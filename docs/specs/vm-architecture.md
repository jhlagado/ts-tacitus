# Tacit VM Architecture Specification

## Overview

The Tacit VM is a stack-based virtual machine with segmented memory, NaN-boxed values, and unified addressing. It executes bytecode while maintaining strict separation between data and code segments.

Execution pipeline (high level):

- Tokenize & Parse → Compile to bytecode
- Execute opcode loop with unified dispatch (builtins + bytecode)

## Memory Layout

### Unified Data Arena

Tacit allocates a single data arena sized at compile time. Three contiguous windows inside that arena provide storage for globals, the data stack, and the return stack. Their cell boundaries are defined in `src/core/constants.ts`:

| Constant      | Meaning                                                      |
| ------------- | ------------------------------------------------------------ |
| `GLOBAL_BASE` | Absolute cell index for the first global-heap cell           |
| `GLOBAL_TOP`  | End (exclusive) of the global-heap window (cell index)       |
| `STACK_BASE`  | Start of the data-stack window (cell index)                  |
| `STACK_TOP`   | End (exclusive) of the data-stack window (cell index)        |
| `RSTACK_BASE` | Start of the return-stack window (cell index)                |
| `RSTACK_TOP`  | End (exclusive) of the return-stack window (cell index)      |
| `TOTAL_DATA`  | Total cell capacity of the unified data arena (`RSTACK_TOP`) |

Byte-based constants (`*_BYTES`) are also available for memory I/O operations, but cell-based constants are preferred for data segment addressing. Adjusting capacities only requires editing these constants; runtime code operates on absolute cell indices and does not bake in window sizes.

### Data Windows & Auxiliary Segments

- **Global heap window** — long-lived dictionary entries and global values; managed by the `GP` bump pointer and manipulated via Tacit primitives (`gpush`, `gpop`, `gpeek`, `gmark`, `gsweep`).
- **Data-stack window** — operand stack storage; advanced/retreated by `SP`.
- **Return-stack window** — call frames and locals; advanced/retreated by `RSP` with `BP` pointing at the current frame base.
- **CODE segment** — byte-addressed instruction storage (separate allocation).
- **STRING segment** — byte-addressed immutable strings (separate allocation).

## Stack Architecture

**Main Stack (data-stack window)**:

- Growth: Low to high addresses
- Elements: 32-bit tagged values
- Operations: push, pop, peek, dup, swap, drop
- Stack pointer: SP (cell-indexed; derive byte offsets explicitly as `SP * CELL_SIZE` when required)

**Return Stack (return-stack window)**:

- Call frame management
- Local variable storage
- Return address tracking
- Base pointer: BP (cell index, canonical). A derived byte view (`BPBytes = BP * CELL_SIZE`) exists only at memory boundary helpers. All frame arithmetic and slot addressing are cell-native.

Cell size: 4 bytes (word-aligned). All stack elements are 32‑bit float32 values encoding NaN‑boxed tags or raw numbers.

VM registers store **absolute cell indices** inside the unified arena; public accessors
expose relative depths by subtracting the relevant window base:

- SP — data stack pointer (`_spCells`), initialised to `STACK_BASE`
- RSP — return stack pointer (`_rspCells`), initialised to `RSTACK_BASE`
- BP — base pointer for the current frame (`_bpCells`), initialised to `RSTACK_BASE`
- GP — global bump pointer (cell offset from `GLOBAL_BASE`)
- IP — instruction pointer (byte address in CODE)

`SP`, `RSP`, and `BP` are stored internally as absolute cell indices within the unified arena. `GP` remains window-relative: a value of 0 represents `GLOBAL_BASE`, and helpers add the base offset when forming byte addresses for the global heap.

## Execution Model

**Instruction Pointer**: IP (bytecode address)
**Execution cycle**:

1. Fetch instruction at IP
2. Decode opcode and operands
3. Execute operation
4. Update IP and continue

Opcode encoding & dispatch:

- Builtins (0–127): single‑byte opcodes.
  - Encoded as: `opcode` (single byte, 0x00-0x7F, bit 7 = 0)
- User words (bytecode addresses 0–32767): two‑byte encoding using **X1516 format**.
  - **X1516 Format**: 15-bit address encoded over a 16-bit carrier where bit 7 is always 1.
  - **Encoding**: First byte `0x80 | (address & 0x7f)`, second byte `(address >> 7) & 0xff`
  - **Two-byte sequence interpretation**:
    - If bit 7 is 0: Second byte can be ignored (builtin opcode, single byte)
    - If bit 7 is 1: Number is stored in X1516 format (user code address, two bytes)
  - Examples:
    - Address 0x0000 (0): `0x80 0x00` → 16-bit `0x0080`
    - Address 0x40 (64): `0xC0 0x00` → 16-bit `0x00C0`
    - Address 0x80 (128): `0x80 0x01` → 16-bit `0x0180`
    - Address 0x0100 (256): `0x80 0x02` → 16-bit `0x0280`
    - Address 0x4000 (16384): `0x80 0x80` → 16-bit `0x8080`
  - The compiler encodes 15 bits of address space (0–32767) while the current `CODE_SIZE` (0x2000) bounds active bytecode to 0–8191. The extra range is reserved for future expansion.
- Dispatch is unified: builtins resolve through the symbol table; user words execute by jumping to bytecode addresses. See `Compiler.compileOpcode` and VM `nextOpcode`.
- Bit 7 in the first byte distinguishes builtins (0) from user code (1), allowing addresses 0–127 to be encoded as either single-byte builtins or two-byte user code.

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

- meta = 1 (immediate): dictionary entries flagged with the sign-bit set execute during compilation (`@immediate` words, control-flow macros). Builtins reuse the same flag.
- meta = 0 (function / colon definition): Prologue sequence (cell units):
  1. Push return address (next IP)
  2. Push caller BP (cells)
  3. Set BP = RSP (frame root at current top)

After step 2 completes, RSP points one past the frame root: the most recent push (saved caller BP) resides at RSP-1, and the earlier push (return address) resides at RSP-2. This layout is reflected in the diagram below and enforced by the epilogue.

Epilogue (`Exit`) validates saved BP cell index, restores `RSP = savedBP`, restores `BP = previousBP`, then resumes at popped return address.

Frame Layout on RSTACK (top → bottom after prologue):

```
┌───────────────┐  RSP-1 (BP-1): Saved Caller BP (cell index)
│ Saved BP      │
├───────────────┤  RSP-2 (BP-2): Return Address (CODE tagged value / address sentinel)
│ Return Address│
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
Tacit uses a split-stack model within the unified data arena: the data-stack window holds operand values and the return-stack window holds call-frame metadata plus locals. Frames are fully cell-based: all indices (`SP`, `RSP`, `BP`) are stored and manipulated in cell units (32‑bit words). Byte addresses are derived only at memory access boundaries by multiplying by `CELL_SIZE` (4).

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
┌──────────────────┐ RSP-1  Saved Caller BP
│ Saved BP         │
├──────────────────┤ RSP-2  Return Address (function)
│ Return Address   │
├──────────────────┤ RSP-3  Local Slot 0 (BP + 0)
│ Local Slot 0     │
│ Local Slot 1     │ (BP + 1)
│ ...              │
└──────────────────┘
Increasing depth ↓ (toward lower indices)
```

Locals

- Allocation via `Reserve` advances `RSP` by slot count (cells) after the frame root is established.
- Initialization via `InitVar` writes into `(BP + slot) * CELL_SIZE` within the return-stack window.
- References (`&x`) compile to a `REF` whose payload stores the absolute cell index `(BP + slot)` within the unified data arena.

Compound Locals (Lists)

- Lists are stored on the return-stack window in reverse layout: `[payload cells...] [LIST header]`.
- When initializing a LIST local, the materialized LIST on the data stack is transferred to the return stack; the slot receives a `REF` whose payload resolves to the header cell inside the return-stack window.
- Fast path for ref-to-list assignment copies payload + header directly when the source is already in the return-stack region; slot reference is preserved.

Corruption Testing

- `unsafeSetBPBytes(byteIndex)` (test helper) injects a byte-aligned value for BP (multiple of 4) that is converted to cells to keep invariants while enabling negative / out-of-range scenarios for error-path coverage.

Invariants

- `BP`, `SP`, `RSP` are non-negative integers (cells)
- `BP <= RSP`
- Frame locals occupy `[BP, RSP]`
- `Reserve` never reduces `RSP`
- No hidden `/4` or `*4` arithmetic outside explicit address formation

## References & Addressing

- `Tag.REF` is the canonical runtime handle for any cell in the data arena. Its 16-bit payload stores the absolute cell index; helpers infer which window (global heap, data stack, return stack) owns that index by comparing against segment bounds.

Reference helpers (see `core/refs.ts`):

- `createRef(absoluteCellIndex)` → `REF` (absolute cell index in unified arena)
- `getByteAddressFromRef(ref)` → absolute byte address
- `readRefValue(vm, ref)` / `writeReference(vm, ref)` read/write via resolved address
- `getRefRegion(ref)` → `'global' | 'stack' | 'rstack'` (inferred from address range)

All reference payloads use arena-absolute cell indices. Decoding maps the payload to the correct window and enforces the bounds `[GLOBAL_BASE, RSTACK_TOP]`. Zero therefore still represents "first cell of the arena" for diagnostics while allowing non-zero bases per window.

## Lists (Reverse Layout)

- Header at TOS encodes payload slot count; elements are stored directly beneath.
- Element traversal uses span rule: LIST → span = payload + 1; simple values → span = 1.
- Address‑returning operations (`slot`, `elem`, `find`) compose with `fetch`/`store` to read/write values.

## Symbol Table & @symbol

- `@symbol` pushes a tagged reference: `Tag.BUILTIN(op)` for builtins or `Tag.CODE(addr)` for colon definitions/compiled blocks.
- `eval` executes tagged references: BUILTIN dispatches native implementation; CODE jumps to bytecode address (block/function per meta flag).
- `Tag.LOCAL` marks local variables at compile time in the symbol table; runtime locals are addressed via `REF` handles that resolve into the return-stack window (see locals spec).

## Operations

**Stack operations**: Manipulate main stack
**Memory operations**: Load/store to data-arena windows
**Control flow**: Jumps, calls, returns
**Built-ins**: Direct function dispatch

## Error Handling

- Stack overflow/underflow detection
- Invalid address protection
- Type mismatch prevention
- Graceful error recovery
  Errors use structured types (e.g., StackUnderflowError, ReturnStackOverflowError, InvalidOpcodeError) and include stack state snapshots to aid diagnostics. Stack depth checks (e.g., `ensureStackSize`) run before destructive pops.

## Implementation Notes

- Unified data arena with window views
- Efficient tagged value operations
- Direct bytecode interpretation
- Minimal overhead design

## Cross‑References

- Tagged values: `docs/specs/tagged.md`
- Lists & traversal: `docs/specs/lists.md`
- Addressing & paths: see `docs/specs/lists.md` (Addressing & Bracket Paths)
- Local variables & frames: `docs/specs/variables-and-refs.md`

## Related Specifications

- `docs/specs/tagged.md` - Value representation
- `docs/specs/README.md` - Stack primer and index
- `docs/specs/core-invariants.md` - Shared invariants and rules

---

## Rationale for Cell Canonicalization

- Removes pervasive divide/multiply by 4 noise in frame math.
- Simplifies reasoning about slot addressing and stack layout.
- Keeps corruption tests meaningful via explicit helper instead of implicit byte state.

## Related Files

- `src/core/vm.ts` — register storage & helpers
- `src/ops/core/core-ops.ts` — `exitOp`
- `src/ops/builtins.ts` — `reserveOp`, `initVarOp`
- `src/ops/lists/query-ops.ts` — `storeOp` fast paths
- `src/core/refs.ts` — reference resolution (cell index → byte address)

## Future Hardening

- Add optional runtime invariant assertions in debug builds
- Microbenchmark call/return path
