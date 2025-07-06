# Deprecation Notice
This document has been superseded by [modern-syntax.md].
Retained for historical reference only.
Current syntax rules: [See modern-syntax §2-4]

# Tacit Language Grammar

## Overview

Tacit is a stack-based programming language inspired by Forth. Programs consist of words and numbers that manipulate a stack of values. The language follows a postfix notation where operators appear after their operands.

## Grammar

This document describes the grammar of the Tacit language.

### Program Structure

```ebnf
program ::= statement*

statement ::= expression | definition | special_token | comment
```

### Expressions

```ebnf
expression ::= number | word | string | code_block | vector_literal | curly_block | group_notation | dictionary_literal

number ::= [+-]?[0-9]+(\.[0-9]+)?

word ::= [^(){}\[\]"'`:; \t\n\r]+

string ::= '"' char* '"'

code_block ::= '(' expression* ')'

vector_literal ::= '[' expression* ']'

curly_block ::= '{' expression* '}'

dictionary_literal ::= ':[' (key value)* ']:'
```

### Definitions

```ebnf
definition ::= ':' word expression* ';'
```

### Word Quoting

```ebnf
quoted_word ::= '`' word
```

### Control Flow

#### Traditional Style
```ebnf
if_statement ::= condition true_block false_block 'if'

condition ::= expression
true_block ::= code_block
false_block ::= code_block
```

#### Modern Style
```ebnf
modern_if ::= condition 'IF' curly_block ['ELSE' curly_block]

condition ::= expression
```

### Special Tokens

```ebnf
special_token ::= ':' | ';' | '(' | ')' | '[' | ']' | '{' | '}' | '"' | '`'
```

### Comments

```ebnf
comment ::= '//' any_character* newline
```

## Notes

- Words are delimited by whitespace or special characters
- Numbers can be integers or floating-point values
- String literals support escaped characters like '\n', '\t', etc.
- The stack is the primary data structure for passing values between operations
- Vector literals `[ ... ]` create heap-allocated vector data structures 
- Curly braces `{ ... }` define compile-time blocks used with modern control structures
- Parentheses `( ... )` define code blocks that can be manipulated as values and executed with `eval`
- Dictionary literals `:[ ... ]:` create key-value mappings
- `:` and `;` are used for word definitions similar to Forth
- Comments use C++ style with double-slash (`//`)
