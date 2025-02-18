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
	public static readonly RULE_typeInstance = 2;
	public static readonly RULE_object = 3;
	public static readonly RULE_pair = 4;
	public static readonly RULE_key = 5;
	public static readonly RULE_array = 6;
	public static readonly literalNames: (string | null)[] = [ null, "'true'", 
                                                            "'false'", "'null'", 
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
		"start", "value", "typeInstance", "object", "pair", "key", "array",
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
			this.state = 14;
			this.value();
			this.state = 15;
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
			this.state = 25;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 6:
				localctx = new ObjectValueContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 17;
				this.object();
				}
				break;
			case 10:
				localctx = new ArrayValueContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 18;
				this.array();
				}
				break;
			case 14:
				localctx = new StringValueContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 19;
				this.match(TASONParser.STRING);
				}
				break;
			case 15:
				localctx = new NumberValueContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 20;
				this.match(TASONParser.NUMBER);
				}
				break;
			case 1:
				localctx = new BooleanTrueContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 21;
				this.match(TASONParser.T__0);
				}
				break;
			case 2:
				localctx = new BooleanFalseContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 22;
				this.match(TASONParser.T__1);
				}
				break;
			case 3:
				localctx = new NullValueContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 23;
				this.match(TASONParser.T__2);
				}
				break;
			case 12:
				localctx = new TypeInstanceValueContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 24;
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
	public typeInstance(): TypeInstanceContext {
		let localctx: TypeInstanceContext = new TypeInstanceContext(this, this._ctx, this.state);
		this.enterRule(localctx, 4, TASONParser.RULE_typeInstance);
		try {
			this.state = 36;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 27;
				this.match(TASONParser.TYPE_NAME);
				this.state = 28;
				this.match(TASONParser.T__3);
				this.state = 29;
				this.match(TASONParser.STRING);
				this.state = 30;
				this.match(TASONParser.T__4);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 31;
				this.match(TASONParser.TYPE_NAME);
				this.state = 32;
				this.match(TASONParser.T__3);
				this.state = 33;
				this.object();
				this.state = 34;
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
		this.enterRule(localctx, 6, TASONParser.RULE_object);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 38;
			this.match(TASONParser.T__5);
			this.state = 50;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===13 || _la===14) {
				{
				this.state = 39;
				this.pair();
				this.state = 44;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 40;
						this.match(TASONParser.T__6);
						this.state = 41;
						this.pair();
						}
						}
					}
					this.state = 46;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
				}
				this.state = 48;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 47;
					this.match(TASONParser.T__6);
					}
				}

				}
			}

			this.state = 52;
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
		this.enterRule(localctx, 8, TASONParser.RULE_pair);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 54;
			this.key();
			this.state = 55;
			this.match(TASONParser.T__8);
			this.state = 56;
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
		this.enterRule(localctx, 10, TASONParser.RULE_key);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 58;
			_la = this._input.LA(1);
			if(!(_la===13 || _la===14)) {
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
	public array(): ArrayContext {
		let localctx: ArrayContext = new ArrayContext(this, this._ctx, this.state);
		this.enterRule(localctx, 12, TASONParser.RULE_array);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 60;
			this.match(TASONParser.T__9);
			this.state = 72;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 54350) !== 0)) {
				{
				this.state = 61;
				this.value();
				this.state = 66;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 62;
						this.match(TASONParser.T__6);
						this.state = 63;
						this.value();
						}
						}
					}
					this.state = 68;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				}
				this.state = 70;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 69;
					this.match(TASONParser.T__6);
					}
				}

				}
			}

			this.state = 74;
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

	public static readonly _serializedATN: number[] = [4,1,18,77,2,0,7,0,2,
	1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,1,0,1,0,1,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,3,1,26,8,1,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,3,2,37,
	8,2,1,3,1,3,1,3,1,3,5,3,43,8,3,10,3,12,3,46,9,3,1,3,3,3,49,8,3,3,3,51,8,
	3,1,3,1,3,1,4,1,4,1,4,1,4,1,5,1,5,1,6,1,6,1,6,1,6,5,6,65,8,6,10,6,12,6,
	68,9,6,1,6,3,6,71,8,6,3,6,73,8,6,1,6,1,6,1,6,0,0,7,0,2,4,6,8,10,12,0,1,
	1,0,13,14,83,0,14,1,0,0,0,2,25,1,0,0,0,4,36,1,0,0,0,6,38,1,0,0,0,8,54,1,
	0,0,0,10,58,1,0,0,0,12,60,1,0,0,0,14,15,3,2,1,0,15,16,5,0,0,1,16,1,1,0,
	0,0,17,26,3,6,3,0,18,26,3,12,6,0,19,26,5,14,0,0,20,26,5,15,0,0,21,26,5,
	1,0,0,22,26,5,2,0,0,23,26,5,3,0,0,24,26,3,4,2,0,25,17,1,0,0,0,25,18,1,0,
	0,0,25,19,1,0,0,0,25,20,1,0,0,0,25,21,1,0,0,0,25,22,1,0,0,0,25,23,1,0,0,
	0,25,24,1,0,0,0,26,3,1,0,0,0,27,28,5,12,0,0,28,29,5,4,0,0,29,30,5,14,0,
	0,30,37,5,5,0,0,31,32,5,12,0,0,32,33,5,4,0,0,33,34,3,6,3,0,34,35,5,5,0,
	0,35,37,1,0,0,0,36,27,1,0,0,0,36,31,1,0,0,0,37,5,1,0,0,0,38,50,5,6,0,0,
	39,44,3,8,4,0,40,41,5,7,0,0,41,43,3,8,4,0,42,40,1,0,0,0,43,46,1,0,0,0,44,
	42,1,0,0,0,44,45,1,0,0,0,45,48,1,0,0,0,46,44,1,0,0,0,47,49,5,7,0,0,48,47,
	1,0,0,0,48,49,1,0,0,0,49,51,1,0,0,0,50,39,1,0,0,0,50,51,1,0,0,0,51,52,1,
	0,0,0,52,53,5,8,0,0,53,7,1,0,0,0,54,55,3,10,5,0,55,56,5,9,0,0,56,57,3,2,
	1,0,57,9,1,0,0,0,58,59,7,0,0,0,59,11,1,0,0,0,60,72,5,10,0,0,61,66,3,2,1,
	0,62,63,5,7,0,0,63,65,3,2,1,0,64,62,1,0,0,0,65,68,1,0,0,0,66,64,1,0,0,0,
	66,67,1,0,0,0,67,70,1,0,0,0,68,66,1,0,0,0,69,71,5,7,0,0,70,69,1,0,0,0,70,
	71,1,0,0,0,71,73,1,0,0,0,72,61,1,0,0,0,72,73,1,0,0,0,73,74,1,0,0,0,74,75,
	5,11,0,0,75,13,1,0,0,0,8,25,36,44,48,50,66,70,72];

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
export class BooleanFalseContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterBooleanFalse) {
	 		listener.enterBooleanFalse(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitBooleanFalse) {
	 		listener.exitBooleanFalse(this);
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
export class BooleanTrueContext extends ValueContext {
	constructor(parser: TASONParser, ctx: ValueContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterBooleanTrue) {
	 		listener.enterBooleanTrue(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitBooleanTrue) {
	 		listener.exitBooleanTrue(this);
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


export class TypeInstanceContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public TYPE_NAME(): TerminalNode {
		return this.getToken(TASONParser.TYPE_NAME, 0);
	}
	public STRING(): TerminalNode {
		return this.getToken(TASONParser.STRING, 0);
	}
	public object(): ObjectContext {
		return this.getTypedRuleContext(ObjectContext, 0) as ObjectContext;
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_typeInstance;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterTypeInstance) {
	 		listener.enterTypeInstance(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitTypeInstance) {
	 		listener.exitTypeInstance(this);
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
	public STRING(): TerminalNode {
		return this.getToken(TASONParser.STRING, 0);
	}
	public IDENTIFIER(): TerminalNode {
		return this.getToken(TASONParser.IDENTIFIER, 0);
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_key;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterKey) {
	 		listener.enterKey(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitKey) {
	 		listener.exitKey(this);
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
