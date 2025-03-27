# Tacit Language Architecture

This document provides an overview of the key architectural components of the Tacit programming language implementation.

## 1. **Memory Model**

- Uses a segmented memory architecture with separate segments for different purposes:
  - Code segment (SEG_CODE): Stores compiled bytecode
  - Stack segment (SEG_STACK): Data stack for operations
  - Return stack segment (SEG_RSTACK): Manages function call returns
  - Heap segment (SEG_HEAP): Block-based memory allocation for complex data types
  - String segment (SEG_STRING): Stores string data

## 2. **Value System (Tagged Values)**

- Implements NaN-boxing for efficient tagged values representation
- Supports both primitive (CoreTag) and heap-allocated (HeapTag) data types:
  - CoreTags: NUMBER, INTEGER, CODE, STRING
  - HeapTags: BLOCK, SEQ, VECTOR, DICT
- Encodes 16-bit values within 32-bit floats using NaN-boxing techniques

## 3. **Heap Management**

- Block-based allocation with 64-byte blocks
- Reference counting for memory management
- Copy-on-write semantics for efficient data sharing
- Support for multi-block allocations for larger objects

## 4. **Data Structures**

- **Vectors**: Linked blocks with fixed metadata structure
  - Support for multi-block vectors for large collections
  - Efficient random access and updates with copy-on-write
- **Sequences**: Lazy evaluation of data sources
  - Support for different sequence types: RANGE, VECTOR, MULTI_SEQUENCE, STRING
  - Functions for creating and iterating through sequences
- **Dictionaries**: Key-value storage with hashing

## 5. **Language Processing Pipeline**

- **Tokenizer**: Converts source code into tokens
- **Parser**: Transforms tokens into bytecode operations
- **Compiler**: Manages compilation of operations into the code segment
- **VM**: Executes bytecode with stack-based operations

## 6. **Virtual Machine**

- Stack-based architecture with dual stacks (data stack and return stack)
- Instruction pointer (IP) for code navigation
- Support for colon definitions (`:word ... ;`) for creating new words
- Support for code blocks using `(` and `)` syntax

## 7. **Operations**

- **Stack Operations**: dup, drop, swap
- **Arithmetic Operations**: plus, minus, multiply, divide, power, etc.
- **Control Flow**: branch, call, exit
- **Monadic Operations**: negate, reciprocal, floor, not, signum, etc.
- **Sequence Operations**: sequence creation, iteration
- **Vector Operations**: creation, access, update

## 8. **Interactive Environment**

- REPL for interactive programming
- File processing for loading and executing Tacit code files
- Support for loading additional files during interactive sessions

## 9. **Symbol Table**

- Manages word definitions (similar to functions in other languages)
- Supports both built-in and user-defined words
- Uses a digest system for string management

## 10. **Execution Model**

- Concatenative programming style where functions compose by juxtaposition
- Stack-based computation where operations consume and produce stack values
- Support for both immediate and compiled execution
