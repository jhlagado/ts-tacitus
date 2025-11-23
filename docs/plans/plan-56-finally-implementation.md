# Plan 56: Finally Implementation (per `docs/specs/finally.md`)

This plan is intentionally detailed (≈200 lines) to remove ambiguity and make implementation traceable to the spec.

## 0. Grounding
- Re-read `docs/specs/finally.md` to align on registers (`err`, `inFinally`), opcode names (`setErr`, `setInFinally`, `exit` family), wrapper rebinding, two-stage locals, and X1516 extended opcodes.
- Assumptions: `err` is numeric (0/1) for now; cleanup cannot see body locals; extended opcode infra (X1516) already works.

## 1. VM State Additions (`src/core/vm.ts`)
1.1 Add fields to VM shape: `err: number`, `inFinally: boolean`.
1.2 Initialize to `0`/`false` inside `createVM`.
1.3 Reset in any VM reuse/cache helpers used by tests (search for VM pooling).
1.4 Ensure TypeScript typings export these fields everywhere VM is referenced.

## 2. Exit-Family Adjustments (clear `inFinally`)
2.1 In `src/ops/core/core-ops.ts`:
   - `exitOp`: set `vm.inFinally = false` before restoring IP/BP.
2.2 In `src/ops/builtins.ts`:
   - `exitConstructorOp`, `exitDispatchOp`: also clear `vm.inFinally` before return.
2.3 In `src/ops/capsules/capsule-ops.ts`:
   - `exitCapsuleOp` (or equivalent): clear `vm.inFinally`.
2.4 Re-run grep for `Exit`-like verbs to ensure no variant is missed (aliases or wrappers).

## 3. New Opcodes (`SetErr`, `SetInFinally`)
3.1 Enum: add to `src/ops/opcodes.ts` at next free opcode values; keep naming consistent (PascalCase).
3.2 Implement verbs in `src/ops/core/core-ops.ts`:
   - `setErrOp(vm)`: ensureStackSize(1); `vm.err = pop(vm);`.
   - `setInFinallyOp(vm)`: `vm.inFinally = true;` (no stack effect).
3.3 Register in dispatch table `src/ops/builtins.ts`: map `Op.SetErr` → `setErrOp`; `Op.SetInFinally` → `setInFinallyOp`.
3.4 Confirm no name collision with existing words; add to any exported lists if required.

## 4. Dictionary Payload Rebinding Helper
4.1 Add `updateDictEntryPayload(vm, entryCellIndex, newPayloadTagged)` in `src/core/dictionary.ts`.
4.2 Implementation details:
   - Validate `entryCellIndex != 0`.
   - Validate `newPayloadTagged` has Tag.CODE (and expected meta, e.g., 0/1).
   - Write into payload slot via existing memory helpers.
4.3 Export helper; add unit test if feasible (or cover via finally tests).
4.4 Note: callers may have cached pre-wrapper addresses; behavior is “cleanup bypass” (documented risk).

## 5. Interpreter Dispatch (err-driven unwind)
5.1 File: `src/lang/interpreter.ts`.
5.2 After `nextOpcode` decoding (where opcode/index is known):
   - If `vm.err != 0 && !vm.inFinally`:
     * If opcode == `Op.SetInFinally`: execute it (so cleanup can start); continue main loop.
     * Else: unwind one frame:
       - If return stack lacks two cells (IP/BP), halt: `vm.running = false;` propagate/retain err.
       - Restore BP/IP from return stack (match existing frame layout: BP stored relative to `RSTACK_BASE`).
       - Loop without executing the skipped opcode.
   - Else: normal execution path.
5.3 Ensure logic works for extended opcodes (X1516). `nextOpcode` already resolves the opcode; comparisons use resolved opcode value.
5.4 Add tests to verify skip semantics and halt-at-top behavior.

## 6. Register the `finally` Immediate
6.1 Add the `finally` word (immediate) to `src/ops/builtins-register.ts` (or relevant bootstrap file).
6.2 Point it to the new lowering function (see Section 7).

## 7. Compiler: `finally` Lowering (two-phase)

### 7A. Preparation
7A.1 Locate current immediates handling (`lang/parser.ts` or helpers). Identify where other immediates are wired (e.g., `;`).
7A.2 Ensure access to current function metadata: body entry address, defEntryCell, branch prologue positions, defCheckpoint, localCount, reservePatchAddr, hidden dictionary head.

### 7B. On Seeing `finally` in a Colon Definition
7B.1 Preconditions: inside a colon definition; tokenizer points at `finally`.
7B.2 Actions (body close):
   - Emit `Op.Exit` to close body.
   - If `reservePatchAddr != -1`, patch it with current `localCount`.
   - Forget body locals using the definition checkpoint (`defCheckpoint` or equivalent).
   - Reset local bookkeeping: `localCount = 0`, `reservePatchAddr = -1`.
7B.3 Capture body entry address for wrapper call (the hidden dictionary entry currently points to it; may also store from compile pointer/branch).

### 7C. Start Wrapper `<name>finally>`
7C.1 Preserve colon prologue/hide-branch behavior (the initial branch used to hide definition remains; the wrapper uses the same mechanism).
7C.2 Dictionary: continue using the same entry; do not create a new entry; will rebind payload later.
7C.3 Wrapper codegen order:
   1) On first cleanup local, emit `Op.Reserve` (fresh reservePatchAddr for wrapper locals).
   2) Emit X1516 call to body entry (compiler helper exists: `emitUserWordCall` / `compilerCompileUserWordCall`).
   3) Emit `Op.SetInFinally`.
   4) Compile remaining tokens as cleanup.
   5) End with `Op.Exit`.
7C.4 Wrapper locals: maintain separate `localCount` and reservePatchAddr; patch at `;`.

### 7D. At `;` (end of wrapper)
7D.1 Patch wrapper `Reserve` with wrapper `localCount` (if emitted).
7D.2 Forget wrapper locals (new checkpoint inside wrapper).
7D.3 Rebind dictionary entry payload to wrapper address using helper from Section 4.
7D.4 Ensure recursion/self-reference (`recurse`) emits wrapper address, not body address.

### 7E. Locals Separation
7E.1 Body locals are inaccessible in cleanup: two independent reserve/patch/forget cycles.
7E.2 Cleanup locals live only in wrapper frame; body `call` creates/destroys its frame before cleanup runs.
7E.3 Document this in code comments and tests.

## 8. Testing Strategy (TDD-first)

### 8A. Compiler Emission Tests
8A.1 Function with body locals and cleanup locals: assert two `Reserve` placeholders patched separately; body `exit`; wrapper prologue order (call → setInFinally), cleanup `exit`.
8A.2 Function without cleanup locals: wrapper has no `Reserve`; prologue still call → setInFinally.
8A.3 Recursive function with `finally`: `recurse` should target wrapper address.

### 8B. VM Dispatch / Runtime Tests
8B.1 Err-driven skipping: set `err` manually, ensure arbitrary opcode is skipped, `SetInFinally` executes.
8B.2 Unwind to top: when `err != 0` and no more frames, VM halts, `err` preserved.
8B.3 Exit clearing: all exit variants clear `inFinally`.
8B.4 Extended opcode path: X1516 call works with `setInFinally` following.

### 8C. Scenario Tests
8C.1 Happy path: body completes, cleanup runs, `err` stays 0.
8C.2 Error in body: `err` set, unwinds to nearest finally, runs cleanup under `inFinally=true`, `err` preserved.
8C.3 Error in cleanup: cleanup aborts, `err` preserved (original), `inFinally` cleared on exit.
8C.4 Nested finally: verify flag toggling false→true→false across nested wrappers and correct unwind order.
8C.5 Rebinding: lookup of the function name yields wrapper address; a captured pre-wrapper address bypasses cleanup (documented).
8C.6 Cleanup locals: ensure body locals are inaccessible; wrapper locals are allocated/patched independently.

### 8D. Dictionary Helper Tests
8D.1 Payload update writes Tag.CODE with X1516 address; rejects bad tags.
8D.2 Optional: update only current head entry; failing otherwise.

## 9. Integration and Coverage
9.1 Run full test suite after each major phase (VM changes, opcode additions, compiler changes).
9.2 Add coverage-focused tests around err-driven branches and exit clearing to keep honest branch %.
9.3 Verify no Istanbul ignores or shortcuts; coverage uplift should be organic.

## 10. Implementation Order (suggested)
10.1 Add VM fields + initialize/reset; adjust exit-family to clear `inFinally`; add opcodes and dispatch registrations.  
10.2 Implement interpreter err-driven dispatch logic; add runtime tests for skipping/unwind/halting.  
10.3 Add dictionary payload update helper; add small unit test if feasible.  
10.4 Wire `finally` immediate registration; implement compiler lowering (two-phase locals, wrapper prologue order, rebinding); add emission tests.  
10.5 Add scenario tests (happy/error/nested/locals isolation/rebinding).  
10.6 Full suite + coverage review; tidy docs only if code diverges from spec.

## 11. Notes / Risks
- Cached body pointers bypass cleanup: acceptable per spec; call out in tests/docs.
- Err currently numeric; future work may store tagged error values once safe.
- Ensure frame layout assumptions (BP relative to RSTACK_BASE) are consistent when unwinding on err.
- Keep colon prologue/hide-branch intact; omission in examples is for clarity only.

