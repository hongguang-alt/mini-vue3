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
function trigger(target, key) {
  let depsMap = bucket.get(target);
  if (!depsMap) return;
  let effects = depsMap.get(key);
  let effectsToRun = new Set(effects);
  effectsToRun &&
    effectsToRun.forEach((effectFn) => {
      if (activeEffect !== effectFn) {
        if (effectFn.options.scheduler) {
          effectFn.options.scheduler(effectFn);
        } else {
          effectFn();
        }
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

const reactive = (data) => {
  return new Proxy(data, {
    get(target, key) {
      track(target, key);
      return target[key];
    },
    set(target, key, newVal) {
      target[key] = newVal;
      trigger(target, key);
      return true;
    },
  });
};

export { reactive, effect, computed, watch };
