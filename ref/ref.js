// ref其实是对reactive的一个封装
function ref(value) {
  const wrapper = {
    value,
  };
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });
  return reactive(wrapper);
}

/**
 * ...解构方法会丢失响应式，通过toRefs解决
 */

function toRefs(obj) {
  const ret = {};

  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }

  return ret;
}

// 调用这个对象的时候，调用响应式对象的值
// 这里的obj是响应式对象
function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key];
    },
    set value(val) {
      obj[key] = val;
    },
  };

  // 定义是ref的属性
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });
  return wrapper;
}

function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      return value.__v_isRef ? value.value : value;
    },
    set(target, key, newVal, receiver) {
      const value = target[key];
      if (value.__v_isRef) {
        value.value = newVal;
        return true;
      }
      return Reflect.set(target, key, newVal, receiver);
    },
  });
}
