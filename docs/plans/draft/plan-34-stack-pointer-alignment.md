# Plan 34 — Stack Pointer Cell-Centric Migration

## Status
- **Stage:** Draft
- **Scope:** Transition every stack-pointer consumer to the canonical cell-based accessors; retire byte-oriented shortcuts; align documentation and tooling to the new naming (`SP`→cells, `SPBytes` for byte math).

## High-level objective
Ensure the virtual machine and toolchain expose a single, cell-oriented data-stack pointer while still supporting byte calculations through explicitly named helpers. The migration must be incremental and well-tested so downstream work (e.g., GP unification) can proceed without hidden byte assumptions.

## Implementation phases
Each phase produces observable artefacts (code, docs, or reports) and has explicit validation steps.

### Phase 0 — Usage census & classification ✅
- Collect every occurrence of `vm.SP`, `vm.SPCells`, and manual `CELL_SIZE` arithmetic via an automated sweep (CLI script or notebook).
- Classify each use as one of: *byte math*, *cell math*, *raw memory IO*, or *test fixture*; record the mapping in `docs/analysis/sp-access-audit.md`.
- Flag any ambiguous sites that will require design decisions before rewriting (e.g., interoperability layers).
- **Validation:** audit document checked in; no code changes, so no tests expected.

### Phase 1 — Runtime code migration (core + ops) ✅
- Update production TypeScript (everything under `src/core` and `src/ops`) to stop consuming `vm.SP` as bytes: replace division/multiplication by `CELL_SIZE` with direct calls to `vm.SPCells` (or helper functions introduced where reuse makes sense).
- Introduce small utilities where repetitive translations appear (e.g., `cellsToBytes`, `stackCellOffset(vm, slots)`), keeping behaviour identical.
- Leave byte-centric helpers (`vm.SPBytes`) in place for now but ensure no production logic depends on the legacy `vm.SP` alias.
- **Validation:** targeted regression suites — at minimum `yarn test -- --runTestsByPath src/test/ops/stack/stack-utils.test.ts src/test/stack/slots.test.ts` and the list-operation tests touching SP math. *(Executed: full `yarn test` plus focused list/broadcast suites; both fail solely on global coverage thresholds.)*

### Phase 2 — Test & tooling migration ✅
- Rewrite fixtures, helpers, and scripts (`src/test/**`, `scripts/debug-*.js`) to pivot to cell semantics; only use `SPBytes` when deliberately validating byte offsets.
- Adjust assertions that previously divided by 4 to compare against cell counts directly.
- **Validation:** full `yarn test` to confirm there are no lingering assumptions in coverage suites. *(Executed: full `yarn test`, suites all pass; run exits non-zero solely because global coverage thresholds remain unmet.)*

### Phase 3 — Accessor renaming & clean-up ✅
- Rename the canonical accessor pair to `get SP(): number /* cells */` / `set SP(cells: number)`, moving the byte-level API behind `get SPBytes()` / `set SPBytes()`.
- Remove the deprecated alias currently exposing bytes under `vm.SP`; update any stragglers introduced between phases with the appropriate API.
- Eliminate redundant `BPCells()` once the naming pattern (`SP`, `RSP`, `BP`, `GP`) is consistent; maintain backwards-compat shims only if discoverable call sites remain (document them if so).
- **Validation:** rerun the stack-heavy suites and a smoke `yarn test`. (Executed: full `yarn test`; suites pass, run exits non-zero only due to global coverage thresholds.)

### Phase 4 — Documentation & developer ergonomics
- Update specs and learn docs referencing the byte-oriented `SP` (notably `docs/specs/metaprogramming.md`, stack architecture references, and any developer guides).
- Revise debugging utilities/docs (e.g., README snippets) to reflect the new API.
- **Validation:** documentation builds (if any) plus manual inspection; no runtime tests required beyond Phase 3 regressions.

## Risks & mitigations
- **Hidden byte arithmetic:** the audit deliverable ensures nothing is overlooked before the accessor flip.
- **Test brittleness:** staggering runtime/test migrations keeps failing assertions localised and easier to diagnose.
- **External tooling drift:** documenting renamed accessors in the final phase alerts downstream consumers before the alias disappears.

## Deliverables checklist
- [x] `docs/analysis/sp-access-audit.md` summarising the census.
- [x] Production code free of byte-based `vm.SP` usage.
- [x] Test/helpers updated to cell semantics.
- [x] Accessors renamed (`SP`→cells, `SPBytes` explicit) with redundant aliases removed.
- [ ] Docs and snippets aligned with the new naming.
