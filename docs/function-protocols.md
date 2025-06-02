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
    - [5.1 Resumable A (in `init` or `main` phase) Calling Normal Function B](#51-resumable-a-in-init-or-main-phase-calling-normal-function-b)
    - [5.2 Resumable A Calling Resumable B](#52-resumable-a-calling-resumable-b)
  - [6. Error Case: Uncontrolled Re-entry via `eval`](#6-error-case-uncontrolled-re-entry-via-eval)
  - [7. Summary of Offsets and Terminology](#7-summary-of-offsets-and-terminology)


# Functions and Resumable Functions

## 1. Conceptual Overview: Resumable Functions with Init/Main Phases

Tacit's resumable functions provide a powerful mechanism for creating functions with persistent, stack-allocated state. A function is *designed* to be resumable by including a `main` keyword within its definition. It is initially invoked using the standard calling protocol for ordinary Tacit functions (see Section 2.1, "Calling an Ordinary Function"). The function's subsequent behavior depends on its execution path:

*   If the function completes its execution and issues a `return` *before* its control flow reaches a `main` keyword, it behaves in all respects like an ordinary function. This includes performing its own stack frame cleanup upon return, as detailed in Section 2.4 ("Final Return from an Ordinary Function").
*   If the function's control flow *does* reach a `main` keyword, this signals its transition into a resumable state, operating on a two-phase model: an _initialization (`init`) phase_ and a _main re-entrant (`main`) phase_.

This two-phase model, when activated by reaching the `main` keyword, consists of:

1.  _Init Phase:_ The `init` phase comprises all code within the function definition that executes *before* the `main` keyword is encountered. This phase is responsible for setting up any persistent state variables the function will need for its subsequent `main` phase operations. This state is allocated within the function's own stack frame.
2.  _`main` Keyword Demarcation:_ When execution reaches the `main` keyword, it acts as a crucial demarcation. This keyword can be considered to compile into a special VM instruction (or opcode) that, when executed, signals the end of the one-time initialization (`init` phase) and the beginning of the function's re-entrant logic (`main` phase). At this point, this effective `main` instruction triggers the execution of a special epilogue (detailed in Section 3.1) which involves:
    *   Storing the entry point of the `main` phase (the address of the instruction at or immediately following the `main` keyword) into the `_(BP – 1)_` slot of its stack frame.
    *   Performing a specific type of `return` that yields a handle (the function's Base Pointer, `_BP_`) to its initiator, while leaving its own stack frame (now containing initialized persistent state and the `main` entry address) intact on the return stack.
3.  _Main Phase Invocation:_ The caller can then use this handle to repeatedly invoke the function's `main` phase (typically via the `eval` primitive). Each invocation of the `main` phase operates on the persistent state established during `init`.

Conceptually, the `init` phase "closes over" the persistent state, making it available every time the `main` phase is subsequently entered. The term 'resumable' refers to this ability to repeatedly call the `main` phase of an initialized function, with its unique state automatically available. This model is ideal for stateful sequences, generators, or iterative computations where context must be preserved, leveraging stack-based memory for efficiency. The detailed mechanics are discussed in subsequent sections.

---

## 2. The Ordinary Tacit Function

### 2.1. Frame Layout and Entry Steps

When the caller invokes a function (whether resumable or not), the VM reserves exactly three metadata slots—caller’s return address, a slot reserved for the “`main` entry address” (for resumables), and caller’s BP—before allocating any locals. The frame layout (from lower to higher addresses) immediately after entry is:

* _BP – 2_: caller’s return address
* _BP – 1_: reserved for the “`main` entry address” (used by resumable functions after their `init` phase to store the `main` entry point; holds a dummy/undefined value for ordinary functions or resumable functions before their `init` phase completes)
* _BP + 0_: caller’s old BP
* _BP + 1 … BP + N\_locals_: this function’s local variables (N\_locals slots)

No code that follows may overwrite the slots at `BP – 2`, `BP – 1`, or `BP + 0`. Locals begin at `BP + 1`.

### 2.2. How We Get That Layout

1. _Push caller’s return address._
   The caller pushes its return address onto the return stack. Since the return stack grows upward, that value occupies a new top slot.

2. _Push placeholder for “`main` entry address.”_
   Immediately after that, the caller pushes a dummy value (for example, zero). This slot at `(BP - 1)` is reserved. For resumable functions, it will store the “`main` entry address” after the `init` phase completes. For ordinary functions, or resumable functions before their `init` phase completes, it holds this dummy value.

3. _Push caller’s BP._
   Next, the caller pushes its current BP value. Now the top-of-stack contains the caller’s BP.

4. _Set `BP := RP`._
   At this moment, BP points at the slot holding the caller’s BP. Consequently:

   * `BP – 1` holds the dummy placeholder for the “`main` entry address”.
   * `BP – 2` holds the caller’s return address.

5. _Reserve local slots._
   The compiler already knows exactly how many local variables this function needs—call that number `N_locals`. Advance `RP` upward by `N_locals`, creating slots at `(BP + 1)` through `(BP + N_locals)` for all locals. BP remains unchanged.

After these steps, the return stack layout is:

* BP – 2 = caller’s return address
* BP – 1 = reserved slot for “`main` entry address” (initially holds a dummy value)
* BP + 0 = caller’s old BP
* BP + 1 … BP + N\_locals = locals
* RP points at BP + N\_locals

Execution then enters the function’s body. Any assignment to a local simply stores into `(BP + offset(local))`.

---

### 2.3. Body Execution

Inside the function body:

* _Assigning to a local_ stores into `(BP + k)`.
* _Calling another function_ pushes that callee’s return address, dummy resume slot, and old BP above this frame, then reserves its own locals. On return, that callee’s frame unwinds, restoring BP back to this function’s BP.
* An ordinary function executes its logic and eventually reaches its final `return`, unwinding as described in Section 2.4.

### 2.4. Ordinary Function Return and Self-Cleanup

An ordinary Tacit function is responsible for completely removing its own stack frame upon its final `return`. This process is as follows:

1.  _Unified Stack Value Cleanup:_
    Upon its final `return`, an ordinary function performs a unified cleanup of all values on the stack that are within its scope of responsibility. This scope extends from its current `_RP_` (Return Stack Pointer) down to its `_BP_` (Base Pointer). The process is a single, continuous loop:

    The cleanup loop continues as long as `_RP_` is greater than `_BP_`. In each pass of the loop, the function pops one value from the stack. If the value at `_*RP_` is reference-counted, its reference count is decremented. `_RP_` is then decremented.

    This iterative cleanup ensures that all values in the region are appropriately handled. This includes local variables of the current ordinary function, as well as any local variables or metadata from descendant resumable function frames that might have been left on the stack above this ordinary function's `_BP_`.

    The loop concludes when `_RP_` becomes equal to `_BP_`. At this stage, `_RP_` is pointing to the slot `_(BP + 0)_`, which holds the `_BP_` of the function that called this ordinary function. All stack slots above `_(BP + 0)_` for which this function was responsible have now been cleaned.

2.  _Restore Caller's BP:_
    The caller's old BP is popped from `(BP + 0)` (i.e., from where `RP` currently points) into the `BP` register. `RP` is decremented.

3.  _Discard Reserved `main` entry address Slot:_
    The dummy value in the reserved “`main` entry address” slot at `(BP – 1)` (relative to the original BP of this frame, now the next item on stack pointed to by `RP`) is popped and discarded. `RP` is decremented.

4.  _Restore Caller's Return Address and Jump:_
    The caller's return address, stored at `(BP – 2)` (relative to the original BP of this frame, now pointed to by `RP`), is popped into the instruction pointer (`IP`). Execution then jumps to this address. `RP` is decremented.

At this point, the entire stack frame of the returning ordinary function (locals and metadata) has been removed from the stack, and `RP` is restored to its value prior to this function's call. Control transfers to the caller.

---

Here’s a rewritten version of that paragraph with clearer structure and improved readability, while preserving all original information:

---

## 3. The Resumable Tacit Function (Init/Main Phases)

### 3.1. Initialization Phase and the `main` Keyword Demarcation

A resumable function—identified by the presence of a `main` keyword within its definition—is initially invoked using the standard calling protocol for ordinary Tacit functions (see Section 2.1, "Calling an Ordinary Function"). If the function completes and returns without reaching the `main` keyword, it behaves exactly like a normal function: it cleans up its own stack frame on return (as described in Section 2.4), and no resumable behavior is ever triggered.

However, if execution reaches the `main` keyword, this marks the end of the initialization phase. The `main` keyword itself is compiled into a special VM instruction (or opcode) that, when executed at runtime, performs a special epilogue to conclude initialization and convert the function into an initialized resumable:

* **Store the resume entry point**: Write the instruction address at or immediately following the `main` keyword into the frame slot at `(BP - 1)`. This marks the entry point for the resumable’s `main` phase.

* **Return control to the caller**: Perform a plain return by restoring two tagged values in sequence:

  1. Load `BP` from `(BP + 0)` to restore the caller’s base pointer.
  2. Load the instruction pointer from `(BP - 2)` and jump to it, returning to the caller.

Importantly, this return does **not** adjust the return stack pointer or clean up any local variables. The region from `(BP + 1)` through `(BP + N_locals)` (along with the stored resume address at `(BP - 1)`) remains untouched. The entire frame is preserved on the return stack in its initialized state, ready for the `main` phase to be resumed at a later time. Cleanup is deferred to an ancestor frame.

---

Here is a revised version of **Section 3.2**, rewritten for clarity and precision without omitting any content:

---

### 3.2. Invoking the `main` Phase and Subsequent Exit

#### 3.2.1. Invoking the `main` Phase via `eval`

To resume the `main` phase of an initialized resumable function, the caller places the function’s handle—a tagged `BP` value returned from the `init` phase—on the data stack and invokes `eval`. The `eval` operation performs the following steps:

1. **Extract the function handle into a temporary (`saved_BP`)**
   This is the base pointer of the previously initialized resumable frame.

2. **Store the current `BP` into `(saved_BP + 0)`**
   This saves the caller’s base pointer into the resumed frame’s "old BP" slot, linking the two frames.

3. **Store the caller’s return address into `(saved_BP – 2)`**
   The return address—pointing to the instruction immediately following the `eval` call—is saved into the frame. This ensures that the resumed function will return to the right place.

4. **Set `BP := saved_BP`**
   This activates the resumable’s frame. At this point:

   * `(BP – 2)` holds the return address for when the `main` phase completes.
   * `(BP – 1)` holds the stored resume entry point (set during the `init` phase).
   * `(BP + 0)` holds the invoker’s saved `BP`.
   * `(BP + 1 … BP + N_locals)` remain unchanged, still holding the persistent local variables.

5. **Jump to the resume address at `(BP – 1)`**
   Execution of the `main` phase begins at the stored resume address. This address was captured during the `main` keyword execution in the `init` phase.

No pushes, pops, or return stack pointer adjustments are performed during `eval`. The resumed frame was already fully constructed during the `init` phase. `eval` simply links the current caller to it and jumps to the correct continuation point.

---

#### 3.2.2. Final Return from the `main` Phase (No Self-Cleanup)

When the `main` phase reaches its final `return`, the function must not attempt to clean up its own locals. Resumables preserve their stack frame; cleanup is deferred to an ancestor frame. The return sequence is:

1. **Restore the caller’s base pointer**
   Load the saved base pointer from `(BP + 0)` into `BP`. This reactivates the caller’s frame.

2. **Restore and jump to the caller’s return address**
   Load the return address from `(BP – 2)` and jump to it. This address was saved by the invoker during `eval`.

At this point, execution resumes in the caller as if `eval` had returned. The resumable frame remains completely intact on the return stack, including all local variables and the stored `main` entry point. It is now ready for another invocation or eventual cleanup by the ancestor that owns the stack.

---

## 4. Encapsulation and Unified Cleanup by Ancestor

A key principle in Tacit's function protocol is that ordinary (conventional) functions (as described in Section 2) define a scope that encapsulates any resumable functions (Section 3) they initiate, either directly or indirectly. While resumable functions do not clean up their own stack frames upon the final `return` of their `main` phase (see Section 3.2.2), their lifecycle is ultimately managed by an ancestor ordinary function.

The responsibility for cleaning up all initialized resumable function frames (i.e., those that have completed their `init` phase and are awaiting or executing their `main` phase)—along with the ordinary function's own frame—falls to this ancestor ordinary function when it executes its final `return`. This cleanup is achieved through the unified return process of the ancestor ordinary function itself, as further detailed below.

The cleanup of these encapsulated resumable function frames is achieved by the ancestor ordinary function's own final `return` sequence, specifically through the "_Unified Stack Value Cleanup_" process described in Section 2.4, Step 1.

When the ancestor ordinary function executes this step:
*   It initiates a single, continuous loop that processes values on the stack from the current `_RP_` down to its own `_BP_`.
*   Any resumable function frames that were initiated by this ancestor (or its callees) and remain on the stack will reside in the region between the current `_RP_` and the ancestor's `_BP_`.
*   As the ancestor's cleanup loop iterates (as per Section 2.4, Step 1.a):
    *   It encounters and processes each value. This includes the local variables of any descendant resumable functions and their stored `_main entry address_` values (at their respective `_(BP-1)_` slots).
    *   Reference counts are decremented for applicable values, and `_RP_` is decremented for every value, effectively popping it.
*   This single loop seamlessly cleans all data from descendant resumable frames as well as the local variables of the ancestor ordinary function itself. The loop terminates when `_RP_` equals the ancestor's `_BP_`.

Following this unified value cleanup, the ancestor ordinary function then completes its return by executing Steps 2, 3, and 4 from Section 2.4 (restoring its caller's `_BP_`, discarding its own `_main entry address_` slot, and restoring its caller's return address).

This mechanism ensures that no resumable function needs to (or does) clean up its own frame. The ancestor ordinary function's standard return protocol inherently manages the cleanup of all stack frames within its scope of responsibility.

---

## 5. Example Scenarios

Below are descriptions—without code blocks—of how the stack evolves in three common scenarios, always remembering that cleanup of locals is done by the ancestor, not by any resumable itself.

### 5.1 Resumable A (in `init` or `main` phase) Calling Normal Function B

This scenario describes when resumable function A, while executing either its `init` phase or an invocation of its `main` phase, calls a normal (non-resumable) function B.

*   _Start:_ Resumable function A is active. `BP_A` points to its base. Its persistent locals occupy `(BP_A + 1 … BP_A + N_A)`. A's stack frame also contains:
    *   `(BP_A – 2)`: Return address (points into A's initiator if A is in `init` phase, or into `eval`'s caller if A is in `main` phase).
    *   `(BP_A – 1)`: Slot for A's `main` entry address (populated when A's `init` phase completes by reaching the `main` keyword).
    *   `(BP_A + 0)`: Base Pointer of A's initiator/invoker.

*   _A calls B (normal function):_
    1.  A pushes B’s return address (the instruction in A immediately after the call to B) onto the stack. This will become `(BP_B – 2)`.
    2.  A pushes a dummy value onto the stack. This will become `(BP_B – 1)`, B's (unused) slot for a `main` entry address, as B is a normal function.
    3.  A pushes its current `BP_A` onto the stack. This will become `(BP_B + 0)`.
    4.  A sets `BP_B` to the current stack pointer (`RP`), establishing B's frame base.
    5.  A reserves space for B’s local variables `(BP_B + 1 … BP_B + N_B)`.
    Now B’s entire frame sits on top of A’s frame. A’s frame remains unchanged underneath.

*   _B executes and returns normally:_
    1.  B performs its operations. Upon its final `return`, B cleans up its own stack frame completely, as per the protocol for ordinary functions (Section 2.4). This involves:
        a.  Performing the "_Unified Stack Value Cleanup_" for its locals (from its `_RP_` down to `_BP_B_`).
        b.  Restoring A's `_BP_` (i.e., `_BP_A_`) from `_(BP_B + 0)_`.
        c.  Discarding its own dummy `_main entry address_` slot `_(BP_B – 1)_`.
        d.  Restoring A's return address from `_(BP_B – 2)_` into `_IP_` and jumping there.
    After B returns, its entire frame is removed from the stack.

*   _A continues execution:_
    Control returns to A, at the instruction immediately following its call to B. `BP_A` is restored.
    *   _If A was in its `init` phase when it called B:_ A continues executing its `init` phase logic. If A subsequently reaches its `main` keyword, it completes its `init` phase by:
        *   Storing the address of its `main` phase entry point (the instruction at or after `main`) into `(BP_A – 1)`.
        *   Performing a standard return (as described in Section 3.1, popping `BP` from `(BP_A + 0)` and `IP` from `(BP_A – 2)`). This returns control to A's initiator. The function's handle (`BP_A`) is implicitly made available to the initiator. A's frame remains on the stack (B's frame is already cleaned).
    *   _If A was in an invocation of its `main` phase when it called B:_ A continues executing its `main` phase logic. If A subsequently reaches its own `return` statement (signaling the end of the current `main` phase invocation), it performs a standard return (as described in Section 3.2.2, popping `BP` from `(BP_A + 0)` and `IP` from `(BP_A – 2)`). This returns control to A's invoker (the entity that called `eval` on A). A's frame remains on the stack (B's frame is already cleaned), ready for future `main` phase invocations or eventual cleanup.

### 5.2 Resumable A Calling Resumable B

* _Start:_ Resumable A has BP_A with locals `(BP_A + 1 … BP_A + N_A)` and metadata `(BP_A – 2, BP_A – 1, BP_A + 0)`.

* _A reaches its `main` keyword (completing `init`):_

  1. A writes its `main` entry address (address of the instruction at/after `main`) into `(BP_A – 1)`.
  2. A does a normal `return`, popping `BP` from `(BP_A + 0)` and popping the return address from `(BP_A – 2)`.

  A’s entire frame (locals + `main` entry address) remains on the return stack; BP reverts to whoever initiated A or invoked its `main` phase.

* _Caller of A invokes A's `main` phase:_

  1. Caller pushes A’s BP handle on the data stack and calls `eval`.
  2. `eval` saves the caller’s BP into `(BP_A + 0)`, saves the caller’s return address into `(BP_A – 2)`, sets `BP := BP_A`, and jumps to `(BP_A – 1)`, A’s stored `main` entry address.
  3. A’s `main` phase (the code at/after the `main` keyword) begins executing with locals still at `(BP_A + 1 … BP_A + N_A)`.

* _A_new calls resumable B:_

  1. A pushes B’s return address, a dummy value for B’s “`main` entry address” slot, and `BP_A` in sequence.
  2. A sets `BP_B := RP` and reserves `(BP_B + 1 … BP_B + N_B)` for B’s locals.

  B’s frame now sits above A’s frame. A’s locals remain at `(BP_A + 1 … BP_A + N_A)`.

* _B completes its `init` phase (reaches its `main` keyword and yields):_

  1. B writes its `main` entry address into `(BP_B – 1)`.
  2. B does a normal `return`, popping `BP` from `(BP_B + 0)` and popping the return address from `(BP_B – 2)`.

  B’s frame remains on the return stack above A’s.

* _Caller of B resumes B:_

  1. That caller pushes B’s BP handle on the data stack, calls `eval`.
  2. `eval` saves its BP into `(BP_B + 0)`, saves its return address into `(BP_B – 2)`, sets `BP := BP_B`, and jumps to `(BP_B – 1)`.
  3. B's `main` phase begins execution at its stored `main` entry address with locals intact at `(BP_B + 1 … BP_B + N_B)`.

* _Eventually, B returns for good:_

  1. B’s final return restores BP from `(BP_B + 0)` (back to BP_A) and restores return address from `(BP_B – 2)`, then jumps there.
  2. B’s frame (locals + `main` entry address) remains on the stack. BP_A points to A’s frame again, and A resumes execution after its call to B.

At no point does a resumable function clean up its own locals. All cleanup happens later when an ancestor—ultimately a conventional caller—unwinds those frames.

## 6. Error Case: Uncontrolled Re-entry via `eval`

A resumable function's handle (its `BP`) is intended to be returned to its initiator after the `init` phase completes, allowing the initiator (or other functions) to subsequently invoke the `main` phase via `eval`. It is generally an error for a resumable function to attempt to `eval` its own handle directly from within itself in a way that bypasses the intended `init`-once, `main`-many-times lifecycle, or leads to uncontrolled recursion.

Consider a resumable function `RFunc`:

_Scenario 1: `RFunc` attempts `eval` on itself during its `init` phase._
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
1.  The `main` entry address at `(BP - 1)` would not have been set yet (this happens only when the `init` phase concludes by reaching `main`). `eval` would jump to an undefined or incorrect address.
2.  This violates the protocol where the `init` phase must complete and return a handle before the `main` phase can be invoked.

_Scenario 2: `RFunc` attempts `eval` on itself during its `main` phase._
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
*   It would then jump to `(RFunc.BP - 1)`, which is `RFunc`'s `main` entry address.

_Prevention/Mitigation:_
*   _Protocol Adherence:_ The primary prevention is strict adherence to the resumable function protocol: `init` phase runs once, returns a handle; `main` phase is invoked via that handle by external callers.
*   _`eval` Behavior:_ The `eval` primitive itself doesn't inherently prevent self-invocation of the `main` phase. If `eval` were to check if `saved_BP == current_BP` (where `saved_BP` is the handle being `eval`-ed), it could potentially flag or prevent such direct self-re-entry. However, this might also restrict legitimate recursive patterns if not designed carefully.
*   _Static Analysis/Linting:_ Tooling could potentially detect unconditional self-`eval` patterns within a function's `main` phase.

The critical point is that the `init` phase must complete before `eval` is used on its handle. Uncontrolled recursive `eval` of the same handle from within the `main` phase is a logic error in the resumable function's design, leading to a loop.

---

## 7. Summary of Offsets and Terminology

* _BP – 2_ = caller’s return address

* _BP – 1_ = reserved “`main` entry address” slot (for resumable functions; ordinary functions may use this for a dummy value)

* _BP + 0_ = caller’s old BP

* _BP + 1 … BP + N\_locals_ = this function’s local variables

* _`main` keyword (demarcation in resumable functions):_
    *   Signifies the end of the one-time `init` phase and the start of the re-entrant `main` phase. It can be considered to compile into a special VM instruction (opcode) that, when executed at runtime, triggers the `init` phase epilogue.
    *   This `init` phase epilogue involves:
        1.  Storing the address of the first instruction of the `main` phase (or the instruction immediately following the `main` keyword/opcode) into `_(BP – 1)_`.
        2.  Executing a specific type of `return` to the initiator (which involves restoring the initiator's `_BP_` from `_(BP + 0)_`, then restoring the initiator's return address from `_(BP – 2)_` and jumping there). The function's handle (its `_BP_`) is implicitly made available to the initiator.

* _`eval` operation_

  1. Extract initialized function's handle (its BP) from the data stack into `saved_BP`.
  2. Store invoker's BP into `(saved_BP + 0)`.
  3. Store invoker's return address (instruction after `eval`) into `(saved_BP – 2)`.
  4. Set `BP := saved_BP`.
  5. Fetch `main` entry address from `(BP – 1)` and jump there (starts/resumes the `main` phase).

* _Cleanup of initialized/active resumable function frames:_
    *   Occurs only when an ancestor ordinary function executes its final `return`. Its epilogue walks down every local slot in its own frame and any descendant resumable frames, performs reference-count cleanup, conceptually discards `main` entry address slots, and restores BP and return address for each frame, in descending order, effectively unwinding the stack.

By adhering to this specification—return address at `BP – 2`, `main` entry address at `BP – 1` (for resumables), old BP at `BP + 0`, locals above—all functions manage their frames correctly, with resumable functions relying on an ancestor ordinary function for cleanup.
