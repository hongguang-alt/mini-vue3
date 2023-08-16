// 有限状态机

// 定义状态机的状态
const State = {
  initial: 1, // 初始状态
  tagOpen: 2, // 标签开始
  tagName: 3, // 标签名称状态
  text: 4, // 文本状态
  tagEnd: 5, // 结束标签状态
  tagEndName: 6, // 结束标签名称状态
};

function isAlpha(char) {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

// 接受模板字符串作为参数，并将模板切割为 Token 返回
function tokenize(str) {
  // 状态机的当前状态：初始状态
  let currentState = State.initial;
  // 用于缓存字符
  const chars = [];
  // 生成的 Token 会存储到 tokens 数组中，并作为函数的返回值返回
  const tokens = [];
  while (str) {
    // 查看第一个字符，注意，这里只是查看，并没有消费这个字符
    const char = str[0];
    switch (currentState) {
      case State.initial:
        if (char === "<") {
          // 1.状态机切换到标签开始状态
          currentState = State.tagOpen;
          // 2.消费字符
          str = str.slice(1);
        } else if (isAlpha(char)) {
          // 1.遇到字母，切换到文本状态
          currentState = State.text;
          // 2.将当前字母缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        }
        break;
      case State.tagOpen:
        if (isAlpha(char)) {
          // 1.遇到字母，切换到标签名称状态
          currentState = State.tagName;
          // 2.将字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        } else if (char === "/") {
          //1.遇到 / ，切换到结束标签状态
          currentState = State.tagEnd;
          // 2.消费当前字符
          str = str.slice(1);
        }
        break;
      case State.tagName:
        if (isAlpha(char)) {
          // 1.遇到字母，继续保持标签名称状态
          // 2.将字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        } else if (char === ">") {
          // 1.遇到 > ，切换到初始状态
          currentState = State.initial;
          // 2.生成 Token
          tokens.push({
            type: "tag",
            name: chars.join(""),
          });
          // 3.清空 chars 数组
          chars.length = 0;
          // 4.消费当前字符
          str = str.slice(1);
        }
        break;
      case State.text:
        if (isAlpha(char)) {
          // 1.遇到字母，继续保持文本状态
          // 2.将字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        } else if (char === "<") {
          // 1. 遇到 < ,切换到初始状态
          currentState = State.tagOpen;
          // 2.生成 Token
          tokens.push({
            type: "text",
            value: chars.join(""),
          });
          // 3.清空 chars 数组
          chars.length = 0;
          // 4.消费当前字符
          str = str.slice(1);
        }
        break;
      case State.tagEnd:
        if (isAlpha(char)) {
          // 1.遇到字母，切换到标签结束名称的状态
          currentState = State.tagEndName;
          // 2.将字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        }
        break;
      case State.tagEndName:
        if (isAlpha(char)) {
          // 1.遇到字母，继续保持标签结束名称状态
          // 2.将字符缓存到 chars 数组
          chars.push(char);
          // 3.消费当前字符
          str = str.slice(1);
        } else if (char === ">") {
          // 1.遇到 > ，切换到初始状态
          currentState = State.initial;
          // 2.生成 Token
          tokens.push({
            type: "tagEnd",
            name: chars.join(""),
          });
          chars.length = 0;
          str = str.slice(1);
        }
        break;
    }
  }
  return tokens;
}

// const tokens = tokenize("<div>hello</div>");

function parse(str) {
  // 获取 tokens
  const tokens = tokenize(str);
  const root = {
    type: "Root",
    children: [],
  };
  // 创建 栈
  const elementStack = [root];

  while (tokens.length) {
    const parent = elementStack[elementStack.length - 1];
    const t = tokens[0];
    switch (t.type) {
      case "tag":
        // 如果当前 Token 是开始标签，则创建 Element 类型的 AST 节点
        const elementNode = {
          type: "Element",
          tag: t.name,
          children: [],
        };
        // 将当前节点添加到父节点的 children 中
        parent.children.push(elementNode);
        // 将当前节点压入栈
        elementStack.push(elementNode);
        break;
      case "text":
        // 如果当前 Token 是文本，则创建 Text 类型的 AST 节点
        const textNode = {
          type: "Text",
          content: t.value,
        };
        parent.children.push(textNode);
        break;
      case "tagEnd":
        elementStack.pop();
        break;
    }
    // 消费每一个 token
    tokens.shift();
  }
  return root;
}

function transformRoot(node) {
  return () => {
    if (node.type !== "Root") return;
    const vnodeJsNode = node.children[0].jsNode;
    node.jsNode = {
      type: "FunctionDecl",
      id: { type: "Identifier", name: "render" },
      params: [],
      body: [
        {
          type: "ReturnStatement",
          return: vnodeJsNode,
        },
      ],
    };
  };
}

function transformElement(node) {
  // 将转换代码编写在退出阶段的回调函数中
  // 这样可以保证该标签节点的子节点全部被处理完毕
  return () => {
    if (node.type !== "Element") return;
    // 1.创建 h 函数调用语句
    const callExp = createCallExpression("h", [createStringLiteral(node.tag)]);
    // 2.处理 h 函数调用的参数
    node.children.length === 1
      ? callExp.arguments.push(node.children[0].jsNode)
      : callExp.arguments.push(
          // 数组的每个元素都是子节点的 JsNode
          createArrayExpression(node.children.map((child) => child.jsNode))
        );
    node.jsNode = callExp;
  };
}

function transfromText(node, context) {
  if (node.type !== "Text") return;
  /**
   * 文本节点对应的 JavaScript AST 节点其实就是一个字符串字面量
   * 因此只需要使用 node.content 创建一个 StringLiteral 类型的节点即可
   * 最后将文本节点对应的 JavaScript AST 节点赋值给 node.jsNode 即可
   */
  node.jsNode = createStringLiteral(node.content);
}

// 深度遍历
function traverseNode(node, context) {
  context.currentNode = node;
  const nodeTransforms = context.nodeTransforms;
  // 新增退出阶段的回调函数数组
  const exitFns = [];
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](context.currentNode, context);
    if (onExit) {
      // 将退出节点的回调函数添加到 exitFns 数组中
      exitFns.push(onExit);
    }
    if (!context.currentNode) return;
  }

  const children = context.currentNode.children;
  if (children) {
    children.forEach((child, index) => {
      context.parent = node;
      context.childrenIndex = index;
      traverseNode(child, context);
    });
  }
  // 在节点处理的最后阶段执行缓存到 exitFns 中的回调函数
  // 注意，这里我们要反序执行
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

function transform(ast) {
  const context = {
    currentNode: null,
    parent: null,
    childrenIndex: 0,
    replaceNode(node) {
      context.parent.children[context.childrenIndex] = node;
      context.currentNode = node;
    },
    removeNode() {
      if (context.parent) {
        context.parent.children.splice(context.childrenIndex, 1);
        context.currentNode = null;
      }
    },
    nodeTransforms: [transfromText, transformRoot, transformElement],
  };
  traverseNode(ast, context);
}

function dump(node, indent = 0) {
  const type = node.type;
  const desc =
    type === "Root" ? "" : type === "Element" ? node.tag : node.content;
  console.log(`${"-".repeat(indent)}${type}:${desc}`);
  if (node.children) {
    node.children.forEach((child) => {
      dump(child, indent + 2);
    });
  }
}

// JavaScript AST 的一些方法

// 创建字符串
function createStringLiteral(value) {
  return {
    type: "StringLiteral",
    value,
  };
}

// 创建 变量
function createIdentifier(name) {
  return {
    type: "Identifier",
    name,
  };
}

// 创建数组表达式
function createArrayExpression(elements) {
  return {
    type: "ArrayExpression",
    elements,
  };
}

// 创建函数执行的表达式
function createCallExpression(callee, arguments) {
  return {
    type: "CallExpression",
    callee: createIdentifier(callee),
    arguments,
  };
}

function genNodeList(nodes, context) {
  const { push } = context;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    genNode(node, context);
    if (i < nodes.length - 1) {
      push(",");
    }
  }
}

function genFunctionDecl(node, context) {
  const { push, indent, deIndent } = context;
  push(`function ${node.id.name} `);
  push("(");
  genNodeList(node.params, context);
  push(") ");
  push("{");
  // 缩进
  indent();
  node.body.forEach((node) => {
    genNode(node, context);
  });
  deIndent();
  push("}");
}

function genArrayExpression(node, context) {
  const { push } = context;
  push("[");
  genNodeList(node.elements, context);
  push("]");
}

function genReturnStatement(node, context) {
  const { push } = context;
  push("return ");
  genNode(node.return, context);
}

function genStringLiteral(node, context) {
  const { push } = context;
  push(`"${node.value}"`);
}

function genCallExpression(node, context) {
  const { push } = context;
  push(node.callee.name);
  push("(");
  genNodeList(node.arguments, context);
  push(")");
}

function genNode(node, context) {
  switch (node.type) {
    case "FunctionDecl":
      genFunctionDecl(node, context);
      break;
    case "ReturnStatement":
      genReturnStatement(node, context);
      break;
    case "CallExpression":
      genCallExpression(node, context);
      break;
    case "StringLiteral":
      genStringLiteral(node, context);
      break;
    case "ArrayExpression":
      genArrayExpression(node, context);
      break;
  }
}

// 生成js代码
function generate(node) {
  const context = {
    code: "",
    push(code) {
      context.code += code;
    },
    currentIndent: 0,
    newline() {
      context.code += `\n${" ".repeat(context.currentIndent * 2)}`;
    },
    indent() {
      context.currentIndent++;
      context.newline();
    },
    deIndent() {
      context.currentIndent--;
      context.newline();
    },
  };
  genNode(node, context);

  return context.code;
}

function compile(str) {
  // 解析 AST 树
  const ast = parse(str);
  // 对 AST 树做转换
  transform(ast);
  const code = generate(ast.jsNode);
  console.log(code);
}

const str = "<div><p>Vue</p><p>Template</p></div>";

compile(str);
