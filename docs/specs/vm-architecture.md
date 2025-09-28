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
- Stack pointer: SP (cell-indexed; accessor exposes bytes for compatibility)

**Return Stack (RSTACK segment)**:

- Call frame management
- Local variable storage
- Return address tracking
- Base pointer: BP (cell index, canonical). A derived byte view (`BPBytes = BP * CELL_SIZE`) exists only at memory boundary helpers. All frame arithmetic and slot addressing are cell-native.

Cell size: 4 bytes (word-aligned). All stack elements are 32‑bit float32 values encoding NaN‑boxed tags or raw numbers.

VM registers:

- SP — data stack pointer (cells)
- RSP — return stack pointer (cells)
- BP — base pointer (cells) for current function frame (alias: BPCells); `BPBytes` provided for diagnostics/corruption testing only.
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

`Tag.CODE` meta bit determines execution form:

- meta = 1 (reserved): lexical quotations formerly used this mode. New immediate constructs no longer emit it, but the encoding remains reserved for future lexical forms.
- meta = 0 (function / colon definition): Prologue sequence (cell units):
  1. Push return address (next IP)
  2. Push caller BP (BPCells)
  3. Set BP = RSP (frame root at current top)
  Epilogue (`Exit`) validates saved BP cell index, restores `RSP = savedBP`, restores `BP = previousBP`, then resumes at popped return address.

Frame Layout on RSTACK (top → bottom after prologue):

```
┌───────────────┐  RSP-1 : Return Address (CODE tagged value / address sentinel)
│ Return Address│
├───────────────┤  RSP-2 : Saved Caller BP (cell index)
│ Saved BP      │
├───────────────┤  (grows downward as locals reserved by Reserve)
│ Local Slot 0  │  (absolute cell index = BP + 0)
│ Local Slot 1  │  (absolute cell index = BP + 1)
│ ...           │
└───────────────┘
```

Local variable addressing: slot N resides at cell index `BP + N` (byte address obtained only when writing to memory: `(BP + N) * CELL_SIZE`). No `/4` or `*4` implicit arithmetic remains elsewhere.

Corruption / Testing: A helper `unsafeSetBPBytes(byteIndex)` (alignment‑checked) converts to a cell index for targeted error simulation without reintroducing byte-centric logic.

## Frames & BP (Cell Canonical)

Overview
Tacit uses a split-stack model: the data stack (STACK) for operand values and the return stack (RSTACK) for call frame metadata and local variables. Frames are fully cell-based: all indices (`SP`, `RSP`, `BP`) are stored and manipulated in cell units (32‑bit words). Byte addresses are derived only at memory access boundaries by multiplying by `CELL_SIZE` (4).

Frame Prologue & Epilogue
Function (meta = 0)
1. Push return address (next IP)
2. Push caller `BP`
3. Set `BP = RSP`

Epilogue (`Exit`):
1. Validate saved BP (0 ≤ savedBP ≤ RSP) else `ReturnStackUnderflowError`
2. Set `RSP = savedBP`
3. Pop previous BP
4. Pop return address and jump

Code Block (meta = 1)
- Immediate control flow compiled by the parser runs within the current frame; no separate opcode is required for teardown.

Layout Diagram
```
Top (High RSP)
┌──────────────────┐ RSP-1  Return Address (function)
│ Return Address   │
├──────────────────┤ RSP-2  Saved Caller BP
│ Saved BP         │
├──────────────────┤ RSP-3  Local Slot 0 (BP + 0)
│ Local Slot 0     │
│ Local Slot 1     │ (BP + 1)
│ ...              │
└──────────────────┘
Increasing depth ↓ (toward lower indices)
```

Locals
- Allocation via `Reserve` advances `RSP` by slot count (cells) after the frame root is established.
- Initialization via `InitVar` writes into `(BP + slot) * CELL_SIZE` within `SEG_RSTACK`.
- References (`&x`) compile to `RSTACK_REF` with payload = absolute cell index `(BP + slot)`.

Compound Locals (Lists)
- Lists are stored on RSTACK in reverse layout: `[payload cells...] [LIST header]`.
- When initializing a LIST local, the materialized LIST on STACK is transferred to RSTACK; the slot receives an `RSTACK_REF` pointing to the header cell.
- Fast path for ref-to-list assignment copies payload + header directly when segments match; slot reference is preserved.

Corruption Testing
- `unsafeSetBPBytes(byteIndex)` (test helper) injects a byte-aligned value for BP (multiple of 4) that is converted to cells to keep invariants while enabling negative / out-of-range scenarios for error-path coverage.

Invariants
- `BP`, `SP`, `RSP` are non-negative integers (cells)
- `BP <= RSP`
- Frame locals occupy `[BP, RSP)`
- `Reserve` never reduces `RSP`
- No hidden `/4` or `*4` arithmetic outside explicit address formation

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
- Addressing & paths: see `specs/lists.md` (Addressing & Bracket Paths)
- Local variables & frames: `specs/variables-and-refs.md`

## Related Specifications

- `specs/tagged.md` - Value representation
- `specs/README.md` - Stack primer and index
- `specs/core-invariants.md` - Shared invariants and rules

---

## Rationale for Cell Canonicalization

- Removes pervasive divide/multiply by 4 noise in frame math.
- Simplifies reasoning about slot addressing and stack layout.
- Keeps corruption tests meaningful via explicit helper instead of implicit byte state.

## Related Files
- `src/core/vm.ts` — register storage & helpers
- `src/ops/core/core-ops.ts` — `exitOp` / `exitCodeOp`
- `src/ops/builtins.ts` — `reserveOp`, `initVarOp`
- `src/ops/lists/query-ops.ts` — `storeOp` fast paths
- `src/core/refs.ts` — reference resolution (cell index → byte address)

## Future Hardening
- Remove any residual transitional comments
- Add optional runtime invariant assertions in debug builds
- Microbenchmark call/return path
