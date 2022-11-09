const keepAlive = {
  // keepAlive 组件独有的属性，用作标识
  _isKeepAlive: true,
  setup(props, { slots }) {
    // 创建一个缓存对象
    // key: vnode.type
    // value: vnode
    const cache = new Map();
    // 当前 KeepAlive 组件的实例
    const instance = currentInstance;
    // 对于 KeepAlive 组件来说，它的实例上存在特殊的 keepAliveCtx 对象，改对象有渲染器注入
    // 该对象会暴露渲染器的一些内部方法，其中 move 函数用来将一段 DOM 移动到另一个容器中
    const { move, createElement } = instance.keepAliveCtx;

    // 创建隐藏容器
    const storageContainer = createElement("div");

    instance._deActivate = (vnode) => {
      move(vnode, storageContainer);
    };

    instance._activate = (vnode, container, anchor) => {
      move(vnode, container, anchor);
    };
  },
};
