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

### Phase 1 — Immediate word implementations
Create `src/lang/meta/when-do.ts` (or analogous module) that exports three helpers:
1. `beginWhenImmediate(state)`
   - Snapshot return stack pointer (`savedRSP`) and push onto the data stack.
   - Push the `EndWhen` closer token.
2. `beginDoImmediate(state)`
   - Preconditions: TOS must be `EndWhen`; otherwise throw “`do` without `when`”.
   - Emit `IfFalseBranch +0` and push the operand address as `p_skip`.
   - Push the `EndDo` closer token.
3. `ensureNoOpenWhen(state)`
   - Called during parser finalization to ensure no `EndWhen` remains on the data stack.
   - Mirror existing `ensureNoOpenConditionals` style: scan the stack for any leftover `EndWhen` tokens and report “unclosed `when`”.

Add focused unit tests for each helper (e.g., in `src/test/lang/when-do-immediate.test.ts`) using a fake `CompileState` to assert stack contents and emitted bytecode. In particular, cover nested scenarios where a clause body opens another `when` while `EndDo` still sits on the stack below it; `beginWhenImmediate` must leave the existing `EndDo` undisturbed.

### Phase 2 — Closer executions
Implement the logic described in the spec for the two closers (compile-time execution when `;` pops them):
1. `endDoCloser(state)` (invoked when generic `;` evaluates `EndDo`)
   - Stack contract: `[..., savedRSP, EndWhen, p_skip]` on entry.
   - Steps:
     1. Validate `p_skip` (error if zero/missing).
     2. Emit `Branch +0`; record operand address as `p_exit`.
     3. Push `p_exit` onto the return stack (`state.rpush`).
     4. Patch `p_skip` to the current `CP`.
     5. Drop `p_skip`, leaving `[..., savedRSP, EndWhen]`.
   - Tests: ensure the emitted branch operand is recorded, the predicate skip is patched, and errors fire if the stack contract is violated.
2. `endWhenCloser(state)`
   - Stack contract: `[..., savedRSP, EndWhen]`.
   - Steps:
     1. Pop `savedRSP` (after the generic closer removes `EndWhen`).
     2. Loop while `state.rsp > savedRSP`: pop each `p_exit`, patch it forward to `CP`.
     3. Verify the loop emptied exactly the entries contributed inside this construct (under invariants, no underflow should occur). Keep an assertion to flag underflow during development.
   - Tests: multi-branch scenarios confirming all recorded exits are patched; ensure nested constructs restore the outer `savedRSP` untouched.

### Phase 3 — Wiring and registration
1. Export the new helpers via `src/lang/immediates.ts` (or relevant re-export file).
2. Register the immediates in `src/ops/builtins-register.ts`:
   - `symbolTable.defineBuiltin('when', Op.Nop, beginWhenImmediate, /*immediate=*/true)`.
   - `symbolTable.defineBuiltin('do', Op.Nop, beginDoImmediate, true)`.
   - Mark the internal closers (`EndDo`, `EndWhen`) so the generic `;` dispatcher can reach them, but do **not** expose `enddo` / `endwhen` to user code or the dictionary.
3. Update parser finalization (`src/lang/parser.ts`) to invoke `ensureNoOpenWhen(state)` alongside existing checks (no additional requirements at each `when`).
4. Ensure the generic `;` routing includes the new closer opcodes if it uses an explicit dispatch table.

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
- [ ] Immediate helpers (`when`, `do`, `ensureNoOpenWhen`) implemented and tested.
- [ ] Closer logic (`endDo`, `endWhen`) matches spec and passes unit tests.
- [ ] Builtins registered; parser validation updated.
- [ ] Comprehensive test suite for happy paths, nesting, and errors.
- [ ] Documentation synchronized with implementation.
