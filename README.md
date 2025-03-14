# Memory Management in Tacit

## Overview

The `memory.ts` file in the Tacit codebase manages the memory layout and provides low-level memory operations. It defines the structure of the memory space, including sections for the stack, return stack, strings, heap, and code within a 64KB memory space.

## Key Features

### Memory Layout

- **Memory Size**: The total memory size is 64KB (65536 bytes)
- **Segment-Based Architecture**: Memory is divided into logical segments:
  - **SEG_STACK**: Data stack for operation values (256 bytes)
  - **SEG_RSTACK**: Return stack for function calls (256 bytes)
  - **SEG_STRING**: String storage (2KB)
  - **SEG_CODE**: Executable code (8KB)
  - **SEG_HEAP**: Dynamic memory allocation (remaining space)

### Memory Operations

- **Segment-Based Addressing**: All memory operations require a segment ID and offset
- **Read/Write Operations**: Methods for 8-bit, 16-bit, and 32-bit float values
- **Address Resolution**: `resolveAddress` converts segment+offset pairs to absolute addresses
- **Bounds Checking**: All operations verify memory accesses are within valid ranges

## Heap Management in Tacit

### Block-Based Architecture

- **Fixed-Size Blocks**: Each block is exactly 64 bytes
- **Block Structure**:
  - **BLOCK_NEXT** (2 bytes): Points to the next block in a chain
  - **BLOCK_REFS** (2 bytes): Reference count for garbage collection
  - **Usable Space**: 60 bytes per block (BLOCK_SIZE - 4)

### Block-Based Addressing

- **Block Indices**: The system uses 16-bit block indices rather than byte offsets
- **Addressing Capacity**: This approach expands addressable memory from 64KB to 4MB
- **Address Translation**: `blockToByteOffset` converts block indices to actual byte offsets

### Memory Allocation

- **Free List**: Tracks available blocks using a linked list
- **Multi-Block Allocation**: Supports allocating contiguous blocks for larger data structures
- **Reference Counting**: Automatically manages memory through reference counts

### Copy-on-Write Mechanism

- **Immutable Updates**: Modifications to shared blocks create copies first
- **Structural Sharing**: Unmodified parts of data structures remain shared
- **Block Cloning**: `cloneBlock` creates copies while preserving reference integrity

## Data Structures

### Vectors

- **Implementation**: Vectors are built on top of the heap system
- **Block Layout**:
  - Uses heap block header (BLOCK_NEXT, BLOCK_REFS)
  - Adds vector-specific metadata (VEC_SIZE, VEC_RESERVED)
  - Stores elements as 32-bit floats
- **Multi-Block Support**: Large vectors span multiple linked blocks
- **Operations**: Create, get, update (with copy-on-write semantics)

### Sequences

- **Purpose**: Abstractions for iterating over various data sources
- **Types**:
  - **Range Sequences**: Generate numeric sequences with start, step, end
  - **Vector Sequences**: Iterate over elements in a vector
  - **String Sequences**: Iterate over characters in a string
  - **Multi-Sequences**: Combine multiple sequences (like zip operation)
- **Architecture**:
  - **Sources**: Create sequences from different data types
  - **Processors**: Transform sequence elements (map, filter)
  - **Sinks**: Consume sequences and produce results

## Technical Highlights

### NaN-Boxing for Tagged Values

- **Tagged Values**: Uses NaN-boxing to encode type information and values in 32-bit floats
- **Types**:
  - **Core Tags**: NIL, INTEGER, CODE, NAN, STRING
  - **Heap Tags**: BLOCK, SEQ, VECTOR, DICT
- **Benefits**: Efficient type checking and value extraction without separate type fields

### Reference Counting vs Garbage Collection

- **Deterministic Cleanup**: Objects are freed immediately when reference count reaches zero
- **Automatic Propagation**: Freeing a block decrements references to linked blocks
- **No Collection Pauses**: Avoids the overhead of garbage collection cycles

## Conclusion

The memory management system in Tacit is designed for efficiency within constrained environments. The block-based addressing scheme with reference counting provides a balance between flexibility and performance, while the copy-on-write mechanism enables functional programming patterns with immutable data structures. This architecture allows Tacit to manage complex data structures efficiently while maintaining a small memory footprint.

# Language Processing in Tacit

## Overview

The `lang` directory contains components responsible for parsing, lexing, compiling, and interpreting Tacit code. These components work together to enable the execution of Tacit programs, handling everything from tokenizing input to executing compiled bytecode.

## Key Components

### Lexer (`lexer.ts`)

- **Purpose**: Converts input strings into a sequence of tokens
- **Function**: `lex`
  - Tokenizes input into numbers, words, and special characters
  - Handles numbers (integers, floats), words, operators, and special characters
  - Ignores whitespace and comments (denoted by `//`)
- **Design Decisions**:
  - Simple and efficient tokenization focused on essential syntax elements
  - Robust error handling that skips invalid tokens

### Parser (`parser.ts`)

- **Purpose**: Converts token sequences into executable bytecode
- **Function**: `parse`
  - Processes tokens sequentially and emits corresponding bytecode
  - Handles numbers, words, blocks, and colon definitions
  - Manages compilation context and nesting
- **Key Features**:
  - **Colon Definitions**: Supports `: word ... ;` syntax for defining new words
  - **Code Blocks**: Handles `(...)` syntax for anonymous functions
  - **Error Handling**: Provides clear messages for syntax errors

### Compiler (`compiler.ts`)

- **Purpose**: Generates bytecode for the VM to execute
- **Functions**:
  - `compile8`, `compile16`, `compileFloat`: Emit different-sized values
  - `reset`: Resets the compilation state
- **Design Decisions**:
  - Produces compact bytecode for efficient execution
  - Supports branch patching for control flow structures

### Symbol Table (`symbol-table.ts`)

- **Purpose**: Manages word definitions in the language
- **Functions**:
  - `define`: Registers a new word or overrides an existing one
  - `find`: Looks up a word by name
  - `defineCall`: Creates a word that calls a specific address
- **Implementation**:
  - Uses a linked list of symbol nodes for efficient lookup
  - Supports word redefinition (later definitions override earlier ones)

## Execution Model

### Stack-Based Architecture

- **Data Stack**: Primary stack for operands and results
- **Return Stack**: Manages function calls and returns
- **RPN Syntax**: Operators follow their operands (e.g., `2 3 +`)

### Bytecode Execution

- **Instruction Pointer**: Tracks the current execution position
- **Opcodes**: Single-byte instructions (e.g., `Op.Plus`, `Op.Call`)
- **Control Flow**: Supports branching, loops, and function calls

## Sequence Processing

Tacit implements a powerful sequence abstraction for working with collections:

1. **Creation**: Sequences can be created from ranges, vectors, or strings
2. **Transformation**: Processors like `filter` and `map` transform elements
3. **Consumption**: Sinks like `toVector` and `forEach` produce final results

This architecture enables lazy evaluation and efficient processing of data collections.

## Conclusion

The language processing components in Tacit provide a robust foundation for a stack-based programming language. The design emphasizes simplicity, efficiency, and functional programming patterns, making it suitable for resource-constrained environments while still offering powerful abstractions like sequences and immutable data structures.

# Comprehensive Overview of the Tacit Virtual Machine

## Core Architecture

Tacit is a stack-based programming language with a virtual machine implementation in TypeScript. It combines elements from Forth, APL, and functional programming languages like Clojure, optimized for constrained environments.

### Key Design Principles

1. **Memory Efficiency**: Operates within a 64KB memory space using block-based addressing
2. **Immutable Data Structures**: Implements copy-on-write semantics for efficient updates
3. **Reference Counting**: Uses explicit reference counting instead of garbage collection
4. **Stack-Based Execution**: Follows reverse Polish notation with two stacks
5. **Functional Programming**: Supports higher-order functions and sequence abstractions

## Memory Management

### Segmented Memory Model

- **Total Size**: 64KB addressable space
- **Segments**:
  - **Stack**: Data values during execution (256 bytes)
  - **Return Stack**: Function call tracking (256 bytes)
  - **String**: String storage (2KB)
  - **Code**: Compiled bytecode (8KB)
  - **Heap**: Dynamic memory allocation (remaining space)

### Block-Based Heap

- **Block Size**: Fixed 64-byte blocks
- **Addressing**: Uses 16-bit block indices instead of byte offsets
- **Capacity**: Effectively addresses up to 4MB (2^16 blocks × 64 bytes)
- **Reference Counting**: Tracks object lifetimes with `BLOCK_REFS`

### NaN-Boxing

- **Tagged Values**: Encodes type information and values in 32-bit floats
- **Type Tags**: Distinguishes between integers, strings, code pointers, and heap objects
- **Memory Safety**: Prevents type confusion and invalid memory access

## Data Structures

### Vectors

- **Implementation**: Linked blocks with metadata for length
- **Operations**: Create, get, update with copy-on-write semantics
- **Multi-Block**: Large vectors span multiple linked blocks

### Sequences

- **Sources**: Generate elements from ranges, vectors, strings
- **Processors**: Transform elements (map, filter)
- **Sinks**: Consume sequences (reduce, forEach)
- **Lazy Evaluation**: Computes elements on demand

## Language Features

### Stack Operations

- **Data Manipulation**: dup, swap, drop, over
- **Arithmetic**: +, -, *, /
- **Logic**: and, or, not, xor

### Control Flow

- **Conditionals**: if, else, then
- **Loops**: while, until, repeat
- **Function Calls**: call, exit

### Word Definitions

- **Syntax**: `: word ... ;`
- **Code Blocks**: `(...)` for anonymous functions
- **Dynamic Lookup**: Symbol table for word resolution

## Implementation Details

### Compiler

- **Bytecode Generation**: Translates words to opcodes
- **Branch Resolution**: Handles control flow structures
- **Word Registration**: Adds definitions to symbol table

### Interpreter

- **Instruction Dispatch**: Executes opcodes
- **Stack Management**: Maintains data and return stacks
- **Error Handling**: Reports execution errors with context

## Technical Innovations

1. **Block-Based Addressing**: Expands addressable memory from 64KB to 4MB
2. **Copy-on-Write**: Enables immutable data structures with efficient updates
3. **Sequence Abstraction**: Provides a unified interface for collections
4. **Reference Counting**: Deterministic memory management without GC pauses

## Conclusion

Tacit combines the simplicity of stack-based languages with the power of functional programming, all within a memory-efficient architecture. Its design makes it suitable for embedded systems, educational purposes, or as a foundation for domain-specific languages. The implementation demonstrates how modern programming concepts can be applied within constrained environments.
