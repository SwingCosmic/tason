grammar TASON;

start: value EOF;

BOOLEAN_TRUE: 'true';
BOOLEAN_FALSE: 'false';
NULL: 'null';

TYPE_NAME: [A-Z][a-zA-Z0-9_]*;
IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]*;


WS: [ \t\n\r]+ -> skip;
SINGLE_LINE_COMMENT: '//' ~[\r\n]* -> skip;
MULTI_LINE_COMMENT: '/*' .*? '*/' -> skip;


value
  : object          # ObjectValue
  | array           # ArrayValue
  | STRING          # StringValue
  | number          # NumberValue
  | boolean         # BooleanValue
  | NULL          # NullValue
  | typeInstance    # TypeInstanceValue
  ;

boolean: BOOLEAN_TRUE | BOOLEAN_FALSE;

typeInstance
  : TYPE_NAME '(' STRING ')' # ScalarTypeInstance
  | TYPE_NAME '(' object ')' # ObjectTypeInstance
  ;


//#region object

object: '{' (pair (',' pair)* ','?)? '}';

pair: key ':' value;

key
  : STRING      # StringKey
  | IDENTIFIER  # Identifier
  ;




//#region


array
  : '[' value (',' value)* ','? ']'
  | '[' ']'
  ;


//#region string

STRING
  : '"' (ESC | SAFE_STRING_CHAR)* '"'
  | '\'' (ESC | SAFE_STRING_CHAR)* '\''
  ;

fragment ESC: '\\' (["'\\/bfnrtv0] | UNICODE | HEX_ESC);
fragment HEX_ESC: 'x' HEX HEX;
fragment UNICODE: 'u' HEX HEX HEX HEX;
fragment SAFE_STRING_CHAR: ~["'\\\u0000-\u001F];

//#region


//#region number

number 
  : SYMBOL? NUMBER
  | SYMBOL? 'NaN'
  | SYMBOL? 'Infinity'
  ;

SYMBOL: '+' | '-';

NUMBER
	: INT ('.' [0-9]*)? EXP? // +1.e2, 1234, 1234.5
	| '.' [0-9]+ EXP? // -.2e3
	| '0x' HEX+  // 0x13579AbCdeF
	| '0o' OCT+  // 0o1234567
	| '0b' BIN+  // 0b00100111110
  | INVALID_OCT { 
    throw new Error("Deprecated octal number style");
  }
  ;

fragment HEX: [0-9a-fA-F];
fragment DEC: [0-9];
fragment OCT: [0-7];
fragment BIN: [0-1];

fragment INT : '0' | [1-9] DEC*;
fragment EXP: [Ee] SYMBOL? DEC*;

fragment INVALID_OCT: '0' [0-9]+;

//#region


