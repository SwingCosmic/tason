
# 类型系统


## 基本类型

涵盖了JSON5中的基本类型

* `null`
* boolean: `true`或`false`
* number: 64位浮点数
  * ✅ 十进制整数和小数
  * ✅ `0x`十六进制,`0o`八进制,`0b`二进制
  * ❌ 不支持以单个0开头的八进制数字，如0123e4, -0345，极易造成混淆，并且js严格模式下不支持
  * ⚠️ 不支持大写形式的`0X`,`0O`,`0B`，因为大写`O`极易与`0`混淆
  * ✅ 科学计数法
  * ✅ `NaN`,`Infinity`, `-Infinity`
  * ✅ .01和10.
  * ✅ 可以有前导的 `+`
* string: 字符串
  * ✅ 单引号
  * ✅ 双引号
  * ✅ 不转义的Unicode字符
  * ✅ `\uXXXX` Unicode字符转义
  * ✅ `\xXX` 十六进制转义
  * ✅ `\b \f \n \r \t \v \0 \' \"`
  * ⚠️ js支持 `\u{XXXX}` 形式的Unicode字符转义，但这和`\uXXXX`作用完全相同并且更长，故被排除以简化语法
  * ❌ 不支持转义行尾换行符，从而让字符串跨域多行。TASON主要面向数据传输而不是配置文件，在跨平台情况下检查换行符采用的是CRLF还是LF十分困难
  * ⚠️ 不支持转义`/`，在大部分语言中正斜杠都无需转义。即使作为参数传给内置的`RegExp`标量类型，也无需转义
* array: 数组
  * ✅ 可以有尾随逗号
  * ✅ 支持各种可迭代对象。例如在JavaScript中指`Iterable<T>`， C#中指`IEnumerable<T>`
* object: 对象字面量
  * ✅ 可以有尾随逗号
  * ✅ 属性名可以是符合 `[a-zA-Z_][a-zA-Z0-9_]*` 的标识符
  * ✅ 属性名可以是字符串
  * ⚠️ 不支持以`$`开头的标识符，因为很多语言如C#的标识符不能以`$`开头
  * ❌ 不支持将其他合法的Unicode字符（包括汉字）作为标识符，容易造成混淆，并且非字母数字的标识符很少作为属性名
* 注释
  * ✅ 单行注释
  * ✅ 多行注释
* 空白字符
  * ✅ 空格` `, `\r`, `\n`, `\t`
  * ❌ `\b`, `\v`, `\f`, `\0`: 不应该出现在代码中
  * ❌ 行分隔符 `\u2028`, 段落分隔符`\u2029`: 臭名昭著
  * ⚠️ 不支持零宽度空格 `\u200B`: 该字符极易在各种软件特别是URL末尾中产生，且无法看见，从而造成难以排查的问题
  * ⚠️ 不支持不间断空格 `\u00A0`, 全角空格 `\u3000`: 该字符来源极广，且难以和普通空格区分，从而造成混淆
## TASON类型实例

TASON类型实例包括两大类：标量类型(ScalarTypeInstance)和对象类型(ObjectTypeInstance)。

### 标量类型实例 ScalarTypeInstance

类似GraphQL中的Scalar，代表了一种不会被细分的基元类型，比如各种整数、浮点数、日期时间、正则表达式、UUID等。

* 标量类型使用代表值的字符串进行构造，如`RegExp("/^[A-Z0-9_]+$/i")`，`Int64("0x1234ABCDEF")`
* 可以创建自己的标量类型，并且标量类型不受类型的复杂程度限制。例如可以创建一个名为`JSON`的标量类型，使用`JSON.stringify()`和`JSON.parse()`进行序列化和反序列化一整个字符串
* 默认情况下，标量类型对应的类具有一个构造函数，接受一个代表值的字符串作为参数

### 对象类型实例 ObjectTypeInstance

对象类型代表一种强类型化的对象，比如各种结构体、类、字典等。

* 对象类型使用对象字面量进行构造，如`Person({ name: "John", 'age': 30 })`
* 可以创建自己的对象类型。有两种常见的实现方式：
  * 类拥有一个无参构造函数，并在创建后再对对应的属性进行赋值
  * 对于动态语言如js来说，为了简化使用，对应的类的构造函数可以接受一个对象字面量作为参数，其中对象的每一个属性都是这个类的公共可写属性名
  * 在C#中record类型可以直接注册为对象类型，因为它通常具有类初始化器、复制构造函数等简化对象创建的方法

# 内置类型

内置类型的支持正在补充中

## 整数和浮点数类型

### 必须提供
* ✅ UInt8 : 8位无符号整数，提供别名Byte
* ✅ Int16 : 16位有符号整数，提供别名Short
* ✅ Int32 : 32位有符号整数，提供别名Int
* ✅ Int64 : 64位有符号整数，提供别名Long
* ✅ Float32 : 32位浮点数，提供别名Single
* ✅ Float64 : 64位浮点数，提供别名Double
* ✅ Decimal128 : 128位有符号十进制数，提供别名Decimal
* ✅ BigInt : 无限精度整数

### 可选提供
* Int8 : 8位有符号整数
* UInt16 : 16位无符号整数
* UInt32 : 32位无符号整数
* UInt64 : 64位无符号整数
* Float16 : 16位浮点数，提供别名Half

### ⚠️ 数字类型注意事项

> **JavaScript 实现说明**：JS/TS 没有定长数值原语（仅有 `number` / `bigint`）。本仓库通过 **数值处理选项** 控制装箱/拆箱，并通过 **实体 Schema** 把字段收成期望的运行时类型。使用说明：
>
> - [数值处理（Number Handling）](./number-handling.md)
> - [实体元数据与 Schema](./class-metadata.md)

标准不要求提供UInt8以外的无符号整数类型，以及8位有符号整数。很多语言如Java不支持无符号整数类型，并且被.NET标记为CLS不兼容。

如果你的语言支持这些默认不提供的数字类型，并且可能包含其它范围更小或者更大的数字类型（如Int128），应该提供相应类型的实现；
如果你的语言中对应类型的名称和标准的名称不一致，应当提供别名以简化使用，例如Java中Decimal128的实现采用`BigDecimal`类型。

在数据传输上，由于无符号类型和对应的有符号类型采用相同的内存表示，因此可以很容易地转换。
其它内存表示为整数或者浮点数的类型（如C#字符类型Char，本机大小的整数IntPtr），除特殊用途外，应该转换为相同内存表示的标准数字类型。

## 时间日期

* ✅ Date : 时间日期，使用JavaScript的`Date`对象。
时区取决于创建时是否指定了时区标记（例如UTC标记`Z`或者精确时间偏移`+06:30`），如果没有标记，默认为本地时区。
* ✅ DateOnly : 仅包含日期，和时区无关。
* ✅ TimeOnly : 仅包含24小时制的时间，和时区无关。
* ✅ Timestamp : UTC时间戳（单位为毫秒），和时区无关。
独立设置时间戳类型是为了解决语义上表达距`1970-01-01T00:00:00Z`经过的毫秒数，并且在数据库等场景中往往有单独的处理方式。

⚠️ 由于很多语言使用`Date`类型表示时间日期，如果采用`DateTime`表示时间日期，`Date`和`Time`分别表示只有日期和只有时间的类型，
可能会引起混淆。因此这里使用`Date`表示时间日期，`DateOnly`和`TimeOnly`分别表示只有日期和只有时间的类型。
这样在.NET, JavaScript, Java等语言中都不会产生混淆。

## 其它内置类型

* ✅ RegExp: 正则表达式，采用PCRE语法，并用js风格的/.../包裹起来，后面跟上正则表达式选项字符
  * ⚠️ 正则表达式在不同语言的支持存在差异，具体见 [正则表达式](regexp.md)
* ✅ UUID : UUID/GUID，横杠分隔的形式
* ✅ JSON类型: 包括`JSON`, `JSONObject`和`JSONArray`。虽然TASON完全支持JSON的语法，但在某些情况下仍然需要使用目标语言所使用的专用JSON类型，
例如Java的JSONObject(fastjson)，以便于更好地控制序列化反序列化过程
* ✅ Buffer : 二进制数据，使用base64编码或者HEX字符串
  * ⚠️ 通常Buffer类型用于DTO中用来承载小型二进制数据，例如嵌入的图片、哈希和证书等，以简化序列化过程。
  虽然TASON支持序列化字节数组，但不管是序列化还是反序列化，对于二进制数据来说，在体积和性能上开销太大，因此不建议直接使用原生的字节数组类型参与序列化。
  * ⚠️ Buffer类型不提供“二进制字符串”，即完全使用转义符+ASCII字符将字节数组序列化成字符串的格式。虽然二进制字符串可以降低序列化开销，但是会带来较多的安全问题，体积上由于转义符的存在也没有优势，因此不提供支持。

## JavaScript类型

* DOM对象：采用HTML/XML字符串表示
* 各种TypedArray, DataView，ArrayBuffer和node.js Buffer：转换为Buffer类型

## 类型注意事项

以下类型可能会导致一些问题，需要谨慎使用

### 集合类型

集合类型是指可迭代/可枚举类型，如js的`Iterable<T>`，c#的`IEnumerable<T>`等，表达比数组更复杂的集合数据结构。

默认情况下，集合类型将会以数组的形式序列化，因此存在以下限制：
* ⚠️ 不指定类型反序列化时只能得到数组
* ⚠️ 对象中包含可迭代类型的属性时，如果该对象不能正确处理数组类型到到可迭代对象的转换（通常发生在js和Python等动态语言中），则可能发生异常
* ⚠️ 在C#中，对于泛型可迭代对象，在反序列化时可能因为其中的项违反泛型约束而失败

如果确实需要保留集合类型，可以设置选项`useBuiltinCollection`为true来序列化为ObjectTypeInstance，而不是数组
* ⚠️ 启用`useBuiltinCollection`的情况下，无法保证跨语言的兼容性，例如C#的`SortedList<T>`在Java中找不到匹配项。

### 字典类型

字典类型是指js和java的`Map<K, V>`，C#的`IDictionary<K, V>`，Python的`dict[K, V]`等用于存储键值对的类型；在js中普通对象也常用来当做字典使用。

默认情况下，字典将会以对象的形式序列化，因此存在以下对象类型的限制：
* ⚠️ 仅支持键为字符串，使用非字符串的键会导致未定义的行为
  * 在非泛型字典中，如js和Java中通常会丢弃非法的键值对
  * 在C#中，如果泛型`Dictionary<K, V>`的键类型`K`不是字符串，则会抛出异常；非泛型字典丢弃字符串以外的键值对
* ⚠️ 在js中使用数字作为Map的键会在序列化时转换为字符串，反序列化时会产生类型错误
* ⚠️ js 的 Symbol 键 / 值及可迭代协议：见 [不安全的类型 · Symbol](#不安全的类型)

如果确实需要非字符串的键（含对象键等），可以设置选项`useBuiltinDictionary`为true来序列化为内置Dictionary类型，而不是对象

### 不安全的类型

> 以下类型需要启用`allowUnsafeTypes`选项才能使用

* ⚠️ js的`Symbol`: 因为其设计上的特殊性，虽然Symbol可以被序列化和反序列化，但不能保证反序列化后的Symbol对象与原始Symbol对象是同一个。
  * ✅ 可作为**属性值** / 数组元素（需 `allowUnsafeTypes`）
  * ✅ 可作为 **Dictionary/Map 的键或值**（需 `allowUnsafeTypes`；完整往返建议再加 `useBuiltinDictionary`）
  * **未**开启 `allowUnsafeTypes` 时：凡 symbol **进入序列化逻辑**（属性值、数组元素、Map/Dictionary 的 key 或 value）一律**报错**，不得静默丢弃
  * **普通对象上的 Symbol 键**：
    * 未 `allowUnsafeTypes`：不进入序列化视图（与 `Object.entries` 一致），忽略
    * 有 `allowUnsafeTypes`：会尝试读取可枚举 Symbol 键值对  
      * ✅ 有 `useBuiltinDictionary` → 提升为 `Dictionary`，Symbol 键可完整序列化  
      * ⚠️ 否则TASON对象语法无法表达 → **忽略** Symbol 键（仅保留字符串键）
  * **可迭代协议** `[Symbol.iterator]` / `[Symbol.asyncIterator]`：
    * 必须是**方法**（`typeof === "function"`），否则**报错**
    * `iterator` 为方法 → 按 **iterable** 展开（优先于对象/Dictionary 字段路径）
    * `asyncIterator` 为方法 → 不支持，报错
  * ❌ 本地 `Symbol()` / `Symbol("desc")`（仅 `Symbol.for` 与 well-known）
  * ⚠️ 描述名为 well-known 的 `Symbol.for("Symbol.toStringTag")` 反序列化会落到 well-known `Symbol.toStringTag`（身份可能变化）
* ⚠️ 共享内存对象，如js的`SharedArrayBuffer`: 由于可以被多线程写入，无法保证值在序列化时是固定的；始终克隆一个`ArrayBuffer`的副本以防止被修改。
* ⚠️ 指针类型：只能序列化为对应的基础数值类型；无法反序列化，反序列化指针没有意义且具有严重的安全问题

### 不支持的类型

* ❌ 异步包装类，如js的`Promise`, c#的`Task`和`ValueTask`: 无法在同步方法内调用
* ❌ 异步迭代器和生成器: 无法在同步方法内调用
* ❌ 各种函数和类的定义: 序列化和传输代码是一种高危操作。如果需要在特定条件（例如MongoDB查询）下使用，请使用自定义的类型包装代码
* ❌ 类的静态成员和非公共成员: 按语义不支持。也不会提供选项来控制序列化私有字段，请使用公共属性进行暴露，或者提供自定义序列化方法
* ❌ 循环引用: 序列化循环引用往往会带来各种性能和安全问题，而且需要额外的语法调整，因此不支持。
* ❌ 支持弱引用的类型，如js和Java的`WeakMap`, `WeakSet`: 为了避免影响GC，这些类型都无法枚举，因此无法得到需要序列化的内容

## 同一 TypeName 的多种实现

同一 TypeName 可挂多个 JavaScript 实现（例如核心 `Int64` 包装与日后的 `bson.Long`）：

- 再 `registerType` 同名 = **追加类型实现**（`stringify` 认实例；`parse` 仍用当前默认）。
- `registerType(..., { asDefault: true })` / `setDefaultType` 可更换默认实现。
- 单次选型用 `parseAs(ctor | TypeName, text)`，不改变全局默认。

扩展包（如 [`tason-mongodb`](../packages/tason-mongodb/README.md)）通过 `registerMongoDBTypes` 使用上述 API；BSON 类型实现见该包 README。

## 扩展类型

核心默认表不含 MongoDB / BSON。需要这些 TypeName 时安装 [`tason-mongodb`](../packages/tason-mongodb/README.md) 并 `registerMongoDBTypes(registry)`：

| TypeName | 文本 | 说明 |
| --- | --- | --- |
| `ObjectId` | `ObjectId("24hex")` | `bson.ObjectId` |
| `BSONMinKey` / `BSONMaxKey` | `BSONMinKey("")` / `BSONMaxKey("")` | 无载荷标量 |
| `BSONTimestamp` | `BSONTimestamp({ t, i })` | BSON 内部时间戳；**不是**核心毫秒 `Timestamp` |
| `BSONJavaScript` | `BSONJavaScript("源码")` | `bson.Code`；需 `allowUnsafeTypes` |
| `Int64` / `Decimal128` / `Int32` / `Float64` / `UUID` / `Buffer` | 与核心同名 | 追加 bson 类；`replaceDefaultImplementation` 可换成默认 |
| `MD5` | `MD5("32hex")` | `bson.Binary` subtype 5 |
| `BSONEncrypted` / `BSONSensitive` | `BSONEncrypted("base64,…")` | `bson.Binary` subtype 6 / 8 |
| `BSONVector` | `BSONVector({ dtype, values })` | `bson.Binary` subtype 9；`dtype` 为 `"int8"` / `"float32"` / `"packedBit"` |

Binary 子类型、驱动 `promote*` 与 `replaceDefault` / Handling 交叉见该包 README 的选项矩阵。  
对象图写入文档时的 `_t` 打标 **不属于** 该扩展包，见实现资料 `docs/features/polymorphic-persistence/`。
