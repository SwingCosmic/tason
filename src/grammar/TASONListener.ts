// Generated from TASON.g4 by ANTLR 4.13.2

import {ParseTreeListener} from "antlr4";


import { StartContext } from "./TASONParser.js";
import { ObjectValueContext } from "./TASONParser.js";
import { ArrayValueContext } from "./TASONParser.js";
import { StringValueContext } from "./TASONParser.js";
import { NumberValueContext } from "./TASONParser.js";
import { BooleanTrueContext } from "./TASONParser.js";
import { BooleanFalseContext } from "./TASONParser.js";
import { NullValueContext } from "./TASONParser.js";
import { TypeInstanceValueContext } from "./TASONParser.js";
import { TypeInstanceContext } from "./TASONParser.js";
import { ObjectContext } from "./TASONParser.js";
import { PairContext } from "./TASONParser.js";
import { KeyContext } from "./TASONParser.js";
import { ArrayContext } from "./TASONParser.js";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `TASONParser`.
 */
export default class TASONListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by `TASONParser.start`.
	 * @param ctx the parse tree
	 */
	enterStart?: (ctx: StartContext) => void;
	/**
	 * Exit a parse tree produced by `TASONParser.start`.
	 * @param ctx the parse tree
	 */
	exitStart?: (ctx: StartContext) => void;
	/**
	 * Enter a parse tree produced by the `ObjectValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterObjectValue?: (ctx: ObjectValueContext) => void;
	/**
	 * Exit a parse tree produced by the `ObjectValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitObjectValue?: (ctx: ObjectValueContext) => void;
	/**
	 * Enter a parse tree produced by the `ArrayValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterArrayValue?: (ctx: ArrayValueContext) => void;
	/**
	 * Exit a parse tree produced by the `ArrayValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitArrayValue?: (ctx: ArrayValueContext) => void;
	/**
	 * Enter a parse tree produced by the `StringValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterStringValue?: (ctx: StringValueContext) => void;
	/**
	 * Exit a parse tree produced by the `StringValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitStringValue?: (ctx: StringValueContext) => void;
	/**
	 * Enter a parse tree produced by the `NumberValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterNumberValue?: (ctx: NumberValueContext) => void;
	/**
	 * Exit a parse tree produced by the `NumberValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitNumberValue?: (ctx: NumberValueContext) => void;
	/**
	 * Enter a parse tree produced by the `BooleanTrue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterBooleanTrue?: (ctx: BooleanTrueContext) => void;
	/**
	 * Exit a parse tree produced by the `BooleanTrue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitBooleanTrue?: (ctx: BooleanTrueContext) => void;
	/**
	 * Enter a parse tree produced by the `BooleanFalse`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterBooleanFalse?: (ctx: BooleanFalseContext) => void;
	/**
	 * Exit a parse tree produced by the `BooleanFalse`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitBooleanFalse?: (ctx: BooleanFalseContext) => void;
	/**
	 * Enter a parse tree produced by the `NullValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterNullValue?: (ctx: NullValueContext) => void;
	/**
	 * Exit a parse tree produced by the `NullValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitNullValue?: (ctx: NullValueContext) => void;
	/**
	 * Enter a parse tree produced by the `TypeInstanceValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	enterTypeInstanceValue?: (ctx: TypeInstanceValueContext) => void;
	/**
	 * Exit a parse tree produced by the `TypeInstanceValue`
	 * labeled alternative in `TASONParser.value`.
	 * @param ctx the parse tree
	 */
	exitTypeInstanceValue?: (ctx: TypeInstanceValueContext) => void;
	/**
	 * Enter a parse tree produced by `TASONParser.typeInstance`.
	 * @param ctx the parse tree
	 */
	enterTypeInstance?: (ctx: TypeInstanceContext) => void;
	/**
	 * Exit a parse tree produced by `TASONParser.typeInstance`.
	 * @param ctx the parse tree
	 */
	exitTypeInstance?: (ctx: TypeInstanceContext) => void;
	/**
	 * Enter a parse tree produced by `TASONParser.object`.
	 * @param ctx the parse tree
	 */
	enterObject?: (ctx: ObjectContext) => void;
	/**
	 * Exit a parse tree produced by `TASONParser.object`.
	 * @param ctx the parse tree
	 */
	exitObject?: (ctx: ObjectContext) => void;
	/**
	 * Enter a parse tree produced by `TASONParser.pair`.
	 * @param ctx the parse tree
	 */
	enterPair?: (ctx: PairContext) => void;
	/**
	 * Exit a parse tree produced by `TASONParser.pair`.
	 * @param ctx the parse tree
	 */
	exitPair?: (ctx: PairContext) => void;
	/**
	 * Enter a parse tree produced by `TASONParser.key`.
	 * @param ctx the parse tree
	 */
	enterKey?: (ctx: KeyContext) => void;
	/**
	 * Exit a parse tree produced by `TASONParser.key`.
	 * @param ctx the parse tree
	 */
	exitKey?: (ctx: KeyContext) => void;
	/**
	 * Enter a parse tree produced by `TASONParser.array`.
	 * @param ctx the parse tree
	 */
	enterArray?: (ctx: ArrayContext) => void;
	/**
	 * Exit a parse tree produced by `TASONParser.array`.
	 * @param ctx the parse tree
	 */
	exitArray?: (ctx: ArrayContext) => void;
}

