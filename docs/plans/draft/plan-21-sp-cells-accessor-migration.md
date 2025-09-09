# Plan 21 — Stack Pointer (SP) Cells Accessor Migration

Phase 1 of aligning stack pointer units (cells vs bytes). This plan is updated to current repository state and remains scheduled (not started).

## Summary

Gradually migrate the Tacit VM from byte-based `SP` (Stack Pointer) and `RP` (Return Stack Pointer) to cell-based semantics, starting with `SP` only, using an accessor‑first strategy. The plan introduces non‑breaking getters/setters and helpers that operate in cells, migrates call sites in waves, adds runtime assertions and toggles for observability, and only flips internals after call sites are largely converted. `RP` migration is explicitly deferred until `SP` is complete and stabilized.

## Goals

- Align `SP` with cell semantics while keeping memory byte-addressed.
- Allow both direct access and accessor usage during migration; convert callers incrementally.
- Preserve behavior and test results (zero regressions) at each phase.
- Provide clear toggles and assertions to detect unit mixups early.
 - Keep public stack effects and list invariants unchanged.

## Non-Goals

- No immediate change to `push/pop/rpush/rpop` behavior.
- No simultaneous migration of `RP` — handle `SP` first, then `RP` in a later plan.
- No change to list layout or traversal spans.
- No user‑visible language changes; internal implementation only.

## Constraints & Invariants

- Cells are 4 bytes (`CELL_SIZE = 4`).
- Memory access continues to use byte offsets; only the logical stack pointer representation changes over time.
- All intermediate states must keep `SP % CELL_SIZE === 0` and not break list span semantics.
 - VM segments and addressing remain unchanged (SEG_STACK, SEG_RSTACK, SEG_CODE).

## Approach Overview (Accessor‑First)

1. Introduce an accessor API on `VM` that exposes cell‑centric operations for `SP` (read depth, top‑of‑stack address, increment/decrement in cells) alongside existing byte fields.
2. Migrate read‑only usages first (calculations that derive counts/indices from SP).
3. Migrate write sites gradually (decrements/increments of `SP`) to helpers that take cells.
4. Introduce an optional shadow `SP_cells` and invariants under a debug/strict toggle to verify equivalence before flipping internals.
5. Flip `SP` internals to cells once call sites predominantly use accessors; keep a shadow byte counter with assertions for a deprecation period.
6. Repeat a similar program for `RP` in a separate follow‑up plan.

## Proposed VM Accessor API (initial)

Read:
- `spBytes(): number` — current `SP` byte offset (pass‑through to existing field).
- `spCells(): number` — derived `SP / CELL_SIZE` (integer division).
- `tosAddrBytes(): number` — address of the top of the data stack in bytes (`SP - CELL_SIZE`); throws if empty.

Write (cell‑based):
- `incSPCells(n: number): void` — increase SP by `n * CELL_SIZE`.
- `decSPCells(n: number): void` — decrease SP by `n * CELL_SIZE` with underflow checks.

Helpers:
- `byteOffsetForCellIndex(cellIndex: number): number`.
- `cellIndexForByteOffset(byteOffset: number): number` (with `CELL_SIZE` multiple check).

Debug/strict (feature‑flagged via `vm.debug` or a new `vm.strictUnits` flag):
- `assertAlignedSP()` — `SP % CELL_SIZE === 0`.
- (Phase 5+) `assertSPShadowsMatch()` — when a shadow `SP_cells` exists: `SP === SP_cells * CELL_SIZE`.

Note: This API is additive and non‑breaking. Existing direct uses of `vm.SP` continue to work during migration.

## Migration Phases (SP only)

Phase 1 — Inventory & Hotspot Mapping (no code change)
- Identify direct usages of `vm.SP`/`/ CELL_SIZE` across modules.
- Group by module for phased updates:
  - Stack ops: `src/ops/stack/` (dup/swap/rot/over/nip/tuck, pick, helpers).
  - Core lists: `src/core/list.ts` (`reverseSpan`, `getListBounds`, address math).
  - Access ops: `src/ops/access/*` (path traversal indexing).
  - Core formatting utils: `src/core/format-utils.ts` (uses original SP snapshots).
  - Tests/utilities that compute stack depths for assertions.

Deliverable: Checklist of call sites by file/line (tracked in PR description or a temporary doc comment in this plan).

Phase 2 — Introduce Accessor API (no behavior change)
- Add the accessor and helper methods to `VM`.
- Add `assertAlignedSP()` calls in sensitive operations under `vm.debug`/`vm.strictUnits`.
- Do not modify `push/pop` internals yet.

Phase 3 — Replace Read-Only Computations (low risk)
- Replace common patterns:
  - `vm.SP / CELL_SIZE` → `vm.spCells()`.
  - `vm.SP - CELL_SIZE` → `vm.tosAddrBytes()`.
  - `vm.SP - n * CELL_SIZE` (read) → `vm.spBytes() - n * CELL_SIZE` (or a helper that documents intent).
- Target modules (order): stack ops helpers → core lists → access ops → format utils.

Acceptance for Phase 3:
- All tests green, zero functional changes.
- Lint passes; no new cyclic deps.

Phase 4 — Localized Writers to Helpers (medium risk)
- Convert arithmetic writers for `SP` to `incSPCells/decSPCells` in a few operations that are already span‑aware:
  - `dropOp` (list branch): `vm.SP -= totalSlots * CELL_SIZE` → `vm.decSPCells(totalSlots)`.
  - `reverseSpan`/stack shuffles that adjust SP deterministically.
- Keep core `push/pop` unchanged. The goal is to evaluate helper correctness without deep surgery.

Acceptance for Phase 4:
- Tests green, including list/stack manipulation suites.
- Add toggled invariant: when helpers are used, call `assertAlignedSP()`.

Phase 5 — Dual-Counter Shadow (assert-only)
- Add `private spCellsShadow: number` to VM; update it wherever `push/pop` and new cell helpers change SP.
- On every `push/pop` (and helper), assert `SP === spCellsShadow * CELL_SIZE` when `vm.strictUnits` is enabled.
- Report mismatches with operation name and stack snapshot.

Acceptance for Phase 5:
- No test failures under strict mode; confidence that helpers and direct writes do not drift.

Phase 6 — Flip Internals for SP (primary in cells)
- Change `push/pop/peek/peekAt/popArray/ensureStackSize/getStackData` to operate on `spCellsShadow` (cells) and convert to bytes only at memory access boundaries.
- Maintain `SP` byte field as a derived or shadow value for one deprecation cycle with assertions.
- Update any remaining direct byte arithmetic on SP to accessors.

Acceptance for Phase 6:
- Full test suite green; performance parity within tolerance.
- Remove most direct `vm.SP` references from ops and core.

Phase 7 — Cleanup & Deprecation
- Mark direct `vm.SP` access as deprecated in comments; optionally guard against writes outside VM internals when `strictUnits` is enabled.
- Keep compatibility until the follow‑up RP plan is complete; schedule final removal thereafter.

## Dependencies & Current State

- Plan 22 (Load opcode and fetch simplification): COMPLETED. Parser, ops, and specs reflect value‑by‑default `load` and strict `fetch`.
- Current code (as of this revision): no accessor API yet; widespread direct byte arithmetic on `vm.SP` remains across `src/ops/stack`, `src/ops/lists`, `src/ops/access`, and tests.

## Validation & Safety Nets

- Assertions:
  - Alignment: `SP % CELL_SIZE === 0`.
  - Shadow invariant: `SP === spCellsShadow * CELL_SIZE` (strict mode).
- Targeted tests to watch:
  - `src/test/ops/stack/*` — dup/swap/rot/nip/tuck/pick.
  - `src/test/ops/lists/*` — drop/reverse/concat/head/tail address math.
  - `src/test/ops/access/select-op.test.ts` — SP‑neutral step assertions.
  - `src/test/core/unified-references.test.ts` — STACK_REF correctness (cell index semantics).
  - Locals unaffected in this plan (RP untouched) — sanity run only.

## Rollout Toggles

- `vm.debug` (existing): enables console diagnostics already present.
- `vm.strictUnits` (new, default false): enables SP alignment/shadow assertions; used in CI A/B runs.
- CI matrix: run `yarn test` in both modes to catch regressions introduced by accessor migration.

## File-Level Migration Order (SP)

1) `src/ops/stack/data-move-ops.ts` — central span logic; many `/ CELL_SIZE` usages.
2) `src/core/list.ts` — `reverseSpan`, `getListBounds`, address math.
3) `src/ops/access/select-ops.ts` — path traversal SP math.
4) `src/core/format-utils.ts` — SP snapshots and restores.
5) Misc helpers in `src/test/utils/*` that compute depths.

Each file change should be self‑contained, with tests run after each step (zero regressions policy).

## Metrics & Exit Criteria

- Metric: Count of direct `vm.SP` references decreases to near zero outside VM internals before Phase 6.
- All tests pass with `strictUnits=false` throughout; before Phase 6, run with `strictUnits=true` cleanly.
- After Phase 6, no functional regressions and assertions clean for one deprecation cycle.

## Backout Plan

- Accessor API is additive; if regressions occur, revert call‑site changes to direct `vm.SP` usage.
- Shadow counter and assertions are removable without touching functional paths.
- Internals flip (Phase 6) happens only after sustained green runs; revert is limited to VM methods.

## Follow‑Up (Separate Plan)

- Apply the same accessor‑first strategy to `RP` and `BP` interactions tied to locals and frames:
  - Introduce `rpBytes()/rpCells()`, `incRPCells/decRPCells`.
  - Migrate `RESERVE`, prologue/epilogue, `getVarRef`, and local var ops.
  - Flip internals after SP is stable.

## References

- Specs: `docs/specs/vm-architecture.md`, `docs/specs/stack-operations.md`, `docs/specs/local-vars.md`, `docs/specs/lists.md`.
- Code hotspots: `src/ops/stack/`, `src/core/list.ts`, `src/ops/access/`, `src/core/format-utils.ts`.

## Restart‑Safe Checklist (to begin work later)

- [ ] Add accessor API to `VM` with alignment assertion and optional strict toggle.
- [ ] Replace read‑only `SP` math in `src/ops/stack` helpers.
- [ ] Replace read‑only `SP` math in `src/core/list.ts`.
- [ ] Replace read‑only `SP` math in `src/ops/access/*`.
- [ ] Add `spCellsShadow` and strict invariant checks; run full test suite in strict mode.
- [ ] Convert one or two writer sites to `decSPCells/incSPCells`; validate.
- [ ] Flip internals; keep shadow during deprecation window; monitor performance.
