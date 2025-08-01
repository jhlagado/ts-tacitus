# TACIT Reference Glossary

## Core Concepts

**TACIT**: Stack-based, point-free programming language inspired by Forth, APL, and Joy.

**Stack-based**: All operations work on a shared data stack using postfix notation (RPN).

**Point-free**: Functions are composed without explicitly naming parameters.

**NaN-boxing**: Technique for storing type tags in IEEE 754 NaN bit patterns.

## Data Types

**Simple Values**: Atomic values that fit in one 32-bit stack cell with type tag.

**Tagged Values**: NaN-boxed values combining 6-bit type tag with 16-bit payload.

**LIST**: Length-prefixed compound structure containing sequence of simple values.

**LINK**: Stack-only metadata providing backward pointer to locate variable-length structures.

**Capsule**: Object-like structure where element 0 is a function reference.

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

**Stack Effects**: Notation `( before — after )` showing stack transformations.

**Built-ins**: Native operations with opcodes 0-127, executed directly.

**Colon Definitions**: User-defined words compiled to bytecode, opcodes ≥128.

**Code References**: Tagged values pointing to executable code (built-ins or bytecode).

## Language Constructs

**Word**: Named operation or value (function, variable, constant).

**Quotation**: `{ code }` - anonymous code block, creates executable reference.

**Symbol Reference**: `@symbol` - creates reference to named word without executing.

**Eval**: Operation that executes code references created by quotations or symbols.

## Memory Model

**Unified Addressing**: Single 64KB address space with segment boundaries.

**Word-aligned**: Stack elements stored at 4-byte boundaries.

**Immutable Lists**: No in-place modification, transformations create new structures.

**Direct Addressing**: Bytecode addresses point directly to code, no indirection.

## Compilation Model

**Bytecode**: Compact instruction encoding for efficient execution.

**Single-pass**: Compiler processes source left-to-right without backtracking.

**Symbol Table**: Maps names to opcodes (built-ins) or bytecode addresses (colon definitions).

**Function Table**: Legacy indirection mechanism being eliminated for direct addressing.
