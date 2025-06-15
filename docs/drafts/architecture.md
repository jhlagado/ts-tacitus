# Status: Current Architecture Reference

# An In-Depth Exploration of the Tacit Language Architecture

## 1. Introduction

Tacit is a stack-based, concatenative programming language virtual machine (VM) implemented in TypeScript. Drawing inspiration from languages like Forth (stack manipulation, RPN, word definitions) and APL/J (array processing emphasis), Tacit aims to provide a powerful yet resource-efficient computing environment. Its architecture is meticulously designed for memory efficiency and deterministic performance.

This document delves into the intricate details of Tacit's architecture, examining its memory model, value representation, core data structures, execution lifecycle, and the underlying philosophies that shape its design.

## 2. Core Design Philosophy & Principles

Understanding Tacit's architecture requires grasping its foundational principles:

*   Memory Efficiency: A paramount goal is to operate effectively and predictably with memory resources. This dictates choices like stack-based memory management, compact data representation, and efficient data structure implementations.
*   Stack-Based Execution (RPN): Following Forth's tradition, Tacit employs Reverse Polish Notation. Operations consume operands from a data stack and push results back. This simplifies parsing and function composition. Two stacks are used: one for data (`SP`) and one for return addresses, local variables, and buffer storage (`RP`).
*   Stack-Based Memory Management: Memory allocation occurs primarily on the return stack, with a variable table structure for local variables. When a function completes, memory is reclaimed by simply resetting the stack pointer, providing deterministic and efficient cleanup.
*   Tagged Values (NaN-Boxing): A single 32-bit floating-point number format is used to represent all values. Type information and the actual value are encoded into the bit pattern of NaN (Not-a-Number) values. This allows for efficient storage and type checking without separate type fields.
*   Functional & Point-Free Style: The language encourages a functional style. The RPN nature facilitates a tacit (point-free) style where function composition happens implicitly through juxtaposition.
*   Bytecode Compilation: Tacit code is not interpreted directly from source but compiled into a compact bytecode format for the VM to execute, enhancing performance.

## 3. Memory Architecture: The Foundation

The most defining characteristic of Tacit is its carefully crafted memory architecture, designed around the 64KB conceptual limit.

### 3.1. Segmented Memory Architecture

The memory in Tacit is logically divided into segments, each with a distinct purpose:

1.  **SEG_VM**: VM internal data and state:
    *   Stack pointers (SP, RP)
    *   Global state variables
    *   System parameters

2.  **SEG_CODE**: Contains compiled bytecode for execution.

3.  **SEG_STRING**: Stores interned strings, with the `Digest` class managing string storage and deduplication.

4.  **SEG_STACK**: The data stack where operands are pushed and popped during program execution.

5.  **SEG_RETURN**: The return stack which stores return addresses, local variable tables, and buffer data.

### 3.2. Stack-Based Memory Management: Key Advantages

1.  **Deterministic Cleanup**: Stack-based memory management ensures predictable and immediate cleanup when functions complete.
2.  **Efficiency**: Allocating and freeing memory is extremely fast - simply adjusting a stack pointer.
3.  **Locality**: Data on the stack has good cache locality, improving performance.
4.  **No Fragmentation**: Stack allocation inherently avoids memory fragmentation issues.
5.  **Simplicity**: The memory management model is straightforward and easy to reason about.
6.  **Multitasking Support**: The stack-based approach enables lightweight multitasking through co-routines. Multiple tasks can share a single large return stack, with each task having its own stack frame. This allows for efficient context switching without the overhead of separate memory spaces.

### 3.3. Buffer Management: Implementation Considerations

1.  **Lifetime Management**: Buffers are tied to function stack frames, ensuring proper cleanup.
2.  **Sizing Flexibility**: While declaration is static, buffers can be dynamically sized at runtime.
3.  **Efficient Access**: Stack-relative addressing provides fast access to buffer data.
4.  **Mutation Semantics**: Buffer contents are mutable while references are immutable, providing a balance of flexibility and safety.
5.  **Optimization Opportunities**: The stack-based approach allows for various future optimizations such as buffer pooling, specialized buffer types, and optimized operations for common use cases.

## 4. Value Representation: NaN-Boxing (`tagged.ts`)

The most critical aspect of Tacit's value representation is NaN-boxing, a technique that allows a 32-bit floating-point value to encode not just numbers but also other primitive types and tags.

*   Principle: IEEE 754 floating-point numbers have a large range of bit patterns that represent `NaN` (Not-a-Number). These patterns are repurposed to encode non-numeric types while regular numbers are represented directly as IEEE 754 float values.

*   Encoding Scheme:
    *   A value is considered "tagged" if it's a NaN. Normal floating-point numbers are treated directly as `CoreTag.NUMBER`.
    *   If a value *is* NaN, its 32 bits are interpreted as follows:
        *   Sign Bit (Bit 31): Used to distinguish between scalar types (0) and non-scalar types (1) such as buffers and other complex data structures.
        *   Exponent Bits (Bits 30-22): Set to all `1`s to ensure the value is a NaN.
        *   Tag Bits (Bits 21-16): A field used to store the specific type tag within each main category.
        *   Value Bits (Bits 15-0): A 16-bit field that stores type-specific payload data:
            *   For `CoreTag.INTEGER`: Stores a 16-bit *signed* integer value.
            *   For `CoreTag.CODE`: Stores a 16-bit *unsigned* code address.
            *   For `CoreTag.STRING`: Stores a 16-bit *unsigned* string address.
            *   For buffer references: Stores information to locate the buffer on the return stack, such as offset from the base pointer.

*   Tags:
    *   `CoreTag`: Various tags for different value types (NUMBER, INTEGER, CODE, STRING, etc.)
    *   Special tags for buffer references and other complex data types

*   Operations:
    *   `toTaggedValue(tag, value)`: Combines a tag and a 16-bit value into a NaN-boxed 32-bit float.
    *   `fromTaggedValue(float)`: Decodes a tagged value, returning the tag and value.
    *   `NIL`: A special tagged value used to represent "nothing" or uninitialized state.

Helper functions facilitate working with these tagged values, including type checking and value extraction.

## 5. Core Data Structures

Tacit's data structures are built upon the stack-based memory model and utilize tagged values for type safety and memory efficiency.

### 5.1. Buffers

Buffers are contiguous memory regions allocated on the return stack, providing efficient storage for arrays and other data structures:

*   Representation: A buffer is represented by a tagged value that references memory allocated above the variable table in the function's stack frame.
*   Buffer Structure:
    *   Base address: The starting location of the buffer on the stack
    *   Metadata: Information about the buffer's size, shape, and other properties
    *   Data region: The contiguous memory containing the actual buffer data
*   Buffer Types:
    *   Fixed-size buffers: Simple, statically sized blocks
    *   Appendable buffers: Dynamic buffers with separate size and capacity tracking
    *   Shaped buffers: Buffers with associated shape descriptors for multi-dimensional data
    *   Record buffers: Structured data with named fields and type information
*   Access Methods:
    *   Indexing into specific elements
    *   Slicing to create logical views of buffer regions
    *   Mutation of buffer contents within the allocated capacity
    *   Metadata access for shape, type, and capacity information

## 6. Execution Model & Virtual Machine (`vm.ts`, `interpreter.ts`)

Tacit executes programs using a classic stack-based VM.

*   Dual Stacks:
    *   Return Stack: (`RP`, `SEG_RETURN`) Used for control flow, local variables, and buffer storage. Stores return addresses, variable tables, and buffer data in function stack frames.
    *   Data Stack: (`SP`, `SEG_STACK`) Used for passing arguments to operations (words) and receiving results. Manipulated by most operations (`+`, `dup`, `swap`, etc.).

*   Instruction Pointer (`IP`): A register holding the address of the next bytecode instruction to be executed.
*   Bytecode: A sequence of single-byte opcodes potentially followed by immediate operands.
*   Execution Cycle:
    1.  The VM fetches the next opcode from the code segment at the address pointed to by the IP.
    2.  It dispatches to the appropriate handler function for that opcode.
    3.  The handler manipulates the stacks and local variables as required.
    4.  Control flow operations modify the IP directly or work with the return stack.
    5.  The cycle continues until execution completes or is explicitly halted.

*   Key Control Flow Operations:
    *   `Branch`: Modifies the IP to implement conditional and unconditional jumps.
    *   `Call`: Creates a new stack frame and transfers control to the called function.
    *   `Return`: Restores the previous stack frame and returns control to the caller.
    *   `Eval`: Executes code blocks passed as first-class values.
    *   `Abort`: Halts execution of the current program.

## 7. Language Processing Pipeline

Tacit code goes through several stages before execution:

### 7.1. Tokenizer (`tokenizer.ts`)

*   Input: Raw Tacit source code string.
*   Output: A stream of `Token` objects (`{ type: TokenType, value: TokenValue, position: number }`).
*   Process:
    *   Iterates through the input character by character, tracking line and column numbers.
    *   Skips whitespace and full-line comments (`//`).
    *   Recognizes different `TokenType`s:
        *   `NUMBER`: Parses integers and floats (including signs).
        *   `STRING`: Parses double-quoted strings, handling standard escape sequences (`\n`, `\t`, `\"`, `\\`).
        *   `SPECIAL`: Recognizes single special characters defined in `isSpecialChar` (`(`, `)`, `:`, `"`, `'`, `` ` ``). *(Note: The parser later handles `:` and `;` distinctly)*. Also handles specific grouping chars `{}[]` as `WORD` for now.
        *   `WORD`: Parses sequences of non-whitespace, non-special characters. Can include operators (`+`, `*`), names (`dup`, `myWord`), or even number-like identifiers (`123name`).
    *   Provides `nextToken()` to get the next token and `pushBack()` to undo reading one token.

### 7.2. Parser (`parser.ts`)

*   Input: A `Tokenizer` instance.
*   Output: Emits bytecode into the `SEG_CODE` via the `Compiler`. Updates the `SymbolTable`.
*   Process:
    *   Resets the compiler (`vm.compiler.reset()`).
    *   Reads tokens one by one from the tokenizer.
    *   State Management: Tracks whether it's currently inside a colon definition (`currentDefinition`) or a code block (`insideCodeBlock`).
    *   Token Handling (`processToken`):
        *   `NUMBER`: Compiles `Op.LiteralNumber` followed by the 32-bit float value (`compiler.compileFloat`).
        *   `STRING`: Compiles `Op.LiteralString`. Adds the string to the `Digest` (`vm.digest.add`) to get its address, then compiles the 16-bit address (`compiler.compile16`).
        *   `WORD`: Looks up the word in the `SymbolTable` (`vm.symbolTable.find`).
            *   If found, calls the associated `Verb` function. For built-in words like `+` or `dup`, the `Verb` directly calls `vm.compiler.compile8(OpCode)`. For user-defined words (from colon definitions), the `Verb` (created by `defineCall`) compiles `Op.Call` followed by the word's bytecode address (`compiler.compile16`).
            *   If not found, throws an "Unknown word" error.
        *   `SPECIAL`: Handles structural tokens:
            *   `:`: Starts a colon definition.
                *   Checks for nesting errors.
                *   Reads the definition name (must be `WORD` or `NUMBER`).
                *   Compiles a forward `Op.Branch` with a placeholder offset.
                *   Records the definition's start address.
                *   Calls `symbolTable.defineCall` to create a `Verb` that compiles an `Op.Call` to the start address.
                *   Sets `currentDefinition` state and `compiler.preserve = true`.
            *   `;`: Ends a colon definition.
                *   Checks if inside a definition.
                *   Compiles `Op.Exit`.
                *   Patches the offset of the `Op.Branch` compiled by `:` to jump *past* the just-compiled definition body.
                *   Clears `currentDefinition` state.
            *   `(`: Starts a code block (`parseBlock`).
                *   Sets `compiler.preserve = true` (code blocks are typically stored).
                *   Increments nesting counter.
                *   Compiles `Op.BranchCall` with a placeholder offset.
                *   Recursively calls `processToken` for tokens within the block until `)` is found.
                *   Compiles `Op.Exit`.
                *   Patches the `Op.BranchCall` offset to point *past* the block's code.
                *   Decrements nesting counter.
            *   `)`: Should be consumed by `parseBlock`. If encountered outside, throws "Unexpected closing parenthesis".
            *   `` ` ``: Parses the following non-whitespace/non-grouping characters as a symbol literal, interns it using `digest.add`, and compiles `Op.LiteralString` followed by the string address. *(Note: Treats symbols like strings)*.
    *   Adds `Op.Abort` at the very end of compilation.

### 7.3. Compiler (`compiler.ts`)

*   Purpose: Provides methods to append bytecode and immediate operands to the `SEG_CODE`.
*   State:
    *   `CP` (Compile Pointer): The 16-bit offset in `SEG_CODE` where the *next* byte will be written.
    *   `BP` (Buffer Pointer): The starting offset for the current compilation unit. `reset()` usually sets `CP = BP`.
    *   `preserve`: A boolean flag. If true, `reset()` sets `BP = CP`, effectively preserving the just-compiled code (used for definitions and blocks). If false, `reset()` sets `CP = BP`, allowing the code buffer to be reused (typical for REPL lines).
*   Methods:
    *   `compile8(value)`: Writes a single byte.
    *   `compile16(value)`: Writes a 16-bit integer (handling signedness correctly for storage).
    *   `compileFloat32(value)`: Writes a 32-bit float (handles tagged values implicitly).
    *   `compileAddress(value)`: Takes a 16-bit address, tags it as `CoreTag.CODE`, and writes it as a 32-bit float using `compileFloat`.

### 7.4. Symbol Table (`symbol-table.ts`)

*   Purpose: Manages the dictionary of defined words (operations). Maps word names (strings) to `Verb` functions.
*   Representation: A singly linked list of `SymbolTableNode`s (`{ key: number, value: Verb, next: SymbolTableNode | null }`). The `key` is the address of the word's name string in the `Digest`. Using a linked list allows easy shadowing (newer definitions are added to the head and found first).
*   Methods:
    *   `define(name, verb)`: Adds or overrides a word definition. Interns the `name` using `digest.add` to get the key, creates a new node, and prepends it to the linked list.
    *   `defineCall(name, address)`: A specialized version of `define`. It creates a `Verb` closure (`compileCall`) that, when invoked by the parser, compiles an `Op.Call` instruction followed by the provided bytecode `address`. This is how user-defined words are linked.
    *   `find(name)`: Traverses the linked list, comparing the `Digest` string at each node's `key` with the provided `name`. Returns the `Verb` of the first match found (most recent definition) or `undefined`.
*   Initialization: The constructor calls `defineBuiltins`, which populates the table with the core language operations, mapping operator strings (`+`, `dup`, etc.) or word names (`eval`, `abs`) to `Verb` functions that compile the corresponding opcode.

## 8. Tooling and Environment

*   CLI (`cli.ts`): The main command-line entry point. Parses arguments (`--no-interactive`), identifies files to process, and decides whether to run `processFiles` or start the `startREPL`.
*   File Processor (`fileProcessor.ts`):
    *   `processFile`: Reads a `.tacit` file, splits it into lines, trims whitespace, skips empty lines and comments, and calls `executeLine` for each valid line. Handles file reading and execution errors.
    *   `processFiles`: Initializes the interpreter (`setupInterpreter`), iterates through a list of files calling `processFileFn` (defaults to `processFile`), and optionally exits on the first error.
*   REPL (`repl.ts`):
    *   Uses Node.js `readline` for interactive input.
    *   Optionally processes initial files using `processFile`.
    *   Enters a loop: prompts the user (`> `), reads a line, executes it using `executeLine`.
    *   Handles special commands: `exit` (closes REPL) and `load <filepath>` (calls `processFile` on the specified file).
    *   Catches errors from `executeLine` and prints them without exiting the REPL.
*   Testing (`*.test.ts`, `jest.config.js`): Uses Jest and `ts-jest` for unit and integration testing of core components (VM, parser, tokenizer, operations, etc.). Aims for reasonable code coverage.
*   Linting (`eslint.config.mjs`): Uses ESLint with TypeScript support for code style and quality checks.

## 9. Conclusion

The Tacit architecture represents a thoughtful and intricate design aimed squarely at achieving functional programming capabilities within a highly memory-constrained, stack-based environment. Its core strengths lie in:

*   Memory Efficiency: The segmented memory, stack-based memory management, and NaN-boxing all contribute to minimizing memory usage.
*   Deterministic Performance: Stack-based memory management provides predictable cleanup without unpredictable pauses.
*   Immutability with Practicality: The buffer system provides immutable references with mutable contents, balancing functional programming principles with practical efficiency.
*   Efficient Addressing: The variable table system provides an efficient addressing scheme for accessing local variables and buffer data.
*   Unified Value System: NaN-boxing allows diverse types (numbers, pointers, integers) to be handled uniformly on the stack and in data structures.

However, the design also implies certain trade-offs:

*   Limited Maximum Sizes: The 16-bit fields in tagged values cap variable and buffer sizes.
*   Function Lifetimes: Stack-based allocation means variables and buffers cannot outlive their declaring function scope.
*   Stack Space: Each function call consumes stack space that must be managed carefully in a resource-constrained environment.
*   Implementation Complexity: The tagging system and stack-based buffer management require careful implementation to ensure correctness.

Overall, Tacit is a sophisticated VM prototype showcasing how principles from stack languages, array languages, and functional programming can be synthesized into a unique architecture optimized for efficiency and deterministic performance. Its detailed memory management and value representation schemes are particularly noteworthy design elements.

## 10. Related Documentation

For a deeper understanding of specific aspects of the Tacit architecture, refer to the following documentation:

* **[local-variables.md](./local-variables.md)**: Detailed explanation of the variable table system, buffer allocation, and stack frame structure
* **[stack-data-structures.md](./stack-data-structures.md)**: How complex data structures are represented on the stack
* **[compiled-sequences.md](./compiled-sequences.md)**: Compilation and optimization strategies

Additional documentation on multitasking, co-routines, and other advanced features will be added as these features are implemented.