# Plan 35 — Case / Switch Immediate Control Flow

## Status

- **Stage:** Draft
- **Scope:** Introduce a `case` / `of` immediate-family that lowers to existing Tacit opcodes (dup/eq/branch) without parser extensions.

## High-level objective

Deliver a discriminant-based multi-branch construct built entirely with immediates, mirroring the ergonomics of high-level switch-case while preserving Tacit’s stack discipline. Clause bodies should not manage discriminant cleanup explicitly; the immediates must handle comparison, branching, and stack restoration automatically.

## Implementation phases

### Phase 0 — Spec consolidation & design validation ✅

- Re-read `docs/specs/metaprogramming.md` to ensure the closer discipline (saved return-stack snapshots, data-stack placeholders) is respected. _(Reconfirmed; `case` mirrors the proven `when/do` pattern.)_
- Finalise the normative specification (`docs/specs/case-control-flow.md`) including stack diagrams, bytecode skeletons, and error semantics. _(Draft committed; covers stack effect `(discriminant —)` and optional invariants.)_
- Decide on the sentinel literal used by `DEFAULT` and confirm it does not collide with existing runtime symbols. _(Settled on `Tag.SENTINEL` payloads enumerated in `Sentinel`—`DEFAULT` pushes `Sentinel.DEFAULT`, `NIL` uses `Sentinel.NIL`.)_

### Phase 1 — Immediate helper scaffolding ✅

- Added `src/lang/meta/case.ts` exporting:
  - `beginCaseImmediate(vm)` to snapshot `RSP` and push the `EndCase` closer.
  - `clauseOfImmediate(vm)` to emit the comparison/branch/drop sequence and record clause placeholders.
  - `defaultImmediate(vm)` / `nilImmediate(vm)` to emit sentinel literals via the shared `Sentinel` enum.
- Extended `ensureNoOpenConditionals` to flag stray `Op.EndCase` markers (keeps parser validation unified).
- Introduced focused unit tests in `src/test/lang/case-immediate.test.ts` covering stack discipline, literal emission, and error paths.

### Phase 1b — Sentinel constants (optional synergy)

- Introduce a minimal set of sentinel immediate words (e.g., `DEFAULT`, `NIL`) if they do not already exist:
  - Implement as immediates that push tagged sentinel values (e.g., `toTaggedValue(Sentinel.DEFAULT, Tag.SENTINEL)`), relying on the shared `Sentinel` enum.
  - Decide on naming convention: either uppercase bare words (`DEFAULT`, `NIL`) or reserved sigil-prefixed forms (such as `#default`, `#nil`). The simplest path is uppercase bare words registered in the dictionary so they behave like literals.
- Document these immediates in the spec and add unit tests ensuring equality treats the wildcard sentinel as expected. ✅ _(Immediate helpers and tests in Phase 1 cover the literal emission; registration will follow in Phase 3.)_

### Phase 2 — Closer operations ✅

- Added `endOfOp` and `endCaseOp` in `src/ops/core/core-ops.ts`, mirroring the existing `when/do` discipline (predicate skip validation, shared exit patching, saved RSP snapshot check).
- Wired the new opcodes through `src/ops/builtins.ts` so generic `;` dispatch reaches the closers.
- Extended `src/test/lang/case-immediate.test.ts` with clause/construct coverage including empty-case, predicate failure, and metadata validation scenarios.
- Validation: `yarn test --runTestsByPath src/test/lang/case-immediate.test.ts` _(suite passes; run exits 1 because the project-wide coverage gate remains < 80% as before)._

### Phase 3 — Wiring & registration ✅

- Immediates (`case`, `of`, `DEFAULT`, `NIL`) exposed through `src/lang/meta/index.ts` and wired into the dictionary via `src/ops/builtins-register.ts` (immediate flag set so they execute during parsing).
- Confirmed the generic terminator dispatch reaches `EndOf`/`EndCase` through the existing builtin table (`src/ops/builtins.ts` now maps both opcodes).
- Updated documentation entry points so the new construct is discoverable (`docs/specs/metaprogramming.md` references the normative spec, and `docs/specs/README.md` lists `case-control-flow.md`).
- Validation: `yarn test` _(full suite still exits 1 because the long-standing global coverage gate is < 80%; individual suites pass)._

### Phase 4 — Test suite ✅

- Added `src/test/lang/case-control-flow.test.ts` covering happy-path dispatch, default matching, multi-clause fall-through, nested cases, multiple defaults, and parser error reporting.
- Ensured the runtime honours the wildcard sentinel by updating `areValuesEqual` so `Sentinel.DEFAULT` compares truthy against any discriminant.
- Validation: `yarn test --runTestsByPath src/test/lang/case-control-flow.test.ts` and `yarn test` (full suite still exits 1 because the long-standing global coverage gate is below 80%; all suites pass).

### Phase 5 — Documentation & developer ergonomics ✅

- `docs/specs/metaprogramming.md` highlights the `case/of/DEFAULT` lowering and links to the dedicated spec; `docs/specs/README.md` lists the new spec entry.
- Added `docs/learn/control-flow.md` with quick examples for `if`, `when`, and `case`, and surfaced it from `docs/learn/README.md`.
- Overview references now point to the new control-flow materials so the construct is discoverable from the learn/spec landing pages.

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
- [x] Closer operations wired and tested.
- [x] Builtins registered; parser validation updated.
- [x] End-to-end language tests covering success/error paths.
- [x] Documentation and dependency map updates.
