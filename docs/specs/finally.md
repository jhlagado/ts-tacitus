Understood — you want a full restoration of the **original document’s depth and structure**, but now incorporating the **boolean `IN_FINALLY` model**, **`ERR` semantics**, and **wrapper rebinding** approach, while preserving the tone and completeness of your formal specs.
Here’s a fully expanded and internally consistent version:

---

# Specification: Finally Block Compilation via Wrapper Rebinding

> **⚠️ STATUS: NOT YET IMPLEMENTED**  
> This specification describes a planned feature that has not been implemented in the current codebase.  
> The `ERR` and `IN_FINALLY` registers, wrapper rebinding compilation, and `finally` keyword handling are not present in the source code.  
> This document is preserved for future implementation reference.

---

### 1. Purpose

The `finally` construct provides a structured cleanup phase that is guaranteed to execute when a function exits — whether through normal completion, explicit return, or an error condition.
It formalizes deterministic cleanup in Tacit without introducing new stack frame fields or dedicated control registers.

This design achieves **structured error recovery and resource release** through **compile-time transformation** rather than runtime bookkeeping.
All semantics are realized through generated wrapper functions and two VM-level registers: `ERR` and `IN_FINALLY`.

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

The Tacit VM maintains two registers to coordinate errors and cleanup execution. `ERR` starts as `NIL`; once set to a non-`NIL` value it is carried all the way to the top of the call stack unless a cleanup block explicitly clears it as part of an intentional recovery strategy.

| Register     | Type         | Purpose                                                                            |
| ------------ | ------------ | ---------------------------------------------------------------------------------- |
| `ERR`        | Tagged value | Holds the current error sentinel or `NIL` when no error is active.                 |
| `IN_FINALLY` | Boolean      | Indicates whether the interpreter is currently executing within a `finally` block. |

No additional frame fields or pointers are introduced; all behavior is expressed in terms of existing call and return flow.

#### 3.1 Normal Execution

* The VM executes instructions while `ERR == NIL`.
* Function calls and returns behave as standard, pushing and popping return addresses normally.

#### 3.2 Error Event

When an operation sets `ERR` to a non-`NIL` value the interpreter performs a structured unwind:

1. The active opcode completes without executing any further body code.
2. Control returns to the most recent caller.
3. If that caller is a `finally` wrapper, the dispatcher sets `IN_FINALLY := true`, jumps to the cleanup block, and continues executing instructions even though `ERR` remains set.
4. If there is no wrapper, the interpreter continues unwinding until it either finds one or reaches the top-level loop.

#### 3.3 Inside Cleanup

* While `IN_FINALLY == true`, bytecodes execute as normal, even if `ERR` remains non-`NIL`.
* The cleanup phase runs deterministically; it is not skipped or suppressed by the active error condition.
* Any `exit`-family instruction clears `IN_FINALLY` before returning.

#### 3.4 Error Inside Cleanup

If cleanup itself raises an error while `IN_FINALLY` is true:

1. The interpreter clears `IN_FINALLY` immediately.
2. Control returns to the next caller in the stack (skipping the remainder of the current cleanup block).
3. `ERR` keeps its previous non-`NIL` value unless the cleanup block explicitly overwrote it before the failure. In other words, cleanup errors do not hide the original failure; they simply short-circuit any remaining cleanup at that level.

This ensures error propagation continues upward without recursion or infinite unwinding.

#### 3.5 Top-Level Error

* If control reaches the top of the call stack with `ERR` still non-`NIL`, the VM halts with that error condition.
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
   * A new internal function definition begins automatically, with the name `<name>finally>`.
   * The compiler emits a single `call <name>` instruction at the start of this new function.
     This ensures the original implementation executes before cleanup.

4. **Cleanup Emission:**
   The code following `finally` is emitted as the cleanup sequence, ending with a terminal `exit`.

5. **Dictionary Rebinding:**
   Once both parts are emitted:

   * The compiler rewrites the `payload` field of the dictionary entry for `name` to point to `<name>finally>`.
   * The `<name>` body remains in memory but is not directly callable by user code.
   * No new dictionary entry is created; this is an **in-place rebinding** of the existing entry.

This process adds zero runtime overhead and ensures that `finally` functions are indistinguishable from ordinary functions at call time.

---

### 5. Dictionary Representation

Each function definition in Tacit is represented by a standard dictionary entry:

| Field     | Description                            |
| --------- | -------------------------------------- |
| `flags`   | Marks this entry as `CODE`.            |
| `payload` | Address of the compiled entry point.   |
| `name`    | Interned `STRING` symbol.              |
| `prev`    | Link to the previous dictionary entry. |

After compilation with `finally`, the payload is replaced:

| Field     | Before `finally` | After `finally`  |
| --------- | ---------------- | ---------------- |
| `payload` | `<func1>`        | `<func1finally>` |

The rebinding occurs immediately after the cleanup code is emitted, requiring no runtime indirection.
> **Note:** Any code that captured the original body pointer before rebinding will continue to bypass the wrapper. Implementations that rely on cleanup semantics must avoid caching the pre-wrapper address (or must refresh those references after compilation).

---

### 6. Cleanup and Error Interaction

Tacit’s runtime cleanup behavior is defined entirely by two global conditions:

| State                                | Description          | Effect                                                    |
| ------------------------------------ | -------------------- | --------------------------------------------------------- |
| `ERR == NIL`                         | Normal execution     | Instructions execute normally                             |
| `ERR != NIL and IN_FINALLY == false` | Error in body        | Function returns immediately to caller                    |
| `ERR != NIL and IN_FINALLY == true`  | Error inside cleanup | Clear `IN_FINALLY`, return immediately, keep existing `ERR` |
| `ERR == NIL and IN_FINALLY == true`  | Normal cleanup       | Cleanup continues to completion, then resets `IN_FINALLY` |

Exit instructions (`exit`, `exitDef`, `exitCapsule`, etc.) always clear `IN_FINALLY` before returning.

This makes cleanup behavior both predictable and idempotent: `IN_FINALLY` never leaks beyond the block that set it, and normal exit instructions always restore the flag to `false`.

---

### 7. Termination vs. Recovery

By default the `ERR` register propagates to the top of the stack: the VM exits with failure after all applicable cleanup blocks have run. Cleanup code is free to inspect `ERR` (for logging, telemetry, etc.), but it should leave the value untouched unless it deliberately intends to convert the failure into a success. Any cleanup that wishes to recover must explicitly set `ERR := NIL` before returning; this is an advanced pattern and is documented separately in Appendix A.

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
3. After its cleanup, `IN_FINALLY` is reset.
4. Control returns to `func2` or its wrapper, which may itself enter its cleanup.

This pattern allows arbitrary nesting of cleanup sequences with no new data structures.

---

### 9. Error Propagation and Consistency

Errors propagate upward through the call chain until all wrappers have executed.
Each wrapper guarantees that:

* Cleanup runs exactly once per function invocation.
* Errors during cleanup replace prior ones.
* The call chain terminates when no further wrappers exist.

This establishes **flat, composable unwinding semantics** — a single active error state, deterministic propagation, and total cleanup coverage.

---

### 10. Implementation Invariants

To ensure correctness, the following invariants hold:

1. `ERR` is either `NIL` or a tagged error value; never uninitialized.
2. `IN_FINALLY` is always false outside cleanup; cleanup code must explicitly clear it.
3. All `exit` instructions enforce `IN_FINALLY := false`.
4. Every dictionary entry for a `finally`-wrapped function points to the wrapper, not the body.
5. Cleanup code is always tail-positioned in the wrapper; no code follows the final `exit`.
6. Nested finally wrappers do not share `IN_FINALLY` scope — each toggles it independently.

---

### 11. Verification Strategy

To ensure the implementation matches this specification, the following test coverage is required:

- **Wrapper rebinding:** unit tests that confirm a function defined with `finally` invokes the wrapper and that direct invocations of the body are no longer reachable through the dictionary.
- **Single-level cleanup:** cases where the body succeeds, fails, and the cleanup runs without mutating `ERR`.
- **Nested wrappers:** scenarios where an inner `finally` fails and the outer cleanup still executes, verifying `IN_FINALLY` transitions.
- **Cleanup failure:** tests that throw inside `finally` and ensure the original `ERR` persists while the cleanup aborts.
- **Termination propagation:** integration tests that let `ERR` reach the top of the stack so the VM halts with the flagged error.
- **Optional recovery (if used):** demonstrations that a cleanup can clear `ERR` intentionally and that this restores normal execution.

### 12. Advantages

* **Zero new stack fields:** No per-frame pointers or unwind tables.
* **Boolean simplicity:** A single `IN_FINALLY` flag suffices for all cleanup tracking.
* **Deterministic execution:** Cleanup runs on every exit path, error or not.
* **Error replacement model:** New errors overwrite old, preventing recursive cascades.
* **Compile-time enforcement:** Entirely resolved during definition, no runtime patching.
* **Stack consistency:** Works with standard call/return discipline and error unwinding.
* **Dictionary transparency:** Achieved with a simple payload rebind, preserving uniform entry format.

---

### 13. Summary

---

## Appendix A — Optional Recovery Patterns

Occasionally a `finally` block may need to suppress an error (for example, when retry logic or local compensation succeeds). Such code must explicitly clear `ERR` to signal success before returning. Implementers should document these cases carefully and include tests that cover both the failing and recovering paths so that the altered control flow remains intentional.

The `finally` mechanism in Tacit is a **compile-time structural rewrite** combined with a minimal **runtime error model**.
By generating a wrapper that encloses the original function, rewiring its dictionary entry, and coordinating error flow via the `ERR` and `IN_FINALLY` registers, Tacit achieves:

* Reliable, reentrant cleanup
* No runtime instrumentation or heap structures
* Deterministic error propagation
* Clean nesting and composable semantics

This design aligns with Tacit’s philosophy:
**compile-time structure, runtime simplicity, and fully deterministic control flow.**

---
