# Specification: Finally Block Compilation via Wrapper Rebinding

### 1. Purpose

The `finally` construct provides a structured cleanup phase that always executes when a function exits — whether it returns normally or terminates due to an error.
This design eliminates the need for a dedicated `FINALLY_PTR` register or runtime state management. Instead, `finally` is implemented entirely at **compile time** by rewriting the function’s entry point to a wrapper function.

---

### 2. Conceptual Model

A function with a `finally` block is compiled into two functions:

```
: func1
   ...function code...
   finally
   ...cleanup code...
;
```

is transformed into two generated definitions:

```
<func1>         ; original function body
  ...function code...
  exit

<func1finally>  ; wrapper function
  call func1    ; invokes the real implementation
  ...cleanup code...
  exit
```

At the end of compilation, the compiler **rewires the dictionary entry for `func1`** so that its `payload` points to `<func1finally>` instead of `<func1>`.
From this point forward, any call to `func1` actually invokes the wrapper.

---

### 3. Execution Semantics

When `func1` is called:

1. The wrapper (`func1finally`) executes.
2. It immediately calls the original implementation (`func1`).
3. When `func1` returns — either normally or with an error — control resumes in the wrapper.
4. The cleanup code in the `finally` section runs unconditionally.
5. The wrapper exits, returning to the caller.

This guarantees that the `finally` block executes deterministically *on every exit path* without any VM intervention or special instructions.

---

### 4. Compilation Process

The compiler handles `finally` as a **post-definition transformation**:

1. When a function definition begins (`: name`), the compiler records its starting address.
2. The function body is emitted normally until a `finally` token is encountered.
3. On encountering `finally`:

   * The current body is terminated with an `exit` instruction.
   * The compiler begins a new function definition internally, named `<name>finally>`.
   * The first emitted instruction in this wrapper is `call <name>`.
4. After emitting the cleanup code and final `exit`, the compiler:

   * Updates the dictionary entry for `name` to point to `<name>finally>`.
   * Marks the original `<name>` definition as internal (not externally visible).
5. The compiler resumes normal parsing.

No special stack adjustments, error flags, or control registers are needed.

---

### 5. Error Handling and Cleanup Guarantees

Because `finally` is compiled as a normal function wrapper:

* Errors propagate naturally through the call chain.
* The `finally` block always executes, even if the inner function sets an error state.
* If an error occurs inside the `finally` block itself, it continues to propagate upward to the caller — but prior cleanup has still occurred.
* The stack and return stack are identical to ordinary nested calls, ensuring full reentrancy.

---

### 6. Dictionary and Rebinding

Each function is represented in the dictionary as a standard list entry with a `payload` pointing to its entry point.
The `finally` transformation simply updates this payload:

| Field     | Before `finally` | After `finally`  |
| --------- | ---------------- | ---------------- |
| `name`    | `func1`          | `func1`          |
| `payload` | `<func1>`        | `<func1finally>` |
| `flags`   | `CODE`           | `CODE`           |

No new dictionary entry is introduced; the rebind is performed in place after compilation completes.

---

### 7. Nested Finally Blocks

If a `finally` function itself defines another `finally`, the process repeats recursively:

* `func1` → `func1finally`
* `func1finally` → `func1finallyfinally`

Each wrapper calls its predecessor and then performs additional cleanup.
This nesting composes naturally and maintains deterministic cleanup order.

---

### 8. Advantages of the Wrapper Model

* **No runtime machinery:** No need for `FINALLY_PTR` or error-mode skipping logic.
* **Deterministic cleanup:** Cleanup always runs in lexical order.
* **Reentrant and composable:** Works across nested calls without additional stack fields.
* **Transparent dictionary integration:** Implemented by a single pointer rewrite.
* **Error-safe:** Errors within inner calls do not bypass cleanup.

---

### 9. Summary

The `finally` construct in Tacit is a **compile-time structural transformation**, not a runtime feature.
It guarantees cleanup execution by:

* Wrapping each function that declares a `finally` in a generated wrapper,
* Redirecting its dictionary entry to the wrapper’s address,
* And relying solely on standard call/exit semantics.

This approach achieves full `finally` semantics with zero VM cost, zero additional registers, and perfect compatibility with Tacit’s existing stack and dictionary architecture.
