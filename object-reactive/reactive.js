const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};
// 用于循环的收集依赖参数
const ITERATE_KEY = Symbol();
// 全局变量存储副作用
let activeEffect;
// effect 栈
const effectStack = [];
// 注册对应的副作用函数
const effect = (fn, options = {}) => {
  const effectFn = () => {
    cleanup(effectFn);
    // 当effectFn执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    effectStack.push(effectFn);
    const res = fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  };
  // 函数上增加一个属性
  effectFn.deps = [];
  // 函数上新增一个属性参数
  effectFn.options = options;
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
};

// 响应式逻辑
const bucket = new WeakMap();
// 依赖收集
function track(target, key) {
  if (!activeEffect) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

// 发布订阅
function trigger(target, key, type, newVal) {
  let depsMap = bucket.get(target);
  if (!depsMap) return;
  let effects = depsMap.get(key);
  let iterateEffects = depsMap.get(ITERATE_KEY);
  let effectsToRun = new Set();

  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  // 保证数据未改变的时候，不触发发布,增加和删除需要触发
  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 针对数组的添加
  if (type === TriggerType.ADD && Array.isArray(target)) {
    const lengthEffects = depsMap.get("length");
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  if (Array.isArray(target) && key === "length") {
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }

  effectsToRun &&
    effectsToRun.forEach((effectFn) => {
      if (effectFn.options.scheduler) {
        effectFn.options.scheduler(effectFn);
      } else {
        effectFn();
      }
    });
}

// 清除无用副作用
function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

// 实现计算属性
function computed(getter) {
  let value;
  // 表示是否需要重新计算
  let dirty = true;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      // 当计算属性依赖的响应式数据变化时，手动调用trigger函数触发响应
      trigger(obj, "value");
    },
  });
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      // 当读取value时，手动调用track函数进行追踪
      track(obj, "value");
      return value;
    },
  };
  return obj;
}

function watch(source, cb, options = {}) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  let oldValue, newValue, cleanup;
  const onInvalidate = function (fn) {
    cleanup = fn;
  };
  const job = () => {
    newValue = effectFn();
    // 执行上一个的清除操作
    if (cleanup) {
      cleanup();
    }
    cb(newValue, oldValue, onInvalidate);
    oldValue = newValue;
  };
  const effectFn = effect(getter, {
    lazy: true,
    scheduler: () => {
      if (options.flush === "post") {
        const p = Promise.resolve();
        p.then(job);
      } else {
        job();
      }
    },
  });
  if (options.immediate) {
    job();
  } else {
    // 手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn();
  }
}

function traverse(value, seen = new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const k in value) {
    traverse(value[k], seen);
  }
  return value;
}

function reactive(data) {
  return createReactive(data);
}

function shallowReactive(data) {
  return createReactive(data, true);
}

function readOnly(data) {
  return createReactive(data, true, true);
}

function shallowReadOnly(data) {
  return createReactive(data, false, true);
}
function createReactive(data, isShallow = false, isReadOnly = false) {
  return new Proxy(data, {
    get: function (target, key, receiver) {
      if (key === "raw") {
        return target;
      }
      // 为了防止追踪symbol出现错误
      if (!isReadOnly && typeof key !== "symbol") {
        track(target, key);
      }
      // 通过代理这个对象，最后一个参数相当于this，详情见demo1
      const res = Reflect.get(target, key, receiver);
      if (isShallow) {
        return res;
      }
      if (typeof res === "object" && res !== null) {
        return isReadOnly ? readOnly(res) : reactive(res);
      }
      return res;
    },
    // 针对 in 这种访问的方式，收集依赖
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // 针对 for...in 循环访问的方式，收集依赖
    ownKeys(target) {
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    set: function (target, key, newVal, receiver) {
      if (isReadOnly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const oldVal = target[key];
      const type = Array.isArray(target)
        ? Number(key) < target.length
          ? TriggerType.SET
          : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      const res = Reflect.set(target, key, newVal, receiver);

      if (receiver.raw === target) {
        // 后面主要是针对NaN的这种情况
        if (newVal !== oldVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type, newVal);
        }
      }
      return res;
    },
    // 针对删除操作，收集依赖？会有问题
    deleteProperty(target, key) {
      if (isReadOnly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      // 检查被操作的属性是否是对象自己的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (res && hadKey) {
        trigger(target, key, TriggerType.DELETE);
      }
    },
  });
}
