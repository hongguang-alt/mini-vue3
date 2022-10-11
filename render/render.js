// 定义文本和注释节点的唯一标识
const Text = Symbol();
const Comment = Symbol();
const Fragment = Symbol();

function renderer(vnode, container) {
  const options = {
    createElement(tag) {
      return document.createElement(tag);
    },
    setElementText(el, text) {
      el.textContent = text;
    },
    setText(el, text) {
      el.nodeValue = text;
    },
    createTextNode(text) {
      return document.createTextNode(text);
    },
    insert(el, parent, anchor = null) {
      parent.insertBefore(el, anchor);
    },
    // 处理props
    patchProps(el, key, preValue, nextValue) {
      if (/^on/.test(key)) {
        let name = key.slice(2).toLowerCase();
        let invokers = el._vei || (el._vei = {});
        // 伪造的事件处理函数 invoker
        let invoker = invokers[key];
        if (nextValue) {
          if (!invoker) {
            invoker = el._vei[key] = (e) => {
              // 如果事件发生的时间早于事件处理函数绑定的时间，则不执行事件处理函数
              if (e.timeStamp < invoker.attached) return;
              // 如果是数组的话
              if (Array.isArray(invoker.value)) {
                invoker.value.forEach((fn) => fn(e));
              } else {
                invoker.value(e);
              }
            };
            invoker.value = nextValue;
            // 使用高精度时间
            invoker.attached = performance.now();
            // 添加 invoker
            el.addEventListener(name, invoker);
          } else {
            invoker.value = nextValue;
          }
        } else if (invoker) {
          el.removeEventListener(name, invoker);
        }
      }
      // 这里设置class的时候，className比setAttribute的性能更加的优越
      else if (key === "class") {
        el.className = nextValue || "";
      } else if (shouldSetAsProps(el, key, nextValue)) {
        const type = typeof el[key];
        if (type === "boolean" && nextValue === "") {
          el[key] = true;
        } else {
          el[key] = nextValue;
        }
      } else {
        el.setAttribute(key, nextValue);
      }
    },
  };
  const render = createRenderer(options);
  render.render(vnode, container);
}

function createRenderer(options) {
  const {
    createElement,
    setElementText,
    insert,
    patchProps,
    setText,
    createTextNode,
  } = options;

  function unmounted(vnode) {
    if (vnode.type === Fragment) {
      vnode.children.forEach((c) => unmounted(c));
      return;
    }
    const parentNode = vnode.el.parentNode;
    if (parentNode) {
      parentNode.removeChild(vnode.el);
    }
  }

  // 更新节点
  function patchElement(n1, n2) {
    const el = (n2.el = n1.el);
    const oldProps = n1.props;
    const newProps = n2.props;
    for (const key in newProps) {
      // 如果新的属性不在旧的属性之中
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key]);
      }
    }

    // 删除一些旧的属性，使用的是设置为null，而不是直接清空
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null);
      }
    }

    // 更新children
    patchChildren(n1, n2, el);
  }

  // 更新children
  function patchChildren(n1, n2, container) {
    if (typeof n2.children === "string") {
      // 旧节点的类型，如果是数组的话，遍历，卸载，如果为空或者为string类型，就直接设置文本就行了
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmounted(c));
      }
      // 最后将新的文本节点内容设置给容器元素
      setElementText(container, n2.children);
    } else if (Array.isArray(n2.children)) {
      if (Array.isArray(n1.children)) {
        // 涉及到diff算法
        // 临时处理，先全都卸载，然后再全部挂载
        // n1.children.forEach((c) => unmounted(c));
        // n2.children.forEach((c) => patchChildren(null, c, container));

        const oldChildren = n1.children;
        const newChildren = n2.children;

        let lastIndex = 0;
        // 逐层遍历节点
        for (let i = 0; i < newChildren.length; i++) {
          let find = false;
          let newVnode = newChildren[i];
          for (let j = 0; j < oldChildren.length; j++) {
            let oldVnode = oldChildren[j];
            if (newVnode.key === oldVnode.key) {
              find = true;
              patch(oldVnode, newVnode, container);

              if (j < lastIndex) {
                // 获取上一个vnode的节点信息
                let preVnode = newChildren[i - 1];
                // 如果上一个节点不存在，则表明是第一个节点，不需要移动
                if (preVnode) {
                  let anchor = preVnode.el.nextSibling;
                  insert(newVnode.el, container, anchor);
                }
              } else {
                lastIndex = j;
              }
              break;
            }
          }
          if (!find) {
            // 说明当前 newVnode 没有在旧的一组子节点中找到可复用的节点
            // 也就是说，当前 newVnode 是一个新增节点，需要挂载
            const preVnode = newChildren[i - 1];
            let anchor = null;
            if (preVnode) {
              anchor = preVnode.el.nextSibling;
            } else {
              anchor = container.firstChild;
            }

            patch(null, newVnode, container, anchor);
          }
        }

        // 遍历旧的一组子节点
        for (let i = 0; i < oldChildren.length; i++) {
          const oldVnode = oldChildren[i];

          const has = newChildren.find((vnode) => vnode.key === oldVnode.key);
          if (!has) {
            unmounted(oldVnode);
          }
        }
      } else {
        // 旧节点可能是文本节点，也有可能是空（null）
        setElementText(container, null);
        // 将新的一组节点进行挂载
        n2.children.forEach((c) => patch(null, c, container));
      }
    } else {
      // 新节点不存在
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmounted(c));
      } else if (typeof n1.child === "string") {
        setElementText(container, "");
      }
    }
  }

  function mountElement(vnode, container, anchor) {
    const el = (vnode.el = createElement(vnode.type));
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      // 如果是数组，就遍历每一个节点，并且调用patch挂载他们
      vnode.children.forEach((child) => {
        patch(null, child, el);
      });
    }

    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key]);
      }
    }

    insert(el, container, anchor);
  }
  function patch(n1, n2, container, anchor) {
    // 如果新旧vnode的类型不同，就直接卸载
    if (n1 && n2.type !== n1.type) {
      unmounted(n1);
      n1 = null;
    }
    const { type } = n2;
    // 正常的标签
    if (typeof type === "string") {
      if (!n1) {
        mountElement(n2, container, anchor);
      } else {
        // 做diff的挂载
        patchElement(n1, n2);
      }
    } else if (type === Text) {
      // 文本节点
      if (!n1) {
        const el = (n2.el = createTextNode(n2.children));
        insert(el, container);
      } else {
        const el = (n2.el = n1.el);
        if (n2.children !== n1.children) {
          setText(el, n2.children);
        }
      }
    } else if (type === Fragment) {
      // Fragment 节点
      if (!n1) {
        // 如果旧的 vnode 不存在，则只需要将 Fragment 的 children 逐个挂载
        n2.children.forEach((c) => patch(null, c, container));
      } else {
        // 如果旧的 vnode 存在，则更新 Fragment 的 children 就可以
        patchChildren(n1, n2, container);
      }
    } else if (typeof type === "object") {
      // 这里是对组件做处理
    }
  }
  function render(vnode, container) {
    // 如果有vode，就挂载
    if (vnode) {
      patch(container._vnode, vnode, container);
    } else {
      // 如果没有vnode，查看之前的vode，并且走卸载逻辑
      if (container._vnode) {
        unmounted(container._vnode);
      }
    }
    container._vnode = vnode;
  }

  return {
    render,
  };
}

// utils
function shouldSetAsProps(el, key, value) {
  if (key === "form" && el.tagName === "INPUT") return false;
  return key in el;
}
