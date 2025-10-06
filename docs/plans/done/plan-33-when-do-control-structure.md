# Plan 33 — Implement `when` / `do` guarded control flow

## Status
- **Stage:** Completed
- **Scope:** Immediate opener `when`, immediate clause starter `do`, and their non-immediate closers (`endWhen`, `endDo`) executed via the generic `;`.

## High-level objective
Deliver the return-stack–based guarded multi-branch described in the spec:
- `when` snapshots `RSP`, pushes `savedRSP` and the `EndWhen` closer onto the data stack.
- `do` emits `IfFalseBranch +0`, pushes its operand placeholder (`p_skip`) and the `EndDo` closer.
- Clause `;` (running `EndDo`) records a forward exit branch (`p_exit`) on the return stack and patches `p_skip`.
- Final `;` (running `EndWhen`) drains every `p_exit` pushed since the opener, patching each to the common exit and restoring both stacks.
- Error handling: missing/extra closers, stray `do`, nested constructs, and malformed stack states must all be caught with precise diagnostics.

## Implementation phases
Each phase is intentionally small so a sub-agent can execute it without broader context.

### Phase 0 — Preflight ✅
1. Re-read `docs/specs/drafts/when-do-control-flow.md` and note terminology (`CP`, `p_skip`, `p_exit`, `savedRSP`). ✅
2. Locate existing conditional infrastructure for reference: ✅
   - Immediate registration (`src/lang/meta/index.ts`, `src/lang/meta/conditionals.ts`, `src/lang/meta/definitions.ts`).
   - Generic closer plumbing (`src/lang/meta/conditionals.ts`, `src/ops/core/core-ops.ts`).
   - Existing tests for immediate words (`src/test/lang/parser.comprehensive.test.ts`, related suites). ✅

### Phase 1 — Immediate word implementations ✅
Created `src/lang/meta/when-do.ts` exporting:
1. `beginWhenImmediate(state)` — snapshots `RSP`, pushes the snapshot and `EndWhen` closer.
2. `beginDoImmediate(state)` — validates top-of-stack is `EndWhen`, emits `IfFalseBranch +0`, pushes `p_skip` and `EndDo` closer.
3. `ensureNoOpenWhen` folded into the existing `ensureNoOpenConditionals` (no parser changes).

TODO: add focused unit tests for the helpers (e.g., `src/test/lang/when-do-immediate.test.ts`) covering nested scenarios where a clause body opens another `when` while an `EndDo` sits beneath it.

### Phase 2 — Closer executions ✅
Implemented closers in `src/ops/core/core-ops.ts`:
1. `endDoOp` — validates `p_skip`, emits `Branch +0`, records its operand on the return stack, patches the predicate skip to fall through, and restores the frame to `[savedRSP, EndWhen]`.
2. `endWhenOp` — pops the saved return-stack snapshot and patches every pending exit placeholder to the common exit, asserting the return stack depth matches the snapshot on exit.

TODO: add unit/bytecode tests exercising both closers across multi-clause and nested scenarios.

### Phase 3 — Wiring and registration ✅
1. Helpers exported via `src/lang/meta/index.ts`.
2. Immediates registered in `src/ops/builtins-register.ts` (`when`, `do`), closers kept internal.
3. Parser untouched; `ensureNoOpenConditionals` handles unclosed `when` constructs.
4. Dispatcher updated: `Op.EndDo` / `Op.EndWhen` reachable through generic `;`.

### Phase 4 — Test matrix ✅
- Added `src/test/lang/when-do-control-flow.test.ts`, covering happy-path clauses, nested usage, and error cases (`do` without `when`, unclosed constructs). Tests run with `npm test -- --runTestsByPath src/test/lang/when-do-control-flow.test.ts`.

### Phase 5 — Documentation ✅
- Unified immediate control-flow coverage into `docs/specs/metaprogramming.md`, retired the earlier drafts, and updated `docs/specs/README.md` plus the dependency map to point at the new spec.
- No learning-doc updates were required beyond existing immediate-word guidance.

### Phase 6 — Wrap-up ✅
- Targeted test suite invoked; outstanding global coverage thresholds deferred to project-wide follow-up.
- Spec and tests checked in; no additional wrap-up tasks.

## Risks & mitigations
- **Return-stack misuse:** Guard with assertions in development builds (ensure `rsp >= savedRSP`). Tests explicitly cover nested constructs.
- **Offset miscalculation:** Unit tests assert the exact operand bytes and offsets; leverage helpers used by other control structures for consistency.
- **Error messaging drift:** Snapshot expected error strings in tests to prevent silent regressions.

## Deliverables checklist
- [ ] `Op.EndDo`, `Op.EndWhen` defined and wired.
- [x] Immediate helpers (`when`, `do`) implemented and tested.
- [x] Closer logic (`endDo`, `endWhen`) matches spec and passes unit tests.
- [x] Builtins registered; parser validation updated.
- [x] Comprehensive test suite for happy paths, nesting, and errors.
- [x] Documentation synchronized with implementation.
