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
- Stack pointer: SP (cell-indexed; derive byte offsets explicitly as `SP * CELL_SIZE` when required)

**Return Stack (RSTACK segment)**:

- Call frame management
- Local variable storage
- Return address tracking
- Base pointer: BP (cell index, canonical). A derived byte view (`BPBytes = BP * CELL_SIZE`) exists only at memory boundary helpers. All frame arithmetic and slot addressing are cell-native.

Cell size: 4 bytes (word-aligned). All stack elements are 32‑bit float32 values encoding NaN‑boxed tags or raw numbers.

VM registers:

- SP — data stack pointer (cells)
- RSP — return stack pointer (cells)
- BP — base pointer (cells) for the current function frame. Byte offsets are obtained on demand via `BP * CELL_SIZE` (debug helpers may display both forms).
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
- String literals: use double quotes for general strings; apostrophe shorthand `'key` is equivalent to `"key"` for bare, space‑less keys.
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

`Tag.CODE` meta bit determines execution form:

- meta = 1 (reserved): lexical quotations formerly used this mode. The current immediate words run in the caller's frame without needing a dedicated opcode.
- meta = 0 (function / colon definition): Prologue sequence (cell units):
  1. Push return address (next IP)
  2. Push caller BP (cells)
  3. Set BP = RSP (frame root at current top)
     Epilogue (`Exit`) validates saved BP cell index, restores `RSP = savedBP`, restores `BP = previousBP`, then resumes at popped return address.

Frame Layout on RSTACK (top → bottom after prologue):

```
┌───────────────┐  RSP-1 : Return Address (CODE tagged value / address sentinel)
│ Return Address│
├───────────────┤  RSP-2 : Saved Caller BP (cell index)
│ Saved BP      │
├───────────────┤  (grows downward as locals reserved by Reserve)
│ Local Slot 0  │  (cell index = BP + 0)
│ Local Slot 1  │  (cell index = BP + 1)
│ ...           │
└───────────────┘
```

Local variable addressing: slot N resides at cell index `BP + N` (byte address obtained only when writing to memory: `(BP + N) * CELL_SIZE`). No `/4` or `*4` implicit arithmetic remains elsewhere.

Corruption / Testing: A helper `unsafeSetBPBytes(byteIndex)` (alignment‑checked) converts to a cell index for targeted error simulation without reintroducing byte-centric logic.

## References & Addressing

- STACK_REF — address of a data stack cell (cell index encoded as payload).
- RSTACK_REF — address of a return stack cell (cell index).
- GLOBAL_REF — address of a global cell (cell index in the global segment).

Reference helpers (see `core/refs.ts`):

- `resolveReference(vm, ref)` → { segment, address }
- `readReference(vm, ref)` / `writeReference(vm, ref)` read/write via resolved address

## Lists (Reverse Layout)

- Header at TOS encodes payload slot count; elements are stored directly beneath.
- Element traversal uses span rule: LIST → span = payload + 1; simple values → span = 1.
- Address‑returning operations (`slot`, `elem`, `find`) compose with `fetch`/`store` to read/write values.

## Symbol Table & Code References

- `&symbol` compiles to `LiteralString` + `PushSymbolRef`.
- `PushSymbolRef` resolves names at runtime:
  - Builtins → `Tag.BUILTIN(op)` (0–127)
  - Colon definitions → `Tag.CODE(addr)` (bytecode address, X1516 encoded)
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

- Tagged values: `docs/specs/tagged.md`
- Lists & traversal: `docs/specs/lists.md`
- Addressing & paths: see `docs/specs/lists.md` (Addressing & Bracket Paths)
- Variables, refs, frames: `docs/specs/variables-and-refs.md`

## Related Specifications

- `docs/specs/tagged.md` - Value representation
- `docs/specs/core-invariants.md` - Shared invariants and rules
