# TACIT VM Architecture Specification

## Overview

The TACIT VM is a stack-based virtual machine with segmented memory, NaN-boxed values, and unified addressing. It executes bytecode while maintaining strict separation between data and code segments.

## Memory Layout

```
Total: 64KB (65536 bytes)

Segments:
├── STACK:  16KB (0x0000-0x3FFF) - Main data stack
├── RSTACK:  4KB (0x4000-0x4FFF) - Return stack  
├── CODE:    8KB (0x5000-0x6FFF) - Bytecode storage
└── STRING: 36KB (0x7000-0xFFFF) - String storage
```

## Stack Architecture

**Main Stack (STACK segment)**:
- Growth: Low to high addresses
- Elements: 32-bit tagged values
- Operations: push, pop, peek, dup, swap, drop
- Stack pointer: SP (byte offset)

**Return Stack (RSTACK segment)**:
- Call frame management
- Local variable storage  
- Return address tracking
- Base pointer: BP

## Execution Model

**Instruction Pointer**: IP (bytecode address)
**Execution cycle**:
1. Fetch instruction at IP
2. Decode opcode and operands
3. Execute operation
4. Update IP and continue

## Address Spaces

**Bytecode addresses**: 0-8191 (13-bit, byte-addressed)
**String addresses**: 0-36863 (segment-relative)
**Stack addresses**: Word-aligned (4-byte elements)

## Constraints

- Stack overflow protection at segment boundaries
- No cross-segment pointer arithmetic
- Type safety enforced via tagged values
- Deterministic execution order

## Operations

**Stack operations**: Manipulate main stack
**Memory operations**: Load/store to segments
**Control flow**: Jumps, calls, returns
**Built-ins**: Direct function dispatch

## Error Handling

- Stack overflow/underflow detection
- Invalid address protection
- Type mismatch prevention
- Graceful error recovery

## Implementation Notes

- Unified memory buffer with segment views
- Efficient tagged value operations
- Direct bytecode interpretation
- Minimal overhead design

## Related Specifications

- `specs/tagged-values.md` - Value representation
- `specs/bytecode.md` - Instruction encoding
- `specs/stack-operations.md` - Stack manipulation
