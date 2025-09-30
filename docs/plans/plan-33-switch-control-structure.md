# Plan 33 — Immediate `case/of` Switch Control Structure

Status
- Stage: Planning and design ready for implementation
- Depends on:
  - Plan 31 — Generic `;` closer infrastructure (in place)
  - Plan 32 — Brace-block removal (in place)
- Spec source: docs/specs/drafts/switch-control-flow.md (normative draft)

Objectives
- Add a Forth-style switch construct using immediate words:
  - `case` (open switch), `of` (start clause), `;` (generic closer executes `endof`/`endcase`)
- Ensure:
  - No new grammar; immediate words drive compilation
  - Fixed-arity semantics: `of` consumes exactly one runtime flag
  - All compiler state lives on the VM data stack (numbers as placeholders, BUILTIN closers)
- Preserve Tacit invariants and closer stack behavior used by `if … else … ;`

Scope (Implementation Units)
1) Opcodes
   - Add new closers:
     - `Op.EndOf` — closes a single clause; emits exit-branch placeholder and patches false-branch placeholder
     - `Op.EndCase` — closes switch; patches all exit-branch placeholders to the common exit
2) Meta (compile-time immediates)
   - `beginCaseImmediate()` — pushes EndCase closer; emits no bytecode
   - `beginOfImmediate()` — emits `IfFalseBranch`, pushes p_false (number), then EndOf closer
   - `ensureNoOpenSwitches()` — scans compile-time data stack for unclosed EndCase closer
3) Registration
   - Symbol table definitions:
     - `case` → `Op.Nop`, immediate impl: `beginCaseImmediate`
     - `of` → `Op.Nop`, immediate impl: `beginOfImmediate`
     - `endof` → `Op.EndOf` (non-immediate closer)
     - `endcase` → `Op.EndCase` (non-immediate closer)
   - `;` remains the generic closer that evals the BUILTIN closer at TOS
4) Parser validation
   - Call `ensureNoOpenSwitches()` in `validateFinalState` alongside existing open-definition/conditional checks
5) Tests
   - Unit and end-to-end tests covering simple, default-only, single/multi-clauses, nesting, and error cases
6) Documentation
   - Spec already authored in docs/specs/drafts/switch-control-flow.md; keep in sync as needed

Design Summary (from Spec)
- Lowering rules (fixed arity):
  - `case` emits a forward-branch anchor (`Branch` + 16-bit 0) and pushes its operand address (`anchorPos`) beneath an EndCase closer on the data stack.
  - `of` emits `IfFalseBranch p_false`, then pushes `p_false` (number) and EndOf closer.
  - Clause `;` executes EndOf:
    - pop `p_false`
    - temporarily pop EndCase, then pop `anchorPos`
    - emit a backward `Branch` to the anchor’s opcode and compute its offset immediately (no accumulation of exits)
    - restore stack (push `anchorPos`, then EndCase)
    - patch `p_false` → here (fallthrough for false)
  - Final `;` executes EndCase:
    - pop EndCase
    - pop `anchorPos` and patch its forward branch to here (common exit)
- Control flow (explicit):
  - Pred true → fallthrough into body → backward Branch to anchor → anchor’s forward Branch to exit (skip remainder)
  - Pred false → IfFalseBranch jumps over body → next clause or default; if none, to exit
- Compiler-state-on-stack only; no additional parser fields beyond existing validation hooks

File Changes (Detailed Checklist)
- src/ops/opcodes.ts
  - Add enum entries: `EndOf`, `EndCase`
- src/ops/core/core-ops.ts
  - Implement:
    - `endOfOp(vm)` — pop `p_false`; temporarily pop EndCase and `anchorPos`; emit backward `Branch` to the anchor’s opcode and compute offset; restore `anchorPos` + EndCase; patch `p_false` → here
    - `endCaseOp(vm)` — pop EndCase; pop `anchorPos`; patch the anchor’s forward branch to here
  - Export via `executeOp` dispatch
- src/lang/meta/switch.ts (new)
  - `beginCaseImmediate()`
  - `beginOfImmediate()`
  - `ensureNoOpenSwitches()`
- src/lang/meta/index.ts
  - `export { beginCaseImmediate, beginOfImmediate, ensureNoOpenSwitches } from './switch';`
- src/ops/builtins-register.ts
  - Register immediate words and closers:
    - `symbolTable.defineBuiltin('case', Op.Nop, _ => beginCaseImmediate(), true);`
    - `symbolTable.defineBuiltin('of', Op.Nop, _ => beginOfImmediate(), true);`
    - `symbolTable.defineBuiltin('endof', Op.EndOf);`
    - `symbolTable.defineBuiltin('endcase', Op.EndCase);`
- src/lang/parser.ts
  - In `validateFinalState(state)`: call `ensureNoOpenSwitches()` after `ensureNoOpenConditionals()`
- Tests
  - src/test/lang/switch-case.test.ts (new)
    - “case ;” → no-op
    - “case … ;” → runs default-only
    - “case pred of body ; ;” → body when true; nothing when false
    - “case pred of body ; default ;” → body when true, default when false
    - 2+ clauses with default
    - Nested `if … ;` inside clause body
    - Errors:
      - `of` without `case`
      - Unclosed `case` at EOF
    - Stack discipline: after parse, compile-time stack should be clean (no stray numbers/closers)
- Docs
  - Spec is current (explicit true/false flow, fixed arity, stack-only state). Keep synced if code nuances appear during implementation.

Acceptance Criteria
- Parsing any of the worked examples produces correct bytecode and runtime results
- All compiler state represented strictly by stack items (numbers, BUILTIN closer refs)
- Generic `;` closes the innermost construct correctly (EndIf, EndOf, EndCase) with proper LIFO semantics
- Validation catches “OF without CASE” and “Unclosed CASE”
- No reliance on variadic detection; `of` requires exactly one runtime flag
- Coverage added for nesting and error paths

Risks / Mitigations
- Risk: Anchor offset calculation errors (forward/backward branch math)
  - Mitigation: Unit tests asserting exact byte offsets for small synthetic programs; reuse the same offset computation patterns as EndIf and colon definition branch patching.
- Risk: Preserving EndCase + anchorPos adjacency on the compile-time stack across nested constructs
  - Mitigation: LIFO closer tests with nested `if … ;` inside clauses; assert stack shape after each `;`.
- Risk: Backward branch to anchor opcode alignment (target = opcode byte before operand)
  - Mitigation: Centralize helper to compute “targetOpcode = anchorPos - 1” and document it in code comments; add tests covering non-trivial CP movements between EndOf and EndCase.
- Risk: Backward-compatibility (symbols ‘case’, ‘of’)
  - Mitigation: They are new; no prior semantics to preserve

Rollout Steps
1) Add opcodes and meta functions
2) Register builtins
3) Parser validation hook
4) Implement core ops
5) Tests (unit + e2e)
6) CI green; update spec references if any minor discrepancies found

Out of Scope (Future Work)
- Additional switch syntaxes (e.g., `default` keyword) — intentionally avoided; default is implicit region before final `;`
- Pattern forms that manage a discriminant for you — users explicitly manage stack/locals per predicate

References
- Spec: docs/specs/drafts/switch-control-flow.md
- Immediate control model: src/lang/meta/conditionals.ts, src/ops/core/core-ops.ts (EndIf/EndDefinition patterns)
