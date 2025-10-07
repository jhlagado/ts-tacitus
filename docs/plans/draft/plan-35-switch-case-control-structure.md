# Plan 35 — Case / Switch Immediate Control Flow

## Status
- **Stage:** Draft
- **Scope:** Introduce a `case` / `of` / `DEFAULT` immediate-family that lowers to existing Tacit opcodes (dup/eq/branch) without parser extensions.

## High-level objective
Deliver a discriminant-based multi-branch construct built entirely with immediates, mirroring the ergonomics of high-level switch-case while preserving Tacit’s stack discipline. Clause bodies should not manage discriminant cleanup explicitly; the immediates must handle comparison, branching, and stack restoration automatically.

## Implementation phases

### Phase 0 — Spec consolidation & design validation
- Re-read `docs/specs/metaprogramming.md` to ensure the closer discipline (saved return-stack snapshots, data-stack placeholders) is respected.
- Finalise the normative specification (`docs/specs/case-control-flow.md`) including stack diagrams, bytecode skeletons, and error semantics. ✅ *(drafted in this plan)*
- Decide on the sentinel literal used by `DEFAULT` and confirm it does not collide with existing runtime symbols.

### Phase 1 — Immediate helper scaffolding
- Create `src/lang/meta/case.ts` exporting:
  - `beginCaseImmediate(state)`
  - `clauseOfImmediate(state, sentinelAware)`
  - `defaultImmediate(state)`
  - `ensureNoOpenCase(state)` (hooked into existing parser finalisation alongside `ensureNoOpenConditionals`).
- Unit-test the helper stack behaviour in isolation (e.g., `src/test/lang/case-immediate.test.ts`).

### Phase 1b — Sentinel constants (optional synergy)
- Introduce a minimal set of sentinel immediate words (e.g., `DEFAULT`, `NIL`) if they do not already exist:
  - Implement as immediates that push tagged sentinel values (e.g., `toTaggedValue(Sentinel.DEFAULT, Tag.SENTINEL)`), relying on the shared `Sentinel` enum.
  - Decide on naming convention: either uppercase bare words (`DEFAULT`, `NIL`) or reserved sigil-prefixed forms (such as `#default`, `#nil`). The simplest path is uppercase bare words registered in the dictionary so they behave like literals.
- Document these immediates in the spec and add unit tests ensuring equality treats the wildcard sentinel as expected.

### Phase 2 — Closer operations
- Extend `src/ops/core/core-ops.ts` with:
  - `endOfOp(vm)` — emits exit branch, patches predicate skip, restores data stack to discriminant-ready shape.
  - `endCaseOp(vm)` — drops unmatched discriminant, patches recorded exit branches, validates return-stack depth.
- Add coverage tests targeting edge cases (no default, default only, multiple clauses).

### Phase 3 — Wiring & registration
- Export immediates from `src/lang/meta/index.ts`.
- Register `case`, `of`, `DEFAULT` builtins (immediate flag) in `src/ops/builtins-register.ts`.
- Ensure the generic terminator dispatch includes new closer opcodes.
- Update dependency maps (docs) to reference the new spec file.

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
- **Duplicate default detection:** Implement explicit state flag in `clauseOfImmediate` to reject subsequent `DEFAULT` invocations.
- **Clause fall-through confusion:** Documentation clarifies that bodies do not fall through; tests cover early exit to prevent regression.

## Deliverables checklist
- [ ] `docs/specs/case-control-flow.md` finalised (currently draft).
- [ ] Immediate helpers implemented with unit tests.
- [ ] Closer operations wired and tested.
- [ ] Builtins registered; parser validation updated.
- [ ] End-to-end language tests covering success/error paths.
- [ ] Documentation and dependency map updates.
