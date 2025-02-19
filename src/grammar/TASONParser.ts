// Generated from TASON.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import {
	ATN,
	ATNDeserializer, DecisionState, DFA, FailedPredicateException,
	RecognitionException, NoViableAltException, BailErrorStrategy,
	Parser, ParserATNSimulator,
	RuleContext, ParserRuleContext, PredictionMode, PredictionContextCache,
	TerminalNode, RuleNode,
	Token, TokenStream,
	Interval, IntervalSet
} from 'antlr4';
import TASONListener from "./TASONListener.js";
// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export default class TASONParser extends Parser {
	public static readonly T__0 = 1;
	public static readonly T__1 = 2;
	public static readonly T__2 = 3;
	public static readonly T__3 = 4;
	public static readonly T__4 = 5;
	public static readonly T__5 = 6;
	public static readonly T__6 = 7;
	public static readonly T__7 = 8;
	public static readonly T__8 = 9;
	public static readonly T__9 = 10;
	public static readonly T__10 = 11;
	public static readonly TYPE_NAME = 12;
	public static readonly IDENTIFIER = 13;
	public static readonly STRING = 14;
	public static readonly NUMBER = 15;
	public static readonly WS = 16;
	public static readonly SINGLE_LINE_COMMENT = 17;
	public static readonly MULTI_LINE_COMMENT = 18;
	public static override readonly EOF = Token.EOF;
	public static readonly RULE_start = 0;
	public static readonly RULE_value = 1;
	public static readonly RULE_boolean = 2;
	public static readonly RULE_typeInstance = 3;
	public static readonly RULE_object = 4;
	public static readonly RULE_pair = 5;
	public static readonly RULE_key = 6;
	public static readonly RULE_array = 7;
	public static readonly literalNames: (string | null)[] = [ null, "'null'", 
                                                            "'true'", "'false'", 
                                                            "'('", "')'", 
                                                            "'{'", "','", 
                                                            "'}'", "':'", 
                                                            "'['", "']'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             "TYPE_NAME", 
                                                             "IDENTIFIER", 
                                                             "STRING", "NUMBER", 
                                                             "WS", "SINGLE_LINE_COMMENT", 
                                                             "MULTI_LINE_COMMENT" ];
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"start", "value", "boolean", "typeInstance", "object", "pair", "key", 
		"array",
	];
	public get grammarFileName(): string { return "TASON.g4"; }
	public get literalNames(): (string | null)[] { return TASONParser.literalNames; }
	public get symbolicNames(): (string | null)[] { return TASONParser.symbolicNames; }
	public get ruleNames(): string[] { return TASONParser.ruleNames; }
	public get serializedATN(): number[] { return TASONParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(this, TASONParser._ATN, TASONParser.DecisionsToDFA, new PredictionContextCache());
	}
	// @RuleVersion(0)
	public start(): StartContext {
		let localctx: StartContext = new StartContext(this, this._ctx, this.state);
		this.enterRule(localctx, 0, TASONParser.RULE_start);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 16;
			this.value();
			this.state = 17;
			this.match(TASONParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public value(): ValueContext {
		let localctx: ValueContext = new ValueContext(this, this._ctx, this.state);
		this.enterRule(localctx, 2, TASONParser.RULE_value);
		try {
			this.state = 26;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 6:
				localctx = new ObjectValueContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 19;
				this.object();
				}
				break;
			case 10:
				localctx = new ArrayValueContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 20;
				this.array();
				}
				break;
			case 14:
				localctx = new StringValueContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 21;
				this.match(TASONParser.STRING);
				}
				break;
			case 15:
				localctx = new NumberValueContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 22;
				this.match(TASONParser.NUMBER);
				}
				break;
			case 2:
			case 3:
				localctx = new BooleanValueContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 23;
				this.boolean_();
				}
				break;
			case 1:
				localctx = new NullValueContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 24;
				this.match(TASONParser.T__0);
				}
				break;
			case 12:
				localctx = new TypeInstanceValueContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 25;
				this.typeInstance();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public boolean_(): BooleanContext {
		let localctx: BooleanContext = new BooleanContext(this, this._ctx, this.state);
		this.enterRule(localctx, 4, TASONParser.RULE_boolean);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 28;
			_la = this._input.LA(1);
			if(!(_la===2 || _la===3)) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public typeInstance(): TypeInstanceContext {
		let localctx: TypeInstanceContext = new TypeInstanceContext(this, this._ctx, this.state);
		this.enterRule(localctx, 6, TASONParser.RULE_typeInstance);
		try {
			this.state = 39;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				localctx = new ScalarTypeInstanceContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 30;
				this.match(TASONParser.TYPE_NAME);
				this.state = 31;
				this.match(TASONParser.T__3);
				this.state = 32;
				this.match(TASONParser.STRING);
				this.state = 33;
				this.match(TASONParser.T__4);
				}
				break;
			case 2:
				localctx = new ObjectTypeInstanceContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 34;
				this.match(TASONParser.TYPE_NAME);
				this.state = 35;
				this.match(TASONParser.T__3);
				this.state = 36;
				this.object();
				this.state = 37;
				this.match(TASONParser.T__4);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public object(): ObjectContext {
		let localctx: ObjectContext = new ObjectContext(this, this._ctx, this.state);
		this.enterRule(localctx, 8, TASONParser.RULE_object);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 41;
			this.match(TASONParser.T__5);
			this.state = 53;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===13 || _la===14) {
				{
				this.state = 42;
				this.pair();
				this.state = 47;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 43;
						this.match(TASONParser.T__6);
						this.state = 44;
						this.pair();
						}
						}
					}
					this.state = 49;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
				}
				this.state = 51;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 50;
					this.match(TASONParser.T__6);
					}
				}

				}
			}

			this.state = 55;
			this.match(TASONParser.T__7);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public pair(): PairContext {
		let localctx: PairContext = new PairContext(this, this._ctx, this.state);
		this.enterRule(localctx, 10, TASONParser.RULE_pair);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 57;
			this.key();
			this.state = 58;
			this.match(TASONParser.T__8);
			this.state = 59;
			this.value();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public key(): KeyContext {
		let localctx: KeyContext = new KeyContext(this, this._ctx, this.state);
		this.enterRule(localctx, 12, TASONParser.RULE_key);
		try {
			this.state = 63;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 14:
				localctx = new StringKeyContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 61;
				this.match(TASONParser.STRING);
				}
				break;
			case 13:
				localctx = new IdentifierContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 62;
				this.match(TASONParser.IDENTIFIER);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public array(): ArrayContext {
		let localctx: ArrayContext = new ArrayContext(this, this._ctx, this.state);
		this.enterRule(localctx, 14, TASONParser.RULE_array);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 65;
			this.match(TASONParser.T__9);
			this.state = 77;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 54350) !== 0)) {
				{
				this.state = 66;
				this.value();
				this.state = 71;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 6, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 67;
						this.match(TASONParser.T__6);
						this.state = 68;
						this.value();
						}
						}
					}
					this.state = 73;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 6, this._ctx);
				}
				this.state = 75;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 74;
					this.match(TASONParser.T__6);
					}
				}

				}
			}

			this.state = 79;
			this.match(TASONParser.T__10);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}

	public static readonly _serializedATN: number[] = [4,1,18,82,2,0,7,0,2,
	1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,1,0,1,0,1,0,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,3,1,27,8,1,1,2,1,2,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,
	3,1,3,3,3,40,8,3,1,4,1,4,1,4,1,4,5,4,46,8,4,10,4,12,4,49,9,4,1,4,3,4,52,
	8,4,3,4,54,8,4,1,4,1,4,1,5,1,5,1,5,1,5,1,6,1,6,3,6,64,8,6,1,7,1,7,1,7,1,
	7,5,7,70,8,7,10,7,12,7,73,9,7,1,7,3,7,76,8,7,3,7,78,8,7,1,7,1,7,1,7,0,0,
	8,0,2,4,6,8,10,12,14,0,1,1,0,2,3,87,0,16,1,0,0,0,2,26,1,0,0,0,4,28,1,0,
	0,0,6,39,1,0,0,0,8,41,1,0,0,0,10,57,1,0,0,0,12,63,1,0,0,0,14,65,1,0,0,0,
	16,17,3,2,1,0,17,18,5,0,0,1,18,1,1,0,0,0,19,27,3,8,4,0,20,27,3,14,7,0,21,
	27,5,14,0,0,22,27,5,15,0,0,23,27,3,4,2,0,24,27,5,1,0,0,25,27,3,6,3,0,26,
	19,1,0,0,0,26,20,1,0,0,0,26,21,1,0,0,0,26,22,1,0,0,0,26,23,1,0,0,0,26,24,
	1,0,0,0,26,25,1,0,0,0,27,3,1,0,0,0,28,29,7,0,0,0,29,5,1,0,0,0,30,31,5,12,
	0,0,31,32,5,4,0,0,32,33,5,14,0,0,33,40,5,5,0,0,34,35,5,12,0,0,35,36,5,4,
	0,0,36,37,3,8,4,0,37,38,5,5,0,0,38,40,1,0,0,0,39,30,1,0,0,0,39,34,1,0,0,
	0,40,7,1,0,0,0,41,53,5,6,0,0,42,47,3,10,5,0,43,44,5,7,0,0,44,46,3,10,5,
	0,45,43,1,0,0,0,46,49,1,0,0,0,47,45,1,0,0,0,47,48,1,0,0,0,48,51,1,0,0,0,
	49,47,1,0,0,0,50,52,5,7,0,0,51,50,1,0,0,0,51,52,1,0,0,0,52,54,1,0,0,0,53,
	42,1,0,0,0,53,54,1,0,0,0,54,55,1,0,0,0,55,56,5,8,0,0,56,9,1,0,0,0,57,58,
	3,12,6,0,58,59,5,9,0,0,59,60,3,2,1,0,60,11,1,0,0,0,61,64,5,14,0,0,62,64,
	5,13,0,0,63,61,1,0,0,0,63,62,1,0,0,0,64,13,1,0,0,0,65,77,5,10,0,0,66,71,
	3,2,1,0,67,68,5,7,0,0,68,70,3,2,1,0,69,67,1,0,0,0,70,73,1,0,0,0,71,69,1,
	0,0,0,71,72,1,0,0,0,72,75,1,0,0,0,73,71,1,0,0,0,74,76,5,7,0,0,75,74,1,0,
	0,0,75,76,1,0,0,0,76,78,1,0,0,0,77,66,1,0,0,0,77,78,1,0,0,0,78,79,1,0,0,
	0,79,80,5,11,0,0,80,15,1,0,0,0,9,26,39,47,51,53,63,71,75,77];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!TASONParser.__ATN) {
			TASONParser.__ATN = new ATNDeserializer().deserialize(TASONParser._serializedATN);
		}

		return TASONParser.__ATN;
	}


	static DecisionsToDFA = TASONParser._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );

}

export class StartContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public value(): ValueContext {
		return this.getTypedRuleContext(ValueContext, 0) as ValueContext;
	}
	public EOF(): TerminalNode {
		return this.getToken(TASONParser.EOF, 0);
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_start;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterStart) {
	 		listener.enterStart(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitStart) {
	 		listener.exitStart(this);
		}
	}
}


export class ValueContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_value;
	}
	public override copyFrom(ctx: ValueContext): void {
		super.copyFrom(ctx);
	}
}
export class ObjectValueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public object(): ObjectContext {
		return this.getTypedRuleContext(ObjectContext, 0) as ObjectContext;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterObjectValue) {
	 		listener.enterObjectValue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitObjectValue) {
	 		listener.exitObjectValue(this);
		}
	}
}
export class NullValueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterNullValue) {
	 		listener.enterNullValue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitNullValue) {
	 		listener.exitNullValue(this);
		}
	}
}
export class NumberValueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public NUMBER(): TerminalNode {
		return this.getToken(TASONParser.NUMBER, 0);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterNumberValue) {
	 		listener.enterNumberValue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitNumberValue) {
	 		listener.exitNumberValue(this);
		}
	}
}
export class BooleanValueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public boolean_(): BooleanContext {
		return this.getTypedRuleContext(BooleanContext, 0) as BooleanContext;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterBooleanValue) {
	 		listener.enterBooleanValue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitBooleanValue) {
	 		listener.exitBooleanValue(this);
		}
	}
}
export class StringValueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public STRING(): TerminalNode {
		return this.getToken(TASONParser.STRING, 0);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterStringValue) {
	 		listener.enterStringValue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitStringValue) {
	 		listener.exitStringValue(this);
		}
	}
}
export class TypeInstanceValueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public typeInstance(): TypeInstanceContext {
		return this.getTypedRuleContext(TypeInstanceContext, 0) as TypeInstanceContext;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterTypeInstanceValue) {
	 		listener.enterTypeInstanceValue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitTypeInstanceValue) {
	 		listener.exitTypeInstanceValue(this);
		}
	}
}
export class ArrayValueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public array(): ArrayContext {
		return this.getTypedRuleContext(ArrayContext, 0) as ArrayContext;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterArrayValue) {
	 		listener.enterArrayValue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitArrayValue) {
	 		listener.exitArrayValue(this);
		}
	}
}


export class BooleanContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_boolean;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterBoolean) {
	 		listener.enterBoolean(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitBoolean) {
	 		listener.exitBoolean(this);
		}
	}
}


export class TypeInstanceContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_typeInstance;
	}
	public override copyFrom(ctx: TypeInstanceContext): void {
		super.copyFrom(ctx);
	}
}
export class ScalarTypeInstanceContext extends TypeInstanceContext {
	constructor(parser: TASONParser, ctx: TypeInstanceContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public TYPE_NAME(): TerminalNode {
		return this.getToken(TASONParser.TYPE_NAME, 0);
	}
	public STRING(): TerminalNode {
		return this.getToken(TASONParser.STRING, 0);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterScalarTypeInstance) {
	 		listener.enterScalarTypeInstance(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitScalarTypeInstance) {
	 		listener.exitScalarTypeInstance(this);
		}
	}
}
export class ObjectTypeInstanceContext extends TypeInstanceContext {
	constructor(parser: TASONParser, ctx: TypeInstanceContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public TYPE_NAME(): TerminalNode {
		return this.getToken(TASONParser.TYPE_NAME, 0);
	}
	public object(): ObjectContext {
		return this.getTypedRuleContext(ObjectContext, 0) as ObjectContext;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterObjectTypeInstance) {
	 		listener.enterObjectTypeInstance(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitObjectTypeInstance) {
	 		listener.exitObjectTypeInstance(this);
		}
	}
}


export class ObjectContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public pair_list(): PairContext[] {
		return this.getTypedRuleContexts(PairContext) as PairContext[];
	}
	public pair(i: number): PairContext {
		return this.getTypedRuleContext(PairContext, i) as PairContext;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_object;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterObject) {
	 		listener.enterObject(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitObject) {
	 		listener.exitObject(this);
		}
	}
}


export class PairContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public key(): KeyContext {
		return this.getTypedRuleContext(KeyContext, 0) as KeyContext;
	}
	public value(): ValueContext {
		return this.getTypedRuleContext(ValueContext, 0) as ValueContext;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_pair;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterPair) {
	 		listener.enterPair(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitPair) {
	 		listener.exitPair(this);
		}
	}
}


export class KeyContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_key;
	}
	public override copyFrom(ctx: KeyContext): void {
		super.copyFrom(ctx);
	}
}
export class IdentifierContext extends KeyContext {
	constructor(parser: TASONParser, ctx: KeyContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public IDENTIFIER(): TerminalNode {
		return this.getToken(TASONParser.IDENTIFIER, 0);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterIdentifier) {
	 		listener.enterIdentifier(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitIdentifier) {
	 		listener.exitIdentifier(this);
		}
	}
}
export class StringKeyContext extends KeyContext {
	constructor(parser: TASONParser, ctx: KeyContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public STRING(): TerminalNode {
		return this.getToken(TASONParser.STRING, 0);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterStringKey) {
	 		listener.enterStringKey(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitStringKey) {
	 		listener.exitStringKey(this);
		}
	}
}


export class ArrayContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public value_list(): ValueContext[] {
		return this.getTypedRuleContexts(ValueContext) as ValueContext[];
	}
	public value(i: number): ValueContext {
		return this.getTypedRuleContext(ValueContext, i) as ValueContext;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_array;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterArray) {
	 		listener.enterArray(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitArray) {
	 		listener.exitArray(this);
		}
	}
}
