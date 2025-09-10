# Plan 25 — SP/RSP Cell Alignment & Dual-View Memory

## 📋 Overview

- Goal: Align data and return stacks (SP/RSP) to operate in cell units (32-bit words) to match ref/list semantics; add dual memory views for efficient cell and byte access without changing 16-bit payload and string/I/O behavior.
- Complexity: Medium-High
- Dependencies: None hard; touches core VM, memory, ops, tests, and docs
- Estimated Steps: 5 phases, ~15–20 focused steps

## 🎯 Success Criteria

- [ ] `SP` and `RSP` index stacks in cells (not bytes)
- [ ] Bytecode `IP` remains byte-addressed with no ISA changes
- [ ] Dual memory views exposed (`Uint8Array` + `Uint32Array` on one buffer)
- [ ] All stack/list/ref ops use cell units end-to-end (no ad-hoc shifts)
- [ ] `RP` naming replaced by `RSP` across code/docs (with temporary shim if needed)
- [ ] 16-bit payload semantics unchanged (tagged element payloads remain 16-bit)
- [ ] All tests pass and no performance regressions on stack ops

## 📐 Architecture Analysis

### Decisions (Confirmed)
- Keep 16-bit payload width for tagged elements (no change in this plan).
- Rename `RP` to `RSP`; migrate code/docs/tests to `RSP`.
- Stack slots are cells; no sub-cell values on stacks.

### Current State
- Stacks: `SP` and `RP` are byte indices; stack slots are 4-byte cells, requiring frequent `* 4` arithmetic and conversions in ops.
- Memory: Backed by `Uint8Array` + `DataView`; all typed access goes through read/write helpers (8/16/32-bit float via bytes).
- Refs/Lists: Offsets/lengths are defined in cells. Many ops convert between cells and bytes locally.
- Naming: Return stack is referred to as `RP` in code/tests; docs mix `RP`/`RSP`.

### Target State
- Stacks: `SP` and `RSP` are 16-bit cell indices addressing up to 65,536 cells (stack segment limits still enforced by constants).
- Memory: Single buffer with dual views: `U8` for byte ops, `U32` for cell-native ops; memmove semantics via `copyWithin` on `U32` for cell paths.
- ISA: `IP` stays byte-based; instruction encoding unchanged.
- Semantics: Stack slots are cells; tagged element payload width remains 16-bit.
- Naming: `RSP` is the canonical name; legacy `RP` is removed after migration (optionally temporarily aliased for a phase).

### Key Components
- Core VM (`src/core/vm.ts`): SP/RSP fields, push/pop/peek, stack iteration, invariants.
- Memory (`src/core/memory.ts`): Expose the underlying `ArrayBuffer` with both `Uint8Array` and `Uint32Array` views for performance.
- Constants (`src/core/constants.ts`): Sizes remain, but helpers clarify cell vs byte counts.
- Ops touching stacks: list build/query/structure ops, local-var transfer, access/select, core call/ret, print/format utils.
- Docs/specs: vm architecture, stack operations, refs/lists semantics, naming guide.

## 🛠️ Implementation Strategy

### Phase 0: Unit Abstractions & Guardrails
- Goal: Prevent mixed units, and centralize conversions.
- [x] Introduce branded types in TS for `CellIndex`, `CellCount`, `ByteIndex` (internal only) and small helpers: `asBytes(cells)`, `asCells(bytes)` with assertions.
- [x] Add `copyCells`, `fillCells`, `loadCell`, `storeCell` helpers using `U32` view; keep `copyBytes`/`loadByte` etc.

### Phase 1: Dual-View Memory
- Goal: Keep byte memory model; add fast cell view.
- [x] Augment `Memory` to expose `u8`, `u32`, and `view` based on a single `ArrayBuffer` (current `Uint8Array.buffer`).
- [x] Ensure bounds checks reflect bytes vs cells correctly; document endianness (little-endian for serialization).

### Phase 2: Convert SP/RSP to Cells (Core VM)
- Goal: Switch stack pointers to cell indices with minimal churn.
- [x] Replace `SP`/`RP` with `SP`/`RSP` measured in cells; update ctor/reset and invariants (back-compat `SP`/`RP` accessors retained).
- [x] Update `push`/`pop`/`peek`/`peekAt`/`popArray` and return-stack variants to operate in cells internally.
- [x] Update stack iteration (`getStackData`) to iterate cells; external shape unchanged.
- [ ] Add temporary compat (optional): `getSpBytes()`/`getRspBytes()` if needed (not required yet).
- [ ] Rename `RP` to `RSP` across code; provide a temporary alias only if needed to keep compile green during migration.
  - Progress: core ops updated to use `RSP` in checks; list ops and access paths now use `SPCells` for stack math.

### Phase 3: Cell-Native Ops & Fast Paths
- Goal: Remove ad-hoc `* 4` in ops; standardize on cells.
- [x] Lists: Update build/query/structure ops to compute spans in cells; use `Memory.u32.copyWithin` for header+payload moves with overlap safety. (Completed: structure ops, reverseSpan; query store fast path same-segment via `copyCells`)
- [ ] Locals transfer: Convert materialization and in-place update to cell indices and `u32` copies; validate cross-segment math.
  - Progress: rpushList/updateListInPlace now compute stack-side addressing via `SPCells`; loadListFromReturn and update paths use header/base cell helpers; cross-segment copies remain byte-based as designed.
 - [x] Access/select: Ensure path traversal and address-returning functions operate in cells end-to-end.
   - Completed: createTargetRef and traverseMultiPath use `SPCells`; address reads remain byte-based at the boundary.
- [ ] Printers/formatters: Iterate cell slots and header/payload spans without byte math.
- [ ] Maintain 16-bit payload semantics: Any 16-bit fields in headers remain read/written through `DataView` (`read16`/`write16`).

### Phase 4: Periphery, Naming, and Docs
- Goal: Align naming and documentation; update tests.
- [ ] Rename references of `RP` → `RSP` in code and tests; update comments and error strings.
- [ ] Update docs: `docs/specs/vm-architecture.md`, `docs/specs/stack-operations.md`, `docs/specs/lists.md`, `docs/specs/refs.md`, and `docs/naming-guide.md` to reflect cell-based stacks and `RSP` naming.
- [ ] Update debugger/trace dumps to present SP/RSP in cells (optionally include bytes for context).
- [ ] Sweep for `* 4` patterns in ops; replace with cell helpers.
  - Progress: Comments and docs updated to prefer RSP; debug dump prints both units; kept RP accessor in hot paths (reserve) for compatibility.

### Phase 5: Cleanup & Hardening
- Goal: Remove transitional code; validate boundaries and performance.
- [ ] Remove any temporary byte-based SP/RP accessors and `RP` alias.
- [ ] Add invariants: SP/RSP in range, cell-aligned, stack overflow/underflow checks in cell units against segment sizes.
- [ ] Microbench stack ops and list copy fast paths before/after to confirm no regressions.

## 🧪 Testing Strategy

- Unit
  - [ ] SP/RSP invariants (cells only), push/pop/peek balanced behavior.
  - [ ] `u32.copyWithin` overlapping copies vs a reference memmove.
  - [ ] 16-bit payload fields remain correct across list ops.
- Integration
  - [ ] List header+payload direct-copy fast path works with overlap and cross-segment cases.
  - [ ] Local-var materialize/update across STACK↔RSTACK with mixed overlaps.
  - [ ] Access/select returns addresses that compose with fetch/store in cells.
- Regression
  - [ ] All existing tests pass; update assertions expecting byte-based SP/RP.
  - [ ] No change in external printed formats; strings and I/O unaffected.

## 🔍 Risk Analysis

- High
  - Mixed-unit arithmetic bugs: Mitigate with branded types + centralized helpers.
- Medium
  - Overlap copy errors: Use `u32.copyWithin` and add stress tests.
  - Naming churn (`RP`→`RSP`) breaking imports/tests: Migrate in a single sweep; provide short-lived alias if needed.
- Low
  - Performance surprises: Validate with microbench; `u32` paths should be faster or equal.

## 📚 References

- Specs: `docs/specs/vm-architecture.md`, `docs/specs/stack-operations.md`, `docs/specs/lists.md`, `docs/specs/refs.md`
- Naming: `docs/naming-guide.md`, `docs/rules/naming-and-api-style.md`
- Code hotspots: `src/core/vm.ts`, `src/core/memory.ts`, `src/core/constants.ts`, `src/ops/**`, `src/core/format-utils.ts`

## 🏁 Completion Checklist

### Implementation Complete
- [ ] Phases 0–5 complete
- [ ] All tests pass and coverage stable
- [ ] Docs updated (architecture, stacks, lists, refs, naming)
- [ ] No ad-hoc `* 4` remains in ops touching stacks

### Code Quality
- [ ] C-port-friendly loops (no `.map/.filter` in hot paths)
- [ ] Explicit error handling for overflow/underflow
- [ ] Minimal comments; clear names following naming rules

### Integration
- [ ] No ISA changes; `IP` remains byte-based
- [ ] External APIs unchanged or shimmed during migration
- [ ] 16-bit payload semantics preserved

---
Status: 🔄 In Progress  
Last Updated: 2025-09-10  
Assigned: —
