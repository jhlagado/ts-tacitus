# Plan 27: Capsules — `methods` + `dispatch` (DRAFT)

Status: DRAFT — design and staged implementation plan for Capsules per specs.

## Objective
Implement Capsules as specified in `docs/specs/capsules.md`: reify a function’s current frame at `methods { … }` into a list value (the capsule), and add a `dispatch` primitive to resume and mutate that frame by message-driven method execution.

## Motivation
- Enable objects/actors/generators on the stack with strong encapsulation.
- Provide message-driven state machines without heap allocation.
- Align language with the spec while reusing existing frame/list machinery.

## Non-Goals
- No general object system beyond Capsules.
- No changes to list representation or ref semantics.
- No global storage; Capsules remain pure stack values.

## Baseline (Current)
- No Capsule reification at `methods`; functions run to `;` normally.
- No `dispatch` primitive; blocks/functions follow standard call semantics.
- Lists/locals/frames conform to `core-invariants.md`, `lists.md`, `local-vars.md`, `vm-architecture.md`.

## Proposed Design

### 1) Capsule Creation at `methods { … }`
At parse/compile time, encountering `methods` divides the function into:
- Initialization (before `methods`): locals and setup run once.
- Reentry code (inside `{ … }`): method dispatch table and bodies.

Runtime sequence at `methods` (reify-and-return):
1. Compute frame size (cells): `frameCells = RSP - BP`.
2. Push reentry pointer: current `IP` encoded as `Tag.CODE` (element 0 in capsule).
3. Push list header: `LIST:(frameCells + 1)` to cover locals + saved code pointer.
4. Copy the contiguous frame region (locals, any frame-resident compounds) plus code pointer to STACK as a list value.
5. Tear down frame: set `RSP = BP`, restore previous BP and return normally, leaving the capsule list value on STACK for the caller to store (e.g., `var p`).

Implementation note: encapsulate steps (2–4) in a builtin `makeCapsuleOp` for clarity.

### 2) Method Dispatch Code Generation
The `methods { … }` block compiles into a small dispatcher that executes when resuming via `dispatch`:
- Pop/read the incoming `message` from STACK as needed by method code.
- Compare against method selectors (backticked symbols) using digest equality.
- Branch to the matching method block; otherwise fall back to default (see Open Questions).
- Method bodies mutate locals via `->`/`+>` and may leave results on STACK.

Lowering for entries like: `` `move { +> y +> x } `` emits compare + conditional jump to the block.

### 3) `dispatch` Primitive
Signature: `( message &capsule -- result* ) dispatch`
- Validate `&capsule` is an address (RSTACK_REF or STACK_REF to slot) holding a Capsule list.
- Materialize capsule value from slot (if needed), reconstruct the frame onto RSTACK, and set `BP` to the reconstructed frame root.
- Jump to the saved `CODE` pointer (element 0) to run the reentry/dispatcher.
- On return, reify the updated frame back into a Capsule list and write through to the same `&capsule` destination (preserving state).
- Leave any method results on STACK (arity unconstrained, driven by method body).

Error handling: invalid address/tag → throw with canonical messages (see `docs/reference/known-issues.md`).

## Algorithmic Sketches

### makeCapsuleOp (runtime)
- Inputs: none (operates on current frame)
- Steps (cells):
  - `frame = RSP - BP`
  - push `Tag.CODE(IP_after_methods)`
  - push `Tag.LIST(frame + 1)`
  - copy `[BP .. RSP)` cells + saved code pointer as list to STACK
  - `RSP = BP`; restore previous BP; return

### dispatchOp (runtime)
- Stack: `( msg addr -- result* )`
- Validate `addr` (ref); read capsule list header and payload
- Rebuild frame on RSTACK:
  - copy capsule payload (locals) to RSTACK
  - set `BP = RSP - frameCells`
  - read code pointer from element 0; `IP = codePtr`
- Execute reentry; upon `Exit`:
  - reify updated frame into list (same as `makeCapsuleOp` but without changing caller’s BP)
  - write the list back to `addr` (materialize sources as required by store rules)
  - leave any results pushed by method

## Open Questions
- Unmatched message behavior:
  - Option A: return `NIL` (consistent with read soft-fail policy)
  - Option B: throw (explicit error)
  - Default in MVP: return `NIL`.
- Method selection on non-symbol messages: allow numbers/strings/lists as selectors? MVP focuses on backticked symbol keys; others can be matched by user code.
- Capsule metadata: MVP stores only (locals + code pointer). If future metadata is needed, reserve leading slots before the code pointer.

## Implementation Steps
1. Parser lowering for `methods { … }` in `src/lang/parser.ts`:
   - Emit `makeCapsuleOp` at `methods` site and an `Exit` to return the capsule.
   - Compile the block after `methods` into the reentry dispatcher and method bodies.
2. Builtins in `src/ops/builtins.ts`:
   - Add `makeCapsuleOp` (internal) and `dispatchOp` (public `dispatch`).
   - Use existing helpers: `resolveReference`, list copy/read/write, frame prologue/epilogue.
3. VM/frame helpers (if needed): small utilities to copy frames to/from STACK while preserving invariants.
4. Tests (behavioral):
   - Creation: function returning a capsule value; storage in a local; shape = list.
   - Dispatch: symbol match executes method; state persists across calls.
   - Mutation: `+>`/`->` inside methods mutate locals; verify persistence.
   - Safety: invalid `dispatch` inputs throw; unmatched message returns `NIL`.
5. Bench: optional micro-benchmark for dispatch vs normal call/return (`scripts/bench-call-return.ts`).

## Risks & Mitigations
- Frame corruption: rely on existing `stack-frames.md` invariants; validate BP/RSP bounds in epilogues.
- Aliasing bugs: always write back a fresh capsule list (no external alias to internals).
- Control-flow complexity: keep dispatcher linear with simple compares + jumps.

## Success Criteria
- Capsuled functions round-trip: create, dispatch, mutate, and return results deterministically.
- All existing tests pass; new capsule tests cover creation, dispatch, mutation, and errors.
- No regressions to list/ref/local semantics; coverage stays within thresholds.

## Backout Plan
- Guard new code paths behind minimal surface area (two builtins + parser lowering).
- Revert additions if needed; core lists/locals/vm remain untouched.

## References
- `docs/specs/capsules.md` — Capsule specification
- `docs/specs/core-invariants.md` — Invariants and patterns
- `docs/specs/local-vars.md` — Locals/frames and assignment rules
- `docs/specs/vm-architecture.md` — Segments and unified dispatch
- `docs/reference/known-issues.md` — Error policy notes
