grammar TASON;

start: value EOF;

value
  : object          # ObjectValue
  | array           # ArrayValue
  | STRING          # StringValue
  | NUMBER          # NumberValue
  | boolean         # BooleanValue
  | 'null'          # NullValue
  | typeInstance    # TypeInstanceValue
  ;

boolean: 'true' | 'false';

typeInstance
  : TYPE_NAME '(' STRING ')' # ScalarTypeInstance
  | TYPE_NAME '(' object ')' # ObjectTypeInstance
  ;

object: '{' (pair (',' pair)* ','?)? '}';

pair: key ':' value;

key
  : STRING      # StringKey
  | IDENTIFIER  # Identifier
  ;

array: '[' (value (',' value)* ','?)? ']';

TYPE_NAME: [A-Z][a-zA-Z0-9_]*;
IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]*;

STRING
  : '"' (ESC | SAFE_STRING_CHAR)* '"'
  | '\'' (ESC | SAFE_STRING_CHAR)* '\''
  ;

fragment ESC: '\\' (["'\\bfnrtv0] | UNICODE | HEX_ESC);
fragment HEX_ESC: 'x' HEX HEX;
fragment UNICODE: 'u' HEX HEX HEX HEX;
fragment HEX: [0-9a-fA-F];
fragment SAFE_STRING_CHAR: ~["'\\\u0000-\u001F];

NUMBER
  : ('-'? INT ('.' [0-9]*)? EXP?   // 1, 1.2, 3e4, 5E-6
    | '-'? '.' [0-9]+ EXP?          // .234, .567e8
    | '0x' HEX+                    // 0x1F
    | '0b' [01]+                   // 0b1010
    | '0o' [0-7]+                  // 0o17
    | 'Infinity'                   // Infinity
    | 'NaN'                        // NaN
  );

fragment INT: '0' | [1-9][0-9]*;
fragment EXP: [Ee] [+\-]? [0-9]+;

WS: [ \t\n\r]+ -> skip;
SINGLE_LINE_COMMENT: '//' ~[\r\n]* -> skip;
MULTI_LINE_COMMENT: '/*' .*? '*/' -> skip;
