# 阶段 C：类型清单与映射

> 进度：[implementation-plan.md](./implementation-plan.md) · 用语：[glossary.md](../glossary.md)  
> 依据：[BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) · [bsonspec](https://bsonspec.org/spec.html) · `bson` 6.x  
> 表 2 / 3：TypeName ↔ BSON / JS 对象。§5：选项交叉的设计要点与测试覆盖（**行为矩阵只在 [behavior-matrix.md](../../../packages/tason-mongodb/behavior-matrix.md) 维护一份**）。C1 / C2 / C3 均已填。§6：数值 Handling 的现行 / 协议后行为差异（依赖 runtime-type [phase-4](../runtime-type/phase-4-number-protocol.md)）。  
> 命名：仅 BSON 内部语义以 `BSON` 开头；`ObjectId` / `UUID` / `MD5` / 数字 / `Buffer` 不加前缀。实施分 C1 / C2 / C3，见 [implementation-plan](./implementation-plan.md)。

---

## 1. 官方 BSON 类型

类型码封闭。`默认读出` 按驱动 `promoteValues: true`。

| 码 | 别名 | 状态 | 默认读出 | TASON |
| --- | --- | --- | --- | --- |
| 1 | double | 现行 | `number` | 核心字面量 / `Float64`。可选追加 `bson.Double` |
| 2 | string | 现行 | `string` | 核心字面量 |
| 3 | object | 现行 | 普通对象 | 核心对象 / ObjectType。`_t` 不在本包 |
| 4 | array | 现行 | `Array` | 核心数组 |
| 5 | binData | 现行 | `Binary`（`UUID` 为其子类） | 按下表拆 |
| 6 | undefined | 废弃 | — | 不注册 |
| 7 | objectId | 现行 | `ObjectId` | **新** `ObjectId` |
| 8 | bool | 现行 | `boolean` | 核心字面量 |
| 9 | date | 现行 | `Date` | 核心 `Date` |
| 10 | null | 现行 | `null` | 核心字面量 |
| 11 | regex | 现行 | `RegExp` | 核心 `RegExp` |
| 12 | dbPointer | 废弃 | — | 不注册（≠ DBRef） |
| 13 | javascript | 现行 | `Code` | **新** `BSONJavaScript`（仅 unsafe） |
| 14 | symbol | 废弃 | `string` | 不注册（≠ 核心 `Symbol`） |
| 15 | javascriptWithScope | 废弃 | `Code` | 不另开；无 scope 可走 `BSONJavaScript` |
| 16 | int | 现行 | `number` | 核心 `Int32`。可选追加 `bson.Int32` |
| 17 | timestamp | 现行 | `bson.Timestamp` | **新** `BSONTimestamp`（≠ 核心毫秒 `Timestamp`） |
| 18 | long | 现行 | 安全整数 → `number`，否则 `Long` | 追加 `Int64` |
| 19 | decimal | 现行 | `bson.Decimal128` | 追加 `Decimal128` |
| -1 | minKey | 现行 | `MinKey` | **新** `BSONMinKey` |
| 127 | maxKey | 现行 | `MaxKey` | **新** `BSONMaxKey` |
| — | （约定）DBRef | — | `DBRef` 或普通对象 | **不注册**。落盘是 object（`$ref`/`$id`/`$db`），不是类型码 |

### 1.1 `binData` 子类型（码仍为 5）

ctor 均为 `bson.Binary`，仅 UUID 是子类。靠 `match(sub_type)` 选型。

| 子类型 | 含义 | TypeName | ctor | 策略 |
| --- | --- | --- | --- | --- |
| 0 | 通用 | `Buffer` | `Binary` | 追加核心 |
| 1 | Function（旧式函数字节，≠ `javascript`） | `Buffer` | `Binary` | 追加 |
| 2 | Binary (old) | `Buffer` | `Binary` | 追加 |
| 3 | UUID (old) | `UUID` | `UUID` | 追加；**写出 subtype 4** |
| 4 | UUID | `UUID` | `UUID` | 追加 |
| 5 | MD5 | `MD5` | `Binary` | 新 |
| 6 | CSFLE 密文 | `BSONEncrypted` | `Binary` | 新 |
| 7 | 压缩列（引擎内部） | `Buffer` | `Binary` | 追加 |
| 8 | 敏感载荷 | `BSONSensitive` | `Binary` | 新 |
| 9 | 向量 | `BSONVector` | `Binary` | 新；ObjectType `{ dtype, values }`；`dtype` 为 `"int8"` / `"float32"` / `"packedBit"`；`packedBit` 可带 `padding`（0–7，默认 0） |
| 128–255 | 用户子类型 | `Buffer` | `Binary` | 追加；要独立名则自备 `match` |

`Buffer` 的 Mongo `match` **必须排除** 3/4/5/6/8/9。

---

## 2. 序列化：BSON / JS 对象 → TypeName

`stringify` 命中该对象后写出的 TypeName（文本形态）。核心类与 `bson` 类可以挂在**同一 TypeName** 下。

| BSON / JS 对象 | TypeName | 文本 | 来源 |
| --- | --- | --- | --- |
| `Date` | `Date` | `Date("…Z")` | 核心 |
| `RegExp` | `RegExp` | `RegExp("/pat/flags")` | 核心 |
| 核心 `Int32` | `Int32` | `Int32("…")` | 核心 |
| `bson.Int32` | `Int32` | 同上 | 本包追加 |
| 核心 `Int64` | `Int64` | `Int64("…")` | 核心 |
| `bson.Long`（`_bsontype === "Long"`） | `Int64` | 同上 | 本包追加 |
| 核心 `Float64` | `Float64` | `Float64("…")` | 核心 |
| `bson.Double` | `Float64` | 同上 | 本包追加 |
| 核心 `Decimal128`（decimal.js） | `Decimal128` | `Decimal128("…")` | 核心 |
| `bson.Decimal128` | `Decimal128` | 同上 | 本包追加 |
| 核心 `Buffer` | `Buffer` | `Buffer("base64,…")` / `hex,…` | 核心 |
| `bson.Binary` subtype 0/1/2/7/128–255 | `Buffer` | 同上 | 本包追加 |
| 核心 `UUID` | `UUID` | `UUID("8-4-4-4-12")` | 核心 |
| `bson.UUID`；`Binary` subtype 3/4 | `UUID` | 同上 | 本包追加 |
| 核心毫秒 `Timestamp` | `Timestamp` | `Timestamp("毫秒")` | 核心 |
| `bson.ObjectId` | `ObjectId` | `ObjectId("24hex")` | 本包 |
| `bson.Binary` subtype 5 | `MD5` | `MD5("32hex")` | 本包 |
| `bson.Binary` subtype 6 | `BSONEncrypted` | `BSONEncrypted("base64,…")` | 本包 |
| `bson.Binary` subtype 8 | `BSONSensitive` | `BSONSensitive("base64,…")` | 本包 |
| `bson.Binary` subtype 9 | `BSONVector` | `BSONVector({ dtype, values })` | 本包 |
| `bson.MinKey` / `MaxKey` | `BSONMinKey` / `BSONMaxKey` | `BSONMinKey("")` / `BSONMaxKey("")` | 本包 |
| `bson.Timestamp` | `BSONTimestamp` | `BSONTimestamp({ t, i })` | 本包 |
| `bson.Code` | `BSONJavaScript` | `BSONJavaScript("源码")` | 本包；仅 unsafe |

别名只是 TypeName 的另一个名字：`Int`→`Int32`，`Long`→`Int64`，`Double`→`Float64`，`Decimal`→`Decimal128`。写出用规范名。

驱动提升后的原生值（`number` / `string` / `boolean` / `null`）没有 TypeName，走字面量，不进本表。

---

## 3. 反序列化：TypeName → BSON / JS 对象

`parse` 用默认实现（`types[0]`）。`replaceDefaultImplementation` 只作用于 **append** 行。

| TypeName | 默认对象 | `replaceDefault` 后 | 构造 |
| --- | --- | --- | --- |
| `Date` | `Date` | — | `new Date(iso)` |
| `RegExp` | `RegExp` | — | `new RegExp(pat, flags)` |
| `Int32` | 核心 `Int32` | `bson.Int32` | 核心包装 / `Int32.fromString` |
| `Int64` | 核心 `Int64` | `bson.Long` | 核心包装 / `Long.fromString` |
| `Float64` | 核心 `Float64` | `bson.Double` | 核心包装 / `Double.fromString` |
| `Decimal128` | 核心 `Decimal128` | `bson.Decimal128` | 核心包装 / `Decimal128.fromString`（不 rounding） |
| `Buffer` | 核心 `Buffer` | `bson.Binary` subtype 0 | 解析 `base64,…` / `hex,…` |
| `UUID` | 核心 `UUID` | `bson.UUID` | `new UUID(str)` |
| `Timestamp` | 核心毫秒 `Timestamp` | — | **不是** `bson.Timestamp` |
| `ObjectId` | `bson.ObjectId` | —（新名） | `new ObjectId(hex)` |
| `MD5` | `bson.Binary` subtype 5 | — | hex → `new Binary(bytes, 5)` |
| `BSONEncrypted` | `bson.Binary` subtype 6 | — | `new Binary(bytes, 6)` |
| `BSONSensitive` | `bson.Binary` subtype 8 | — | `new Binary(bytes, 8)` |
| `BSONVector` | `bson.Binary` subtype 9 | — | `fromInt8Array` / `fromFloat32Array` / `fromPackedBits` |
| `BSONMinKey` / `BSONMaxKey` | `bson.MinKey` / `MaxKey` | — | `new MinKey()` / `new MaxKey()` |
| `BSONTimestamp` | `bson.Timestamp` | — | `new Timestamp({ t, i })` |
| `BSONJavaScript` | `bson.Code` | — | `new Code(源码)`；未开 unsafe 则未注册 |

---

## 4. 选型：两条相反的多对一

本包有两种「一对多」，二者不要混为一谈：

```
鸭子类型     一个 TypeName  →  多个 JS 类
             Int64          →  核心 Int64  |  bson.Long
             UUID           →  核心 UUID   |  bson.UUID
             Buffer         →  核心 Buffer |  bson.Binary（剩余 subtype）
             Decimal128 / Int32 / Float64 同理

共用基类     一个 JS 类     →  多个 TypeName
             bson.Binary    →  UUID | MD5 | BSONEncrypted | BSONSensitive | BSONVector | Buffer
             bson.Long 继承 →  Int64（Long）| BSONTimestamp（Timestamp 子类）
```

- **stringify**：从实例出发，要先分辨 TypeName（共用基类靠 `match`），再在该名下认实现（鸭子类型）。
- **parse**：TypeName 已写在文本里，只需在该名的实现列表里选 ctor；**不必**再看 Binary subtype。
- 命中规则：`instanceof ctor`，有 `match` 再过滤。扫描顺序为 registry 插入序，取第一个命中项。

### 4.1 序列化（实例 → TypeName）

```
实例
 ├─ 装饰器 / getDeclaredType 有 TypeName？
 │    是 → 只在该名的 types[] 里用 instanceof ∧ match 选实现
 ├─ [TypeDiscriminatorKey]() 返回名？
 │    是 → 同上
 └─ 否则扫全部 TypeName（插入序）
      └─ 第一个 instanceof ∧ match 成功的 (TypeName, 实现)
           └─ 用该实现 serialize → TypeName(...)
```

未命中则不是本表范围（字面量 / 普通对象）。

`Long` 与 `Timestamp` 共用继承，必须靠 `match` 拆开：

```
value instanceof Long
 ├─ _bsontype === "Timestamp"  →  BSONTimestamp
 └─ _bsontype === "Long"       →  Int64（本包 Long 实现）
```

继承只影响**实例识别**（`instanceof Long` 会命中两者，须 `match` 拆分），**不延伸到文本形式**：`BSONTimestamp` 用 object 形式 `{t, i}`，`Int64`（`bson.Long`）用 scalar 十进制串，二者刻意不统一。理由：TypeName 是语言无关契约，BSON timestamp 的跨语言语义是 (seconds, increment) 二元组（EJSON `$timestamp` 同构、.NET / Python 驱动同此），不是 64 位整数；十进制形式会把 bson 的「high=t, low=i」位布局——继承自 `Long` 的存储实现细节——泄漏进文本格式；且与核心毫秒 `Timestamp` / `Int64` 形态雷同易混。`kind` 是 TypeInfo 的属性，与 ctor 继承无关，同继承链挂不同 TypeName / 不同 kind 无机制冲突。

`Binary` 一族：核心先登记了 `Buffer`（ctor 是**核心** `Buffer` 类，无法识别 `bson.Binary`）。本包再往 `Buffer` **追加** `Binary` 实现。若该实现的 `match` 不排除专用 subtype，插入序会让加密 / 向量全部写成 `Buffer(...)`。

```
value
 ├─ instanceof bson.UUID
 │    或 Binary.sub_type ∈ {3, 4}     →  UUID
 ├─ Binary.sub_type === 5             →  MD5
 ├─ Binary.sub_type === 6             →  BSONEncrypted
 ├─ Binary.sub_type === 8             →  BSONSensitive
 ├─ Binary.sub_type === 9             →  BSONVector
 └─ 其余 Binary                       →  Buffer（本包追加实现）
```

各 TypeInfo 的 `match` 必须互斥，并覆盖上图每一支。`UUID` 用子类 ctor，其余共用 `Binary` + `sub_type`。

### 4.2 反序列化（TypeName → 实例）

文本里已经有 TypeName，**不再**按 subtype 猜名字。

```
TypeInstance  TypeName(arg)
 │
 ├─ parseAs(Ctor)     →  该名下 getTypeInfoByCtor(Ctor)
 │                         精确 ctor，否则「实现是 Ctor 的子类」
 │                         找不到则抛；不改 types[0]
 ├─ parseAs(TypeName) →  该名 getDefaultType
 └─ parse             →  getDefaultType（types[0]）
      │
      ├─ 新 TypeName（ObjectId、MD5、…）
      │     登记后 types[0] 就是本包实现
      ├─ 追加 TypeName（Int64、UUID、Buffer、…）
      │     默认仍是核心类
      │     replaceDefaultImplementation 为 true
      │       或 { Int64: true } 等
      │     → 把本包实现置顶
      └─ BSONJavaScript
            allowUnsafeTypes 才登记
            默认 include 跳过；显式 include 则抛
 │
 └─ createInstance：deserialize(arg) 或 new ctor(arg)
```

因此：

- `parse('Int64("1")')` 默认 → 核心 `Int64`；`replaceDefault.Int64` 或 `parseAs(Long)` → `bson.Long`。
- `parse('MD5("…")')` → 一定是 `Binary` subtype 5，与 `Buffer` 的默认实现无关。
- `parseAs(Binary, 'MD5("…")')`：TypeName 仍是 `MD5`，在 **MD5** 的列表里按 ctor=`Binary` 选中，合法。
- `findTypeNameByCtor(Binary)` 只返回**第一个**登记了该 ctor 的 TypeName（通常是 `Buffer`），不能用来从 `Binary` 反推 MD5 / 向量。从实例反推 TypeName 只走 §4.1。

### 4.3 对照

```
                    stringify                         parse
鸭子类型    任一实现 → 同一个 TypeName         只构造 types[0]
            Long / 核心 Int64 都写成 Int64     除非 replaceDefault / parseAs

共用基类    先 match 拆成不同 TypeName         文本里的 TypeName 已决定
            Binary(6) → BSONEncrypted          BSONEncrypted(...) → Binary(6)
```

---

## 5. 选项交叉：设计要点与测试覆盖

表 2 / 3 是 TypeName ↔ 对象。驱动读选项与本包 / Handling 交叉后的 **行为矩阵只在 [behavior-matrix.md](../../../packages/tason-mongodb/behavior-matrix.md) 维护一份**，本节不复制矩阵，只记职责划分、机制说明与测试覆盖。协议后的行为差异另见 §6。

两层不要混：

1. `bson.deserialize` 的 `promoteValues` / `promoteLongs` / `useBigInt64` / `promoteBuffers` 决定 stringify **输入**是什么。
2. `replaceDefaultImplementation` 只改 parse 的 `types[0]`。核心 Number Handling 现行**只拆 / 只裸写核心数值包装**；`bson.Long` 等不是核心包装（协议后的变化见 §6）。
3. `replaceDefaultImplementation` **不作用于 stringify**（机制见 §5.1）。

behavior-matrix 三张矩阵与本节的对应：驱动读出 → `stringify`（§5 职责 1）、`parse`：`replaceDefault` × Handling（职责 2）、`stringify` bson 数值类 × Handling（职责 3，含「replaceDefault 不影响序列化」的结论）。

### 5.1 replaceDefault 与序列化无关（机制说明）

stringify 扫描（`tryGetTypeInfo` 兜底路径）按「TypeName 插入序 × 名内 `types[]` 顺序」对实例做 `instanceof` ∧ `match`，命中哪个实现就用哪个的 `serialize` / `match`，与 `types[0]` 是谁无关。本包各追加实现与核心包装是**互不相关**的类（`bson.Long` 不 `instanceof` 核心 `Int64`，反之亦然），且各 `match` 互斥，故 `asDefault` 置顶（换 `types[0]`）不改变命中结果，也不改变扫描路径——扫描从头到尾与「谁是默认实现」无关。

唯一理论例外：同一 TypeName 下多个实现存在**继承关系**且 `match` 不互斥时，置顶会改变名内扫描的先命中者。本包无此情况——`bson.Timestamp` 继承 `Long` 是**跨 TypeName**（`BSONTimestamp` vs `Int64`）的拆分，由 TypeName 插入序 + Long 实现的 `match`（`_bsontype === "Long"`）双重保证。

### 5.2 测试覆盖

| 编号 | 场景 | 文件 |
| --- | --- | --- |
| M1 | `replaceDefault` 全开 / 按名 | `options.test.ts` |
| M2 | `parseAs(Long)` / `parseAs(Binary, MD5)` | `options.test.ts` |
| M3 | `include` / `allowUnsafeTypes` | `options.test.ts` |
| M4 | `promoteLongs`：安全整数字面量 vs `Long` → `Int64` | `options.test.ts` |
| M5 | `promoteBuffers`：通用仍 `Buffer`；MD5 丢失 subtype | `options.test.ts` |
| M6 | Handling × bson 数值类：默认装箱；`none` 抛错；反序列化 `all` 无 replace 仍核心包装；replace 后 Handling 不拆（协议后按 §6 重写） | `options.test.ts` |
| M7 | `promoteValues: false` 的 Int32/Double；`useBigInt64` 的安全 / 超范围 long | `options.test.ts` |
| T1–Tn | 各 TypeName 默认 parse / stringify（含 Binary 选型） | `types.test.ts` |
| R1 | catalog / Buffer 追加实现 | `register.test.ts` |

不要在本包测试里抄核心 N1–N8 全矩阵；只固定 behavior-matrix 与驱动选项的交叉场景。

不在本包测：核心 Handling 全类型矩阵（`number-handling.test.ts`）；真实驱动 / mongoose（C 集成，需额外环境）。

---
## 6. 数值 Handling：现行与协议后的行为差异（待 runtime-type phase-4）

[behavior-matrix.md](../../../packages/tason-mongodb/behavior-matrix.md) 与 §5.2 的 M6 测试描述的是 **C1–C3 已实现的行为**。「统一数值实现协议」——数值 TypeName 的实现（内置与第三方）以 `TASONTypeInfo.unwrapNumber` 为统一契约、核心单轨化、多实现共存——设计定稿于 **[runtime-type/phase-4-number-protocol.md](../runtime-type/phase-4-number-protocol.md)，尚未实施**（进度在该 feature 的 implementation-plan 勾选）。协议实现后，按本表回改 behavior-matrix 与 M6 测试（跟进任务：[implementation-plan](./implementation-plan.md) 阶段 C4）。

| 差异点 | 现行为（已实现） | 协议落地后 |
| --- | --- | --- |
| 反序列化 `native` × replaceDefault 开 | 不拆：`Int64("1")` → `bson.Long` | 拆箱：Long → `bigint`、Int32 / Double → `number`、Decimal128 → `Decimal`；`all` 仍保留 bson 类 |
| 序列化 `unsafe-only` × bson 数值类 | 安全整数也装箱（`Int64("1")`） | 与核心包装一致：安全裸写 `1`，超范围才装箱 |
| 序列化 `none` × bson 数值类 | 抛错 | 强制裸字面量 |
| 反序列化 `native` × replaceDefault 关 | 拆核心包装为原生值 | 不变 |
| 机制 | 核心只认 `INumber.value`（内置白名单，双轨） | 数值 TypeName 实现统一契约 `unwrapNumber`（内置同此，单轨） |

注意：协议落地后，「replaceDefault 开 + 默认 `native`」会把 parse 出的 bson 类拆成原生值——要保留 bson 类（喂驱动 / mongoose），配 `deserializeNumberHandling: "all"` 或单次 `parseAs(Long)`。方案细节（钩子工作流、原型协议备选评估、bson 四钩子）见协议文档 §3–§6。
