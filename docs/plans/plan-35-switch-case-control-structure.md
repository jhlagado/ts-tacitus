# Plan 35 — Case / Switch Immediate Control Flow

## Status
- **Stage:** Draft
- **Scope:** Introduce a `case` / `of` immediate-family that lowers to existing Tacit opcodes (dup/eq/branch) without parser extensions.

## High-level objective
Deliver a discriminant-based multi-branch construct built entirely with immediates, mirroring the ergonomics of high-level switch-case while preserving Tacit’s stack discipline. Clause bodies should not manage discriminant cleanup explicitly; the immediates must handle comparison, branching, and stack restoration automatically.

## Implementation phases

### Phase 0 — Spec consolidation & design validation ✅
- Re-read `docs/specs/metaprogramming.md` to ensure the closer discipline (saved return-stack snapshots, data-stack placeholders) is respected. *(Reconfirmed; `case` mirrors the proven `when/do` pattern.)*
- Finalise the normative specification (`docs/specs/case-control-flow.md`) including stack diagrams, bytecode skeletons, and error semantics. *(Draft committed; covers stack effect `(discriminant —)` and optional invariants.)*
- Decide on the sentinel literal used by `DEFAULT` and confirm it does not collide with existing runtime symbols. *(Settled on `Tag.SENTINEL` payloads enumerated in `Sentinel`—`DEFAULT` pushes `Sentinel.DEFAULT`, `NIL` uses `Sentinel.NIL`.)*

### Phase 1 — Immediate helper scaffolding ✅
- Added `src/lang/meta/case.ts` exporting:
  - `beginCaseImmediate()` to snapshot `RSP` and push the `EndCase` closer.
  - `clauseOfImmediate()` to emit the comparison/branch/drop sequence and record clause placeholders.
  - `defaultImmediate()` / `nilImmediate()` to emit sentinel literals via the shared `Sentinel` enum.
- Extended `ensureNoOpenConditionals` to flag stray `Op.EndCase` markers (keeps parser validation unified).
- Introduced focused unit tests in `src/test/lang/case-immediate.test.ts` covering stack discipline, literal emission, and error paths.

### Phase 1b — Sentinel constants (optional synergy)
- Introduce a minimal set of sentinel immediate words (e.g., `DEFAULT`, `NIL`) if they do not already exist:
  - Implement as immediates that push tagged sentinel values (e.g., `toTaggedValue(Sentinel.DEFAULT, Tag.SENTINEL)`), relying on the shared `Sentinel` enum.
  - Decide on naming convention: either uppercase bare words (`DEFAULT`, `NIL`) or reserved sigil-prefixed forms (such as `#default`, `#nil`). The simplest path is uppercase bare words registered in the dictionary so they behave like literals.
- Document these immediates in the spec and add unit tests ensuring equality treats the wildcard sentinel as expected. ✅ *(Immediate helpers and tests in Phase 1 cover the literal emission; registration will follow in Phase 3.)*

### Phase 2 — Closer operations ✅
- Added `endOfOp` and `endCaseOp` in `src/ops/core/core-ops.ts`, mirroring the existing `when/do` discipline (predicate skip validation, shared exit patching, saved RSP snapshot check).
- Wired the new opcodes through `src/ops/builtins.ts` so generic `;` dispatch reaches the closers.
- Extended `src/test/lang/case-immediate.test.ts` with clause/construct coverage including empty-case, predicate failure, and metadata validation scenarios.
- Validation: `yarn test --runTestsByPath src/test/lang/case-immediate.test.ts` *(suite passes; run exits 1 because the project-wide coverage gate remains < 80% as before).* 

### Phase 3 — Wiring & registration *(in progress)*
- ✅ Immediates (`case`, `of`, `DEFAULT`, `NIL`) exposed through `src/lang/meta/index.ts` and wired into the dictionary via `src/ops/builtins-register.ts` (immediate flag set so they execute during parsing).
- ☐ Ensure the generic terminator dispatch includes the new closer opcodes once interpreter wiring is finalised.
- ☐ Update dependency maps (docs) to reference the new spec file.

### Phase 4 — Test suite
- Author end-to-end tests `src/test/lang/case-control-flow.test.ts` exercising:
  - Single clause success/failure.
  - Multiple clauses with and without default.
  - Nested `case` constructs.
  - Error diagnostics (missing case, duplicate default, stray clause `;`).
- Expand bytecode-focused tests (if necessary) to assert emitted instruction sequences.

### Phase 5 — Documentation & developer ergonomics
- Update `docs/specs/metaprogramming.md` with a summary and link to the detailed spec.
- Extend learn docs (control flow tutorials) with examples demonstrating `case` usage.
- Announce the new construct in `docs/dependency-map.md` or relevant overviews.

### Phase 6 — Wrap-up
- Run `yarn lint`, targeted `yarn test -- runTestsByPath …`, and finally `yarn test`.
- Address lint/coverage regressions as needed.
- Move this plan to `docs/plans/done` once merged; record outcomes and validation results.

## Risks & mitigations
- **Stack imbalance:** Follow the same snapshotting approach as `when/do`; immediate tests assert stack shape at each step.
- **Wildcard defaults:** Repeated defaults are legal, but documentation should clarify that only the first one matches due to the sentinel equality behaviour.
- **Clause fall-through confusion:** Documentation clarifies that bodies do not fall through; tests cover early exit to prevent regression.

## Deliverables checklist
- [ ] `docs/specs/case-control-flow.md` finalised (currently draft).
- [x] Immediate helpers implemented with unit tests.
- [ ] Closer operations wired and tested.
- [ ] Builtins registered; parser validation updated.
- [ ] End-to-end language tests covering success/error paths.
- [ ] Documentation and dependency map updates.
