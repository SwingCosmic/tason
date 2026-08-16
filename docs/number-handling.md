# 数值处理（Number Handling）

JavaScript 运行时只有 `number` 与 `bigint`，而 TASON 文本可携带 `Int32`、`Int64`、`Decimal128` 等类型名。  
**数值处理**控制：序列化时何时写出类型名（装箱）、反序列化时何时拆成原生值或保留包装类。

通过 `TASONSerializer` 构造参数配置（选项字符串为 kebab-case）：

```ts
import TASON from "tason";

const serializer = new TASON.Serializer({
  serializeNumberHandling: "unsafe-only",              // 默认
  deserializeNumberHandling: "object-fallback-native", // 默认
});
```

默认导出的 `TASON` 单例使用同样的默认值。

---

## 序列化 `serializeNumberHandling`

| 选项 | 含义 |
| --- | --- |
| **`unsafe-only`（默认）** | 仅当数值**超出安全范围**时才写成类型实例；安全范围内尽量写裸数字字面量 |
| **`all`** | 能识别的数值实现尽量写成类型实例（如 `Int32("18")`、`Int64("…")`） |
| **`object-type-property`** | 在 **ObjectType** 成员路径上相当于 `all`；其余路径相当于 `unsafe-only` |
| **`none`** | 强制全部写成裸字面量（永不写数值 TypeName；无法安全表示时会报错） |

### 示例

```ts
import TASON from "tason";

// 默认：安全整数写裸字面量
TASON.stringify(18);       // 18
TASON.stringify(2n ** 60n); // 超出安全范围 → 带类型名的整数（如 Int64 / BigInt）

// 尽量带类型名
const boxed = new TASON.Serializer({ serializeNumberHandling: "all" });
// 对已识别的数值包装实例会写出 Int32("…")、Int64("…") 等

// 强制 JSON 风格数字（注意超大 bigint / 高精度 Decimal 可能失败）
const bare = new TASON.Serializer({ serializeNumberHandling: "none" });
bare.stringify(42n); // 42
```

需要与 .NET 一致地「实体属性尽量保留类型名、其它保持紧凑」时，使用 `object-type-property`。

---

## 反序列化 `deserializeNumberHandling`

| 选项 | 含义 |
| --- | --- |
| **`object-fallback-native`（默认）** | 若 ObjectType 字段挂了 **schema 契约**，按契约收成对应运行时类型；否则拆成原生值 |
| **`object-fallback-all`** | 有 schema 时同样按契约收值；**无契约**时，在 ObjectType 内尽量保留包装类，之外仍拆箱 |
| **`native`** | **忽略** schema，全部拆箱 |
| **`all`** | **忽略** schema，尽量保留包装类 / 原值 |

### 拆箱约定（无契约或 `native`）

| 文本侧 | 常见结果 |
| --- | --- |
| 数字字面量、较小整数类型 | `number` |
| `Int64` / `BigInt` | `bigint` |
| `Decimal128` | [`decimal.js`](https://github.com/MikeMcl/decimal.js) 的 `Decimal` |

拆箱只作用于**核心数值包装**。同一 TypeName 可挂多种实现（如 [`tason-mongodb`](../packages/tason-mongodb/README.md) 的 `bson.Long`）：
默认实现是核心包装时按上表拆箱；通过 `replaceDefaultImplementation` 等把默认实现换成 bson 类后，parse 不再拆箱。
见 [类型系统 · 同一 TypeName 的多种实现](./type-system.md#同一-typename-的多种实现)。

### 示例

```ts
import TASON from "tason";

// 默认：拆箱
TASON.parse(`Int64("42")`); // 42n

// 保留包装类
const keep = new TASON.Serializer({ deserializeNumberHandling: "all" });
const v = keep.parse(`Int64("42")`); // Int64 实例，而非 bigint
```

与实体 schema 一起使用时，默认的 `object-fallback-native` 会把契约为 `bigint` 的字段收成 `bigint`（无论文本是 `Int64("1")` 还是字面量 `1`）。详见 [实体元数据与 Schema](./class-metadata.md)。

---

## 选用建议

| 场景 | 建议 |
| --- | --- |
| 一般 API / 配置 | 保持默认 |
| 字段需要稳定的 `bigint` / `Date` 等 | 注册 schema，并保持默认反序列化选项 |
| 文本尽量自描述类型名（跨语言互操作） | 序列化用 `all` 或 `object-type-property` |
| 下游只接受 JSON 数字 | 序列化用 `none`（注意超大数） |
| 需要操作包装类本身 | 反序列化用 `all`（此时不会按 schema 改写类型） |
| 手里是 `bson.Long` / `Int32` 等 | Handling **不会**把它们拆成字面量；`none` 会抛。要裸数字请让驱动 `promoteLongs` / `promoteValues` / `useBigInt64`。见 [`tason-mongodb` README](../packages/tason-mongodb/README.md) |

---

## 与其它语言

序列化语义与 .NET 实现 [tason-net](https://github.com/SwingCosmic/tason-net) 对齐；序列化选项名 `object-type-property` 与 .NET 一致。  
反序列化的 `object-fallback-*` 为 JS 侧命名，表示「有契约用契约，否则 fallback」。
