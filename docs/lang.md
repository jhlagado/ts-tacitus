# Language Processing in Tacit

## Overview

The `lang` directory in the Tacit codebase is responsible for managing the core language processing functionalities. This includes parsing, lexing, compiling, and interpreting Tacit code. These components work together to enable the execution of Tacit programs, handling everything from tokenizing input to executing compiled bytecode.

## Key Components

### Lexer (`lexer.ts`)

- **Purpose**: The lexer is responsible for converting input strings into a sequence of tokens, which are the basic units of syntax in Tacit.
- **Function**: `lex`
  - **Description**: Tokenizes an input string into an array of tokens, which can be numbers, words, or special characters.
  - **Handling**:
    - **Numbers**: Recognizes integers, floats, and scientific notation.
    - **Words**: Identifies valid words and operators.
    - **Special Characters**: Recognizes characters like `{`, `}`, `(`, `)`, `+`, `-`, `*`, `/`.
    - **Whitespace and Comments**: Ignores whitespace and comments denoted by `//`.
- **Design Decisions**:
  - **Simplicity**: The lexer is designed to be simple and efficient, focusing on the essential syntax elements of Tacit.
  - **Error Handling**: Skips invalid tokens and continues processing, ensuring robustness.

### Parser (`parser.ts`)

- **Purpose**: The parser converts the sequence of tokens produced by the lexer into a structured format that can be executed by the interpreter.
- **Functions**:
  - `parse`: Converts tokens into a sequence of instructions.
  - **Handling**:
    - **Numbers**: Converts number tokens into literal instructions.
    - **Words**: Looks up words in the dictionary and converts them into corresponding opcodes.
    - **Blocks**: Handles code blocks denoted by `{` and `}`.
    - **Colon Definitions**: Supports defining new words using the `:` syntax.
- **Design Decisions**:
  - **Flexibility**: The parser is designed to handle both simple and complex expressions, including nested blocks and definitions.
  - **Error Reporting**: Provides clear error messages for unknown words and syntax errors.

### Compiler (`compiler.ts`)

- **Purpose**: The compiler translates parsed Tacit code into bytecode, which is executed by the virtual machine.
- **Functions**:
  - `compile8`, `compile16`, `compileFloat`: Compile 8-bit, 16-bit, and 32-bit values, respectively.
  - `compileInteger`, `compileAddress`: Compile integers and addresses as tagged pointers.
  - `reset`: Resets the compile pointer for reuse.
- **Design Decisions**:
  - **Efficiency**: The compiler is designed to produce compact and efficient bytecode.
  - **Tagged Pointers**: Uses tagged pointers to manage memory and data efficiently within the constraints of the system.

### Interpreter (`interpreter.ts`)

- **Purpose**: The interpreter executes the bytecode produced by the compiler, managing the stack and controlling the flow of execution.
- **Functions**:
  - `execute`: Executes the bytecode starting from a given address.
  - **Handling**:
    - **Stack Operations**: Manages the stack for data manipulation.
    - **Control Flow**: Handles branching, looping, and function calls.
    - **Error Handling**: Provides detailed error messages for execution errors, including stack traces.
- **Design Decisions**:
  - **Simplicity**: The interpreter is designed to be simple and efficient, focusing on the core execution model of Tacit.
  - **Debugging Support**: Provides debugging information, including stack traces and execution logs.

### Dictionary (`dictionary.ts`)

- **Purpose**: The dictionary manages the definition and lookup of words in Tacit, allowing for dynamic extension of the language.
- **Functions**:
  - `define`: Defines a new word or redefines an existing word.
  - `find`: Looks up a word in the dictionary.
- **Design Decisions**:
  - **Dynamic Extensibility**: Allows users to define new words and extend the language dynamically.
  - **Efficiency**: Uses a linked list to manage words, ensuring efficient lookup and definition.

### REPL (`repl.ts`)

- **Purpose**: The Read-Eval-Print Loop (REPL) provides an interactive environment for executing Tacit code.
- **Functions**:
  - `startREPL`: Starts the REPL, allowing users to enter and execute Tacit commands interactively.
- **Design Decisions**:
  - **Interactivity**: Provides an interactive environment for testing and experimenting with Tacit code.
  - **User-Friendly**: Offers a simple and intuitive interface for entering commands and viewing results.

## Conclusion

The `lang` directory is a critical component of the Tacit programming language, providing the core functionalities for processing and executing Tacit code. Its design decisions, such as simplicity, efficiency, dynamic extensibility, and user-friendly interaction, are tailored to the needs of a restrictive system, ensuring robust and efficient language processing.

