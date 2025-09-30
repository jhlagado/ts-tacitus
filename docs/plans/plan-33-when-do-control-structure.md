# Plan 33 — Immediate `when … do` Guarded Control Structure

Status
- Stage: Planning and design ready for implementation (final naming: opener `when`, clause body `do`)
- Depends on:
  - Plan 31 — Generic `;` closer infrastructure (in place)
  - Plan 32 — Brace-block removal (in place)
- Spec source: docs/specs/drafts/when-do-control-flow.md (normative draft)

Objectives
- Introduce a guard-based multi-clause control structure using immediate words:
  - `when` (open construct), `do` (begin clause body), `;` (generic closer executes `enddo` / `endwhen`)
- Ensure:
  - No new grammar; immediate words drive compilation
  - Fixed-arity semantics: each clause predicate leaves exactly one runtime flag
  - All compiler state lives on the VM data stack (numbers as placeholders, BUILTIN closers)
- Preserve Tacit invariants and closer stack behavior used by `if … else … ;`

Design Summary (from Spec)
- Lowering rules (fixed arity, anchor approach):
  - `when` emits a two-instruction prologue so the common exit is reachable without scanning and normal entry skips the anchor:
    - `Branch +3` to skip over the next 3-byte Branch
    - `Branch +0` (anchor); record its 16-bit operand address as `anchorPos` (beneath EndWhen)
  - `do` emits `IfFalseBranch p_false`, then pushes `p_false` (number) and EndDo closer
  - Clause `;` executes EndDo:
    - pop `p_false`
    - temporarily pop EndWhen, pop `anchorPos`
    - emit backward `Branch` to the anchor’s opcode and compute offset immediately
    - restore stack (push `anchorPos`, then EndWhen)
    - patch `p_false` → here (fallthrough for false)
  - Final `;` executes EndWhen:
    - pop EndWhen
    - pop `anchorPos` and patch its forward branch to here (common exit)
- Control flow (explicit):
  - Pred true → fallthrough into body → back-branch to anchor → anchor’s forward Branch to exit
  - Pred false → IfFalseBranch jumps over body → next clause or default; if none, to exit
- Compile-time stack shape:
  - Always EndWhen at TOS, anchorPos beneath it (during open `when`)
  - During an open clause: TOS EndDo, then p_false, then EndWhen, then anchorPos

Alternative (Informative)
- Single-jump variant via RSTACK SP snapshot:
  - rpush SPCells at `when`, for each clause `;` push forward-branch placeholder beneath EndWhen, at EndWhen rpop baseline and patch exactly k placeholders directly to exit (no anchor). This adds rpush/rpop discipline but removes the extra jump when a clause is taken.

File Changes (Implementation Units)
1) Opcodes
   - Add closers:
     - `Op.EndDo` — closes a single clause; emits backward Branch to the anchor and patches p_false
     - `Op.EndWhen` — closes construct; patches anchor forward to common exit
2) Meta (compile-time immediates)
   - `beginWhenImmediate()` — emit prologue (Branch +3; anchor Branch +0), push `anchorPos` then EndWhen (EndWhen at TOS)
   - `beginDoImmediate()` — emit `IfFalseBranch p_false`; push `p_false`, push EndDo closer
   - `ensureNoOpenWhen()` — scans for EndWhen closer on data stack
3) Registration
   - Symbol table definitions:
     - `when` → `Op.Nop`, immediate impl: `beginWhenImmediate`
     - `do` → `Op.Nop`, immediate impl: `beginDoImmediate`
     - `enddo` → `Op.EndDo` (non-immediate closer)
     - `endwhen` → `Op.EndWhen` (non-immediate closer)
   - `;` remains the generic closer (evals the BUILTIN closer at TOS)
4) Parser validation
   - Call `ensureNoOpenWhen()` in `validateFinalState` alongside existing checks
5) Tests
   - Unit and end-to-end tests covering: no-op, default-only, single/multi-clause, with default, nesting, and errors
   - Bytecode offset assertions for:
     - Backward branch from EndDo to anchor opcode (targetOpcode = anchorPos - 1)
     - Final anchor patch (here - (anchorPos + 2))
6) Documentation
   - Spec authored in docs/specs/drafts/when-do-control-flow.md

Implementation Sketch (Pointers)
- src/ops/opcodes.ts
  - Add enum entries: `EndDo`, `EndWhen`
- src/ops/core/core-ops.ts
  - Implement:
    - `endDoOp(vm)` — pop `p_false`; temporarily pop EndWhen and `anchorPos`; emit backward `Branch` to anchor opcode; restore `anchorPos` + EndWhen; patch `p_false` → here
    - `endWhenOp(vm)` — pop EndWhen; pop `anchorPos`; patch anchor forward to here
- src/lang/meta/when-do.ts (new)
  - `beginWhenImmediate()`, `beginDoImmediate()`, `ensureNoOpenWhen()`
- src/lang/meta/index.ts
  - `export { beginWhenImmediate, beginDoImmediate, ensureNoOpenWhen } from './when-do';`
- src/ops/builtins-register.ts
  - Register immediate words and closers:
    - `symbolTable.defineBuiltin('when', Op.Nop, _ => beginWhenImmediate(), true)`
    - `symbolTable.defineBuiltin('do', Op.Nop, _ => beginDoImmediate(), true)`
    - `symbolTable.defineBuiltin('enddo', Op.EndDo)`
    - `symbolTable.defineBuiltin('endwhen', Op.EndWhen)`
- src/lang/parser.ts
  - In `validateFinalState(state)`: call `ensureNoOpenWhen()` after `ensureNoOpenConditionals()`

Tests (src/test/lang/when-do-control.test.ts)
- Parse-time behavior
  - “when ;” → no code emitted (anchor patched to here)
  - “when default ;” → default-only code compiles; anchor patched to exit
  - Single clause, no default: true → body then two-step exit; false → skip to exit
  - Single clause + default: true → skip default; false → default, exit
  - Multi-clause with default and without
  - Nesting: `if … ;` inside a do-body closes correctly before EndDo and EndWhen
- Errors
  - `do` without open `when`
  - Unclosed `when`
  - Invalid `p_false` at EndDo
- Offset assertions
  - Backward branch target = (anchorPos - 1)
  - EndWhen patch (here - (anchorPos + 2))

Risks / Mitigations
- Anchor offset calculation errors
  - Mitigation: unit tests assert offset math; reuse EndIf/definition patch patterns
- Preserving EndWhen + anchorPos adjacency across nested constructs
  - Mitigation: LIFO closer tests asserting stack shape and closers ordering

Rollout Steps
1) Add opcodes
2) Implement core ops
3) Meta immediates and exports
4) Register builtins
5) Parser validation hook
6) Tests (incl. offset assertions)
7) CI, iterate docs if nuances surface

Out of Scope (Future Work)
- Optimized single-jump variant (RSTACK snapshot) can be added if the extra jump is a measurable hot path
- Additional syntactic sugar beyond when/do — not planned

References
- Spec: docs/specs/drafts/when-do-control-flow.md
- Immediate control model: src/lang/meta/conditionals.ts, src/ops/core/core-ops.ts (EndIf/EndDefinition patterns)
