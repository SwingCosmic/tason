# 格式化

`TASON.format` 按选项把一篇 TASON 文本**整体重排**成规范文本：先做语法层解析，再按配置重新打印。它不查类型注册表，未注册的 TypeName（如 `User({…})`）也可以格式化。空白、换行和缩进都由格式化器生成，不保留原文里的空白。

语法有错误时**不改原文**，结果里带上诊断（`line` / `column` 从 0 计，与编辑器一致）。

## 用法

默认导出上的 `TASON.format` 与具名导出 `formatTASON` 是同一个函数。

```ts
import TASON, { formatTASON, parseSyntax } from "tason";

const result = TASON.format(`{a:1,b:2}`);
result.text; // '{ a: 1, b: 2 }\n'
result.diagnostics; // []

formatTASON(`{a:1}`, { tabWidth: 4, singleQuote: true });

// 只要语法树、不要值级序列化时：
const tree = parseSyntax(`Int64("1") /* id */`);
tree.ast?.type; // "TypeInstance"
tree.comments; // 行注释与块注释，按出现顺序
```

输出以换行结尾（`endOfLine` 为 `"crlf"` 时是 `\r\n`）。对同一选项再格式化一次，文本不变。

### 轻量子入口 `tason/syntax`

只含语法层解析和格式化器，不拉取值级依赖（`decimal.js`、`date-fns`、`uuid`、`reflect-metadata` 等）。函数名是 `parseSyntax` / `formatTASON`，没有 `TASON.format` 这个挂载。

```ts
import { formatTASON, parseSyntax } from "tason/syntax";
```

需要 `TASON.parse`（例如读取 `.tasonrc`）时用主入口 `tason`，不要用这个子入口。

`package.json` 的 `exports` 只列出 `.`、`./syntax` 和 `./package.json`。`tason/lib/...` 这类深路径导入不可用。

## 选项

未传入的选项用下表的默认值。三个 `optimize*` **首版未实现**：传入 `true` 与不传相同，输出不变。

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `tabWidth` | `2` | 缩进宽度。`"auto"` 按原文前导空格检测，候选 `1` / `2` / `4` / `6` / `8`，平手取较大值 |
| `useTabs` | `false` | `true` 用 tab 缩进。`"auto"` 按原文行首 tab / 空格的多数决定，平手用空格 |
| `printWidth` | `80` | 单行宽度上限。放得下且没有必须换行的注释时，对象、数组和对象参数保持单行 |
| `singleQuote` | `false` | `true` 用单引号。`"auto"` 按源文字面量（含字符串 key）的引号个数严格多数决定，平手或没有字符串时用双引号 |
| `quoteKeys` | `"as-needed"` | 字符串 key 在解码后能当成标识符、且不是 `true` / `false` / `null` / `NaN` / `Infinity` 时去掉引号。`"preserve"` 保持原文是标识符还是字符串 |
| `trailingComma` | `"all"` | 多行容器写尾逗号。`"none"` 不写。单行容器没有尾逗号 |
| `endOfLine` | `"lf"` | `"lf"` 或 `"crlf"` |
| `optimizeNumbers` | `false` | **首版未实现**。计划中的行为是同进制等值规范化 |
| `optimizeNumberTypeInstances` | `false` | **首版未实现**。计划中仅在 `optimizeNumbers` 开启时，优化内置数值 TypeName 的标量参数 |
| `optimizeBlockComments` | `false` | **首版未实现**。计划中的行为是按 JS 风格规范化块注释。首版不重排注释内部 |

首版不重排注释内部：不补行首 `*`、不裁装饰空白、不合并空行。缩进是另一件事——格式化如果改了元素的缩进，挂在该元素上的单独行注释，以及占多行的块注释，会整段跟着平移，行与行之间的相对位置保留。

`"auto"` 只根据**当前输入**统计。格式化结果本身风格统一，再检测一次结论相同。

```ts
import { formatTASON } from "tason";

formatTASON(`{a:1,b:2}`, { singleQuote: "auto" }).text;
// '{ a: 1, b: 2 }\n'   没有字符串，落回双引号

formatTASON(`{ name: 'Ada', city: 'Paris' }`, {
  singleQuote: "auto",
  printWidth: 20,
}).text;
// 源文单引号占多数 → 输出仍用单引号
```

直接调用库时，`singleQuote` 的默认是双引号（`false`）。VSCode 插件在没有任何来源设置引号时传入 `"auto"`，因为编辑器没有引号设置。

## 语法错误

`diagnostics` 非空时 `text` 就是输入原文，不会格式化其中正确的那一段。

```ts
import TASON from "tason";

const bad = TASON.format(`{,}`);
bad.text; // "{,}"
bad.diagnostics[0].line; // 0
bad.diagnostics[0].column; // 从 0 计
```

`parseSyntax` 在有错误时仍尽量返回局部语法树，同时 `diagnostics` 非空。`format` / `formatTASON` 看到诊断就不打印。

## 项目配置 `.tasonrc`

工作区根目录可以放格式化配置，键名与上表一致。文件名按下面顺序，用第一个存在的文件：

1. `.tasonrc`
2. `.tasonrc.json`
3. `.tasonrc.jsonc`
4. `.tasonrc.tason`

内容是 TASON 对象（JSON / JSONC 是其子集，可以写注释和尾逗号）。不认识的键会忽略。

```js
// .tasonrc
{
  printWidth: 100,
  singleQuote: true,
  trailingComma: "none",
}
```

VSCode 扩展 [vscode-tason](https://github.com/SwingCosmic/vscode-extension-tason) 的「格式化文档」会读取这份文件，再与编辑器设置逐字段合并。优先级从高到低：

| 优先级 | 来源 | 覆盖的选项 |
| --- | --- | --- |
| 1 | 工作区根目录 `.tasonrc` 家族 | 上表里写明的键。文件缺失则跳过；解析失败或结果不是普通对象时提示并跳过，不阻断格式化 |
| 2 | 编辑器已经解析好的缩进，以及工作区设置 `tason.format.*` | 编辑器传入的 `tabSize` / `insertSpaces` 决定 `tabWidth` / `useTabs`（已含 EditorConfig）。同一字段若在工作区设置里显式写了 `tason.format.*`，以设置为准。这一层不读 `editor.*` |
| 3 | Prettier 配置 | **首版不读取** |
| 4 | 用户级全局设置 `tason.format.*` | 只取显式改过的项。全局里的 `tabWidth` / `useTabs` 不会盖过上一层的编辑器缩进 |
| 5 | 默认 | 插件传入 `singleQuote: "auto"`；`endOfLine` 跟随文档当前换行，显式配置可以覆盖。其余用上表的库默认值 |

设置项的贡献默认值不参与合并。留空表示「这一层没有意见」。插件不解析 `.editorconfig`，缩进以编辑器交给格式化器的参数为准。
