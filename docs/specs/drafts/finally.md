Understood — you want a full restoration of the **original document’s depth and structure**, but now incorporating the **boolean `inFinally` model**, **`err` semantics**, and **wrapper rebinding** approach, while preserving the tone and completeness of your formal specs.
Here’s a fully expanded and internally consistent version:

---

# Specification: Finally Block Compilation via Wrapper Rebinding

> **⚠️ STATUS: NOT YET IMPLEMENTED**  
> This specification describes a planned feature that has not been implemented in the current codebase.  
> The `err` and `inFinally` registers, wrapper rebinding compilation, and `finally` keyword handling are not present in the source code.  
> This document is preserved for future implementation reference.

---

### 1. Purpose

The `finally` construct provides a structured cleanup phase that is guaranteed to execute when a function exits — whether through normal completion, explicit return, or an error condition.
It formalizes deterministic cleanup in Tacit without introducing new stack frame fields or dedicated control registers.

This design achieves **structured error recovery and resource release** through **compile-time transformation** rather than runtime bookkeeping.
All semantics are realized through generated wrapper functions and two VM-level registers: `err` and `inFinally` (lower camelCase).

---

### 2. Conceptual Overview

Tacit’s `finally` mechanism is not a runtime feature but a **compile-time rewrite**.
A function that declares a `finally` section is split into two separately compiled components:

```
: func1
   ...function code...
   finally
   ...cleanup code...
;
```

is transformed internally into:

```
<func1>         ; function body
  ...function code...
  exit

<func1finally>  ; wrapper definition
  call func1
  ...cleanup code...
  exit
```

The compiler then **rewires the dictionary entry** for `func1` so that its payload points to `<func1finally>`.
From this point forward, calling `func1` executes the wrapper, which always runs the cleanup sequence after the original body exits.

This guarantees cleanup execution *on every exit path* — whether by normal return, explicit `exit`, or error propagation — using standard VM call semantics.

---

### 3. Runtime Model

The Tacit VM maintains two registers to coordinate errors and cleanup execution. `err` currently behaves as a boolean (0 = no error, 1 = error); once set to 1 it is carried all the way to the top of the call stack unless a cleanup block explicitly clears it as part of an intentional recovery strategy. A future iteration may allow `err` to hold a tagged error value (e.g., an error message) once storing non-numeric tagged values in registers is proven safe.

| Register     | Type         | Purpose                                                                            |
| ------------ | ------------ | ---------------------------------------------------------------------------------- |
| `err`        | Number (boolean for now) | Holds 0 (no error) or 1 (error active). Future: tagged error payload.       |
| `inFinally`  | Boolean      | Indicates whether the interpreter is currently executing within a `finally` block. |

**New opcodes (reserved names):**
- `SetErr` (`setErrOp`): pops one value, writes it into `vm.err`.
- `SetInFinally` (`setInFinallyOp`): sets `vm.inFinally = true` (no stack effect).

No additional frame fields or pointers are introduced; all behavior is expressed in terms of existing call and return flow.

#### 3.1 Normal Execution

* The VM executes instructions while `err == 0`.
* Function calls and returns behave as standard, pushing and popping return addresses normally.

#### 3.2 Error Event

When an operation sets `err` to a non-zero value the interpreter performs a structured unwind:

1. The active opcode completes without executing any further body code.
2. Control returns to the most recent caller.
3. If that caller is a `finally` wrapper, the dispatcher sets `inFinally := true`, jumps to the cleanup block, and continues executing instructions even though `err` remains set.
4. If there is no wrapper, the interpreter continues unwinding until it either finds one or reaches the top-level loop.

#### 3.2.1 Unwind Execution Rules (`err != 0`)

While `err != 0` and `inFinally == false`:
- Skip all opcodes except:
  - `SetInFinally` (allowed so cleanup can start)
  - Exit-family ops that restore a caller frame (these clear `inFinally` when used inside cleanup, and restore IP/BP from the return stack)
- Each skipped opcode advances control by unwinding one frame: restore IP/BP from return stack; if the stack is exhausted, halt with `err` preserved.
- No other opcode executes until `inFinally` becomes true.

While `err != 0` and `inFinally == true` (during cleanup):
- Execute opcodes normally; cleanup code runs even with active error.
- Exit-family opcodes clear `inFinally` before returning.

Return epilogue (exit-family, as implemented by `exitOp`):
- Require at least two cells on the return stack; if not, stop (`vm.running = false`).
- Guard against corruption: if `bp` is outside the current return-stack depth, throw underflow.
- Set `rsp = bp` (bp is absolute cells).
- Pop saved BP (stored as relative cells) → add `RSTACK_BASE` → restore `bp`.
- Pop return address → restore `ip`.
- Clear `inFinally` as part of exit-family behavior.
No additional fields are touched.

`err` payload: only the non-error value is defined (0). A future revision may store `NIL` or tagged error data when safety is validated; current implementations must treat any non-zero as “error active” without assuming a specific payload format.

#### 3.3 Inside Cleanup

* While `inFinally == true`, bytecodes execute as normal, even if `err` remains non-zero.
* The cleanup phase runs deterministically; it is not skipped or suppressed by the active error condition.
* Any `exit`-family instruction clears `inFinally` before returning.

#### 3.4 Error Inside Cleanup

If cleanup itself raises an error while `inFinally` is true:

1. The interpreter clears `inFinally` immediately.
2. Control returns to the next caller in the stack (skipping the remainder of the current cleanup block).
3. `err` keeps its previous non-zero value unless the cleanup block explicitly overwrote it before the failure. In other words, cleanup errors do not hide the original failure; they simply short-circuit any remaining cleanup at that level.

This ensures error propagation continues upward without recursion or infinite unwinding.

#### 3.5 Top-Level Error

* If control reaches the top of the call stack with `err` still non-zero, the VM halts with that error condition.
* Host or REPL policy determines whether this results in a printed error, crash, or recovery prompt.

---

### 4. Compilation Process

The `finally` construct is handled entirely by the compiler as a **post-definition transformation**.

1. **Function Start:**
   When `: name` is encountered, the compiler records the function’s entry address in the code segment.

2. **Body Emission:**
   The function body is emitted as normal until `finally` is seen.

3. **Boundary Handling:**
   When `finally` appears:

   * The compiler closes the current function with an explicit `exit`.
   * Patch the body’s `Reserve` placeholder with the current `localCount`, `forget` the body locals, and reset `localCount` (and compiler local bookkeeping) to 0 so the wrapper can have its own locals.
   * A new internal function definition begins automatically, with the name `<name>finally>`.
   * **Alignment:** Before encoding any CODE reference with X1516, the compiler must align the target entry to `CODE_ALIGN_BYTES` (currently 8). The normal body entry is already aligned by colon-definition padding; the cleanup wrapper entry must also be aligned just before it is emitted so its address can be encoded legally.
   * The compiler emits an extended-opcode call (X1516) to the original body entry at the start of this new function (bit 7 set on the first opcode byte, encoding a 15-bit target). This preserves the normal call/return frame semantics without introducing a new opcode shape.
   * The compiler emits `setInFinally` **after** the call so only the cleanup portion runs with `inFinally` set. Body execution itself does not need the flag.

   The `finally` immediate word performs only these compile-time actions: it seals the body, starts the wrapper, emits the X1516 call plus `setInFinally`, and resumes emitting the remaining source as cleanup. It does **not** execute any code at compile time.

4. **Cleanup Emission:**
   The code following `finally` is emitted as the cleanup sequence, ending with a terminal `exit`. A new `Reserve` is emitted for cleanup locals (if any); at the final `;`, that reserve is patched and those locals are forgotten. Locals are not shared across the boundary: the body’s locals live in the body frame; cleanup locals live in the wrapper frame. Cleanup cannot see body locals.

5. **Dictionary Rebinding:**
   Once both parts are emitted:

   * The compiler rewrites the `payload` field of the dictionary entry for `name` to point to `<name>finally>`.
   * The `<name>` body remains in memory but is not directly callable by user code.
   * No new dictionary entry is created; this is an **in-place rebinding** of the existing entry.

This process adds zero runtime overhead and ensures that `finally` functions are indistinguishable from ordinary functions at call time.
Because it rewrites the active dictionary entry, `finally` is a privileged transform: it can change what callers bind to without altering call sites or introducing new symbols.

### 4.1 Example Bytecode Layout (wrapper rebinding)

For the source:

```
: foo
  A B C
  var x          \ body local
 finally
  var y          \ cleanup local
  cleanup1 cleanup2
;
```

the compiler emits the following structure (addresses illustrative):

```
; Body section (with its own locals table)
0000: Reserve <bodySlots>     ; emitted when first local appears in body (here 1 slot for x)
0003: ...A B C bytecode...
00NN: InitVar 0               ; x init/store as compiled code
00NN+3: Exit                  ; terminate body and tear down body frame

; Wrapper section (its own locals table for cleanup locals)
00NN+4: foo_body              ; extended opcode: call to original body (bit7=1 on first byte)
00NN+7: setInFinally         ; inFinally := true (cleanup executes under this flag)
00NN+8: Reserve <wrapSlots>   ; emitted when first cleanup local appears (here 1 slot for y)
00NN+11: InitVar 0            ; y init/store as compiled code
00NN+14: cleanup1 bytecode
...   : cleanup2 bytecode (may include init/store for wrapper locals)
00MM: Exit                    ; clears inFinally and returns to caller
```

After emitting the wrapper, the compiler rebinds the dictionary entry for `foo` so its payload points at `00NN+1`. Because colon definitions are hidden until `;`, no call sites exist until the wrapper address is final; explicit recursion will require a dedicated helper that emits the wrapper address.

> Extended opcodes: The wrapper’s call to the original body uses the X1516 extended opcode format (bit7 set on the first opcode byte) to encode the 15-bit target address without introducing a new opcode shape.
> Colon definitions still begin with a short branch to hide the in-progress definition; it is omitted from this layout for clarity because it does not affect `finally` mechanics.
> **Alignment note:** Both `foo_body` and the wrapper entry must be aligned to `CODE_ALIGN_BYTES` (currently 8) so their X1516 references are valid. The compiler pads with NOPs before each entry to satisfy this; the branch offsets used to hide the definition must account for the padding when patched. A simple rule: patch the skip offset to `currentCP - (branchPos + 2)` **after** any NOP padding is emitted so the skip jumps over padding plus body.

---

### 5. Dictionary Representation

Each function definition in Tacit is represented by a standard dictionary entry:

| Field     | Description                                                                          |
| ----------| ------------------------------------------------------------------------------------ |
| `name`    | Interned `STRING` symbol (meta bit used to mark hidden entries during compilation).  |
| `payload` | Tagged value for the word body (typically `Tag.CODE` with an X1516-encoded address). |
| `prevRef` | `Tag.REF` to the previous entry header (or `NIL`), forming the linked list.          |

Notes:
- Hidden status is derived from the name’s meta bit (`true` when hidden, e.g., during active definition).
- Payload tag is always `Tag.CODE`; meta bit may indicate immediates (meta = 1) for compile-time execution.

After compilation with `finally`, the payload is replaced:

| Field     | Before `finally` | After `finally`  |
| --------- | ---------------- | ---------------- |
| `payload` | `<func1>`        | `<func1finally>` |

The rebinding occurs immediately after the cleanup code is emitted, requiring no runtime indirection.
> **Note:** Any code that captured the original body pointer before rebinding will continue to bypass the wrapper. Implementations that rely on cleanup semantics must avoid caching the pre-wrapper address (or must refresh those references after compilation).

---

### 5.5 Opcode Summary

| Opcode            | Stack effect  | Description                                                                                |
|-------------------|---------------|--------------------------------------------------------------------------------------------|
| `setErr`          | `( value -- )`| Pops a value and stores it in `err` (0 or 1 for now). Does not alter `inFinally`.          |
| `setInFinally`    | `( -- )`      | Sets `inFinally := true`. Intended for compiler-emitted wrapper prologues (after body call).|
| `exit`            | `( -- )`      | Existing opcode; additionally clears `inFinally` before returning.                         |
| `exitCapsule`     | `( -- )`      | Existing opcode; additionally clears `inFinally` before returning.                         |
| `call` (extended) | existing      | Reused in wrappers via X1516 extended opcode to invoke the original body.                   |

### 5.6 Error-driven dispatch (non-zero err)

When `err` is non-zero, dispatch behaves as follows:

1. If `inFinally` is true, execute the next opcode normally (cleanup continues even under error).
2. If `inFinally` is false:
   * If the next opcode is `setInFinally`, execute it to enter cleanup and continue executing the wrapper’s cleanup code.
   * Otherwise, skip the opcode and perform a forced return: pop caller IP/BP from the return stack, restore BP, set IP to caller, and repeat this check. If the return stack is empty, halt with the active `err`.
3. Any `exit`-family opcode clears `inFinally` on return.

This makes `finally` optional: if no wrapper is on the stack, the VM keeps returning until it either finds a `setInFinally` in a wrapper or reaches the top (halting with `err`).

All other opcodes must respect the unwind rule defined in §6.

---

### 6. Cleanup and Error Interaction

After every opcode executes the interpreter performs the following check:

1. If `err == 0`, dispatch continues normally.
2. If `err != 0` and `inFinally == true`, dispatch continues until the cleanup block finishes (or raises another error).
3. If `err != 0` and `inFinally == false`, the interpreter stops executing further instructions in the current frame, pops frames until it encounters a wrapper, sets `inFinally := true`, and resumes execution at that wrapper’s cleanup entry. If no wrapper remains, unwinding continues to the top-level where the VM terminates with the recorded error.

The runtime conditions below summarise the possible states:

| State                                | Description          | Effect                                                    |
| ------------------------------------ | -------------------- | --------------------------------------------------------- |
| `err == 0`                           | Normal execution     | Instructions execute normally                             |
| `err != 0 and inFinally == false`    | Error in body        | Function returns immediately to caller                    |
| `err != 0 and inFinally == true`     | Error inside cleanup | Clear `inFinally`, return immediately, keep existing `err` |
| `err == 0 and inFinally == true`     | Normal cleanup       | Cleanup continues to completion, then resets `inFinally`  |

Exit instructions (`exit`, `exitCapsule`) always clear `inFinally` before returning.

This makes cleanup behavior both predictable and idempotent: `inFinally` never leaks beyond the block that set it, and normal exit instructions always restore the flag to `false`.

---

### 7. Termination vs. Recovery

By default the `err` register propagates to the top of the stack: the VM exits with failure after all applicable cleanup blocks have run. Cleanup code is free to inspect `err` (for logging, telemetry, etc.), but it should leave the value untouched unless it deliberately intends to convert the failure into a success. Any cleanup that wishes to recover must explicitly set `err := 0` before returning; this is an advanced pattern and is documented separately in Appendix A.

### 8. Nested Finally Wrappers

Each `finally` wrapper acts as an independent frame:

```
func1finally:
   call func1
   ...cleanup 1...
   exit

func2finally:
   call func2
   ...cleanup 2...
   exit
```

If `func2` calls `func1`, the nesting is natural:

1. `func1` executes and fails.
2. Control passes to `func1finally` (inner cleanup).
3. After its cleanup, `inFinally` is reset.
4. Control returns to `func2` or its wrapper, which may itself enter its cleanup.

This pattern allows arbitrary nesting of cleanup sequences with no new data structures.

---

### 9. Error Propagation and Consistency

Errors propagate upward through the call chain until all wrappers have executed.
Each wrapper guarantees that:

* Cleanup runs exactly once per function invocation.
* Errors during cleanup abort the current cleanup but do not overwrite the original `err` value.
* The call chain terminates when no further wrappers exist.

This establishes **flat, composable unwinding semantics** — a single active error state, deterministic propagation, and total cleanup coverage.

---

### 10. Implementation Invariants

To ensure correctness, the following invariants hold:

1. `err` is either 0 or (future) a tagged error value; never uninitialized.
2. `inFinally` is always false outside cleanup; cleanup code must explicitly clear it.
3. All `exit` instructions enforce `inFinally := false`.
4. Every dictionary entry for a `finally`-wrapped function points to the wrapper, not the body.
5. Cleanup code is always tail-positioned in the wrapper; no code follows the final `exit`.
6. Nested finally wrappers do not share `inFinally` scope — each toggles it independently.

---

### 11. Verification Strategy

To ensure the implementation matches this specification, the following coverage is required:

1. **Wrapper rebinding** – compile a function with `finally` and assert that looking it up in the dictionary yields the wrapper address; confirm the body’s address is unreachable via normal lookup.
2. **Body success path** – execute a function whose body completes without setting `err` and confirm cleanup still runs and the return value is preserved.
3. **Body failure path** – execute a function whose body invokes `setErr` and verify that cleanup runs, `inFinally` toggles (`false → true → false`), and the VM ultimately terminates with the recorded error.
4. **Cleanup failure** – force an error inside the cleanup sequence and check that `inFinally` is cleared immediately, remaining cleanup instructions are skipped, and `err` retains the original value.
5. **Nested wrappers** – construct `foo` calling `bar`, each with `finally`, trigger errors at different depths, and ensure the unwind order matches the rules in §6.
6. **Opcode exemptions** – ensure `setInFinally` executes even when `err` is set, while ordinary opcodes abort immediately.
7. **Optional recovery** (if used) – demonstrate a cleanup that sets `err := 0`, restoring normal execution; include a counterpart test showing that omitting this step still terminates.

### 12. Advantages

* **Zero new stack fields:** No per-frame pointers or unwind tables.
* **Boolean simplicity:** A single `inFinally` flag suffices for all cleanup tracking.
* **Deterministic execution:** Cleanup runs on every exit path, error or not.
* **Error replacement model:** New errors overwrite old, preventing recursive cascades.
* **Compile-time enforcement:** Entirely resolved during definition, no runtime patching.
* **Stack consistency:** Works with standard call/return discipline and error unwinding.
* **Dictionary transparency:** Achieved with a simple payload rebind, preserving uniform entry format.

---

### 13. Summary

---

## Appendix A — Optional Recovery Patterns

Occasionally a `finally` block may need to suppress an error (for example, when retry logic or local compensation succeeds). Such code must explicitly clear `err` to signal success before returning. Implementers should document these cases carefully and include tests that cover both the failing and recovering paths so that the altered control flow remains intentional.

The `finally` mechanism in Tacit is a **compile-time structural rewrite** combined with a minimal **runtime error model**.
By generating a wrapper that encloses the original function, rewiring its dictionary entry, and coordinating error flow via the `err` and `inFinally` registers, Tacit achieves:

* Reliable, reentrant cleanup
* No runtime instrumentation or heap structures
* Deterministic error propagation
* Clean nesting and composable semantics

This design aligns with Tacit’s philosophy:
**compile-time structure, runtime simplicity, and fully deterministic control flow.**

---
