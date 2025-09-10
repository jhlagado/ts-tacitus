# Plan 26 — Base Pointer (BP) Cell Migration

## 📋 Overview

**Goal:** Migrate the call-frame Base Pointer from a byte-indexed model to a canonical cell-indexed model (`BPCells`) while preserving test behavior, frame semantics, and corruption test capabilities.
**Complexity:** Medium
**Dependencies:** Plan 25 (SP/RSP cell alignment) completed, current VM ref/list fast paths. No external blockers.
**Estimated Steps:** 3 phases / ~14 granular steps

## 🎯 Success Criteria

- [ ] `BP` canonical representation becomes cell-based (`_bpCells`), with derived byte view only at memory boundary.
- [ ] Frame prologue/epilogue push/pop and stored frame roots use cell units consistently.
- [ ] All existing tests pass after each phase (current count: 1210 tests).
- [ ] Corruption/error simulation tests still meaningful (achieved via controlled byte->cell conversion points or helper).
- [ ] No lingering `* 4` / `/ 4` arithmetic tied to BP except at explicit address conversion boundaries.
- [ ] Documentation updated (architecture, stack frames) to reflect cell-based BP.
- [ ] Performance of call/return and local-var access not degraded (±3% baseline).

## 📐 Architecture Analysis

### Current State
- `BP` stored as byte index (`_bpBytes`) with derived `bpCells` or temporary helper (byte-to-cell division) at usage sites.
- Frame layout on return stack saves: [Return IP][Prior BP][Locals/Temps] using byte-based BP for frame root arithmetic.
- Local variable resolution mixes units: calculates slot address via cell math but anchors relative to byte `BP`.
- Tests assume certain byte-level invariants only indirectly (e.g., frame depth, not raw BP value), except a few potential debugging/printing assertions.

### Target State
- Canonical internal field `_bpCells: number` (cell index). Public getter `BPCells` (cells) and derived `BPBytes` (cells * CELL_SIZE) only where raw addresses needed.
- Prologue: push caller frame root in cells; set new `_bpCells = RSP` (after pushing saved IP & BPCells).
- Epilogue: restore `RSP = _bpCells`; pop saved BPCells then IP (mirroring cell order).
- Corruption / fuzz tests: Introduce helper `unsafeSetBPBytes(rawByteIndex)` that validates alignment then converts to cells.
- All local variable, list materialization, and debug print paths operate purely on cell indices.

### Key Components
- `src/core/vm.ts` — BP storage, getters/setters, frame prologue/epilogue helpers.
- `src/lang/executor.ts` / `interpreter.ts` — call/return logic referencing BP.
- `src/ops/builtins-interpreter.ts` and `builtins-stack.ts` — frame debugging & dumps.
- `src/ops/local-vars-transfer.ts` — list/local variable movement across frames.
- Tests under `src/lang/*`, `src/ops/*`, possibly frame or local-var specific tests.
- Docs: `docs/specs/vm-architecture.md`, possibly `docs/specs/stack-frames.md` (add if missing), naming guides.

## 🛠️ Implementation Strategy

### Phase 1: Dual BP Representation (Cells Canonical Internally)
**Goal:** Introduce `_bpCells` while keeping external behavior stable; adapt code to use cells; provide derived byte accessor for transitional use.

#### Step 1.1: Introduce `_bpCells` Field & Accessors ✅
**Task:** In `vm.ts`, add `_bpCells`, getters `get BPCells()`, `get BPBytes()`, and a transitional setter `set BPCells(v)` with range + alignment assertions. Keep legacy `BP` getter returning bytes (derived) for now. Initialize `_bpCells = 0` in reset. Mark docstring TODO to remove byte form later.
**Files:** `src/core/vm.ts`
**Tests:** Full suite executed (1210 tests) — all passed.
**Result:** Added `_bpCells`, synchronized dual setters (setting bytes derives cells via floor, setting cells derives bytes), added `BPBytes` convenience getter. No behavior change; coverage unchanged.
**Success:** ✅ Build + tests pass; plan proceeds to Step 1.2.

#### Step 1.2: Refactor Call Prologue/Epilogue Internals to Use Cells
**Task:** Update internal helpers (executor/interpreter call) to use `BPCells`; where they previously pushed `BP` bytes, push `BPCells` (still may store as cell value; ensure restore path matches). Keep legacy byte conversion where tests introspect, if any.
**Files:** `src/lang/executor.ts`, `src/lang/interpreter.ts`
**Tests:** Call/return suites.
**Success:** All tests pass; no byte math on BP in logic except conversions.

#### Step 1.3: Update Local Var & List Transfer to Use `BPCells`
**Task:** Replace calculations that anchor on byte BP with cell-based computations (multiplying only at final memory address derivation). Remove `/ 4` adjacent to BP usage.
**Files:** `src/ops/local-vars-transfer.ts`
**Tests:** Local var, list materialization tests.
**Success:** Tests pass; grep shows no BP `/4` or `*4` in this file.

#### Step 1.4: Frame Debug / Dump Paths
**Task:** Update debug printers to show `BPCells` primarily; optionally include bytes for transitional clarity. Ensure tests expecting format updated minimally (phase may defer test updates if format change breaks).
**Files:** `src/ops/builtins-interpreter.ts`, `src/core/printer.ts` or related debug modules.
**Tests:** Debug/dump tests.
**Success:** Tests pass; debug output stable or intentionally adjusted.

#### Step 1.5: Transitional Audit
**Task:** Grep for `BP` arithmetic patterns (`BP * 4`, `/ 4`, `bpBytes`). Replace with `BPCells` and explicit `* CELL_SIZE` only at memory boundaries (address computations passing to memory load/store utilities).
**Files:** Global (search & patch subset).
**Tests:** Full suite.
**Success:** No stray arithmetic; tests green.

### Phase 2: Flip Canonical External Representation
**Goal:** Remove legacy byte-centric naming; expose cell-based BP; adapt any tests relying on old getter.

#### Step 2.1: Remove Legacy `BP` Byte Getter (or Rebrand)
**Task:** Rename `BP` getter to `BPBytes` (explicit) or remove if unused; encourage usage of `BPCells`. Add deprecation note if kept briefly.
**Files:** `src/core/vm.ts` + update references.
**Tests:** Adjust tests referencing `BP`.
**Success:** Build + tests pass; no references to bare `BP` remain.

#### Step 2.2: Update Frame Prologue/Epilogue Storage Format
**Task:** Ensure stored frame metadata on stack uses cells consistently (saved BPCells). Confirm restore path correct order and type.
**Files:** `executor.ts`, `interpreter.ts`
**Tests:** Call nesting, recursion tests.
**Success:** Deeper recursion tests pass; stack traces correct.

#### Step 2.3: Introduce `unsafeSetBPBytes` Helper
**Task:** For corruption tests, add method on VM allowing injection of a byte index (validated alignment) converting to cells; document test-only usage.
**Files:** `vm.ts`, test helper file.
**Tests:** Add/modify corruption tests if present.
**Success:** Fuzzer/corruption tests still simulate invalid frames meaningfully without reintroducing bytes globally.

#### Step 2.4: Documentation Update (Architecture & Frames)
**Task:** Rewrite stack frame section to describe cell-based BP; note transitional layer removal. Add/Update `specs/stack-frames.md` if not existing.
**Files:** `docs/specs/vm-architecture.md`, new `docs/specs/stack-frames.md` (if needed), naming guide.
**Tests:** None (doc only).
**Success:** Docs accurate; references consistent.

### Phase 3: Cleanup & Hardening
**Goal:** Remove transitional code, finalize invariants, performance checks.

#### Step 3.1: Remove Deprecated Fields / Comments
**Task:** Delete any leftover byte-centric compatibility code (`legacy BP`, deprecation notes).
**Files:** `vm.ts`, others.
**Tests:** Full suite.
**Success:** Clean grep; tests green.

#### Step 3.2: Add Invariants & Assertions
**Task:** Ensure all BP mutations validate range and alignment; add invariant check in VM tick/reset optionally (development mode).
**Files:** `vm.ts`
**Tests:** Negative tests (invalid alignment injection via unsafe helper) produce expected errors.
**Success:** Assertions triggered correctly.

#### Step 3.3: Microbenchmark Call/Return Path
**Task:** (Optional) Add lightweight benchmark script comparing pre/post metrics or reuse existing; ensure ±3% tolerance.
**Files:** `scripts/bench-call-return.ts` (optional new).
**Tests:** Manual run only.
**Success:** Performance within target.

#### Step 3.4: Final Audit & Plan Closure
**Task:** Re-run global grep for `BP * 4`, `/ 4`, `bpBytes`; confirm absent. Mark all success criteria complete; update plan status.
**Files:** None (search only).
**Tests:** Full suite final run.
**Success:** Plan closed.

## 🧪 Testing Strategy

### Unit
- [ ] VM BP getters/setters: correct cell↔byte conversions.
- [ ] Prologue/Epilogue cell-based push/pop sequence order.
- [ ] Local var resolution unaffected by canonical flip.

### Integration
- [ ] Deep recursion (e.g., 200 nested calls) stable and reversible.
- [ ] List materialization across frames unaffected.
- [ ] Debug dump reflects cell-based indices.

### Regression
- [ ] All existing suites pass after each step.
- [ ] No performance regression in call-intensive tests.

## 🔍 Risk Analysis

### High
- Misaligned conversion causing off-by-one frame restores (Mitigation: assert alignment & round-trip tests).

### Medium
- Hidden test expectations about BP byte values (Mitigation: incremental phase gate & search for direct BP reads).
- Corruption tests losing expressiveness (Mitigation: `unsafeSetBPBytes` helper).

### Low
- Minor performance hit from added conversions (Mitigation: keep conversions localized to boundary functions).

## 📚 References
- Prior Plan: `plan-25-sp-rsp-cell-alignment.md`
- Specs: `docs/specs/vm-architecture.md`, lists, tagged values.
- Core Files: `src/core/vm.ts`, `src/lang/executor.ts`, `src/lang/interpreter.ts`.

## 🏁 Completion Checklist

### Implementation Complete
- [ ] Phases 1–3 complete
- [ ] Docs updated
- [ ] Tests green (1210/1210) post-migration
- [ ] No stray BP byte arithmetic in logic paths

### Code Quality
- [ ] Invariants enforced
- [ ] No dead compatibility code
- [ ] Clear debug output (cells primary)

### Integration
- [ ] External behavior unchanged
- [ ] Corruption testing capability preserved
- [ ] Performance within tolerance

---
**Status:** 🔄 In Progress
**Last Updated:** 2025-09-11
**Assigned:** —
