import {
  CharStreams,
  CommonTokenStream,
  ErrorListener,
  InputStream,
  ParserRuleContext,
  ParseTree,
  RecognitionException,
  Recognizer,
} from "antlr4";
import TASONTypeRegistry from "./TASONTypeRegistry";
import TASONLexer from "./grammar/TASONLexer";
import TASONParser from "./grammar/TASONParser";
import { TASONVisitor } from "./TASONVisitor";
import { TASONGenerator } from "./TASONGenerator";
import { SerializerOptions, SerializerOptionsInit } from "./SerializerOptions";

class ThrowingErrorListener implements ErrorListener<any> {
  syntaxError(
      recognizer: Recognizer<any>,
      offendingSymbol: any,
      line: number,
      charPositionInLine: number,
      msg: string,
      e: RecognitionException | undefined
  ): void {
    throw e || new Error(msg);
  }
}

export default class TASONSerializer {
  readonly registry: TASONTypeRegistry;
  readonly options: Required<SerializerOptions>;

  private readonly visitor: TASONVisitor;

  constructor(options: SerializerOptionsInit = {}) {
    options.allowUnsafeTypes ??= false;
    options.nullPrototypeObject ??= false;
    options.allowDuplicatedKeys ??= true;
    options.indent ??= false;
    options.maxDepth ??= 64;
    options.registry ??= new TASONTypeRegistry(options.allowUnsafeTypes);

    this.registry = options.registry;
    delete options.registry;
    this.options = options as any;

    this.visitor = new TASONVisitor(this.registry, this.options);
  }

  parse<T = any>(text: string): T {
    const chars = CharStreams.fromString(text);
    const lexer = new TASONLexer(chars);
    const tokens = new CommonTokenStream(lexer);
    const parser = new TASONParser(tokens);
    parser.addErrorListener(new ThrowingErrorListener());
    const tree = parser.start();

    return this.visitor.visit(tree);
  }

  stringify(value: any): string {
    const generator = new TASONGenerator(this.registry, this.options);
    return generator.generate(value);
  }

}
