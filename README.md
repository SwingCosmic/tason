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

## 语法

详细语法见此ANTLR4语法文件 [TASON.g4](src/grammar/TASON.g4)

TASON语法以JSON5为蓝本，去掉了少数易混淆的语法，并增强了类型支持。

以下是一个TASON文件示例，来表达MongoDB的一个文档记录：

```javascript
{
  _id: ObjectId("6670f391dcb0bd791cb3bd18"),
  id: UUID("3e5b933e-adc1-48a8-b0f8-30aa701cfd77"),
  "$type": "com.alibaba.fastjson.JSONObject",
  name: "Pilipili Corporation",
  createTime: Date("2025-01-01T00:00:00.000Z"),
  reportDate: '2024-12',
  financial: {
    totalAsset: 66666666666.,
    totalDebt: 9876547210.33,
    netProfit: Decimal128("114514.1919"),
  },
  legalPerson: User({
    id: Int64("6571037680684232705"),
    name: "🤣👉🤡👈🤣",
    age: 24
  }),
  keywords: ["线下PVP", '本子', "femboy", ]
}
```

## 类型系统

参见 [类型系统说明](docs/type-system.md)

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
