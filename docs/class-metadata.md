# 实体元数据与 Schema

在注册 ObjectType 时，可附带一份 **运行时契约（schema）**，描述字段在 JavaScript 内存中的期望类型（例如 `id` 为 `bigint`、`when` 为 `Date`）。  
解析 / 写出时，TASON 按契约把文本中的类型实例或字面量映射到对应运行时值。

- Schema 只描述 **应用层 RuntimeType**，不要写 TASON 类型名（如 `"Int64"`）。
- TASON 类型名（`Int64`、`Date` 等）仍由 **类型注册表** 负责。
- 核心通过 **`RuntimeSchemaAdapter`** 解释任意 schema 库；官方只内置 [Valibot](https://valibot.dev/) 适配器。

---

## 快速开始（Valibot）

```bash
npm install valibot
```

```ts
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
  // schema 写法见 Valibot 文档：https://valibot.dev/
  { schema: v.object({ id: v.bigint(), name: v.string() }) },
);

const u = TASON.parse<User>(`User({ id: Int64("1"), name: "Ada" })`);
// u.id === 1n
```

要点：

- 必须先 `setSchemaAdapter`；否则 `metadata.schema` 会被忽略。
- 适配器挂在 **registry** 上；新建 / 克隆 registry 后需重新设置。
- 如何声明 `object` / `array` / `optional` / `instance` 等，请直接查阅 [Valibot 文档](https://valibot.dev/)。

与数值处理选项的配合见 [数值处理](./number-handling.md)（默认 `object-fallback-native`：有契约按契约收值，无契约则拆箱）。

---

## 公开 API

| API | 说明 |
| --- | --- |
| `registry.setSchemaAdapter(adapter \| null)` | 注册 / 替换 / 清除适配器 |
| `registry.getSchemaAdapter()` | 当前适配器 |
| `createValibotAdapter()` | 官方 Valibot 实现（包根导出；**不会**自动注册） |
| `registerType(name, typeInfo, metadata?, options?)` | 第三参含 `schema`；第四参 `{ asDefault?: boolean }` 见 [类型系统 · 多实现](./type-system.md#同一-typename-的多种实现) |
| `getClassMetadata(name)` | 读取整包元数据（无单独的 `getSchema`） |

```ts
import type { TasonClassMetadata, RuntimeSchemaAdapter, RuntimeType } from "tason";

interface TasonClassMetadata<S = unknown> {
  ctor?: abstract new (...args: any[]) => any;
  schema: S; // 对核心不透明，由 adapter 解释
}
```

Valibot 为 optional peer，不装也能使用 TASON 其余功能。

---

## 自定义 Adapter

实现 `RuntimeSchemaAdapter<S>`，把所用 schema 库的节点翻译成 TASON 能理解的形状即可。

```ts
import type { RuntimeSchemaAdapter, RuntimeType } from "tason";

interface RuntimeSchemaAdapter<S = unknown> {
  /** 值是否为本库可识别的 schema */
  isSchema(value: unknown): value is S;

  /** 对象字段列表；非 object 返回 null */
  objectEntries(schema: S): Iterable<[string, S]> | null;

  /** 数组元素 schema；非 array 返回 null */
  arrayElement(schema: S): S | null;

  /**
   * 该节点对应的 JS RuntimeType。
   * "instance" 表示 class 实例，具体构造函数由 instanceCtor 给出。
   * 不要返回 TASON TypeName 字符串。
   */
  runtimeType(schema: S): RuntimeType;

  /**
   * runtimeType === "instance" 时返回期望 ctor（如 Date、RegExp）；
   * 否则返回 null。
   */
  instanceCtor(schema: S): (abstract new (...args: any[]) => any) | null;
}

type RuntimeType =
  | "bigint" | "number" | "string" | "boolean" | "decimal"
  | "object" | "array" | "instance" | "unknown";
```

| 方法 | 职责 |
| --- | --- |
| `isSchema` | 过滤无关值；无法识别时契约整体忽略（不抛错） |
| `objectEntries` | 供序列化/反序列化遍历实体字段 |
| `arrayElement` | 供数组元素按同一契约映射 |
| `runtimeType` | 叶子映射依据（`bigint` → 收成 `bigint` 等） |
| `instanceCtor` | `Date` / `RegExp` 等实例字段 |

实现时注意：

1. **解包** optional / nullable / default 等包装层，再判断内层类型。  
2. **`unknown`** 表示无法映射：该路径回退为无契约行为。  
3. class 实例用 `"instance"` + `instanceCtor`，不要把 `"RegExp"` 这类 TypeName 塞进 `runtimeType`。  
4. 每个 registry 调用一次 `setSchemaAdapter(yourAdapter)`。

---

## 示例：Zod Adapter（简化）

以下为 **示意实现**（针对常见 Zod object / array / 原语），完整能力需按你使用的 [Zod](https://zod.dev/) 版本补全（union、brand、preprocess 等）。  
Zod 的 introspect API 随大版本变化，请以当前 Zod 文档为准调整 `_def` / 类型判断。

```ts
import type { RuntimeSchemaAdapter, RuntimeType } from "tason";
import { z, type ZodTypeAny } from "zod";

/** 解包 optional / nullable / default */
function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let s = schema;
  for (let i = 0; i < 8; i++) {
    const t = s._def?.typeName as string | undefined;
    if (
      t === "ZodOptional" ||
      t === "ZodNullable" ||
      t === "ZodDefault"
    ) {
      s = s._def.innerType;
      continue;
    }
    break;
  }
  return s;
}

function createZodAdapter(): RuntimeSchemaAdapter<ZodTypeAny> {
  return {
    isSchema(value: unknown): value is ZodTypeAny {
      return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as ZodTypeAny).safeParse === "function" &&
        (value as any)._def != null
      );
    },

    objectEntries(schema) {
      const s = unwrap(schema);
      if (s._def?.typeName !== "ZodObject") return null;
      return Object.entries(s._def.shape()) as [string, ZodTypeAny][];
    },

    arrayElement(schema) {
      const s = unwrap(schema);
      if (s._def?.typeName !== "ZodArray") return null;
      return s._def.type as ZodTypeAny;
    },

    runtimeType(schema): RuntimeType {
      const s = unwrap(schema);
      switch (s._def?.typeName) {
        case "ZodBigInt":
          return "bigint";
        case "ZodNumber":
          return "number";
        case "ZodString":
          return "string";
        case "ZodBoolean":
          return "boolean";
        case "ZodObject":
          return "object";
        case "ZodArray":
          return "array";
        case "ZodDate":
          return "instance";
        // 其它 class：可用 z.custom / 自建并在 instanceCtor 中返回 ctor
        default:
          return "unknown";
      }
    },

    instanceCtor(schema) {
      const s = unwrap(schema);
      if (s._def?.typeName === "ZodDate") return Date;
      return null;
    },
  };
}

// 使用
import TASON from "tason";

TASON.registry.setSchemaAdapter(createZodAdapter());

const UserSchema = z.object({
  id: z.bigint(),
  name: z.string(),
});

TASON.registry.registerType(
  "User",
  { kind: "object", ctor: User },
  { schema: UserSchema },
);
```

需要 `RegExp` 等更多实例类型时：在 `runtimeType` 识别你的 Zod 写法（如 `z.instanceof(RegExp)` / `z.custom`），并在 `instanceCtor` 返回对应构造函数。

官方 Valibot 适配器源码可作对照：`src/schema/adapters/valibot.ts`。

---

## 其它说明

- 无法识别的 schema → **忽略契约**，不抛错。  
- 契约为 `number` 且入站为超安全整数范围的 `bigint` / `Int64` 时会 **抛错**，不会静默截断。  
- `deserializeNumberHandling` 为 `native` / `all` 时会 **忽略** schema；细节见 [数值处理](./number-handling.md)。
