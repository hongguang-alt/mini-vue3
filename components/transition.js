const Transition = {
  name: "Transition",
  setup(props, { slots }) {
    return () => {
      const innerVNode = slots.default();

      innerVNode.transition = {
        beforeEnter(el) {
          // 设置初始状态： 添加 enter-from 和 enter-active 类
          el.classList.add("enter-from");
          el.classList.add("enter-active");
        },
        enter(el) {
          // 在下一帧切换到结束状态
          nextFrame(() => {
            // 移除 enter-from 类，添加 enter-to 类
            el.classList.remove("enter-from");
            el.classList.add("enter-to");
            // 监听 transitioned 事件完成收尾工作
            el.addEventListener("transitioned", () => {
              el.classList.remove("enter-to");
              el.classList.remove("enter-active");
            });
          });
        },
        leave(el, performRemove) {
          // 设置离场过度的初始状态：添加 leave-from 和 leave-active 类
          el.classList.add("leave-from");
          el.classList.add("leave-active");

          // 强制 reflow ，使得初始状态生效
          document.body.offsetHeight;

          // 在下一帧修改状态
          nextFrame(() => {
            // 移除 leave-from 类，添加 leave-to 类
            el.classList.remove("leave-from");
            el.classList.add("leave-to");

            // 监听 transitioned 事件完成收尾工作
            el.addEventListener("transitioned", () => {
              el.classList.remove("leave-to");
              el.classList.remove("leave-active");
              // 调用 transition.leave 钩子函数的第二个参数，完成 DOM 元素的卸载
              performRemove();
            });
          });
        },
      };

      return innerVNode;
    };
  },
};
