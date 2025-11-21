# Plan 56: Finally Implementation (per `docs/specs/finally.md`)

## Steps to Implement
1) **Spec alignment**  
   - Re-read `docs/specs/finally.md`; mirror register names (`err`, `inFinally`) and opcode names (`setErr`, `setInFinally`, `exit`, X1516 call). Keep casing consistent.
2) **VM registers and dispatch**  
   - Add `err: number` (0/1) and `inFinally: boolean` to VM state in `src/core/vm.ts`; init to 0/false in `createVM`, reset in any VM cache helpers.  
   - Modify `lang/interpreter.ts` loop: after `nextOpcode`, if `err != 0 && !inFinally`, skip executing the opcode unless it is `Op.SetInFinally`; otherwise unwind one frame (restore BP/IP from return stack) and repeat; if the return stack is empty, halt with the existing `err`. If `inFinally` is true, run normally.  
   - Ensure every exit-family verb clears `inFinally` before returning: `Exit`, `ExitCapsule`, `ExitConstructor`, `ExitDispatch` (and any aliases).  
3) **Opcode semantics**  
   - Add `Op.SetErr` and `Op.SetInFinally` to `src/ops/opcodes.ts`; implement verbs in `src/ops/core/core-ops.ts` (`setErrOp` pops to `vm.err`; `setInFinallyOp` sets flag).  
   - Register them in `src/ops/builtins.ts` dispatch table. Extended opcode decoding already handles X1516 calls; no new shapes needed.  
4) **Dictionary handling**  
   - Keep entry shape as in spec: `name` (meta for hidden/immediate), `payload` (Tag.CODE + X1516 address), `prevRef`.  
   - Add helper to rebind payload in place (e.g., `updateDictEntryPayload` in `src/core/dictionary.ts`), validating Tag.CODE/meta, and use it after wrapper emission. Note: code that captured the pre-wrapper address will bypass cleanup (documented risk).
5) **Compiler: `finally` immediate**  
   - Locate/implement the `finally` immediate in the parser: when seen inside a colon definition:  
     * Emit body `exit`; patch body `Reserve` with `localCount`; forget body locals; reset `localCount` and reserve patch addr to 0.  
     * Capture body entry address for the wrapper call.  
     * Start wrapper `<name>finally>`: keep the colon prologue/branch; on first cleanup local, emit new `Reserve`; emit X1516 call to body entry; emit `setInFinally`; continue compiling cleanup, ending with `exit`. Patch wrapper reserve at `;` and forget wrapper locals.  
     * Rebind the existing dictionary entry’s payload to the wrapper address; recursion/self-reference should use the wrapper address (e.g., `recurse` emits wrapper address).  
   - Locals are **not shared**: two independent reserve/patch/forget cycles (body then wrapper); cleanup cannot see body locals.  
   - Register `finally` as an immediate word in `builtins-register.ts` so the compiler can see it.
6) **Testing (TDD)**  
   - Add compiler-emission tests: ensure `finally` produces body `exit`, wrapper prologue (X1516 call → `setInFinally`), and cleanup `exit`.  
   - VM tests: err-driven dispatch (skips until `setInFinally`), exit clears `inFinally`, `setErr`/`setInFinally` effects, extended opcode call path.  
   - Scenario tests: normal path runs cleanup; error path unwinds to nearest finally; cleanup that errors stops further cleanup but preserves original `err`; nested finally ordering toggles `inFinally` (false→true→false); `setInFinally` executes even when `err != 0`; redefining a word with finally updates dictionary payload; calling a captured pre-wrapper address bypasses cleanup (intentional/documented).  
7) **Integration/coverage**  
   - Run full test suite; add targeted coverage for new control flow to keep branch % honest.  
   - Update doc cross-references only if implementation diverges from `docs/specs/finally.md`.
