# Stack Frames & Base Pointer (Cell Canonical)


## Overview
Tacit uses a split-stack model: the data stack (STACK) for operand values and the return stack (RSTACK) for call frame metadata and local variables. Frames are fully cell-based: all indices (`SP`, `RSP`, `BP`) are stored and manipulated in cell units (32‑bit words). Byte addresses are derived only at memory access boundaries by multiplying by `CELL_SIZE` (4).

## Frame Prologue & Epilogue
### Function (meta = 0)
Prologue (cells):
1. Push return address (next IP as a numeric code address or tagged value depending on context)
2. Push caller `BP`
3. Set `BP = RSP`

Epilogue (`Exit`):
1. Read saved BP cell index (validation: `0 <= savedBP <= RSP` else `ReturnStackUnderflowError`)
2. Set `RSP = savedBP`
3. Pop previous BP
4. Pop return address and jump

### Code Block (meta = 1)
Blocks do not introduce a new frame: only the return address is pushed and later popped by `ExitCode`; `BP` is preserved.

## Layout Diagram
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

`BP` always points to the first local slot (same cell index as `Saved BP` + 1). The saved BP itself resides immediately below the return address.

## Local Variables
- Allocation via `Reserve` advances `RSP` by slot count (cells) after the frame root is established.
- Initialization via `InitVar` writes into `(BP + slot) * CELL_SIZE` within `SEG_RSTACK`.
- References (`&x`) compile to `RSTACK_REF` with payload = absolute cell index `(BP + slot)`.

## Compound Locals (Lists)
Lists are stored on RSTACK in exactly the same reverse layout used on STACK:
`[payload cells...] [LIST header]`

When initializing a LIST local:
1. Materialized LIST on STACK is transferred to RSTACK in place order via `rpushList`.
2. Slot receives an `RSTACK_REF` pointing to the LIST header cell.

Mutation (`->`) fast path for ref-to-list assignment copies payload + header directly (memmove semantics) when source and destination segments match, avoiding materialization.

## Corruption Testing
`unsafeSetBPBytes(byteIndex)` (test helper) allows injecting a byte value for BP (must be multiple of 4). Internally converts to cells to maintain invariant while enabling negative / out-of-range scenarios for error path coverage.

Corruption guard lives in `exitOp` prior to frame tear-down; invalid `bpCells` triggers `ReturnStackUnderflowError`.

## Invariants
- `BP`, `SP`, `RSP` are non-negative integers (cells)
- `BP <= RSP`
- Frame locals occupy `[BP, RSP)`
- `Reserve` never reduces `RSP`
- No hidden `/4` or `*4` arithmetic outside explicit address formation

## Rationale for Cell Canonicalization
- Removes pervasive divide/multiply by 4 noise
- Aligns with SP/RSP migration (Plan 25)
- Simplifies reasoning about list and local variable addressing
- Keeps corruption tests meaningful via explicit helper instead of implicit byte state

## Related Files
- `src/core/vm.ts` — register storage & helper
- `src/ops/core/core-ops.ts` — `exitOp` / `exitCodeOp`
- `src/ops/builtins.ts` — `reserveOp`, `initVarOp`
- `src/ops/lists/query-ops.ts` — `storeOp` fast paths
- `src/core/refs.ts` — reference resolution (cell index → byte address)

## Future Hardening (Phase 3)
- Remove any residual transitional comments
- Add optional runtime invariant assertions in debug builds
- Microbenchmark call/return path vs pre-migration baseline
