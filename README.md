# TASON

![npm](https://img.shields.io/npm/v/tason?color=green)

TASON (Type-Augmented Serialization Object Notation，发音`/ˈtæsən/`) 是一种类型化的对象表示语法，可以用于序列化和反序列化数据。


## 特性

TASON的三大特性：**人类可读**、**自描述强类型**和**动态结构**

### 人类可读
* TASON是一种文本序列化，语法是JSON的超集，使用起来非常方便。
* 在保留绝大部分JSON5对JSON的语法简化的同时，移除了少数容易产生混淆的语法和空白字符，以减低手工编写时的错误率。

### 自描述强类型
* TASON的语法包含了类型信息，不需要额外的描述文件，因此可以非常方便的进行反序列化。
* TASON类型是语言无关的，即使是TASON内置类型，具体的实现也取决于所使用的语言，只需要语义上的一致即可
* 支持类型判别器(discriminator)、创建类型别名和指定序列化类型，实现多态序列化、多对一反序列化、鸭子类型序列化

### 动态结构
* TASON支持动态结构，对象可以包含任意数量的属性，或者将动态对象和固定类型对象混合使用。
* 在`Protocol Buffers`, `MessagePack`等二进制序列化中，
为了表达动态结构，仍然需要通过内嵌JSON字符串等方式进行降级，反而降低了其性能和强类型优势


## 使用场景

### 推荐场景

1. 低代码平台、企业数据中台、数据仓库、仪表盘、BI分析等所使用的高度动态化查询结果，可以同时实现强类型，自描述和人类可读的数据格式。
2. 含有动态类型的非关系型数据库如MongoDB的无损数据查询和保存。MongoDB支持在查询中使用复杂类型，
如果使用传统基于JSON的API接口传递参数，例如传递字符串形式的Date, Int64和RegExp，可能会在查询动态结构文档时，类型不匹配而查询不到数据。
事实上，MongoDB管理工具展现数据的格式和TASON非常相似，也是其灵感来源之一
3. 将接口数据反序列化为JavaScript类，从而简化JavaScript基于实体类的跨平台/同构(isomorphic)应用开发

### 其它可用场景

1. 编写强类型的配置文件，直接获得配置对象实例，解决JSON弱类型带来的反序列化复杂性
2. 配合SOAP, GraphQL等已有的强类型数据和服务规范，推出简化的Web API

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

TASON类型包括两大类：标量类型(Scalar)和对象类型(Object)。

### 标量类型

类似GraphQL中的Scalar，代表了一种不会被细分的基元类型，比如各种整数、浮点数、日期时间、正则表达式、UUID等。

* 标量类型使用代表值的字符串进行构造，如`RegExp("/^[A-Z0-9_]+$/i")`，`Int64("0x1234ABCDEF")`
* 可以创建自己的标量类型，并且标量类型不受类型的复杂程度限制。例如可以创建一个名为`JSON`的标量类型，使用`JSON.stringify()`和`JSON.parse()`进行序列化和反序列化一整个字符串
* 默认情况下，标量类型对应的类具有一个构造函数，接受一个代表值的字符串作为参数

### 对象类型

对象类型代表一种强类型化的对象，比如各种结构体、类、字典等。

* 对象类型使用对象字面量进行构造，如`Person({ name: "John", 'age': 30 })`
* 可以创建自己的对象类型。有两种常见的实现方式：
  * 类拥有一个无参构造函数，并在创建后再对对应的属性进行赋值
  * 对于动态语言如js来说，为了简化使用，对应的类的构造函数可以接受一个对象字面量作为参数，其中对象的每一个属性都是这个类的公共可写属性名
  * 在C#中record类型可以直接注册为对象类型，因为它通常具有类初始化器、复制构造函数等简化对象创建的方法


## 使用

主要的类为`TASONSerializer`，提供了`parse`和`stringify`方法。
该类的构造函数支持传递一些参数来控制序列化和反序列化的行为，例如是否允许重复的对象键，缩进级别，最大嵌套层次等。

包的默认导出对象`TASON`是具有合理默认参数的`TASONSerializer`实例，可以直接使用。

### 安装

```bash
npm install tason
# or
yarn add tason
# or
pnpm add tason
```

注意 `tason` 仅支持 ESM，因此你的项目如果在前端使用，需要一个模块打包器如 `vite`、`webpack`等；如果在node.js使用，需要原生支持ESM导入

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

### 序列化

```typescript
import TASON from 'tason';
const serializer = new TASON.Serializer({
  indent: 2, //指定缩进级别为2个空格
  registry: TASON.registry.clone(), // 复用全局实例的类型注册表
});

const people = [
  new Person("John", 30),
  new Person("Jane", 25),
];

console.log(serializer.stringify(people));

```

## 内置类型

内置类型的支持正在补充中

### 整数和浮点数类型

* ✅ Byte : 8位无符号整数
* ✅ Int16 : 16位有符号整数
* ✅ Int32 : 32位有符号整数
* ✅ Int64 : 64位有符号整数
* ✅ Float32 : 32位浮点数
* ✅ Float64 : 64位浮点数
* ✅ Decimal128 : 128位有符号十进制数
* ✅ BigInt : 无限精度整数

不提供Byte以外的无符号整数类型，以及8位有符号整数。
很多语言如Java不支持无符号整数类型，并且被.NET标记为CLS不兼容。
在数据传输上，无符号类型可以很容易地使用有符号类型进行无损转换。

### 时间日期

* ✅ Date : 时间日期，使用JavaScript的`Date`对象。时区取决于创建时是否指定了时区标记。
* Time : 时间，时区取决于创建时是否指定了时区标记。
* Timestamp : UTC时间戳（单位为秒），和时区无关。

### 其它内置类型

* ✅ RegExp: 正则表达式，采用PCRE语法，并用js风格的/.../包裹起来，后面跟上正则表达式选项字符
* UUID : UUID/GUID，横杠分隔的形式
* ✅ JSON类型: 包括`JSON`, `JSONObject`和`JSONArray`。虽然TASON完全支持JSON的语法，但在某些情况下仍然需要使用目标语言所使用的专用JSON类型，
例如Java的JSONObject(fastjson)，以便于更好地控制序列化反序列化过程
* ✅ Buffer : 二进制数据，使用base64编码或者HEX字符串
* 哈希值类型：包括MD5, SHA1, SHA256, CRC32等常见哈希算法，HEX字符串

### 不安全的类型

* ✅ Symbol: 符号，使用js风格的`Symbol('name')`。因为其设计上的特殊性，虽然Symbol可以被序列化和反序列化，但不能保证反序列化后的Symbol对象与原始Symbol对象是同一个
* 字典类型：如js和java的Map，C#的Dictionary等。仅支持键为字符串，使用非字符串的键会导致未定义的行为，可能抛出异常，也可能丢弃键值对