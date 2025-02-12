The README has been updated to reflect the GNU Public License. Here is the revised version:

# Tacit Programming Language

## Overview

Tacit is a new programming language designed to run on more restrictive systems than the JavaScript VM. It is a prototype that may be converted to C and even assembly language. The language features a unique memory management system, a stack-based execution model, and a focus on array programming inspired by languages like APL and J.

## Key Features

### Memory Management

- **Memory Space**: The memory space is limited to 64KB, using 16-bit pointers.
- **Main Data Types**: The primary data types are numbers (32-bit floating-point) and multi-dimensional arrays.
- **Tagged Data**: The language extends the Float32 format to store tagged data within the 23-bit mantissa of a NaN float. 3 bits are used for the tag, and the remaining 20 bits are used for data.
- **Reference Counting**: Uses reference counting to manage memory without garbage collection.
- **Immutable Data Structures**: Arrays are copy-on-write but use structural sharing to prevent cyclic references and improve efficiency.
- **Persistent Data Structures**: Maintains immutability by cloning only the necessary parts of the array, similar to Clojure.
- **No Fragmentation**: All blocks are the same size (BLOCK_SIZE), and larger blocks are created by linking them together (BLOCK_NEXT).

### Execution Model

- **Stack-Based**: The language processes arguments using a stack, with a second stack for storing return addresses. There is no concept of stack frames.
- **Reverse Polish Notation (RPN)**: Similar to PostScript and Forth, Tacit uses RPN for its stack-based execution model.
- **No Local Variables**: State is held on the stack, and there may be some global variables. Vectors can contain pointers to other heap-allocated objects, with reference counting deciding the lifespan of objects.
- **Ownership**: The main form of ownership of objects is the stack.

### Language Design

- **No Loops or Recursion**: The language is based on iterators, combinators, and operators such as `each`, `reduce`, `scan`, etc., rather than lambda calculus.
- **Bytecode Compilation**: Functions are easily composed using bytecode compilation, with no closures.
- **Array Language**: The language features array language capabilities similar to APL or J.

## Codebase Overview

### Memory Management

- **Memory Layout**: The memory is divided into sections for the stack, return stack, strings, heap, and code.
- **Memory Operations**: The `Memory` class handles low-level memory operations, including reading and writing 8-bit, 16-bit, and 32-bit values.
- **Heap Management**: The `Heap` class manages memory allocation and deallocation, including reference counting and free list management.

### Data Structures

- **Arrays**: The `array.ts` file defines functions for creating, accessing, and updating arrays. Arrays support multi-dimensional data and use copy-on-write with structural sharing.
- **Vectors**: The `vector.ts` file defines functions for creating, accessing, and updating vectors. Vectors are used to store contiguous data.
- **Views**: The `view.ts` file defines functions for creating views on vectors, allowing for efficient access to subsets of data.

### Execution Engine

- **Virtual Machine**: The `VM` class in `vm.ts` manages the execution of bytecode, including stack operations, instruction pointer management, and memory access.
- **Compiler**: The `Compiler` class in `lang/compiler.ts` handles the compilation of Tacit code into bytecode.
- **Interpreter**: The `interpreter.ts` file defines functions for executing compiled bytecode, including error handling and debugging support.

### Language Features

- **Built-in Words**: The `ops/builtins.ts` file defines built-in words for arithmetic operations, stack manipulation, and control flow.
- **Dictionary**: The `Dictionary` class in `lang/dictionary.ts` manages the definition and lookup of words in the language.
- **Parser**: The `parser.ts` file defines functions for parsing Tacit code into a sequence of tokens and compiling it into bytecode.
- **Lexer**: The `lexer.ts` file defines functions for tokenizing input strings into a sequence of tokens.

### Sequence Processing

- **Sequences**: The `seq` directory contains files for defining and processing sequences, including sources, processors, and sinks.
- **Sequence Operations**: The `sequence.ts` file defines basic sequence operations, such as consuming the next element and duplicating sequences.
- **Processors**: The `processor.ts` file defines functions for creating processor sequences that apply mapping or filtering functions to each element.
- **Sinks**: The `sink.ts` file defines functions for consuming sequences and reducing them to a single value or collecting them into an array.

### Utilities

- **Tagged Values**: The `tagged-value.ts` file defines functions for encoding and decoding tagged values, which are used to store pointers and other metadata in a compact form.
- **Utilities**: The `utils.ts` file defines various utility functions for character checks, bitwise operations, and other common tasks.

## Getting Started

To get started with Tacit, you can explore the codebase and run the tests to understand the language's features and execution model. The tests are written using Jest.

## Contributing

Contributions to Tacit are welcome! Please follow the existing code style and write tests for any new features or bug fixes.

## License

Tacit is licensed under the GNU Public License. See the LICENSE file for more information.

## Contact

For more information about Tacit, please contact the project maintainers.

---

This README provides a comprehensive overview of the Tacit programming language, its features, and the structure of the codebase. It is designed to help developers understand the language's unique memory management system, execution model, and language features.