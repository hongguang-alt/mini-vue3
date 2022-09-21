function renderer(vnode, container) {
  const options = {
    createElement(tag) {
      return document.createElement(tag);
    },
    setElementText(el, text) {
      el.textContent = text;
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
  const { createElement, setElementText, insert, patchProps } = options;

  function unmounted(vnode) {
    const parentNode = vnode.el.parentNode;
    if (parentNode) {
      parentNode.removeChild(vnode.el);
    }
  }

  // 更新节点
  function patchElement(preVnode, newVnode) {
    // 为了测试，直接进行覆盖
    let el = preVnode.el;
    // 对于新的节点的props进行更新
    if (newVnode.props) {
      for (const key in newVnode.props) {
        patchProps(el, key, null, newVnode.props[key]);
      }
    }
  }

  function mountElement(vnode, container) {
    const el = (vnode.el = createElement(vnode.type));
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      // 如果是数组，就遍历每一个节点，并且调用patch挂载他们
      vnode.children.forEach((child) => {
        path(null, child, el);
      });
    }

    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key]);
      }
    }

    insert(el, container);
  }
  function path(n1, n2, container) {
    // 如果新旧vnode的类型不同，就直接卸载
    if (n1 && n2.type !== n1.type) {
      unmounted(n1);
      n1 = null;
    }
    const { type } = n2;
    // 正常的标签
    if (typeof type === "string") {
      if (!n1) {
        mountElement(n2, container);
      } else {
        // 做diff的挂载
        patchElement(n1, n2);
      }
    } else if (typeof type === "object") {
      // 这里是对组件做处理
    }
  }
  function render(vnode, container) {
    // 如果有vode，就挂载
    if (vnode) {
      path(container._vnode, vnode, container);
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
