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
	public static readonly BOOLEAN_TRUE = 11;
	public static readonly BOOLEAN_FALSE = 12;
	public static readonly NULL = 13;
	public static readonly TYPE_NAME = 14;
	public static readonly IDENTIFIER = 15;
	public static readonly WS = 16;
	public static readonly SINGLE_LINE_COMMENT = 17;
	public static readonly MULTI_LINE_COMMENT = 18;
	public static readonly STRING = 19;
	public static readonly SYMBOL = 20;
	public static readonly NUMBER = 21;
	public static readonly INVALID_CHAR = 22;
	public static override readonly EOF = Token.EOF;
	public static readonly RULE_start = 0;
	public static readonly RULE_value = 1;
	public static readonly RULE_boolean = 2;
	public static readonly RULE_typeInstance = 3;
	public static readonly RULE_object = 4;
	public static readonly RULE_pair = 5;
	public static readonly RULE_key = 6;
	public static readonly RULE_array = 7;
	public static readonly RULE_number = 8;
	public static readonly literalNames: (string | null)[] = [ null, "'('", 
                                                            "')'", "'{'", 
                                                            "','", "'}'", 
                                                            "':'", "'['", 
                                                            "']'", "'NaN'", 
                                                            "'Infinity'", 
                                                            "'true'", "'false'", 
                                                            "'null'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, "BOOLEAN_TRUE", 
                                                             "BOOLEAN_FALSE", 
                                                             "NULL", "TYPE_NAME", 
                                                             "IDENTIFIER", 
                                                             "WS", "SINGLE_LINE_COMMENT", 
                                                             "MULTI_LINE_COMMENT", 
                                                             "STRING", "SYMBOL", 
                                                             "NUMBER", "INVALID_CHAR" ];
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"start", "value", "boolean", "typeInstance", "object", "pair", "key", 
		"array", "number",
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
			this.state = 18;
			this.value();
			this.state = 19;
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
			this.state = 28;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 3:
				localctx = new ObjectValueContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 21;
				this.object();
				}
				break;
			case 7:
				localctx = new ArrayValueContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 22;
				this.array();
				}
				break;
			case 19:
				localctx = new StringValueContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 23;
				this.match(TASONParser.STRING);
				}
				break;
			case 9:
			case 10:
			case 20:
			case 21:
				localctx = new NumberValueContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 24;
				this.number_();
				}
				break;
			case 11:
			case 12:
				localctx = new BooleanValueContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 25;
				this.boolean_();
				}
				break;
			case 13:
				localctx = new NullValueContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 26;
				this.match(TASONParser.NULL);
				}
				break;
			case 14:
				localctx = new TypeInstanceValueContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 27;
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
			this.state = 30;
			_la = this._input.LA(1);
			if(!(_la===11 || _la===12)) {
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
			this.state = 41;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				localctx = new ScalarTypeInstanceContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 32;
				this.match(TASONParser.TYPE_NAME);
				this.state = 33;
				this.match(TASONParser.T__0);
				this.state = 34;
				this.match(TASONParser.STRING);
				this.state = 35;
				this.match(TASONParser.T__1);
				}
				break;
			case 2:
				localctx = new ObjectTypeInstanceContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 36;
				this.match(TASONParser.TYPE_NAME);
				this.state = 37;
				this.match(TASONParser.T__0);
				this.state = 38;
				this.object();
				this.state = 39;
				this.match(TASONParser.T__1);
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
			this.state = 43;
			this.match(TASONParser.T__2);
			this.state = 55;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===15 || _la===19) {
				{
				this.state = 44;
				this.pair();
				this.state = 49;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 45;
						this.match(TASONParser.T__3);
						this.state = 46;
						this.pair();
						}
						}
					}
					this.state = 51;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
				}
				this.state = 53;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 52;
					this.match(TASONParser.T__3);
					}
				}

				}
			}

			this.state = 57;
			this.match(TASONParser.T__4);
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
			this.state = 59;
			this.key();
			this.state = 60;
			this.match(TASONParser.T__5);
			this.state = 61;
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
			this.state = 65;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 19:
				localctx = new StringKeyContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 63;
				this.match(TASONParser.STRING);
				}
				break;
			case 15:
				localctx = new IdentifierContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 64;
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
			this.state = 83;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 8, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 67;
				this.match(TASONParser.T__6);
				this.state = 68;
				this.value();
				this.state = 73;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 6, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 69;
						this.match(TASONParser.T__3);
						this.state = 70;
						this.value();
						}
						}
					}
					this.state = 75;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 6, this._ctx);
				}
				this.state = 77;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 76;
					this.match(TASONParser.T__3);
					}
				}

				this.state = 79;
				this.match(TASONParser.T__7);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 81;
				this.match(TASONParser.T__6);
				this.state = 82;
				this.match(TASONParser.T__7);
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
	public number_(): NumberContext {
		let localctx: NumberContext = new NumberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 16, TASONParser.RULE_number);
		let _la: number;
		try {
			this.state = 97;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 12, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 86;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===20) {
					{
					this.state = 85;
					this.match(TASONParser.SYMBOL);
					}
				}

				this.state = 88;
				this.match(TASONParser.NUMBER);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 90;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===20) {
					{
					this.state = 89;
					this.match(TASONParser.SYMBOL);
					}
				}

				this.state = 92;
				this.match(TASONParser.T__8);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 94;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===20) {
					{
					this.state = 93;
					this.match(TASONParser.SYMBOL);
					}
				}

				this.state = 96;
				this.match(TASONParser.T__9);
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

	public static readonly _serializedATN: number[] = [4,1,22,100,2,0,7,0,2,
	1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,1,0,1,0,1,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,29,8,1,1,2,1,2,1,3,1,3,1,3,1,3,1,3,1,
	3,1,3,1,3,1,3,3,3,42,8,3,1,4,1,4,1,4,1,4,5,4,48,8,4,10,4,12,4,51,9,4,1,
	4,3,4,54,8,4,3,4,56,8,4,1,4,1,4,1,5,1,5,1,5,1,5,1,6,1,6,3,6,66,8,6,1,7,
	1,7,1,7,1,7,5,7,72,8,7,10,7,12,7,75,9,7,1,7,3,7,78,8,7,1,7,1,7,1,7,1,7,
	3,7,84,8,7,1,8,3,8,87,8,8,1,8,1,8,3,8,91,8,8,1,8,1,8,3,8,95,8,8,1,8,3,8,
	98,8,8,1,8,0,0,9,0,2,4,6,8,10,12,14,16,0,1,1,0,11,12,109,0,18,1,0,0,0,2,
	28,1,0,0,0,4,30,1,0,0,0,6,41,1,0,0,0,8,43,1,0,0,0,10,59,1,0,0,0,12,65,1,
	0,0,0,14,83,1,0,0,0,16,97,1,0,0,0,18,19,3,2,1,0,19,20,5,0,0,1,20,1,1,0,
	0,0,21,29,3,8,4,0,22,29,3,14,7,0,23,29,5,19,0,0,24,29,3,16,8,0,25,29,3,
	4,2,0,26,29,5,13,0,0,27,29,3,6,3,0,28,21,1,0,0,0,28,22,1,0,0,0,28,23,1,
	0,0,0,28,24,1,0,0,0,28,25,1,0,0,0,28,26,1,0,0,0,28,27,1,0,0,0,29,3,1,0,
	0,0,30,31,7,0,0,0,31,5,1,0,0,0,32,33,5,14,0,0,33,34,5,1,0,0,34,35,5,19,
	0,0,35,42,5,2,0,0,36,37,5,14,0,0,37,38,5,1,0,0,38,39,3,8,4,0,39,40,5,2,
	0,0,40,42,1,0,0,0,41,32,1,0,0,0,41,36,1,0,0,0,42,7,1,0,0,0,43,55,5,3,0,
	0,44,49,3,10,5,0,45,46,5,4,0,0,46,48,3,10,5,0,47,45,1,0,0,0,48,51,1,0,0,
	0,49,47,1,0,0,0,49,50,1,0,0,0,50,53,1,0,0,0,51,49,1,0,0,0,52,54,5,4,0,0,
	53,52,1,0,0,0,53,54,1,0,0,0,54,56,1,0,0,0,55,44,1,0,0,0,55,56,1,0,0,0,56,
	57,1,0,0,0,57,58,5,5,0,0,58,9,1,0,0,0,59,60,3,12,6,0,60,61,5,6,0,0,61,62,
	3,2,1,0,62,11,1,0,0,0,63,66,5,19,0,0,64,66,5,15,0,0,65,63,1,0,0,0,65,64,
	1,0,0,0,66,13,1,0,0,0,67,68,5,7,0,0,68,73,3,2,1,0,69,70,5,4,0,0,70,72,3,
	2,1,0,71,69,1,0,0,0,72,75,1,0,0,0,73,71,1,0,0,0,73,74,1,0,0,0,74,77,1,0,
	0,0,75,73,1,0,0,0,76,78,5,4,0,0,77,76,1,0,0,0,77,78,1,0,0,0,78,79,1,0,0,
	0,79,80,5,8,0,0,80,84,1,0,0,0,81,82,5,7,0,0,82,84,5,8,0,0,83,67,1,0,0,0,
	83,81,1,0,0,0,84,15,1,0,0,0,85,87,5,20,0,0,86,85,1,0,0,0,86,87,1,0,0,0,
	87,88,1,0,0,0,88,98,5,21,0,0,89,91,5,20,0,0,90,89,1,0,0,0,90,91,1,0,0,0,
	91,92,1,0,0,0,92,98,5,9,0,0,93,95,5,20,0,0,94,93,1,0,0,0,94,95,1,0,0,0,
	95,96,1,0,0,0,96,98,5,10,0,0,97,86,1,0,0,0,97,90,1,0,0,0,97,94,1,0,0,0,
	98,17,1,0,0,0,13,28,41,49,53,55,65,73,77,83,86,90,94,97];

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
	public NULL(): TerminalNode {
		return this.getToken(TASONParser.NULL, 0);
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
	public number_(): NumberContext {
		return this.getTypedRuleContext(NumberContext, 0) as NumberContext;
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
	public BOOLEAN_TRUE(): TerminalNode {
		return this.getToken(TASONParser.BOOLEAN_TRUE, 0);
	}
	public BOOLEAN_FALSE(): TerminalNode {
		return this.getToken(TASONParser.BOOLEAN_FALSE, 0);
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


export class NumberContext extends ParserRuleContext {
	constructor(parser?: TASONParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public NUMBER(): TerminalNode {
		return this.getToken(TASONParser.NUMBER, 0);
	}
	public SYMBOL(): TerminalNode {
		return this.getToken(TASONParser.SYMBOL, 0);
	}
    public get ruleIndex(): number {
    	return TASONParser.RULE_number;
	}
	public enterRule(listener: TASONListener): void {
	    if(listener.enterNumber) {
	 		listener.enterNumber(this);
		}
	}
	public exitRule(listener: TASONListener): void {
	    if(listener.exitNumber) {
	 		listener.exitNumber(this);
		}
	}
}
