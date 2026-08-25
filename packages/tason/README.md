# tason

**TASON（Type-Augmented Serialization Object Notation）的核心实现包**——一种类型化的对象表示语法，用于序列化和反序列化数据。语法是 JSON 的超集，并兼容绝大部分 JSON5 / JS 对象字面量写法（特意砍掉了一部分易混淆的内容）；文本自带类型信息（如 `Int64("1")`、`User({…})`），无需额外描述文件即可反序列化。

项目总览、使用场景与其它语言实现见[仓库根 README](../../README.md)。

- 仅支持 **ESM**：前端需打包器（Vite、webpack 等）；Node.js 需原生 ESM。
- 本包只含核心；MongoDB `ObjectId` 等 BSON 类型见扩展包 [`tason-mongodb`](../tason-mongodb/README.md)。

## 特性

- **人类可读**：JSON 超集文本，保留绝大部分 JSON5 对 JSON 的语法简化，同时移除了少数易混淆的语法和空白字符，降低手工编写错误率。完整语法定义见 [TASON.g4](./src/grammar/TASON.g4)。
- **自描述强类型**：类型名内嵌于文本；同一类型名可注册多种实现（鸭子类型注册），序列化按实例识别、反序列化走默认实现，默认实现可替换或单次指定。
- **动态结构**：对象可含任意数量属性，动态与固定类型对象可混合使用——不像二进制协议那样需要内嵌 JSON 字符串降级。

## 安装

```bash
npm install tason
# or
yarn add tason
```

使用[实体 Schema](../../docs/class-metadata.md) 时额外安装可选依赖：

```bash
npm install valibot
```

## 快速上手

包的默认导出 `TASON` 是带合理默认参数的 [`TASONSerializer`](./src/TASONSerializer.ts) 实例，可直接使用；需要独立配置时用 `new TASON.Serializer({ ... })`。

### 反序列化

```typescript
import TASON from 'tason';

class Person {
  name: string;
  age: number;

  constructor(name = "", age = 0) {
    this.name = name;
    this.age = age;
  }
}

TASON.registry.registerType("Person", {
  kind: "object",
  ctor: Person,
});

const people = TASON.parse<Person[]>(
`[
  Person({
    "name": "John",
    "age": 30
  }),
  // 可以包含注释
  Person({
    name: 'Jane',
    age: 25,
  }),
]`);
```

默认会将 `Int64("…")` 等拆成原生 `bigint` / `number`。需要保留包装类时：

```typescript
const s = new TASON.Serializer({ deserializeNumberHandling: "all" });
s.parse(`Int64("42")`); // Int64 实例
```

### 序列化

```typescript
import TASON from 'tason';
const serializer = new TASON.Serializer({
  indent: 2, // 缩进 2 空格
  registry: TASON.registry.clone(), // 复用全局类型注册表
});

console.log(serializer.stringify([new Person("John", 30)]));
```

### 实体字段的精确运行时类型（Schema）

仅 `registerType` 只能得到类实例，字段值的 JS 类型仍受数值处理默认策略影响。若希望 `id` 稳定为 `bigint`、`when` 为 `Date` 等，可为类型挂上 schema（官方适配 [Valibot](https://valibot.dev/)）：

```typescript
import TASON, { createValibotAdapter } from "tason";
import * as v from "valibot";

class User {
  id!: bigint;
  name!: string;
  constructor(init?: Partial<User>) {
    if (init) Object.assign(this, init);
  }
}

TASON.registry.setSchemaAdapter(createValibotAdapter());
TASON.registry.registerType(
  "User",
  { kind: "object", ctor: User },
  { schema: v.object({ id: v.bigint(), name: v.string() }) },
);

const u = TASON.parse<User>(`User({ id: Int64("1"), name: "Ada" })`);
// u.id === 1n
```

要点：必须先 `setSchemaAdapter`，否则契约不生效；适配器挂在 registry 上，新建 / 克隆 registry 后需重新设置。

## 数值处理（Number Handling）

控制序列化时何时写出类型名（装箱）、反序列化时何时拆成原生值或保留包装类：

```ts
const serializer = new TASON.Serializer({
  serializeNumberHandling: "unsafe-only",              // 默认：仅超出安全范围才装箱
  deserializeNumberHandling: "object-fallback-native", // 默认：有 schema 契约按契约收值，否则拆箱
});
```

常用取向：

| 场景 | 建议 |
| --- | --- |
| 一般 API / 配置 | 保持默认 |
| 文本尽量自描述类型名（跨语言互操作） | 序列化用 `all` 或 `object-type-property` |
| 下游只接受 JSON 数字 | 序列化用 `none`（注意超大数） |
| 需要操作包装类本身 | 反序列化用 `all` |

完整选项表、示例与选用建议见 [数值处理](../../docs/number-handling.md)。

## 内置类型与多实现

内置类型覆盖整数 / 浮点数（`Int32`、`Int64`、`Decimal128` …）、时间日期、UUID、Buffer、RegExp、集合与字典等，完整清单与注意事项见 [类型系统](../../docs/type-system.md)。

同一 TypeName 可挂多种实现：序列化从实例出发识别实现；反序列化按默认实现构造，可用 `asDefault` / `setDefaultType` 替换默认、`parseAs` 单次选型。详见 [类型系统 · 同一 TypeName 的多种实现](../../docs/type-system.md#同一-typename-的多种实现)。

## 扩展包

| 包 | 说明 |
| --- | --- |
| [`tason-mongodb`](../tason-mongodb/README.md) | MongoDB / BSON 类型扩展：`ObjectId`、`bson.Long` / `Decimal128` / `Int32` / `Double` / `UUID` / `Binary` 子类型；支持把 bson 实现替换为默认实现 |

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [仓库根 README](../../README.md) | 项目总览、特性、使用场景、完整安装说明 |
| [类型系统](../../docs/type-system.md) | 语法类型、内置类型清单、同一类型名的多种实现与规范约定 |
| [数值处理](../../docs/number-handling.md) | 序列化 / 反序列化数值装箱与拆箱策略 |
| [实体元数据与 Schema](../../docs/class-metadata.md) | 用 Valibot 等契约把字段收成 `bigint` / `Date` 等运行时类型，自定义 adapter |
| [正则表达式](../../docs/regexp.md) | `RegExp` 类型实例与选项 |
| [MongoDB / BSON 类型](../tason-mongodb/README.md) | BSON 标量类型扩展与默认实现替换选项 |

## License

MIT
