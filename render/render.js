// 定序列的递增子序列
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = ((u + v) / 2) | 0;
        if (arr[result[c] < arrI]) {
          u = c + 1;
        } else {
          v = c;
        }
      }

      if (arrI < arr[result[v]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }

  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }

  return result;
}

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

  // 简单 diff 算法
  function patchSimpleChildren(n1, n2, container) {
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
  }

  // 双端 diff 算法
  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;

    let oldStartIdx = 0;
    let oldEndIdx = oldChildren.length - 1;
    let newStartIdx = 0;
    let newEndIdx = newChildren.length - 1;

    let oldStartVnode = oldChildren[oldStartIdx];
    let oldEndVnode = oldChildren[oldEndIdx];
    let newStartVnode = newChildren[newStartIdx];
    let newEndVnode = newChildren[newEndIdx];

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (!oldStartVnode) {
        // 如果头尾部节点为undefined，则说明该节点已经被处理过了，直接跳到下一个位置
        oldStartVnode = oldChildren[++oldStartIdx];
      } else if (oldStartIdx.key === newStartIdx.key) {
        // 打补丁
        patch(oldStartVnode, newStartVnode, container);

        // 更新索引值
        oldStartVnode = oldChildren[++oldStartIdx];
        newStartVnode = newChildren[++newStartIdx];
      } else if (oldEndIdx.key === newEndIdx.key) {
        // 打补丁
        patch(oldEndVnode, newEndVnode, container);
        // 更新索引值
        oldEndIdx = oldChildren[--oldEndIdx];
        newEndIdx = newChildren[--newEndIdx];
      } else if (oldStartIdx.key === newEndIdx.key) {
        // 打补丁
        patch(oldStartVnode, newEndVnode, container);

        // 移动到老的节点的最后一个
        insert(oldStartVnode.el, container, oldEndVnode.el.nextSibling);

        // 更新索引值
        oldStartVnode = oldChildren[++oldStartIdx];
        newEndVnode = newChildren[--newEndIdx];
      } else if (oldEndIdx.key === newStartIdx.key) {
        // 打补丁
        patch(oldEndVnode, newStartVnode, container);

        // 将节点从最后面移动到最上面
        insert(oldEndVnode.el, container, oldStartVnode.el);

        // 移动 dom 完成之后，更新索引值
        oldEndVnode = oldChildren[--oldEndIdx];
        newStartVnode = newChildren[++newStartIdx];
      } else {
        // 递归旧children，视图寻找与 newStartVNode 拥有相同 key 值的元素
        const idxInOld = oldChildren.findIndex(
          (n) => n.key === newStartVnode.key
        );
        // idxInOld 位置对应的 Vnode 就是需要移动的节点
        if (idxInOld > 0) {
          const VNodeToMove = oldChildren[idxInOld];
          // 打补丁
          patch(VNodeToMove, newStartVnode, container);

          // 将 vnodeToMove 移动到头部节点 oldStartVNode.el 之前，因此使用后者作为锚点
          insert(VNodeToMove.el, container, oldStartVnode.el);

          oldChildren[idxInOld] = undefined;
        } else {
          // 将 newStartVNode 作为新节点挂载到头部，使用当前头部节点 oldStartVNode.el 作为锚点
          patch(null, newStartVnode, container, oldStartVnode.el);
        }
        // 更新 newStartIdx 到下一个位置
        newStartVnode = newChildren[++newStartIdx];
      }
    }

    // 循环结束后检查索引值的情况
    if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
      // 如果满足条件，则说明有新的节点遗留，需要挂载它们
      for (let i = newStartIdx; i <= newEndIdx; i++) {
        // 这一步 anchor 不理解，这样的结果不都是 null 么
        const anchor = newChildren[newEndIdx + 1]
          ? newChildren[newEndIdx + 1].el
          : null;
        patch(null, newChildren[i], container, anchor);
      }
    } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
      // 如果满足条件，表明一些节点需要被卸载
      for (let i = oldStartIdx; i <= oldEndIdx; i++) {
        unmounted(oldChildren[i]);
      }
    }
  }

  // 快速 diff 算法
  function patchFastKeyedChildren(n1, n2, container) {
    const newChildren = n2.children;
    const oldChildren = n1.children;

    // 处理相同的前置节点
    let j = 0;
    let oldVNode = oldChildren[j];
    let newVNode = newChildren[j];
    while (oldVNode.key === newVNode.key) {
      // 对于新旧节点进行打补丁
      patch(oldVNode, newVNode, container);
      j++;
      oldVNode = oldChildren[j];
      newVNode = newChildren[j];
    }

    // 处理相同的后置节点
    let oldEnd = oldChildren.length - 1;
    let newEnd = newChildren.length - 1;

    oldVNode = oldChildren[oldEnd];
    newVNode = newChildren[newEnd];

    while (oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container);
      oldEnd--;
      newEnd--;
      oldVNode = oldChildren[oldEnd];
      newVNode = newChildren[newEnd];
    }

    // 预处理完毕后，如果满足 j <= newEnd && j > oldEnd ，则说明 j --> newEnd 节点之间都是新节点
    if (j > oldEnd && j <= newEnd) {
      const anchorIndex = newEnd + 1;
      // 如果锚点的索引超过新节点的长度，那么就是最后一个节点，那么锚点就为 null
      const anchor =
        anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;

      // 对于区间的锚点，以此挂载
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor);
      }
    } else if (j <= oldEnd && j > newEnd) {
      // 如果满足 j > newEnd && j <= oldEnd ，则说明 j--> oldEnd 节点之间都是旧节点，都需要卸载
      while (j <= oldEnd) {
        unmounted(oldChildren[j++]);
      }
    } else {
      const count = newEnd - j + 1;
      const source = new Array(count);
      source.fill(-1);

      const oldStart = j;
      const newStart = j;
      // 新增两个变量， moved 和 pos
      let moved = false;
      let pos = 0;

      // 构建索引表
      const keyIndex = {};
      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i;
      }

      // 新增 patched 变量，代表更新过的节点数量
      let patched = 0;
      // 遍历旧的一组子节点中剩余未处理的节点
      for (let i = oldStart; i <= oldEnd; i++) {
        oldVNode = oldChildren[i];

        if (patched <= count) {
          const k = keyIndex[oldVNode.key];
          if (typeof k !== "undefined") {
            newVNode = newChildren[k];
            // 调用 patch 函数进行打补丁
            patch(oldVNode, newVNode, container);
            // 每更新一个节点，都将 patched 变量 +1
            patched++;
            source[k - newStart] = i;
            // 判断节点是否需要移动
            if (k < pos) {
              moved = true;
            } else {
              pos = k;
            }
          } else {
            // 新节点中不存在，直接卸载
            unmounted(oldVNode);
          }
        } else {
          // 如果更新过的节点数量大于需要更新的节点数量，则卸载多余的节点
          unmounted(oldVNode);
        }
      }
      // 如果需要移动
      if (moved) {
        // 获取最长递增子序列
        const seq = getSequence(source);

        let s = seq.length - 1;
        let i = count - 1;
        for (i; i >= 0; i--) {
          if (source[i] === -1) {
            // 说明索引为 i 的节点是全新的节点，应该将其挂载
            // 该节点在新 children 中的真实位置索引
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            // 该节点的下一个节点的位置索引
            const nextPos = pos + 1;
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            patch(null, newVNode, container, anchor);
          } else if (i !== seq[s]) {
            // 如果节点的索引 i 不等于 seq[i] 的值，说明该节点需要移动
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            insert(newVNode.el, container, anchor);
          } else {
            // 当 i === seq[s] 时，说明该位置的节点不需要移动
            // 并让 s 指向下一个位置
            s--;
          }
        }
      }
    }
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
        // 简单 diff 算法
        // patchSimpleChildren(n1, n2, container);
        // 双端 diff 算法
        // patchKeyedChildren(n1, n2, container);
        // 快速diff算法
        patchFastKeyedChildren(n1, n2, container);
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

  // 调度器
  const queue = new Set();
  // 表示是否正在刷新任务队列
  let isFlushing = false;
  const p = new Promise.resolve();

  function queueJob(job) {
    queue.add(job);
    if (!isFlushing) {
      isFlushing = true;
      p.then(() => {
        try {
          queue.forEach((job) => job());
        } finally {
          isFlushing = false;
          queue.clear = 0;
        }
      });
    }
  }

  // resloveProps 函数用于解析组件 props 和 attrs 数据
  function resloveProps(options, propsData) {
    const props = {};
    const attrs = {};
    // 遍历为组件传递的 props 数据
    for (const key in propsData) {
      if (key in options || key.startsWith("on")) {
        // 如果为组件传递的 props 数据在自身的 props 选项中有定义，则将其视为合法的 props
        props[key] = propsData[key];
      } else {
        // 否则将其作为 attrs
        attrs[key] = propsData[key];
      }
    }
    return [props, attrs];
  }

  // 检测 props 是否发生变化
  function hasPropsChanged(preProps, nextProps) {
    const nextKeys = Object.keys(nextProps);
    // 如果新旧 props 数量变了，则说明有变化
    if (nextKeys.length !== Object.keys(preProps).length) {
      return true;
    }

    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i];
      if (nextProps[key] !== preProps[key]) return true;
    }

    return false;
  }

  // 挂载组件
  function mountComponent(vnode, container, anchor) {
    const componentOptions = vnode.type;
    const {
      render,
      data,
      beforeCreate,
      created,
      beforeMounted,
      mounted,
      beforeUpdate,
      updated,
      props: propsOptions,
      setup,
    } = componentOptions;

    beforeCreate && beforeCreate();

    const state = data ? reactive(data()) : null;

    const [props, attrs] = resloveProps(propsOptions, vnode.props);
    const slots = vnode.children || {};

    // 定义组件实例，一个组件实例本质上就是一个对象，它包含于组件相关的状态信息
    const instance = {
      // 组件自身的状态数据，即data
      state,
      // 将解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
      props: shallowReactive(props),
      // 一个布尔值，用来表示组件是否已经被挂载，初始值为false
      isMounted: false,
      // 组件所渲染的内容，即子树
      subTree: null,
      slots,
    };

    /**
     * 定义 emit 函数，它接收两个参数
     * evnet: 事件名称
     * payload: 传递给事件处理函数的参数
     */
    function emit(event, ...payload) {
      // 根据约定对事件名称进行处理，例如 change => onChange
      const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
      // 根据处理后的事件名称去 props 中寻找对应的事件处理函数
      const handler = instance.props[eventName];
      if (handler) {
        handler(...payload);
      } else {
        console.error("事件不存在");
      }
    }

    const setupContext = { attrs, emit, slots };

    const setupResult = setup(shallowReactive(instance.props), setupContext);

    // setupResult 用来存储由 setup 返回的函数
    let setupState = null;
    // 如果 setup 函数返回的值是函数，则将其作为渲染函数
    if (typeof setupResult === "function") {
      if (render) console.error("setup 函数返回渲染函数,render 选项将被忽略");
      // 将 setupResult 作为渲染函数
      render = setupResult;
    } else {
      // 如果 setup 的返回值不是函数，则作为数据状态赋值给 setupState
      setupState = setupResult;
    }

    // 将组件实例设置到 vnode 上，用于后续更新
    vnode.component = instance;

    // 创建渲染上下文对象，本质上是组件实例的代理
    const renderContext = new Proxy(instance, {
      get(t, k, r) {
        // 获取组件自身状态和 props 数据
        const { state, props, slots } = t;
        if (k === "$slots") return slots;
        // 先尝试读取自身状态数据
        if (state && k in state) {
          return state[key];
        } else if (k in props) {
          return props[k];
        } else if (setupResult && k in setupResult) {
          // 渲染上下文需要增加对 setupState 的支持
          return setupState[key];
        } else {
          console.error("不存在");
        }
      },
      set(t, k, v, r) {
        const { state, props } = t;
        if (state && k in state) {
          state[k] = v;
        } else if (k in props) {
          console.warn(`Attempting to mutate props ${k} . Props are readonly`);
        } else if (setupState && k in setupState) {
          // 渲染上下文需要增加对 setupState 的支持
          setupState[k] = v;
        } else {
          console.error("不存在");
        }
      },
    });

    created && created.call(renderContext);

    effect(
      () => {
        // 执行渲染函数，获取组件要渲染的内容，即 render 函数返回的虚拟 DOM
        const subTree = render.call(state, state);
        if (!instance.isMounted) {
          beforeMounted && beforeMounted.call(renderContext);
          // 初次挂载，调用 patch 函数第一个参数传递 null
          patch(null, subTree, container, anchor);
          // 重点：将组件实例的 isMounted 设置为 true ,这样当更新发生时就不会再次进行挂载操作，而是会执行更新
          instance.isMounted = true;
          mounted && mounted.call(renderContext);
        } else {
          beforeUpdate && beforeUpdate.call(renderContext);
          patch(vnode.subTree, subTree, container, anchor);
          updated && updated.call(renderContext);
        }

        // 更新组件实例的子树
        instance.subTree = subTree;
      },
      {
        scheduler: queueJob,
      }
    );
  }

  // 更新组件
  function patchComponent(n1, n2, anchor) {
    // 获取组件实例，即 n1.component ，同时让 n2.component 也指向组件实例
    const instance = (n2.component = n1.component);
    // 获取当前的 props 数据
    const { props } = instance;
    // 调用 hasPropsChanged 检测为子组件传递的 props 是否发生变化，如果没有变化，则不需要更新
    if (hasPropsChanged(n1.props, n2.props)) {
      // 调用 resloveProps 函数重新获取 props 数据
      const [nextProps] = resloveProps(n2.type.props, n2.props);
      // 更新 props
      for (const k in nextProps) {
        props[k] = nextProps[k];
      }
      // 删除不存在的 props
      for (const k in props) {
        if (!(k in nextProps)) delete props[k];
      }
    }
  }

  // 挂载元素
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
      if (!n1) {
        mountComponent(n2, container, anchor);
      } else {
        patchComponent(n1, n2, anchor);
      }
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
