const Teleport = {
  _isTeleport: true,
  process(n1, n2, container, anchor, internals) {
    // 在这里处理渲染逻辑
    // 通过 internals 参数获取渲染器的内部方法
    const { patch, patchChildren, move } = internals;
    // 如果旧 VNode n1 不存在，则是全新的挂载，否则执行更新
    if (!n1) {
      const target =
        typeof n2.props.to === "string"
          ? document.querySelector(n2.props.to)
          : n2.props.to;
      n2.children.forEach((c) => patch(null, c, target, anchor));
    } else {
      patchChildren(n1, n2, container);
      if (n2.props.to !== n1.props.to) {
        // 获取新的容器
        const newTarget =
          typeof n2.props.to === "string"
            ? document.querySelector(n2.props.to)
            : n2.props.to;
        // 创建新容器
        n2.children.forEach((c) => move(c, newTarget));
      }
    }
  },
};
