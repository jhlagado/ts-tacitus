# Plan 33 — Implement `when` / `do` guarded control flow

## Status
- **Stage:** Ready for implementation (spec finalized in `docs/specs/drafts/when-do-control-flow.md`).
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

### Phase 4 — Test matrix
Create a dedicated test file `src/test/lang/when-do-control-flow.test.ts` covering:
1. **Immediate stack discipline**
   - `when` pushes `[savedRSP, EndWhen]`; `do` extends it; clause `;` restores it.
   - Nested `when` inside clause body and default region maintains LIFO order.
2. **Bytecode layout**
   - Single clause: verify emitted opcodes (`IfFalseBranch`, clause body, `Branch +0`) and patched offsets for both true and false predicate cases.
   - Multi-clause with default: ensure each clause adds one pending `p_exit` and the final `;` patches them all to the common exit.
3. **Runtime behavior (integration tests)**
   - Evaluate sample programs (using existing VM harness) to confirm first-true wins, fall-through default, and stack cleanup responsibilities remain on the programmer.
4. **Error coverage**
   - `do` without `when`.
   - Clause `;` without `do` (missing `p_skip`).
   - Final `;` with outstanding `EndDo` (`previous clause not closed`).
   - Unterminated `when` at EOF.
   - Nested constructs to ensure no cross-talk between saved snapshots.

### Phase 5 — Documentation
1. Update any learning or reference docs that list control structures (e.g., `docs/learn/local-vars.md`, `docs/specs/drafts/immediate-words-and-terminators.md`) to mention `when` / `do`.
2. Add migration notes if older plans referenced the anchor-based design (call out the return-stack approach).
3. Ensure doctests/examples mirror the final syntax with quoted keywords in comments.

### Phase 6 — Wrap-up
1. Run formatting (`pnpm lint` or project equivalent), unit tests, and integration tests.
2. Review diff to confirm no unintended files changed (respecting existing dirty state policy).
3. Update `CHANGELOG` or release notes if project requires.

## Risks & mitigations
- **Return-stack misuse:** Guard with assertions in development builds (ensure `rsp >= savedRSP`). Tests explicitly cover nested constructs.
- **Offset miscalculation:** Unit tests assert the exact operand bytes and offsets; leverage helpers used by other control structures for consistency.
- **Error messaging drift:** Snapshot expected error strings in tests to prevent silent regressions.

## Deliverables checklist
- [ ] `Op.EndDo`, `Op.EndWhen` defined and wired.
- [ ] Immediate helpers (`when`, `do`) implemented and tested.
- [ ] Closer logic (`endDo`, `endWhen`) matches spec and passes unit tests.
- [ ] Builtins registered; parser validation updated.
- [ ] Comprehensive test suite for happy paths, nesting, and errors.
- [ ] Documentation synchronized with implementation.
