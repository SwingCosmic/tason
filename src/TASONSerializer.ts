import {
  CharStreams,
  CommonTokenStream,
  InputStream,
  ParserRuleContext,
  ParseTree,
} from "antlr4";
import TASONTypeRegistry from "./TASONTypeRegistry";
import TASONLexer from "./grammar/TASONLexer";
import TASONParser from "./grammar/TASONParser";
import { TASONVisitor } from "./TASONVisitor";

export default class TASONSerializer {
  readonly registry = new TASONTypeRegistry();

  constructor() {}

  parse(text: string): any {
    const chars = CharStreams.fromString(text);
    const lexer = new TASONLexer(chars);
    const tokens = new CommonTokenStream(lexer);
    const parser = new TASONParser(tokens);
    const tree = parser.start();

    const visitor = new TASONVisitor(this.registry);
    return visitor.visit(tree);
  }

}
