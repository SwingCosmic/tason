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

export interface SerializerOptions {
  allowUnsafeTypes?: boolean;
  nullPrototypeObject?: boolean;
  allowDuplicatedKeys?: boolean;
}

export interface SerializerOptionsInit extends SerializerOptions {
  registry?: TASONTypeRegistry;
}

export default class TASONSerializer {
  readonly registry: TASONTypeRegistry;
  readonly options: Required<SerializerOptions>;

  constructor(options: SerializerOptionsInit = {}) {
    options.allowUnsafeTypes ??= false;
    options.nullPrototypeObject ??= false;
    options.allowDuplicatedKeys ??= true;
    options.registry ??= new TASONTypeRegistry(options.allowUnsafeTypes);

    this.registry = options.registry;
    delete options.registry;
    this.options = options as any;
  }

  parse<T = any>(text: string): T {
    const chars = CharStreams.fromString(text);
    const lexer = new TASONLexer(chars);
    const tokens = new CommonTokenStream(lexer);
    const parser = new TASONParser(tokens);
    parser.addErrorListener(new ThrowingErrorListener());
    const tree = parser.start();

    const visitor = new TASONVisitor(this.registry, this.options);
    return visitor.visit(tree);
  }

}
