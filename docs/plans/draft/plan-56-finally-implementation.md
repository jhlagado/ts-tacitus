# Plan 56: Finally Implementation (per `docs/specs/finally.md`)

## Steps to Implement
1) **Spec alignment**  
   - Re-read `docs/specs/finally.md`; mirror register names (`err`, `inFinally`) and opcode names (`setErr`, `setInFinally`, `exit`, X1516 call). Keep casing consistent.
2) **VM registers and dispatch**  
   - Add `err` (0/1 for now) and `inFinally` fields to the VM state.  
   - Change the interpreter dispatch loop: when `err != 0` and `inFinally == false`, skip opcodes except `setInFinally`; unwind frames until a wrapper or top (halt with `err`). When `inFinally == true`, execute normally. Ensure `exit`/`exitCapsule` clear `inFinally`.
3) **Opcode semantics**  
   - Implement/confirm `setErr` (pop to `err`) and `setInFinally` (set flag).  
   - Ensure extended opcode decoding (X1516, bit7 set) is used for wrapper calls—no new opcode shape required.
4) **Dictionary handling**  
   - Keep entry shape as in spec: `name` (meta for hidden/immediate), `payload` (Tag.CODE + X1516 address), `prevRef`.  
   - Support in-place rebinding of `payload` to the wrapper address after compilation.
5) **Compiler: `finally` immediate**  
   - During a colon definition: emit body until `finally`; close with `exit`. Patch the body `Reserve` with current `localCount`, forget body locals, and reset local bookkeeping (including `localCount` and reserve patch addr) to 0.  
   - Start wrapper `<name>finally>`: emit a new `Reserve` if cleanup declares locals; emit X1516 call to body entry, then `setInFinally`, then compile remaining tokens as cleanup, ending with `exit`. Patch the wrapper `Reserve` at `;` and forget wrapper locals.  
   - Rebind the existing dictionary entry to the wrapper address; ensure recursion uses wrapper address. No code executes at compile time.  
   - Locals are **not shared** across the boundary: two independent reserves/patch/forget cycles (body, then wrapper).
6) **Testing (TDD)**  
   - Add compiler-emission tests: ensure `finally` produces body `exit`, wrapper prologue (X1516 call → `setInFinally`), and cleanup `exit`.  
   - VM tests: err-driven dispatch (skips until `setInFinally`), exit clears `inFinally`, `setErr`/`setInFinally` effects, extended opcode call path.  
   - Scenario tests: normal path runs cleanup; error path unwinds to nearest finally; nested finally order; redefining a word with finally updates dictionary payload.  
7) **Integration/coverage**  
   - Run full test suite; add targeted coverage for new control flow to keep branch % honest.  
   - Update doc cross-references only if implementation diverges from `docs/specs/finally.md`.
