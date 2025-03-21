# Tacit Language Grammar

## Overview

Tacit is a stack-based programming language inspired by Forth. Programs consist of words and numbers that manipulate a stack of values. The language follows a postfix notation where operators appear after their operands.

## Grammar

This document describes the grammar of the Tacit language.

### Program Structure

```ebnf
program ::= statement*

statement ::= expression | definition | comment
```

### Expressions

```ebnf
expression ::= number | word | code_block | special_token

number ::= [+-]? digit+ ('.' digit+)?

word ::= (letter | digit) (letter | digit | special_char)*
      | digits_followed_by_non_digits

special_token ::= ':' | ';' | '(' | ')'

code_block ::= '(' expression* ')'
```

### Definitions

```ebnf
definition ::= ':' word expression* ';'
```

### Comments

```ebnf
comment ::= '//' any_text newline
```

### Lexical Rules

```ebnf
digit ::= '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
letter ::= 'a'..'z' | 'A'..'Z' | '_'
whitespace ::= ' ' | '\t' | '\n' | '\r'
special_char ::= Any non-whitespace character except grouping characters
grouping_char ::= '(' | ')' | '{' | '}' | '[' | ']' | ';' | ':'
```

## Tokenization Notes

The tokenizer follows these rules:

- Numbers are sequences of digits, optionally with a decimal point, and optional +/- prefix
- When a sequence starts with digits but contains non-digit characters (e.g., "123name"), it's treated as a word
- Words can start with digits or letters
- Special tokens (`:`, `;`, `(`, `)`) are recognized separately when not part of a word
- Words are identified by any sequence of non-whitespace characters that don't include grouping characters
- Words can be used as definition names, including words that are pure numbers

## Core Operations

### Stack Manipulation

- `dup` - Duplicate the top stack item
- `drop` - Remove the top stack item
- `swap` - Swap the top two stack items

### Arithmetic

- `+` - Addition
- `-` - Subtraction
- `*` - Multiplication
- `/` - Division

### Control Flow

- `eval` - Execute a code block

## Examples

### Basic Arithmetic

```
5 3 +     // Pushes 8 onto the stack
10 3 -    // Pushes 7 onto the stack
5 3 *     // Pushes 15 onto the stack
15 3 /    // Pushes 5 onto the stack
```

### Stack Operations

```
5 dup     // Results in stack: [5, 5]
5 3 drop  // Results in stack: [5]
5 3 swap  // Results in stack: [3, 5]
```

### Code Blocks

```
(30 20 *) eval    // Pushes 600 onto the stack
4 (3 2 *) eval +  // Pushes 10 onto the stack
```

### Word Definitions

```
: square dup * ;   // Define a word 'square' that duplicates and multiplies
3 square           // Pushes 9 onto the stack

: double 2 * ;     // Define a word 'double' that multiplies by 2
: quadruple double double ;  // Define 'quadruple' using 'double'
5 quadruple        // Pushes 20 onto the stack

: 123 dup * ;      // Define a word named '123'
5 123              // Pushes 25 onto the stack
```

### Nested Definitions

```
: apply-block swap eval ;    // Define a word that swaps and evaluates
(2 *) 5 apply-block         // Pushes 10 onto the stack
```

## Execution Model

Tacit uses a stack-based execution model:

1. When a number is encountered, it's pushed onto the stack
2. When a word is encountered, its associated operation is executed
3. Operations typically consume values from the stack and may push results back
4. Code blocks are compiled and can be executed with `eval`
5. Defined words are like named subroutines

## Error Handling

The interpreter will report errors for:

- Unknown words
- Stack underflow (not enough items on the stack for an operation)
- Division by zero
- Invalid syntax in definitions
- Unclosed code blocks or definitions
- Nested definitions (which are not allowed)
- Defining words inside code blocks

## Implementation Notes

- Words can contain any characters except whitespace and grouping characters
- Words can start with numbers (e.g., "123name" is a valid word)
- Numbers followed by non-digit characters are treated as words
- Code blocks can be nested
- Comments extend to the end of the line
- Word definitions cannot be nested
