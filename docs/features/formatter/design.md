# 设计：语法层解析与格式化器（formatter）

> 状态：**设计定稿，未开工** · 进度：[implementation-plan.md](./implementation-plan.md)  
> 服务对象：VSCode 插件 vscode-tason（已以 git submodule 嵌入本仓库 `extensions/vscode-tason`，源仓库 GitHub: `vscode-extension-tason`）的「格式化文档」能力。

---

## 0. 锁定架构

```
┌────────────────────────────────────────────┐
│ VSCode 插件 vscode-tason（对端仓库）          │
│ DocumentFormattingEditProvider               │
│ 只做壳：取全文 → 调 formatTASON → 回 TextEdit   │
└───────────────────┬────────────────────────┘
                    │ npm 依赖 tason（子入口 tason/syntax）
┌───────────────────▼────────────────────────┐
│ 核心包 tason（本 feature）                     │
│ src/syntax/                                   │
│ · parseSyntax：文本 → AST + 诊断 + 注释表       │
│   （不查 Registry、不构造运行时值）               │
│ · formatTASON：按格式化配置整体重排生成规范文本    │
│ · 共用 TASON.g4 与 grammar/ 生成物              │
└──────────────────────────────────────────────┘
```

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| 核心包 `src/syntax/` | 语法层 AST、诊断收集、格式化选项与生成算法、`tason/syntax` 子入口 | 值级 `parse` / `stringify` 的任何语义 |
| VSCode 插件 | provider 注册、配置映射、TextEdit、语法错误提示 | 内置第二套 TASON 语法（parser / 词法规则 / 语法高亮驱动的格式判定） |
| 值级 `TASONSerializer` | 照旧 | 不感知格式化的存在 |

**格式化模型定稿：整体重生成（regeneration）。** 格式化不是对原文的局部修补，而是「解析 → 按选项从 AST 重新打印整篇文本」。空白、换行、缩进一律由打印器按配置生成；字符串引号、转义形态、数值字面量的规范化都经选项控制。验收口径因此从「逐字符保真」改为**不丢失可见信息**（§3.1）。

**为什么实现放核心包而不是插件里自写 parser：** TASON 语法的唯一真相源是 `TASON.g4`（JSON5 风格细节、数字进制、字符串转义、尾逗号……）。格式化**继续复用现有 ANTLR 解析**（同一 lexer / parser 生成物，语法层只是它的第二个消费者）；插件自建 parser 必然与核心语法漂移，而 formatter 输出的文本必须仍能被核心 `parse` 接受。

---

## 1. 问题：值级反序列化当不了 formatter 的底座

| # | 现状（值级 parse 路径） | formatter 需要 | 位置 |
| --- | --- | --- | --- |
| 1 | TypeInstance 一律 `resolveTypeInfo` → `getDefaultType`，未注册 TypeName 抛 `Unregistered type`；且 `registry.createInstance` 会真的构造实例 | 接受**任意** IDENTIFIER 作 TypeName——插件不可能预知用户应用注册了哪些类型 | `TASONVisitor.ts` |
| 2 | 注释在 lexer `-> skip` 直接丢弃 | 行注释与块注释都要识别并保留（整体重生成下这是唯一必须抢救的旁路信息） | `TASON.g4` |
| 3 | `ThrowingErrorListener` 在首个语法错误即 throw | 收集诊断；失败时优雅返回原文，不打断编辑 | `TASONSerializer.ts` |
| 4 | 数字经 `new Decimal(n).toNumber()` 归一为 JS number；字符串 unescape 成值 | 语法树要保留字面量**源文本**（进制、指数/普通形态、引号统计），作为重生成与「自动检测」选项的输入 | `TASONVisitor` / `TASONGenerator` |

结论：TASON 文本的**语法本身完全自描述**（TypeName 只是 IDENTIFIER token，Scalar / ObjectType 只看参数形态），需要 Registry 的是**值级解释**（选实现、构造实例、Number Handling 装拆箱）。格式化只需要「语法 + 字面量源文本 + 注释」，因此新增一层**语法层解析（syntax parse）**，与值级路径并列、共用 grammar。

**C# 侧核查：** `tason-net` 亦只有值级 visitor（已检索，无 formatter / 语法层对应物）。本 feature 是 JS 侧新增的纯文本层能力，无 C# 对齐义务；若日后 C# 侧做 formatter，可回头对齐 AST 形状。

---

## 2. 语法层解析（parseSyntax）

### 2.1 模块边界

- 新目录 `packages/tason/src/syntax/`：`ast.ts`（节点模型）、`parseSyntax.ts`（入口 + 诊断收集）、`format/`（格式化器与选项）。
- **禁止 import**：`TASONTypeRegistry`、`types/`（见下文例外）、`schema/`、`metadata/`。即不注册、不查询任何内置类型，调用零类型副作用。
- 允许 import：`grammar/` 生成物与 `antlr4` runtime。
- **例外——数值 TypeName 名单：** formatter 的 `optimizeNumberTypeInstances`（§3.3.2）要识别内置数值 TypeInstance，而名单 `NUMBER_TYPE_NAMES` 现居 `types/NumberHandling.ts`（import 了 decimal.js 与包装类）。把**名单常量**抽到无依赖叶子模块（如 `src/typeNames.ts`），`types/NumberHandling.ts` 改为从那里 import 并 re-export 保持兼容。单一真相源不破坏，语法层也不被值级依赖图污染。
- 值级 `TASONSerializer.parse` 不改。语法层是**并列新函数**，不是 `parse` 的选项分支——`TASONSerializer` 构造即注册全部内置类型，语法层必须摆脱这层依赖才能走 `tason/syntax` 子入口（§4）。

### 2.2 AST 模型

不直接暴露 ANTLR parse tree：context 类是生成物、形状随 grammar 漂移、还拖着整个 antlr4 类型面。TASON 文本是 JS 的真子集（100% 合法 JS 表达式），节点模型**参考 Babel（`@babel/parser`）的类型设计适配并简化**：`type` 字段判别、`start` / `end` 半开区间偏移、字面量带 `raw`、注释是独立小节点。定义自有序（plain serializable）的小节点模型：

```ts
/** 值位置的节点；判别字段为 type（Babel / estree 惯例） */
type TASONExpression =
  | ObjectExpression
  | ArrayExpression
  | StringLiteral
  | NumericLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | TypeInstance;               // TASON 独有，Babel 无对应

interface ObjectExpression {
  type: "ObjectExpression"; start: number; end: number;
  properties: ObjectProperty[];
}

interface ObjectProperty {
  type: "ObjectProperty"; start: number; end: number;
  key: Identifier | StringLiteral;   // 裸 key → Identifier；带引号 key → StringLiteral
  value: TASONExpression;
}

interface ArrayExpression {
  type: "ArrayExpression"; start: number; end: number;
  elements: TASONExpression[];
}

interface StringLiteral {
  type: "StringLiteral"; start: number; end: number;
  value: string;      // 解码后的字符串值
  raw: string;        // 原文形态，含定界引号（同 Babel）；raw[0] 即引号字符
}

interface NumericLiteral {
  type: "NumericLiteral"; start: number; end: number;
  sign?: "+" | "-";   // number 规则的 SYMBOL?，NaN / Infinity 前的符号同此
  raw: string;        // NUMBER / 'NaN' / 'Infinity' token 原文（进制、指数形态）
}

interface BooleanLiteral {
  type: "BooleanLiteral"; start: number; end: number;
  value: boolean;
}

interface NullLiteral {
  type: "NullLiteral"; start: number; end: number;
}

interface Identifier {
  type: "Identifier"; start: number; end: number;
  name: string;
}

/** TypeName(arg)：ScalarTypeInstance / ObjectTypeInstance 的共同形态 */
interface TypeInstance {
  type: "TypeInstance"; start: number; end: number;
  typeName: Identifier;                       // 类型名（TASON 规范表述；词法层面任意 IDENTIFIER）
  argument: StringLiteral | ObjectExpression; // 嵌套子节点即普通节点，与别处无区别
}

/** 注释节点：对齐 Babel 的 CommentBlock / CommentLine（同为独立小节点） */
type TASONComment = CommentBlock | CommentLine;

interface CommentBlock {
  type: "CommentBlock"; start: number; end: number;
  value: string;   // 剥掉 /* 与 */ 定界后的内部文本，原样保留（JSDoc 的第二个 * 属于 value）
}

interface CommentLine {
  type: "CommentLine"; start: number; end: number;
  value: string;   // 剥掉 // 定界后的文本，原样保留（含前导空格）
}
```

与 Babel 的映射与简化（TASON 无方法、展开、洞、运算符、模板串，一律不设对应字段）：

| TASON 语法 | Babel 对应 | 本设计 | 简化点 |
| --- | --- | --- | --- |
| `object` / `pair` / `array` | `ObjectExpression` / `ObjectProperty` / `ArrayExpression` | 同名 | 无 computed / shorthand / method / spread / hole，字段只剩 key / value / properties / elements |
| `STRING` | `StringLiteral` | 同名（`value` + `raw`） | 同 Babel：`raw` 含定界引号；不设 `quote` 字段，引号字符取 `raw[0]` |
| `number` 规则（`SYMBOL? (NUMBER \| NaN \| Infinity)`） | `NumericLiteral` + `Identifier`（NaN / Infinity）+ `UnaryExpression`（符号） | **并入单一 `NumericLiteral`**（`sign?` + `raw`） | 符号不设 UnaryExpression 包装；**不做数值求值**（无 value 字段，大数 / 高精度安全） |
| `true` / `false` / `null` | `BooleanLiteral` / `NullLiteral` | 同名 | — |
| 裸 key、TypeName | `Identifier` | 同名 | — |
| `TypeName(arg)` | （形似 `CallExpression`） | **`TypeInstance`（独有）** | `typeName` + 单 `argument`（callee 的 Babel 说法改为 TASON 规范表述 typeName）；argument 用普通 StringLiteral / ObjectExpression，嵌套子类型不设专形；scalar / object 形态由 `argument.type` 推导，不设 `form` 字段 |

设计要点：

- **`raw` 是重生成的输入，不是输出承诺**：NumericLiteral 的 `sign` + `raw`（进制、指数形态）供默认原样输出与 `optimizeNumbers` 规范化（§3.3.2）；StringLiteral 的 `raw` 供引号统计（`singleQuote: "auto"` 按 `raw[0]` 计数），`value` 供解码重转义（§3.2）。
- **字面量不求值**：NumericLiteral 不计算 JS 数值——语法层不需要知道 `0x1F` 等于多少，也避免大数 / 精度损失；StringLiteral 的 `value` 是解码字符串，无此问题。
- `Identifier` 只出现在 key 与 `TypeInstance.typeName`，值位置没有裸标识符——NaN / Infinity 按 number 语法规则归入 `NumericLiteral`（这二者在 Babel 里是 Identifier，此处并入是对齐 grammar 的简化）。
- `start` / `end`（半开区间、字符偏移）服务于注释归属（§3.4）与未来的语言工具（hover / 校验 / 跳转），是 `parseSyntax` 的公开承诺之一；不设 Babel 的 `loc` 行列——诊断自带 line / column，需要者按偏移换算。

### 2.3 API

```ts
interface SyntaxDiagnostic {
  message: string;
  offset: number;   // 字符偏移
  line: number;     // 0-based，与 VSCode 一致
  column: number;   // 0-based
}

interface SyntaxParseResult {
  ast: TASONExpression | null;   // 完全不可解析时为 null
  comments: TASONComment[];      // 全部行注释与块注释，按出现序（≈ Babel File.comments 的平铺位）
  diagnostics: SyntaxDiagnostic[];
}

export function parseSyntax(text: string): SyntaxParseResult;
```

### 2.4 错误策略

- lexer / parser 各挂**收集型** ErrorListener（不 throw）；`INVALID_CHAR` 词法动作里的 throw 在入口捕获后转诊断。
- ANTLR parser 自带 error recovery（删 / 插 token 恢复），收集模式下让它跑完，通常仍能得到部分树；树中的 ErrorNode 子树由 formatter 原样保留原文（§3.5，后续阶段才启用）。
- **formatter 的 MVP 策略：diagnostics 非空 → 不格式化**（返回原文），插件据此提示「存在语法错误」。部分容错格式化是后续独立增强，不是首发门槛。

### 2.5 grammar 变更：注释进隐藏通道

```diff
 WS: [ \t\n\r]+ -> skip;
-SINGLE_LINE_COMMENT: '//' ~[\r\n]* -> skip;
-MULTI_LINE_COMMENT: '/*' .*? '*/' -> skip;
+SINGLE_LINE_COMMENT: '//' ~[\r\n]* -> channel(HIDDEN);
+MULTI_LINE_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);
```

- `WS` 维持 skip：输出空白完全由打印器按配置生成；注释归属判定用「换行存在性」（可直接从原文按 offset 判断），不需要 WS token。
- **影响评估**：HIDDEN 通道 token 不进 parse tree，`ParserRuleContext.getText()` 只拼接树内终结符 → 值级 parse / stringify 行为不变。改后 `yarn generate`，并跑全量核心测试（至少 `number-handling`、`runtime-schema`、`multi-implementation`，加 `parse*` / `stringify*`）。
- 注释**不进** AST 节点字段、不做 Babel 式附着（`leadingComments` / `trailingComments` / `innerComments`）：以独立 `comments` 平铺列表 + `start` / `end` 输出，归属规则是 formatter 的职责（§3.4）。这样「只想要语法树」的调用方（未来 LSP 能力）不被强制接受一套注释附着模型。

---

## 3. 格式化器（formatTASON）

### 3.1 不变量（验收硬标准）

1. **幂等**：`formatTASON(formatTASON(x).text).text === formatTASON(x).text`。
2. **语义保真**：任何 Registry 配置下 `serializer.parse(formatTASON(x).text)` 与 `serializer.parse(x)` 值相等——不增删 pair、不改 TypeName、数值同进制同值（唯一例外：`-0` 按 §3.3.2 优化为 `0`，`Number(-0) === 0`；语义保真测试对 `-0` / `0` 用宽松比较，不用 `Object.is`）、字符串解码值不变。
3. **可见信息不丢失**：源文的全部语义内容（值、结构、TypeName）与**每一条注释**都出现在输出中。允许且仅允许以下重写：空白 / 换行 / 缩进、引号字符与转义形态（按 `singleQuote`）、数值字面量的等值规范化（按 `optimizeNumbers`）、key 去引号（按 `quoteKeys`）、尾逗号增删。
4. **注释零丢失**：行注释与块注释均保留，**文字内容**不丢失（§3.4 决定位置）。块注释的装饰性空白与行首 `*` 前缀允许按 `optimizeBlockComments`（§3.3.5）重排，视为风格而非内容。
5. 输出由 **AST + 选项** 决定；`"auto"` 检测选项（§3.3.3）的输入是源文统计量。格式化输出自身风格一致（统一缩进、统一引号），对输出重跑检测得到相同结论 → 幂等在 `"auto"` 下仍成立。

顺带一个对实现友好的语法事实：STRING 的 `SAFE_CHAR_*` 排除了 `\u0000-\u001F`，字符串字面量**不含裸换行**，单行宽度测量始终良定义。

### 3.2 风格规则（默认风格定稿）

| 项 | 规则 |
| --- | --- |
| 缩进 | `useTabs` + `tabWidth`：默认 2 空格；`"auto"` 时检测原文档缩进（§3.3.3） |
| 行宽 | `printWidth` 默认 80 |
| 容器展开 | object / array / ObjectTypeInstance 的 object 参数各为一个 group：平铺宽度 ≤ printWidth 且**无强制换行元素** → 单行；否则逐元素展开。嵌套 group 独立判定 |
| 强制换行元素 | own-line 注释、容器内的行注释（块注释可留行内：`Int64("1" /* c */)`） |
| 空容器 | `{}` / `[]` / `Name({})` 恒单行（内有 dangling 注释除外） |
| 逗号 | 多行容器写尾逗号（`trailingComma: "all"` 默认；`"none"` 可选）；单行容器无尾逗号 |
| 冒号 | `key: value` 冒号后一空格；单行对象花括号内侧各一空格 `{ a: 1, b: 2 }` |
| TypeInstance | `Name(arg)`：名字与 `(`、`(` 与参数之间无空格；object 参数按容器规则展开为 `User({\n  …\n})` |
| 字符串 | 按 `singleQuote` 选引号（默认双引号）；解码后按目标引号做**必要转义**（目标引号、反斜杠、控制字符——短名 `\n` `\t` 等优先，其余控制字符用 `\xXX` 短形态；合法代理对原样输出，**未配对代理项以 `\uXXXX` 输出**保证结果为合法 Unicode），不再保留原转义形态 |
| key 写法 | `quoteKeys: "as-needed"`（默认）：string key 尽可能去引号，去不掉的保留（规则与黑名单见 §3.3.4）；`"preserve"` 保持原文形态（identifier 仍是 identifier，string 仍是 string，引号随 `singleQuote` 变） |
| 数值（优化关闭，默认） | `sign` + raw 原样输出（`SYMBOL` 与数字 token 之间的空白自然消失：`- 5` → `-5`） |
| 数值（`optimizeNumbers` 开启） | 等值规范化，规则见 §3.3.2 |

MVP 打印器：递归 + 「平铺测宽、放不下则展开」的二态 group 判定，不引入完整 Wadler / Prettier doc algebra。判定函数内部化；后续如需更丰富断行语义再演进，公开 API 不变。

### 3.3 格式化选项（命名对齐 Prettier）

#### 3.3.1 选项清单

```ts
interface TASONFormatOptions {
  /** 缩进宽度；默认 2。"auto" 检测原文档缩进单元 */
  tabWidth?: number | "auto";
  /** 是否用 tab 缩进；默认 false（空格）。 */
  useTabs?: boolean | "auto";
  /** 单行宽度上限；默认 80 */
  printWidth?: number;
  /** 字符串用单引号；默认 false（双引号）。 */
  singleQuote?: boolean | "auto";
  /** object key 尽可能去引号；默认 "as-needed" */
  quoteKeys?: "as-needed" | "preserve";
  /** 多行容器尾逗号；默认 "all"（添加） */
  trailingComma?: "all" | "none";
  /** 数值字面量等值规范化；默认 false（原样输出）。首版不实现，传 true 视为 false */
  optimizeNumbers?: boolean;
  /** 数值优化扩展到内置数值 TypeName 的 Scalar 参数字符串；默认 false。
      仅在 optimizeNumbers 开启时生效。首版不实现，传 true 视为 false */
  optimizeNumberTypeInstances?: boolean;
  /** 块注释按 JS 风格规范化；默认 false（注释原样搬运）。首版不实现，传 true 视为 false */
  optimizeBlockComments?: boolean;
  /** 换行符；默认 "lf"。插件侧传文档 EOL */
  endOfLine?: "lf" | "crlf";
}

interface FormatResult {
  text: string;             // diagnostics 非空时 === 输入原文
  diagnostics: SyntaxDiagnostic[];
}

export function formatTASON(text: string, options?: TASONFormatOptions): FormatResult;
```

`formatTASON` 内部即 `parseSyntax` + 打印；已持有 `SyntaxParseResult` 的调用方（未来 LSP）可复用解析结果，打印器以内部函数形态同时导出给两种入口。

> **首版范围**：仅严格模式（`diagnostics` 非空即返回原文，§2.4）；`optimizeNumbers` / `optimizeNumberTypeInstances` / `optimizeBlockComments` 三个选项**预留但不实现**——传入 `true` 一律按 `false` 处理（§3.3.2 / §3.3.5 为后续版本的既定设计，配置文件可先写好）。其余选项首版全部实现。

#### 3.3.2 数值优化规则（`optimizeNumbers`）

> 首版不实施（选项视为 `false`）；本节规则为后续版本定稿。首版数值 raw 原样输出（仅压缩 `SYMBOL` 与数字 token 间空白）。

目标序：**尽可能优化成兼容 JSON 的格式；JSON 表达不了时退为 JS 字面量的规范形式；全程保留原有进制，不强制转 10 进制。**

| 输入类别 | 规则 | 示例 |
| --- | --- | --- |
| 十进制普通形式 | 去冗余：前导 `+`、前后导零、前导点补零、尾点；`-0` 规范化为 `0`（负零不保留，`Number(-0) === 0`） | `+5`→`5`、`.5`→`0.5`、`12.`→`12`、`1.50`→`1.5`、`-0`→`0` |
| 十进制指数形式 | 等值最短候选（普通 / 指数）取短者，平手取普通形式；指数 `e` 小写、去指数冗余 `+`/零 | `1.23e5`→`123000`、`2.5e-4`→`2.5e-4`、`1E+3`→`1e3`、`5e0`→`5` |
| 十六 / 八 / 二进制 | 保持进制，仅规范化：前缀小写（`0x`/`0o`/`0b`）、进制字母小写、去冗余前导零 | `0X1F`→`0x1f`、`0o007`→`0o7`、`0b0011`→`0b11` |
| `NaN` / `±Infinity` | JSON 无法表达 → 按 JS 字面量形态保留，仅去符号与词之间的空白 | `- Infinity`→`-Infinity` |

实现约束：

- **精确重排**：十进制用 decimal.js、进制转换用 BigInt，按字面量的精确值计算；**不经 JS `number` 往返**（对齐 glossary「字面量含义、安全整数不静默截断」）。大指数场景下「最短候选」天然避免病态展开（`1e100` 不会展开成 101 位数字）。
- 输出必须是合法 NUMBER token（重新 lex 验证）。
- **`optimizeNumberTypeInstances`**：名单来自 `NUMBER_TYPE_NAMES`（§2.1 叶子模块）。仅当 Scalar 参数字符串**整体**恰为合法 TASON 数值字面量时按上表优化，否则原样（数值 TypeName 的参数不是纯数字形态时不冒险）。优化后必须仍被对应内置实现解析为相同值——测试对全部名单类型断言往返相等。

#### 3.3.3 自动检测（`"auto"`）

三个检测全部为**确定性统计规则**，输入只用源文，可表格驱动测试：

| 选项 | 检测规则 | 兜底 |
| --- | --- | --- |
| `singleQuote: "auto"` | 统计源文全部 STRING token（含 string key）的引号字符，按 token 个数严格多数定单 / 双 | 平手或无字符串 → 双引号 |
| `useTabs: "auto"` | 统计有前导缩进的行（注释行计入）：tab 起头 vs 空格起头，多数获胜 | 平手或无缩进行 → false（空格） |
| `tabWidth: "auto"` | 候选 `{1,2,4,6,8}`；对每个 w 统计「前导空格数为 w 的正整数倍」的行数为支持度，取最高，**平手取较大 w**（w=1 整除一切缩进，取较小会退化成恒为 1；全 4 空格文档应检测为 4） | 无缩进行 → 2 |

检测在格式化输出上重跑得到相同结论（输出风格统一：单一引号、一致缩进单元）——这是 §3.1 幂等在第 5 条的成立依据。

### 3.3.4 key 引号简化（`quoteKeys`）

默认 `"as-needed"`：**尽可能**把 string key 简化为 identifier 写法。

| 项 | 规则 |
| --- | --- |
| 判定对象 | key 的**解码后完整值**（不是 raw——`"\u0061bc"` 解码为 `abc` 后同样可去引号） |
| 去引号条件 | 解码值**整个**匹配 IDENTIFIER 词法 `[a-zA-Z_][a-zA-Z0-9_]*`，**且**不在保留字黑名单 |
| 黑名单 | `{ true, false, null, NaN, Infinity }`。`true/false/null` 有先于 IDENTIFIER 的专属 lexer 规则；`NaN/Infinity` 是 parser 规则里字面量引用生成的 ANTLR 隐式 token，同样优先于 IDENTIFIER——这些词裸写在 key 位置会直接语法错误（已由核心 `parse.test.ts`「保留字 key」用例钉死）。**宁多勿少**，大小写敏感 |
| 去不掉的 | 空串、含非标识符字符（`"a-b"`、`"1x"`、`"a b"`）、黑名单词——保留引号，引号字符随 `singleQuote` |
| identifier key | 不受影响，原样保持 identifier |
| `"preserve"` | 保持原文形态：string key 仍是 string（引号随 `singleQuote` 变），不做去引号 |

- 语义保真不受影响：`"foo"` 与 `foo` 是同一个 key 字符串（§3.1 第 2 条）。
- 幂等：`as-needed` 输出后，key 二态稳定——能去引号的已是 identifier（重跑仍 identifier），去不掉的仍匹配失败（重跑仍带引号）。
- 与 `singleQuote` 的交互只影响**去不掉**的 key：`{ "a-b": 1 }` 在 `singleQuote: true` 下输出 `{ 'a-b': 1 }`。

### 3.3.5 块注释优化（`optimizeBlockComments`）

> 首版不实施（选项视为 `false`）；本节规则为后续版本定稿。首版块注释 value 原样搬运（重拼定界符）。注意：**首版仍包含 g4 注释通道变更**（§2.5）——注释的收集与保留不依赖本节优化。

默认 `false`：关闭时块注释按 value 原样搬运（§3.4）。开启后按 JS 风格规范化；行注释（`//`）不受影响。单行 / 多行以 `CommentBlock.value`（§2.2，已剥定界符）是否含换行判定：

| 内容形态 | 输出 |
| --- | --- |
| 单行 | `/* 内容 */`——`/*` 与内容、内容与 `*/` 之间各一空格 |
| 多行 | 首行 `/* 内容`；后续每行缩进对齐到开头 `/*` 所在列，行首 `*`；内容无前导空格时 `*` 后补一个空格，内容自带前导空格时原样跟在 `*` 后；`*/` 单独一行 |

```
/* 注释内容
 * 注释第二行
 * 更多注释
 */
```

**实现：纯字符串小型解析器，不需要 ANTLR**（块注释结构太简单，不值得进 grammar / token 层）：

1. 输入即 `CommentBlock.value`（§2.2，`parseSyntax` 已剥定界符），无需再剥。
2. 识别 JSDoc：`value` 以 `*` **紧跟开头**（无空格隔开）视为 JSDoc 标记，保留（输出仍以 `/**` 起），不算内容。
3. 按行 split，逐行**判定内容**——所有形态的右端一律裁到**行末最后一个非空白字符**（尾随空白丢弃）：
   - **空白行**（空或仅空白字符）→ 内容判定为**空**；
   - **无 `*` 的行** → 行首空白**全部视为缩进**，内容 = 第一个非空白字符起，到行末最后一个非空白字符。首行（剥离 `/*` / `/**` 定界后的剩余部分）按本条处理，与单行注释的归一规则一致；
   - **`*` 后无空格** → 内容 = `*` 后第一个字符起，到行末最后一个非空白字符；
   - **`*` 后带空格** → 剥掉**一个**分隔空格，内容 = 其后字符起，到行末最后一个非空白字符——剥掉一个后若仍是连续空格（≥ 2 空格场景），这些是内容自带的**前导空格，保留**。
4. 重排输出：单行拼接 `/* … */`；多行首行接 `/*`（JSDoc 接 `/**`），中间行缀 `*`——内容为空输出 `*`（无尾随空格），内容无前导空格补一个空格，内容自带前导空格则原样跟在 `*` 后（不补）；末行 `*/` 独立。

细化规则（均服务于「不丢可见信息 + 幂等」）：

- **空行不裁剪（纵向）**：块注释内的连续空行**全部保留、各占一行**，不合并、不删除；空白行判定为空内容，输出为 `*`。（行首空格的处理不在此列，属上面的装饰剥离规则。）
- **首行为空不提行**：首行 `/*` 后只有空白字符时，首行输出单独的 `/*`（JSDoc 为 `/**`），**不把下一行内容提上来**；内容从下一行照常输出。末行仅空白同理，直接落到独立的 `*/` 行。
- **内容前导空格不压缩**：`*` 后 ≥ 2 个连续空格时，剥掉一个分隔空格，其余是内容自带的前导空格，原样保留且 `*` 后**不**再补空格（内容自己的空格充当分隔）；仅在内容无前导空格时才补一个。例：行 `*   nested`（`*` 后 3 空格）→ 内容 `  nested`（保留 2 空格）→ 输出 `*  nested`。
- 空内容（含仅空白）注释：输出 `/* */`（JSDoc 输出 `/** */`）——**恰好一个空格，不省略**。`/**/` 里的 `*/` 在连字（ligature）字体下会与相邻字符连成一体，编辑器内渲染异常，必须保留空格隔开。
- 行中非行首的 `*` 原样保留；每行最多剥一个前导 `*`。
- **幂等按输出文本验证**：剥除规则「`*` 后剥一个空格」与输出规则「内容无前导空格才补一个」互为逆操作——`*  nested` 第二轮判定内容为 ` nested`（1 前导空格），输出仍为 `*  nested`，文本稳定。单个前导空格归属（分隔 vs 内容）存在天然歧义，但两种归法的输出文本相同，歧义无害。无 `*` 行输出为 `* 内容`，第二轮按 `*` 行判定，内容不变；首行输出 `/* 内容`，第二轮按无 `*` 行判定剥掉一个空格，同样不变。
- 文字内容逐行保留，零丢失；解析器是 `src/syntax/format/` 的内部实现，不进 AST、不进 `parseSyntax`。

### 3.4 注释归属与重排

MVP 用确定性规则（依据 token 流 + 节点 / 注释的 `start` / `end` + 换行存在性），不引入注释附着模型：

| 类别 | 判定 | 输出位置 |
| --- | --- | --- |
| leading | 注释独占一行（与前一个 default 通道 token 之间有换行，或是文件首个 token） | 归属**下一个**元素，输出在该元素前一行；连续 leading 依序保留 |
| trailing | 注释与前一个 default 通道 token 同行 | 归属该元素，输出在其行末；`//` 前两空格，块注释前一空格 |
| dangling | 容器最后一个元素之后、闭括号之前 | 输出在闭括号前一行，按容器缩进 |
| 文件首 / 尾 | 根值之前 / EOF 之后的注释 | 根值前 / 文件尾独立块 |

- 注释之间、注释与代码之间的空行保留至多 1 行（块注释**内部**的空行不适用本条，由 §3.3.5 全量保留）。
- 注释**内容原样**：`CommentBlock` / `CommentLine` 的 `value` 不改写，输出时重拼定界符（`//` + value；`/*` + value + `*/`）；`optimizeBlockComments` 开启时，块注释在写出前先过 §3.3.5 规范化器（输入即 value）。
- 规则只依赖 token 相对位置与换行存在性 → 确定、可表格驱动测试、幂等。

### 3.5 错误容忍（后续增强，非 MVP）

**首版仅严格模式**：diagnostics 非空即返回原文，且**不暴露** `errorTolerance` 选项。

后续可选：diagnostics 非空时仍尽力格式化——ErrorNode 子树按 start / end 截原文原样输出，其余子树正常格式化。风险是部分输出不保证幂等、编辑可能跨错误点移动文本。列为独立阶段，默认关闭（`errorTolerance?: "strict" | "best-effort"`，默认 `"strict"`）。

---

## 4. 导出与打包

- 根入口 `index.ts`：`export { parseSyntax, formatTASON }` 及相关类型。
- 子路径 **`tason/syntax`**：只含 syntax + formatter 的模块图（不 import `types/` 的值级实现 → 不拉 decimal.js 包装类链 / date-fns / uuid / reflect-metadata；数值优化自身用 decimal.js / BigInt 是格式化器直接依赖，允许）。插件 esbuild bundle 体积显著小于整包。
- `package.json` 新增 `exports` 字段的兼容性注意：加 `exports` 后未列出的子路径（含 deep import `tason/lib/...`）失效。当前无文档化的 deep import 路径 → 按 `{ ".", "./syntax", "./package.json" }` 添加，随 minor 发布并在 CHANGELOG 声明。
- antlr4 runtime 随 bundle 打入（体积量级可接受；不为此引入 parser 进程隔离 / worker）。

---

## 5. VSCode 插件侧对接契约（对端仓库实现，本仓库只记录）

1. 注册 `DocumentFormattingEditProvider`（语言 `tason`）；MVP 只做整文档格式化，不实现 range formatting。
2. 实现骨架：`formatTASON(doc.getText(), { endOfLine: doc.eol === vscode.EndOfLine.CRLF ? "crlf" : "lf", ...用户配置 })`；`diagnostics` 非空 → `showWarningMessage`（带首条诊断信息）并返回 `[]`；否则返回整文单个 `TextEdit`（结果与原文相同则 `[]`）。
3. 配置解析（插件侧职责；核心 `formatTASON` 只接收**最终的配置对象**，不读文件系统——配置对象作参数是核心 API 的固定形态）。来源优先级从高到低，**逐字段合并**（高层来源设置了的字段覆盖低层）：

   | 优先级 | 来源 | 说明 |
   | --- | --- | --- |
   | 1 | VSCode 设置 `tason.format.*`（工作区 > 用户） | 逐字段映射 `TASONFormatOptions`；未设置的字段不参与覆盖。检测类选项可在 VSCode 侧默认暴露为 `"auto"`（编辑器场景「跟随文档」更顺手） |
   | 2 | 项目根 `.tasonrc.json` | schema 即 `TASONFormatOptions` 的 JSON 形态（键名一致） |
   | 3 | 项目 prettier 配置 | `.prettierrc` / `.prettierrc.json` / `package.json` 的 `prettier` 字段；**只取 TASON 认识的键**：`tabWidth` / `useTabs` / `printWidth` / `singleQuote` / `trailingComma` |
   | 4 | 核心包默认值 | 不复制到插件，缺省即默认 |

   - `trailingComma` 映射：prettier `"es5"` / `"all"` → `"all"`；`"none"` → `"none"`。
   - 文件缺失 / JSON 损坏：该来源整体跳过，损坏时 `showWarningMessage`，不阻断格式化。
   - prettier 的 JS / YAML / TOML 形态（`.prettierrc.js` / `.prettierrc.yaml` 等）MVP 不读取（需要模块加载或额外解析器，体积与安全权衡），列为后续。
4. 插件不解析文本、不判定语法；一切判定在核心包。

---

## 6. 测试策略

新文件（归属遵循 AGENTS §6）：

| 文件 | 覆盖 |
| --- | --- |
| `packages/tason/test/syntax-parse.test.ts` | AST 形状（`type` / `start` / `end`、字面量 `sign` / `raw` / `value`、TypeInstance typeName / argument）；任意（未注册 / 不存在的）TypeName 合法；行注释 / 块注释全量收集（CommentBlock / CommentLine，value 已剥定界）；诊断定位（offset / line / column）；`INVALID_CHAR` 转诊断 |
| `packages/tason/test/formatter.test.ts` | **首版**：不变量三件套（幂等 / 语义保真 / 注释零丢失）× 首版选项矩阵 + `optimize*` 传 `true` 等价 `false`；注释四类归属（value 原样、重拼定界符）；§3.3.3 检测规则矩阵 + `"auto"` 幂等稳定性；§3.3.4 key 去引号黑名单矩阵（含转义写法解码、空串、非标识符字符、`singleQuote` 交互）；EOL；空容器与强制展开。**Phase D**：§3.3.2 数值优化全表 + 进制保留 + `-0`→`0`；§3.3.5 块注释规范化矩阵（单 / 多行、JSDoc 保留、空内容 `/* */` 连字安全、连续空行纵向保留、首行空白不提行、无 `*` 行缩进剥离、内容前导空格不压缩、尾随空白裁剪、行中 `*`、幂等）；`NUMBER_TYPE_NAMES` 全名单 Scalar 参数优化往返 |

- 语义保真的写法：`expect(serializer.parse(formatTASON(src).text)).toEqual(serializer.parse(src))`，对既有 fixture 全量 + 边界样本。
- 回归：grammar 通道变更合入时跑核心全量（至少 `number-handling` / `runtime-schema` / `multi-implementation`）。
- 插件侧验证在 vscode 仓库做（手动清单 + 插件自测），本仓库不测 VSCode API；配置解析（`.tasonrc.json` 读取、prettier 键映射、优先级逐字段合并、损坏文件降级）同样在插件仓库测试。

---

## 7. 风险与规则

| 风险 | 处理 |
| --- | --- |
| 注释改 HIDDEN 通道影响值级行为 | `getText()` 不含 HIDDEN token（ANTLR4 语义）+ 全量回归背书；若仍异常，回滚该 diff，备选方案为语法层独立 lexer 实例 + 通道过滤 |
| 数值优化引入精度偏差 / 值漂移 | decimal.js / BigInt 精确重排，禁 JS `number` 往返；输出重 lex 验证；`-0` → `0` 是唯一值级例外（决策定稿，测试用宽松比较钉死）；全名单 TypeInstance 往返断言 |
| 块注释规范化丢内容 / 不幂等 | 只剥装饰（行首空白 + 至多一个前导 `*`），文字逐行保留；空内容与 JSDoc 边界入测试矩阵；幂等用例背书 |
| 插件配置来源冲突 / 文件损坏 | 优先级逐字段合并定死（§5）；损坏文件降级跳过 + 提示，不阻断格式化 |
| `"auto"` 检测抖动（两次格式化结论不同） | 检测只依赖源文统计量，且输出风格统一 → 对输出重检结论不变（§3.1 第 5 条），作为测试固定 |
| key 去引号误伤 → 输出语法错误 | 解码值整个匹配 IDENTIFIER 词法 + 黑名单 `{ true, false, null, NaN, Infinity }` 双重判定；黑名单矩阵表格驱动测试 |
| `NUMBER_TYPE_NAMES` 双份维护 | 抽无依赖叶子模块，`types/NumberHandling.ts` re-export，名单仍单一真相源 |
| `exports` 字段封死 deep import | minor + CHANGELOG 声明；发布前核对无文档化 deep import |
| 注释规则复杂度膨胀 | 锚定 §3.4 四类规则；新需求先加测试再改规则，不引入附着模型 |
| 打印机复杂化 | MVP 二态 group；doc algebra 列为后续演进，不动公开 API |
| 插件自写第二套 parser 造成语法漂移 | **评审拒绝**；插件只允许 import `tason` |

---

## 8. 固定决策清单

1. formatter 实现进核心包 `src/syntax/`；VSCode 插件只是壳，**禁止**内置第二套语法。
2. **整体重生成模型**：输出按选项从 AST 重新打印；验收口径是「不丢失可见信息」，不是逐字符保真。
3. 继续复用现有 ANTLR 解析（grammar 生成物的第二个消费者）；`parseSyntax` 与值级 `parse` 并列，未注册 TypeName 合法，不构造 Registry。
4. 公开 AST 是自有序小节点模型，命名对齐 Babel 并简化（`type` 判别 + `start` / `end` + 字面量 `raw` / `value`；符号并入 `NumericLiteral.sign`；`TypeInstance` 为 TASON 独有节点，argument 即普通子节点），不暴露 ANTLR context。
5. 注释 `-> channel(HIDDEN)`（行注释 / 块注释都识别），WS 维持 skip；值级行为以全量回归背书；改 grammar 必须 `yarn generate`。
6. 选项命名对齐 Prettier：`tabWidth` / `useTabs` / `printWidth` / `singleQuote` / `trailingComma`；扩展 `"auto"` 检测（缩进单元、引号多数）。默认值：2 空格缩进、双引号、尾逗号添加。
7. 数值优化 `optimizeNumbers`（默认关）：同进制等值最短 / 最规范，JSON 文法优先、JS 字面量兜底，禁 JS `number` 往返；**`-0` 优化为 `0`（唯一值级例外）**；`optimizeNumberTypeInstances`（默认关）扩展到 `NUMBER_TYPE_NAMES` 名单的 Scalar 参数，名单抽无依赖叶子模块共享。
8. key 引号简化 `quoteKeys`：默认 `"as-needed"`（尽可能去引号），`"preserve"` 可关；判定用解码后完整值，IDENTIFIER 词法 + 黑名单 `{ true, false, null, NaN, Infinity }` 双重通过才去引号。
9. 块注释优化 `optimizeBlockComments`（默认关）：JS 风格——单行 `/* 内容 */`，多行行首 `* ` 前缀 + `*/` 独立成行、缩进对齐 `/*`；JSDoc 额外 `*` 保留；纯字符串解析器实现，不进 grammar。
10. 核心 API 只接收配置对象参数，不读文件系统；插件侧配置链 `tason.format.*` > `.tasonrc.json` > prettier（JSON 家族，仅认 `tabWidth` / `useTabs` / `printWidth` / `singleQuote` / `trailingComma`）> 默认，逐字段合并。
11. **首版范围**：仅严格模式（有诊断不格式化、返回原文，不暴露 `errorTolerance`）；`optimizeNumbers` / `optimizeNumberTypeInstances` / `optimizeBlockComments` 预留但不实现（传 `true` 视为 `false`）；`best-effort` 容错与两个优化器归入 plan Phase D。g4 注释通道变更（§2.5）在首版内。
12. 幂等、语义保真、可见信息不丢失（含注释零丢失）是发布硬标准。
13. 子路径导出 `tason/syntax`，根入口同时 re-export；`exports` 字段变更随 minor 发布声明。

---

## 相关

- [implementation-plan.md](./implementation-plan.md)
- VSCode 插件：`extensions/vscode-tason`（git submodule，源仓库 [vscode-extension-tason](https://github.com/SwingCosmic/vscode-extension-tason)）
- 用语（TypeName / TypeInstance / 字面量 / 装箱）：[glossary.md](../glossary.md)
