# Tacit VM Architecture Specification

## Overview

The Tacit VM is a stack-based virtual machine with segmented memory, NaN-boxed values, and unified addressing. It executes bytecode while maintaining strict separation between data and code segments.

Execution pipeline (high level):

- Tokenize & Parse → Compile to bytecode
- Execute opcode loop with unified dispatch (builtins + bytecode)

## Memory Layout

Segments (implementation‑defined sizes):

- STACK — Main data stack
- RSTACK — Return stack (call frames, locals)
- CODE — Bytecode storage
- STRING — String storage

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

Cell size: 4 bytes (word-aligned). All stack elements are 32‑bit float32 values encoding NaN‑boxed tags or raw numbers.

VM registers:

- SP — data stack pointer (bytes)
- RP — return stack pointer (bytes)
- BP — base pointer for current frame (bytes)
- IP — instruction pointer (byte address in CODE)

## Execution Model

**Instruction Pointer**: IP (bytecode address)
**Execution cycle**:

1. Fetch instruction at IP
2. Decode opcode and operands
3. Execute operation
4. Update IP and continue

Opcode encoding & dispatch:

- Builtins (0–127): single‑byte opcodes.
- User words (bytecode addresses ≥128): two‑byte encoding with MSB set (15‑bit address), executed via direct jump.
- Dispatch is unified: builtins resolved through the symbol table; user words execute by jumping to bytecode addresses. See `Compiler.compileOpcode` and VM `nextOpcode`.

## Address Spaces

- Bytecode addresses: implementation‑defined (byte‑addressed), validated at runtime.
- String addresses: implementation‑defined (segment‑relative), validated at runtime.
- Stack addresses: word‑aligned (4‑byte elements).

## Constraints

- Segment sizes are implementation‑defined; code must not assume fixed totals.
- Stack overflow/underflow protection at segment boundaries.
- No cross‑segment pointer arithmetic.
- Type safety enforced via tagged values.
- Deterministic execution order.

## Literals & Values in Bytecode

- Numbers: encoded as 32‑bit float; `LiteralNumber` pushes the number.
- Strings: encoded as 16‑bit digest addresses; `LiteralString` pushes `Tag.STRING(address)`.
- Code references: encoded using NaN‑boxed `Tag.CODE(address)`; `LiteralCode` pushes the tagged value.

## Blocks vs Functions (Frames)

- `Tag.CODE` meta flag selects execution mode:
  - meta = 1: code block (quotation) — preserves caller BP; only pushes return address; returns via `ExitCode`.
  - meta = 0: function (colon definition) — pushes return address + current BP; sets BP to new frame; returns via `Exit`.

## References & Addressing

- STACK_REF — address of a data stack cell (cell index encoded as payload).
- RSTACK_REF — address of a return stack cell (absolute cell index).
- GLOBAL_REF — reserved for future; unimplemented (errors).

Reference helpers (see `core/refs.ts`):

- `resolveReference(vm, ref)` → { segment, address }
- `readReference(vm, ref)` / `writeReference(vm, ref)` read/write via resolved address

## Lists (Reverse Layout)

- Header at TOS encodes payload slot count; elements are stored directly beneath.
- Element traversal uses span rule: LIST → span = payload + 1; simple values → span = 1.
- Address‑returning operations (`slot`, `elem`, `find`) compose with `fetch`/`store` to read/write values.

## Symbol Table & @symbol

- `@symbol` pushes a tagged reference: `Tag.BUILTIN(op)` for builtins or `Tag.CODE(addr)` for colon definitions/compiled blocks.
- `eval` executes tagged references: BUILTIN dispatches native implementation; CODE jumps to bytecode address (block/function per meta flag).
- `Tag.LOCAL` marks local variables at compile time in the symbol table; runtime locals are addressed via `RSTACK_REF` (see locals spec).

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
  Errors use structured types (e.g., StackUnderflowError, ReturnStackOverflowError, InvalidOpcodeError) and include stack state snapshots to aid diagnostics. Stack depth checks (e.g., `ensureStackSize`) run before destructive pops.

## Implementation Notes

- Unified memory buffer with segment views
- Efficient tagged value operations
- Direct bytecode interpretation
- Minimal overhead design

## Cross‑References

- Tagged values: `specs/tagged.md`
- Lists & traversal: `specs/lists.md`
- Access operations: `specs/access.md`
- Local variables & frames: `specs/local-vars.md`

## Related Specifications

- `specs/tagged.md` - Value representation
- `specs/stack-operations.md` - Stack manipulation
- `specs/core-invariants.md` - Shared invariants and rules
