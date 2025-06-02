# Table of Contents

- [Table of Contents](#table-of-contents)
- [Functions and Resumable Functions](#functions-and-resumable-functions)
  - [1. Conceptual Overview: Resumable Functions with Init/Main Phases](#1-conceptual-overview-resumable-functions-with-initmain-phases)
  - [2. The Ordinary Tacit Function](#2-the-ordinary-tacit-function)
    - [2.1. Frame Layout and Entry Steps](#21-frame-layout-and-entry-steps)
    - [2.2. How We Get That Layout](#22-how-we-get-that-layout)
    - [2.3. Body Execution](#23-body-execution)
    - [2.4. Ordinary Function Return and Self-Cleanup](#24-ordinary-function-return-and-self-cleanup)
  - [3. The Resumable Tacit Function (Init/Main Phases)](#3-the-resumable-tacit-function-initmain-phases)
    - [3.1. Initialization Phase and the `main` Keyword Demarcation](#31-initialization-phase-and-the-main-keyword-demarcation)
    - [3.2. Invoking the `main` Phase and Subsequent Exit](#32-invoking-the-main-phase-and-subsequent-exit)
      - [3.2.1. Invoking the `main` Phase via `eval`](#321-invoking-the-main-phase-via-eval)
      - [3.2.2. Final Return from the `main` Phase (No Self-Cleanup)](#322-final-return-from-the-main-phase-no-self-cleanup)
  - [4. Encapsulation and Unified Cleanup by Ancestor](#4-encapsulation-and-unified-cleanup-by-ancestor)
  - [5. Example Scenarios](#5-example-scenarios)
    - [5.1 Resumable A Calling a Normal Function B](#51-resumable-a-calling-a-normal-function-b)
    - [5.2 Resumable A Calling Resumable B](#52-resumable-a-calling-resumable-b)
  - [6. Error Case: Uncontrolled Re-entry via `eval`](#6-error-case-uncontrolled-re-entry-via-eval)
  - [7. Summary of Offsets and Terminology](#7-summary-of-offsets-and-terminology)


# Functions and Resumable Functions

## 1. Conceptual Overview: Resumable Functions with Init/Main Phases

Tacit's resumable functions provide a powerful mechanism for creating functions with persistent, stack-allocated state. They operate based on a two-phase model: an **initialization (`init`) phase** and a **main re-entrant (`main`) phase**.

1.  **Init Phase:** When a resumable function is first invoked, it executes its `init` phase. This phase is responsible for setting up any persistent state variables the function will need across multiple invocations. This state is allocated within the function's own stack frame.
2.  **`main` Keyword Demarcation:** The `init` phase code is followed by the `main` keyword. This keyword acts as a crucial demarcation, signaling the end of the one-time initialization and the beginning of the function's re-entrant logic. Upon reaching this point, the `init` phase concludes by storing the entry point of the `main` phase and returning a handle (the function's Base Pointer, BP) to the caller. The function's stack frame, now containing its initialized persistent state, remains on the stack.
3.  **Main Phase Invocation:** The caller can then use this handle to repeatedly invoke the function's `main` phase (typically via the `eval` primitive). Each invocation of the `main` phase operates on the persistent state established during `init`.

Conceptually, the `init` phase "closes over" the persistent state, making it available every time the `main` phase is subsequently entered. The term 'resumable' refers to this ability to repeatedly call the `main` phase of an initialized function, with its unique state automatically available. This model is ideal for stateful sequences, generators, or iterative computations where context must be preserved, leveraging stack-based memory for efficiency. The detailed mechanics are discussed in subsequent sections.

---

## 2. The Ordinary Tacit Function

### 2.1. Frame Layout and Entry Steps

When the caller invokes a function (whether resumable or not), the VM reserves exactly three metadata slots—caller’s return address, reserved “resume IP,” and caller’s BP—before allocating any locals. The frame layout (from lower to higher addresses) immediately after entry is:

* **BP – 2**: caller’s return address
* **BP – 1**: reserved “resume IP” slot (unused unless the function executes `pause`)
* **BP + 0**: caller’s old BP
* **BP + 1 … BP + N\_locals**: this function’s local variables (N\_locals slots)

No code that follows may overwrite the slots at `BP – 2`, `BP – 1`, or `BP + 0`. Locals begin at `BP + 1`.

### 2.2. How We Get That Layout

1. **Push caller’s return address.**
   The caller pushes its return address onto the return stack. Since the return stack grows upward, that value occupies a new top slot.

2. **Push placeholder for “resume IP.”**
   Immediately after that, the caller pushes a dummy value (for example, zero). That slot is reserved for the resume IP if this function ever executes `pause`.

3. **Push caller’s BP.**
   Next, the caller pushes its current BP value. Now the top-of-stack contains the caller’s BP.

4. **Set `BP := SP`.**
   At this moment, BP points at the slot holding the caller’s BP. Consequently:

   * `BP – 1` holds the dummy placeholder for resume IP.
   * `BP – 2` holds the caller’s return address.

5. **Reserve local slots.**
   The compiler already knows exactly how many local variables this function needs—call that number `N_locals`. Advance `SP` upward by `N_locals`, creating slots at `(BP + 1)` through `(BP + N_locals)` for all locals. BP remains unchanged.

After these steps, the return stack layout is:

* BP – 2 = caller’s return address
* BP – 1 = reserved resume IP slot
* BP + 0 = caller’s old BP
* BP + 1 … BP + N\_locals = locals
* SP points at BP + N\_locals

Execution then enters the function’s body. Any assignment to a local simply stores into `(BP + offset(local))`.

---

### 2.3. Body Execution

Inside the function body:

* **Assigning to a local** stores into `(BP + k)`.
* **Calling another function** pushes that callee’s return address, dummy resume slot, and old BP above this frame, then reserves its own locals. On return, that callee’s frame unwinds, restoring BP back to this function’s BP.
* If the function never executes `pause`, it eventually reaches its final `return` and unwinds as described in section 4.2.

### 2.4. Ordinary Function Return and Self-Cleanup

An ordinary Tacit function (one that does not execute `pause`) is responsible for completely removing its own stack frame upon its final `return`. This process is as follows:

1.  **Local Variable Cleanup (Reference Counting):**
    The function iterates through its local variable slots, from `(BP + N_locals)` down to `(BP + 1)`. For each local variable that holds a reference to a heap-allocated object, the object's reference count is decremented. If a reference count drops to zero, the object is freed.

2.  **Deallocate Locals:**
    The stack pointer `SP` is set to `BP`. This effectively deallocates the local variable slots. `SP` now points to the slot `(BP + 0)` which contains the caller's old BP.

3.  **Restore Caller's BP:**
    The caller's old BP is popped from `(BP + 0)` (i.e., from where `SP` currently points) into the `BP` register. `SP` is decremented.

4.  **Discard Reserved Resume IP Slot:**
    The dummy value in the reserved "resume IP" slot at `(BP – 1)` (relative to the original BP of this frame, now the next item on stack pointed to by `SP`) is popped and discarded. `SP` is decremented.

5.  **Restore Caller's Return Address and Jump:**
    The caller's return address, stored at `(BP – 2)` (relative to the original BP of this frame, now pointed to by `SP`), is popped into the instruction pointer (`IP`). Execution then jumps to this address. `SP` is decremented.

At this point, the entire stack frame of the returning ordinary function (locals and metadata) has been removed from the stack, and `SP` is restored to its value prior to this function's call. Control transfers to the caller.

---

## 3. The Resumable Tacit Function (Init/Main Phases)

### 3.1. Initialization Phase and the `main` Keyword Demarcation

When a resumable function completes its initialization phase (i.e., all code before the `main` keyword) and is about to yield control, the following steps occur as part of its `init` phase epilogue:

1. **Store the `main` entry IP.**
   Write the address of the instruction at (or immediately following) the `main` keyword into `(BP – 1)`. This records where to continue when the `main` phase is later invoked.

2. **Return control to the initiator.**
   Perform a plain `return`, which pops two values (both tagged) in sequence:

   1. Pop from `(BP + 0)` into `BP`, restoring the caller’s BP.
   2. Pop from `(BP – 2)` into the instruction pointer, restoring the caller’s return address, and jump there.

   Because the `init` phase does not adjust `SP` upon this return or touch any local slots established for the persistent state, everything from `(BP + 1)` up through `(BP + N_locals)` (and the stored `main` entry IP at `(BP – 1)`) remains intact on the return stack. This initialized frame remains in place, ready for its `main` phase to be invoked, until an ancestor cleans it up.

---

### 3.2. Invoking the `main` Phase and Subsequent Exit

#### 3.2.1. Invoking the `main` Phase via `eval`

To invoke the `main` phase of an initialized resumable function, the caller places the function’s handle (its tagged BP value, obtained from the `init` phase return) on the data stack and calls `eval`. Internally, `eval` performs exactly:

1. **Extract the initialized function's handle into a temporary (`saved_BP`).**
   This `saved_BP` is the base pointer of the initialized function's frame.

2. **Store the current BP into `(saved_BP + 0)`.**
   Write whatever BP is active (the invoker’s BP) into the initialized frame’s “old BP” slot at `(saved_BP + 0)`.

3. **Store the current return address into `(saved_BP – 2)`.**
   The return address here is the instruction immediately following the `eval` call. Writing it into `(saved_BP – 2)` ensures that when the `main` phase eventually returns, execution continues correctly from the invoker.

4. **Set `BP := saved_BP`.**
   BP now points at the base of the initialized frame whose `main` phase is being invoked. At this moment:

   * **`BP – 2`** holds the return address to use when the `main` phase returns.
   * **`BP – 1`** holds the stored `main` entry IP from the `init` phase.
   * **`BP + 0`** holds the invoker’s BP (saved in step 2).
   * **`BP + 1 … BP + N_locals`** still hold that function’s locals exactly as they were.

5. **Fetch and jump to the `main` entry IP at `(BP – 1)`.**
   Execution of the `main` phase begins at the stored `main` entry IP, with all persistent locals still intact.

No stack-pointer adjustments or pushes/pops occur here during the `eval` itself. Everything needed was established during the `init` phase, so invoking the `main` phase simply involved setting up linkage and jumping.

#### 3.2.2. Final Return from the `main` Phase (No Self-Cleanup)

When the `main` phase of a resumable function eventually hits its final `return` (i.e., it completes its execution for this invocation), it must not clean up its own persistent locals—that is the responsibility of an ancestor ordinary function. Instead, the resumed function’s exit consists of:

1. **Restore the caller’s BP.**
   Pop the value from `(BP + 0)` into `BP`, restoring the BP of the frame that invoked the `main` phase via `eval`.

2. **Restore the caller’s return address and jump.**
   Pop the value from `(BP – 2)` into the instruction pointer, and jump to it. That return address came from the invoker’s step 3 during the `eval` call (see Section 3.2.1).

After these two steps, control transfers back to the invoker (or whatever frame called `eval`), and the resumable function’s entire frame—including its persistent locals and stored `main` entry IP—remains on the return stack, ready for potential future invocations of its `main` phase or for eventual cleanup by an ancestor.

---

## 4. Encapsulation and Unified Cleanup by Ancestor

A key principle in Tacit's function protocol is that ordinary (conventional) functions (as described in Section 2) define a scope that encapsulates any resumable functions (Section 3) they initiate, either directly or indirectly. While resumable functions do not clean up their own stack frames upon the final `return` of their `main` phase (see Section 3.2.2), their lifecycle is ultimately managed by an ancestor ordinary function.

The responsibility for cleaning up all initialized resumable function frames (i.e., those that have completed their `init` phase and are awaiting or executing their `main` phase)—along with the ordinary function's own frame—falls to this ancestor ordinary function when it executes its final `return`. This cleanup is a unified process.

The comprehensive cleanup mechanism, triggered during the final return of an ancestor ordinary function, proceeds as follows for each frame it is responsible for (starting with its own frame and then unwinding any descendant resumable frames left on the stack above it):

1.  **Local Variable Cleanup (Reference Counting) for the Current Frame:**
    Starting at the top of the current frame's local variables (`BP + N_locals`) and moving down to `(BP + 1)` for ordinary functions, or from the top of active locals for resumable functions, check if each slot holds a heap-allocated object. If it does, decrement its reference count (freeing if zero).

2.  **Discard Locals and `main` entry IP for the Current Frame:**
    The stack pointer `SP` is adjusted to effectively discard the local variables. For resumable frames, the reserved "resume IP" slot at `(BP – 1)` is also conceptually discarded (it contains no ref-counted data). For an ordinary function's own frame, this step also discards its dummy resume IP. `SP` would now conceptually point to `(BP + 0)` of the current frame being cleaned.

3.  **Restore Previous Frame's State (Caller of Current Frame):**
    *   Pop the value from `(BP + 0)` (the old BP of the caller of the current frame) into the `BP` register.
    *   Pop the value from `(BP – 2)` (the return address for the caller of the current frame) into the instruction pointer (`IP`).

4.  **Loop or Terminate:**
    *   If the newly restored `BP` points to another frame that needs cleanup as part of this same ancestor's unwinding process (i.e., it's a lower resumable frame in the chain, or the ancestor itself completing its own metadata slots), repeat steps 1-3 for this "new current" frame.
    *   If the newly restored `BP` and `IP` belong to the caller of the original ancestor ordinary function (i.e., the entire encapsulated scope has been cleaned), the cleanup is complete, and execution jumps to the restored `IP`, returning control to that caller.

This process ensures that no resumable function ever directly deallocates its own frame or cleans its own locals in its final return. All such frames are managed and cleaned by the ancestor ordinary function when its scope ends. The ordinary function's own frame is handled as the first part of this unified unwinding.

---

## 5. Example Scenarios

Below are descriptions—without code blocks—of how the stack evolves in three common scenarios, always remembering that cleanup of locals is done by the ancestor, not by any resumable itself.

### 5.1 Resumable A (in `init` or `main` phase) Calling Normal Function B

This scenario describes when resumable function A, while executing either its `init` phase or an invocation of its `main` phase, calls a normal (non-resumable) function B.

*   **Start:** Resumable function A is active. `BP_A` points to its base. Its persistent locals occupy `(BP_A + 1 … BP_A + N_A)`. A's stack frame also contains:
    *   `(BP_A – 2)`: Return address (points into A's initiator if A is in `init` phase, or into `eval`'s caller if A is in `main` phase).
    *   `(BP_A – 1)`: Slot for A's `main` entry IP (populated when A's `init` phase completes by reaching the `main` keyword).
    *   `(BP_A + 0)`: Base Pointer of A's initiator/invoker.

*   **A calls B (normal function):**
    1.  A pushes B’s return address (the instruction in A immediately after the call to B) onto the stack. This will become `(BP_B – 2)`.
    2.  A pushes a dummy value onto the stack. This will become `(BP_B – 1)`, B's (unused) slot for a `main` entry IP, as B is a normal function.
    3.  A pushes its current `BP_A` onto the stack. This will become `(BP_B + 0)`.
    4.  A sets `BP_B` to the current stack pointer (`SP`), establishing B's frame base.
    5.  A reserves space for B’s local variables `(BP_B + 1 … BP_B + N_B)`.
    Now B’s entire frame sits on top of A’s frame. A’s frame remains unchanged underneath.

*   **B executes and returns normally:**
    1.  B performs its operations. Upon its final `return`, B itself does not clean up its stack frame (this cleanup is deferred to an ancestor ordinary function, typically A's ancestor, as per Section 4).
    2.  B pops `BP_A` from `(BP_B + 0)` into `BP`, restoring A's base pointer.
    3.  B pops B’s return address from `(BP_B – 2)` into `IP` and jumps there.
    B’s frame technically remains on the return stack (though inactive), to be cleaned up later by A's ancestor.

*   **A continues execution:**
    Control returns to A, at the instruction immediately following its call to B. `BP_A` is restored.
    *   **If A was in its `init` phase when it called B:** A continues executing its `init` phase logic. If A subsequently reaches its `main` keyword, it completes its `init` phase by:
        *   Storing the address of its `main` phase entry point (the instruction at or after `main`) into `(BP_A – 1)`.
        *   Performing a standard return (as described in Section 3.1, popping `BP` from `(BP_A + 0)` and `IP` from `(BP_A – 2)`). This returns control to A's initiator. The function's handle (`BP_A`) is implicitly made available to the initiator. A's frame (and B's inactive frame above it) remains on the stack.
    *   **If A was in an invocation of its `main` phase when it called B:** A continues executing its `main` phase logic. If A subsequently reaches its own `return` statement (signaling the end of the current `main` phase invocation), it performs a standard return (as described in Section 3.2.2, popping `BP` from `(BP_A + 0)` and `IP` from `(BP_A – 2)`). This returns control to A's invoker (the entity that called `eval` on A). A's frame (and B's inactive frame above it) remains on the stack, ready for future `main` phase invocations or eventual cleanup.

### 5.2 Resumable A Calling Resumable B

* **Start:** Resumable A has BP_A with locals `(BP_A + 1 … BP_A + N_A)` and metadata `(BP_A – 2, BP_A – 1, BP_A + 0)`.

* **A reaches its `main` keyword (completing `init`):**

  1. A writes its `main` entry IP (address of the instruction at/after `main`) into `(BP_A – 1)`.
  2. A does a normal `return`, popping `BP` from `(BP_A + 0)` and popping the return address from `(BP_A – 2)`.

  A’s entire frame (locals + `main` entry IP) remains on the return stack; BP reverts to whoever initiated A or invoked its `main` phase.

* **Caller of A invokes A's `main` phase:**

  1. Caller pushes A’s BP handle on the data stack and calls `eval`.
  2. `eval` saves the caller’s BP into `(BP_A + 0)`, saves the caller’s return address into `(BP_A – 2)`, sets `BP := BP_A`, and jumps to `(BP_A – 1)`, A’s stored `main` entry IP.
  3. A’s `main` phase (the code at/after the `main` keyword) begins executing with locals still at `(BP_A + 1 … BP_A + N_A)`.

* **A_new calls resumable B:**

  1. A pushes B’s return address, a dummy for B’s resume IP, and `BP_A` in sequence.
  2. A sets `BP_B := SP` and reserves `(BP_B + 1 … BP_B + N_B)` for B’s locals.

  B’s frame now sits above A’s frame. A’s locals remain at `(BP_A + 1 … BP_A + N_A)`.

* **B executes `pause`:**

  1. B writes its resume IP into `(BP_B – 1)`.
  2. B does a normal `return`, popping `BP` from `(BP_B + 0)` and popping the return address from `(BP_B – 2)`.

  B’s frame remains on the return stack above A’s.

* **Caller of B resumes B:**

  1. That caller pushes B’s BP handle on the data stack, calls `eval`.
  2. `eval` saves its BP into `(BP_B + 0)`, saves its return address into `(BP_B – 2)`, sets `BP := BP_B`, and jumps to `(BP_B – 1)`.
  3. B resumes at its stored resume IP with locals intact at `(BP_B + 1 … BP_B + N_B)`.

* **Eventually, B returns for good:**

  1. B’s final return restores BP from `(BP_B + 0)` (back to BP_A) and restores return address from `(BP_B – 2)`, then jumps there.
  2. B’s frame (locals + resume IP) remains on the stack. BP_A points to A’s frame again, and A resumes after its call to B.

At no point does a resumable function clean up its own locals. All cleanup happens later when an ancestor—ultimately a conventional caller—unwinds those frames.

## 6. Error Case: Uncontrolled Re-entry via `eval`

A resumable function's handle (its `BP`) is intended to be returned to its initiator after the `init` phase completes, allowing the initiator (or other functions) to subsequently invoke the `main` phase via `eval`. It is generally an error for a resumable function to attempt to `eval` its own handle directly from within itself in a way that bypasses the intended `init`-once, `main`-many-times lifecycle, or leads to uncontrolled recursion.

Consider a resumable function `RFunc`:

**Scenario 1: `RFunc` attempts `eval` on itself during its `init` phase.**
If `RFunc`, before completing its `init` phase (i.e., before reaching its `main` keyword and returning its handle), were to somehow obtain its own `BP` and execute `eval` on it:
```tacit
# Inside RFunc's init phase
...
get_own_bp_somehow  # Hypothetical, RFunc's BP is current BP
eval                # Attempting to eval its own handle
...
main
...
```
This is problematic because:
1.  The `main` entry IP at `(BP - 1)` would not have been set yet (this happens only when the `init` phase concludes by reaching `main`). `eval` would jump to an undefined or incorrect address.
2.  This violates the protocol where the `init` phase must complete and return a handle before the `main` phase can be invoked.

**Scenario 2: `RFunc` attempts `eval` on itself during its `main` phase.**
If `RFunc`, while its `main` phase is already executing (having been called via `eval` by an external caller), executes `eval` on its own `BP`:
```tacit
# Inside RFunc's main phase
...
get_own_bp  # RFunc's BP is current BP
eval        # Attempting to re-invoke its own main phase
...
```
This is effectively a direct recursive invocation of `RFunc`'s `main` phase. While recursion can be valid, if this `eval` call is unconditional or not managed by a proper termination condition within `RFunc`'s logic, it will lead to an infinite loop and stack overflow. The `eval` primitive itself, as described in Section 3.2.1, would proceed with the re-entry:
*   It would save the current `BP` (which is `RFunc`'s `BP`) into `(RFunc.BP + 0)`.
*   It would save the return address (the instruction in `RFunc` after `eval`) into `(RFunc.BP - 2)`.
*   It would then jump to `(RFunc.BP - 1)`, which is `RFunc`'s `main` entry IP.

**Prevention/Mitigation:**
*   **Protocol Adherence:** The primary prevention is strict adherence to the resumable function protocol: `init` phase runs once, returns a handle; `main` phase is invoked via that handle by external callers.
*   **`eval` Behavior:** The `eval` primitive itself doesn't inherently prevent self-invocation of the `main` phase. If `eval` were to check if `saved_BP == current_BP` (where `saved_BP` is the handle being `eval`-ed), it could potentially flag or prevent such direct self-re-entry. However, this might also restrict legitimate recursive patterns if not designed carefully.
*   **Static Analysis/Linting:** Tooling could potentially detect unconditional self-`eval` patterns within a function's `main` phase.

The critical point is that the `init` phase must complete before `eval` is used on its handle. Uncontrolled recursive `eval` of the same handle from within the `main` phase is a logic error in the resumable function's design, leading to a loop.

---

## 7. Summary of Offsets and Terminology

* **BP – 2** = caller’s return address

* **BP – 1** = reserved “`main` entry IP” slot (for resumable functions; ordinary functions may use this for a dummy value)

* **BP + 0** = caller’s old BP

* **BP + 1 … BP + N\_locals** = this function’s local variables

* **`main` keyword (demarcation in resumable functions):**
    *   Signifies the end of the one-time `init` phase and the start of the re-entrant `main` phase.
    *   When the `init` phase reaches `main` and is about to yield:
        1.  Store the address of the first instruction of the `main` phase (or instruction immediately following `main`) into `(BP – 1)`.
        2.  Execute a normal `return` to the initiator (restore initiator's BP from `(BP + 0)`, then restore initiator's return address from `(BP – 2)`). The function's handle (its BP) is made available to the initiator.

* **`eval` operation**

  1. Extract initialized function's handle (its BP) from the data stack into `saved_BP`.
  2. Store invoker's BP into `(saved_BP + 0)`.
  3. Store invoker's return address (instruction after `eval`) into `(saved_BP – 2)`.
  4. Set `BP := saved_BP`.
  5. Fetch `main` entry IP from `(BP – 1)` and jump there (starts/resumes the `main` phase).

* **Cleanup of initialized/active resumable function frames:**
    *   Occurs only when an ancestor ordinary function executes its final `return`. Its epilogue walks down every local slot in its own frame and any descendant resumable frames, performs reference-count cleanup, conceptually discards `main` entry IP slots, and restores BP and return address for each frame, in descending order, effectively unwinding the stack.

By adhering to this specification—return address at `BP – 2`, `main` entry IP at `BP – 1` (for resumables), old BP at `BP + 0`, locals above—all functions manage their frames correctly, with resumable functions relying on an ancestor ordinary function for cleanup.
