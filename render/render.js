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
  };
  const render = createRenderer(options);
  render.render(vnode, container);
}

function createRenderer(options) {
  const { createElement, setElementText, insert } = options;

  function mountElement(vnode, container) {
    const el = createElement(vnode.type);
    if (typeof vnode.children === "string") {
      setElementText(el, vnode.children);
    }
    insert(el, container);
  }
  function path(n1, n2, container) {
    if (!n1) {
      mountElement(n2, container);
    }
  }
  function render(vnode, container) {
    if (vnode) {
      path(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        container.innerHTML = "";
      }
    }
    container._vnode = vnode;
  }

  return {
    render,
  };
}
