# TACIT Reference Glossary

## Core Concepts

- **NaN-boxing**: Technique for storing type tags in IEEE 754 NaN bit patterns.
- **Point-free**: Functions are composed without explicitly naming parameters.
- **Stack-based**: All operations work on a shared data stack using postfix notation (RPN).
- **TACIT**: Stack-based, point-free programming language inspired by Forth, APL, and Joy.

## Data Types

- **Capsule**: Object-like structure where element 0 is a dispatch maplist containing method names and code references.
- **Default Key Convention**: Special `default` key in maplists providing fallback values for failed lookups.
- **LINK**: Stack-only metadata providing backward pointer to locate variable-length structures.
- **LIST**: Length-prefixed compound structure containing sequence of simple values.
- **Maplist**: List following key-value alternating pattern for associative data structures.
- **NIL**: INTEGER tagged value with value 0, representing "not found" or "absent" data for graceful error handling.
- **Simple Values**: Atomic values that fit in one 32-bit stack cell with type tag.
- **Tagged Values**: NaN-boxed values combining 6-bit type tag with 16-bit payload.

## VM Components

**Stack Segments**:
- **STACK**: Main data stack for computations
- **RSTACK**: Return stack for call frames and locals
- **CODE**: Bytecode storage segment  
- **STRING**: String literal storage

**Registers**:
- **SP**: Stack pointer (main stack)
- **RP**: Return stack pointer  
- **IP**: Instruction pointer (bytecode address)
- **BP**: Base pointer (call frame)

## Operations

- **Built-ins**: Native operations with opcodes 0-127, executed directly.
- **Bytecode Address**: Direct memory address in CODE segment where compiled colon definition begins.
- **Code References**: Tagged values pointing to executable code (built-ins or bytecode).
- **Colon Definitions**: User-defined words created with `: name ... ;` syntax, compiled to bytecode, assigned function indices ≥128.
- **Function Index**: Numeric identifier for operations: 0-127 for built-ins, 128-32767 for colon definitions.
- **Function Table**: Legacy lookup table mapping function indices to executable implementations.
- **Opcode**: Single-byte instruction code for built-in operations (0-127).
- **Stack Effects**: Notation `( before — after )` showing stack transformations.
- **Symbol Table**: Primary namespace mapping word names to function indices or direct bytecode addresses.

## Language Constructs

- **@symbol syntax**: Prefix notation for creating references to named words without immediate execution.
- **`.method syntax`**: Prefix sigil for method dispatch within `with` combinator context.
- **Combinator**: Higher-order operation that manages control flow and context (e.g., `with` combinator).
- **Dispatch Maplist**: Maplist in slot 0 of capsules containing alternating method names and code references.
- **Eval**: Operation that executes code references created by quotations or symbols.
- **Field**: Named data slot in a capsule, accessed by offset within methods.
- **Method Dispatch**: Process of looking up and executing methods via maplist search in capsules.
- **Prefix Sigil**: Special character that modifies how the following token is interpreted (e.g., `@`, `` ` ``, `.`).
- **Quotation**: `{ code }` - anonymous code block, creates executable reference.
- **Receiver**: Object that receives method calls in object-oriented contexts.
- **Self Register**: VM register pointing to current object context within `with` blocks.
- **Symbol Reference**: `@symbol` - creates reference to named word without executing.
- **Tag.BUILTIN**: Tagged value type (7) for references to built-in operations.
- **Tag.CODE**: Tagged value type (2) for references to bytecode addresses.
- **Unified Dispatch**: Single execution mechanism handling both built-ins and colon definitions via eval.
- **With Block**: Code block executed within object context using `with` combinator syntax: `object with { ... }`.
- **Word**: Named operation or value (function, variable, constant).

## Memory Model

- **Direct Addressing**: Bytecode addresses point directly to code, no indirection.
- **Element Mutation**: Updating simple values in-place within lists without structural changes.
- **Graceful Degradation**: Error handling strategy using NIL values instead of exceptions.
- **Immutable Lists**: No in-place modification, transformations create new structures.
- **Structural Immutability**: List structure (length, positions) should not be modified.
- **Unified Addressing**: Single 64KB address space with segment boundaries.
- **Word-aligned**: Stack elements stored at 4-byte boundaries.

## Testing & Development

- **Comprehensive Test Coverage**: Full testing including edge cases, error conditions, and integration scenarios.
- **Integration Testing**: Testing that verifies multiple components work together correctly.
- **Manual Registration**: Testing technique using direct API calls instead of parsing language syntax.
- **Step-wise Implementation**: Development approach where complex features are built incrementally with validation at each step.
- **Test Coverage**: Measurement of code execution by test suite, tracked for statements, branches, functions, and lines.
- **VM Testing**: Testing virtual machine behavior without language-level changes.

## Advanced Concepts

- **Bounds Checking**: Verification that array/list access is within valid index range.
- **Code as Data**: Treating executable code as manipulable values on the stack.
- **Closure-free**: Programming model where all state is explicitly stored, no lexical environments.
- **Copy-based Instantiation**: Object creation through copying rather than inheritance chains.
- **Forward-only Traversal**: Navigation pattern required for lists, moving from header toward end.
- **Incremental Migration**: Development strategy for replacing systems gradually without breaking existing functionality.
- **Memory Efficiency**: Optimizations to reduce memory usage, such as eliminating the 256KB function table.
- **Metaprogramming**: Programming technique where programs manipulate other programs as data.
- **Stack Pollution**: Problem where excessive `dup` calls clutter the stack during method dispatch.
- **Uniform Representation**: Single mechanism handling different types of executable references.

## Compilation Model

- **Bytecode**: Compact instruction encoding for efficient execution.
- **Code Reference Utilities**: Helper functions for creating, validating, and extracting information from tagged code references.
- **Direct Addressing**: New system where symbol table stores bytecode addresses directly, eliminating function table indirection.
- **Function Table**: Legacy indirection mechanism being eliminated in favor of direct addressing.
- **Function Table Bypass**: Mechanism to extract bytecode addresses from function table entries for migration to direct addressing.
- **Single-pass**: Compiler processes source left-to-right without backtracking.
- **Symbol Table**: Maps names to opcodes (built-ins) or bytecode addresses (colon definitions).
- **Unified Code Reference System**: Architecture allowing `@symbol eval` to work identically for built-ins and colon definitions.
- **VM Dispatch**: Core execution mechanism that routes function indices to appropriate handlers (built-ins vs bytecode).
