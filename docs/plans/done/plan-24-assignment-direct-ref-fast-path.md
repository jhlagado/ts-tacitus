# Plan 24: Assignment Fast Path — Direct Copy From Source Ref (DONE)

Status: DONE — implemented and tested. See “Status (Implemented)” section.

## Objective
Add a guarded fast path to assignment that copies data directly from a reference source into the destination without first materializing the RHS onto the data stack, preserving all current semantics while reducing one copy in common cases.

## Motivation
- Reduce copies on `compound -> compound` writes where RHS is a reference (e.g., local or stack ref) and shapes match.
- Preserve the current, simple programming model (RHS evaluates to a value; LHS is an address) while allowing an internal optimization inside `storeOp`.
- Avoid aliasing and lifetime hazards by enforcing the same checks as the materialization path before any write occurs.

## Non-Goals
- No language or parser changes.
- No change to public semantics or errors (reads still liberal to NIL; writes remain strict and throw on invalid destinations).
- No new opcodes.

## Current Behavior (Baseline)
- Parser lowering for writes: `value -> x[ … ]` → evaluate RHS → `&x` → `Select` → `Nip` → `Store`.
- `storeOp` resolves the destination, materializes compound RHS to the stack (if needed), validates shape, then performs in-place mutation or simple write.

## Proposed Design
Implement a direct-copy fast path inside `storeOp`:
- When RHS (top-of-stack) is a reference to a LIST header (compound):
  - Resolve the source reference to `(segment, headerAddr)` and compute `slotCount` via existing helpers.
  - Resolve the destination address/ref (existing code) and validate compatibility (same tag, same slotCount).
  - Copy payload cells and header directly from source memory to destination memory.
  - Handle potential overlap with a small scratch buffer (Array<number>) to guarantee memmove semantics.
- If any precondition fails, fall back to the current materialize-then-mutate path.

### Preconditions for Fast Path
- RHS is a reference that resolves to a LIST header (compound).
- Destination points to a compatible compound (same tag and slot count). Destination may be a slot holding a ref or a direct header — both already supported.
- Source resolution must use the same helpers as the materialization path:
  - `resolveReference()` to get base address and segment
  - `getListLength()`, `computeHeaderAddr()` to derive `headerAddr` and payload bounds
- All validations must occur before any writes.

### Algorithm (Direct Copy)
1. Peek RHS as `value`. If `isRef(value)`:
   - `src = resolveReference(vm, value)`
   - `srcHeader = readFloat32(src.segment, src.address)`
   - If `!isList(srcHeader)`: skip fast path
   - `slots = getListLength(srcHeader)`
   - `srcHeaderAddr = computeHeaderAddr(src.address + CELL_SIZE, slots)` or via existing header/base helper
2. Resolve destination (existing code); if destination slot holds a ref, resolve to its true header addr/segment.
3. Validate `isCompatibleCompound(destHeader, srcHeader)`; if false → throw (same as baseline).
4. Copy payload+header:
   - Read `slots` payload values from source into a temp array in logical order
   - Write them to destination payload cells in order
   - Write header last
5. Pop RHS and return (stack effect identical to baseline).

### Semantics Preservation
- Same errors as baseline: invalid destination, incompatible shapes → throw; non-compound-to-compound or compound-to-simple → throw.
- NIL/default behaviors are unchanged because the fast path only applies when RHS is a ref to a concrete LIST header. Other cases continue through the baseline.
- Overlap safety ensured by scratch buffer staging.

## Implementation Steps
1. Add helper: `resolveCompoundRef(vm, ref): { segment, headerAddr, slotCount } | null` using `resolveReference`, `getListLength`, and `computeHeaderAddr`/`getListHeaderAndBase`.
2. Update `storeOp` (src/ops/lists/query-ops.ts):
   - After reading `addressValue` and peeking RHS, detect fast-path eligibility.
   - Resolve destination (existing code) and validate shape via `isCompatibleCompound`.
   - Perform direct copy with scratch buffer; otherwise fall back to materialize+mutate path.
3. Tests:
   - Fast path: STACK_REF → RSTACK_REF; RSTACK_REF → RSTACK_REF copy (non-overlap)
   - Overlap: assign sublist within the same list; verify correct final result
   - Guard fallback: RHS non-compound ref → baseline path still works
   - Incompatibility: throw before any write
4. Benchmark (optional): micro-bench copy vs materialize for representative sizes.

## Risks and Mitigations
- Overlap corruption → Use scratch buffer (memmove semantics).
- Divergence from value-by-default semantics → Restrict fast path to compound LIST refs; else fallback.
- Partial writes on error → Validate all conditions before writing; copy in one commit step.

## Success Criteria
- All existing tests pass unchanged.
- New tests verify identical observable behavior to baseline while reducing one copy in ref→compound assignments.
- No performance regressions; measurable reduction in copies for target cases.

## Rollout Plan
- Implement behind no flag (optimization only; semantics identical).
- Land tests and code together.
- Monitor CI performance (optional).

## Backout Plan
- Revert the fast-path code in `storeOp`; baseline materialization path remains intact.

## Status (Implemented)
- Implemented guarded direct-copy fast path in `storeOp` (`src/ops/lists/query-ops.ts`).
- Uses `getListHeaderAndBase` for unified RHS detection; validates with `isCompatibleCompound`.
- Resolves destination indirection; copies payload first, header last; memmove-safe via scratch buffer.
- Early no-op when source and destination regions are identical.

### Tests Added
- `src/test/ops/local-vars/ref-assign-fast-path.test.ts`
  - `&x -> y` copies without materializing x; verifies resulting list contents.
  - Self-assignment `&x -> x` is a no-op and preserves contents.
  - Sublist-to-sibling copy using bracketed destination: `&xs 0 elem -> xs[1]`.

All existing tests pass unchanged; new tests pass.
