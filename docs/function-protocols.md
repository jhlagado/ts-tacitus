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

Tacit's resumable functions provide a powerful mechanism for creating functions with persistent, stack-allocated state. They operate based on a two-phase model: an _initialization (`init`) phase_ and a _main re-entrant (`main`) phase_.

1.  _Init Phase:_ When a resumable function is first invoked, it executes its `init` phase. This phase is responsible for setting up any persistent state variables the function will need across multiple invocations. This state is allocated within the function's own stack frame.
2.  _`main` Keyword Demarcation:_ The `init` phase code is followed by the `main` keyword. This keyword acts as a crucial demarcation, signaling the end of the one-time initialization and the beginning of the function's re-entrant logic. Upon reaching this point, the `init` phase concludes by storing the entry point of the `main` phase and returning a handle (the function's Base Pointer, BP) to the caller. The function's stack frame, now containing its initialized persistent state, remains on the stack.
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

1.  _Local Variable Cleanup (Reference Counting):_
    The function iterates through its local variable slots, from `(BP + N_locals)` down to `(BP + 1)`. For each local variable that holds a reference to a heap-allocated object, the object's reference count is decremented. If a reference count drops to zero, the object is freed.

2.  _Deallocate Locals:_
    The stack pointer `RP` is set to `BP`. This effectively deallocates the local variable slots. `RP` now points to the slot `(BP + 0)` which contains the caller's old BP.

3.  _Restore Caller's BP:_
    The caller's old BP is popped from `(BP + 0)` (i.e., from where `RP` currently points) into the `BP` register. `RP` is decremented.

4.  _Discard Reserved `main` entry address Slot:_
    The dummy value in the reserved “`main` entry address” slot at `(BP – 1)` (relative to the original BP of this frame, now the next item on stack pointed to by `RP`) is popped and discarded. `RP` is decremented.

5.  _Restore Caller's Return Address and Jump:_
    The caller's return address, stored at `(BP – 2)` (relative to the original BP of this frame, now pointed to by `RP`), is popped into the instruction pointer (`IP`). Execution then jumps to this address. `RP` is decremented.

At this point, the entire stack frame of the returning ordinary function (locals and metadata) has been removed from the stack, and `RP` is restored to its value prior to this function's call. Control transfers to the caller.

---

## 3. The Resumable Tacit Function (Init/Main Phases)

### 3.1. Initialization Phase and the `main` Keyword Demarcation

When a resumable function completes its initialization phase (i.e., all code before the `main` keyword) and is about to yield control, the following steps occur as part of its `init` phase epilogue:

1. _Store the `main` entry address._
   Write the address of the instruction at (or immediately following) the `main` keyword into `(BP – 1)`. This records where to continue when the `main` phase is later invoked.

2. _Return control to the initiator._
   Perform a plain `return`, which pops two values (both tagged) in sequence:

   1. Pop from `(BP + 0)` into `BP`, restoring the caller’s BP.
   2. Pop from `(BP – 2)` into the instruction pointer, restoring the caller’s return address, and jump there.

   Because the `init` phase does not adjust `RP` upon this return or touch any local slots established for the persistent state, everything from `(BP + 1)` up through `(BP + N_locals)` (and the stored `main` entry address at `(BP – 1)`) remains intact on the return stack. This initialized frame remains in place, ready for its `main` phase to be invoked, until an ancestor cleans it up.

---

### 3.2. Invoking the `main` Phase and Subsequent Exit

#### 3.2.1. Invoking the `main` Phase via `eval`

To invoke the `main` phase of an initialized resumable function, the caller places the function’s handle (its tagged BP value, obtained from the `init` phase return) on the data stack and calls `eval`. Internally, `eval` performs exactly:

1. _Extract the initialized function's handle into a temporary (`saved_BP`)._
   This `saved_BP` is the base pointer of the initialized function's frame.

2. _Store the current BP into `(saved_BP + 0)`._
   Write whatever BP is active (the invoker’s BP) into the initialized frame’s “old BP” slot at `(saved_BP + 0)`.

3. _Store the current return address into `(saved_BP – 2)`._
   The return address here is the instruction immediately following the `eval` call. Writing it into `(saved_BP – 2)` ensures that when the `main` phase eventually returns, execution continues correctly from the invoker.

4. _Set `BP := saved_BP`._
   BP now points at the base of the initialized frame whose `main` phase is being invoked. At this moment:

   * _`BP – 2`_ holds the return address to use when the `main` phase returns.
   * _`BP – 1`_ holds the stored `main` entry address from the `init` phase.
   * _`BP + 0`_ holds the invoker’s BP (saved in step 2).
   * _`BP + 1 … BP + N_locals`_ still hold that function’s locals exactly as they were.

5. _Fetch and jump to the `main` entry address at `(BP – 1)`._
   Execution of the `main` phase begins at the stored `main` entry address, with all persistent locals still intact.

No stack-pointer adjustments or pushes/pops occur here during the `eval` itself. Everything needed was established during the `init` phase, so invoking the `main` phase simply involved setting up linkage and jumping.

#### 3.2.2. Final Return from the `main` Phase (No Self-Cleanup)

When the `main` phase of a resumable function eventually hits its final `return` (i.e., it completes its execution for this invocation), it must not clean up its own persistent locals—that is the responsibility of an ancestor ordinary function. Instead, the resumed function’s exit consists of:

1. _Restore the caller’s BP._
   Pop the value from `(BP + 0)` into `BP`, restoring the BP of the frame that invoked the `main` phase via `eval`.

2. _Restore the caller’s return address and jump._
   Pop the value from `(BP – 2)` into the instruction pointer, and jump to it. That return address came from the invoker’s step 3 during the `eval` call (see Section 3.2.1).

After these two steps, control transfers back to the invoker (or whatever frame called `eval`), and the resumable function’s entire frame—including its persistent locals and stored `main` entry address—remains on the return stack, ready for potential future invocations of its `main` phase or for eventual cleanup by an ancestor.

---

## 4. Encapsulation and Unified Cleanup by Ancestor

A key principle in Tacit's function protocol is that ordinary (conventional) functions (as described in Section 2) define a scope that encapsulates any resumable functions (Section 3) they initiate, either directly or indirectly. While resumable functions do not clean up their own stack frames upon the final `return` of their `main` phase (see Section 3.2.2), their lifecycle is ultimately managed by an ancestor ordinary function.

The responsibility for cleaning up all initialized resumable function frames (i.e., those that have completed their `init` phase and are awaiting or executing their `main` phase)—along with the ordinary function's own frame—falls to this ancestor ordinary function when it executes its final `return`. This cleanup is a unified process.

The comprehensive cleanup mechanism, triggered during the final return of an ancestor ordinary function, proceeds as follows for each frame it is responsible for (starting with its own frame and then unwinding any descendant resumable frames left on the stack above it):

1.  _Local Variable Cleanup (Reference Counting) for the Current Frame:_
    Starting at the top of the current frame's local variables (`BP + N_locals`) and moving down to `(BP + 1)` for ordinary functions, or from the top of active locals for resumable functions, check if each slot holds a heap-allocated object. If it does, decrement its reference count (freeing if zero).

2.  _Discard Locals and `main` entry address for the Current Frame:_
    The stack pointer `RP` is adjusted to effectively discard the local variables. For resumable frames, the “`main` entry address” slot at `(BP – 1)` (which holds the actual `main` entry address) is also conceptually discarded (it contains no ref-counted data). For an ordinary function's own frame, this step also discards its dummy value from the “`main` entry address” slot. `RP` would now conceptually point to `(BP + 0)` of the current frame being cleaned.

3.  _Restore Previous Frame's State (Caller of Current Frame):_
    *   Pop the value from `(BP + 0)` (the old BP of the caller of the current frame) into the `BP` register.
    *   Pop the value from `(BP – 2)` (the return address for the caller of the current frame) into the instruction pointer (`IP`).

4.  _Loop or Terminate:_
    *   If the newly restored `BP` points to another frame that needs cleanup as part of this same ancestor's unwinding process (i.e., it's a lower resumable frame in the chain, or the ancestor itself completing its own metadata slots), repeat steps 1-3 for this "new current" frame.
    *   If the newly restored `BP` and `IP` belong to the caller of the original ancestor ordinary function (i.e., the entire encapsulated scope has been cleaned), the cleanup is complete, and execution jumps to the restored `IP`, returning control to that caller.

This process ensures that no resumable function ever directly deallocates its own frame or cleans its own locals in its final return. All such frames are managed and cleaned by the ancestor ordinary function when its scope ends. The ordinary function's own frame is handled as the first part of this unified unwinding.

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
    1.  B performs its operations. Upon its final `return`, B itself does not clean up its stack frame (this cleanup is deferred to an ancestor ordinary function, typically A's ancestor, as per Section 4).
    2.  B pops `BP_A` from `(BP_B + 0)` into `BP`, restoring A's base pointer.
    3.  B pops B’s return address from `(BP_B – 2)` into `IP` and jumps there.
    B’s frame technically remains on the return stack (though inactive), to be cleaned up later by A's ancestor.

*   _A continues execution:_
    Control returns to A, at the instruction immediately following its call to B. `BP_A` is restored.
    *   _If A was in its `init` phase when it called B:_ A continues executing its `init` phase logic. If A subsequently reaches its `main` keyword, it completes its `init` phase by:
        *   Storing the address of its `main` phase entry point (the instruction at or after `main`) into `(BP_A – 1)`.
        *   Performing a standard return (as described in Section 3.1, popping `BP` from `(BP_A + 0)` and `IP` from `(BP_A – 2)`). This returns control to A's initiator. The function's handle (`BP_A`) is implicitly made available to the initiator. A's frame (and B's inactive frame above it) remains on the stack.
    *   _If A was in an invocation of its `main` phase when it called B:_ A continues executing its `main` phase logic. If A subsequently reaches its own `return` statement (signaling the end of the current `main` phase invocation), it performs a standard return (as described in Section 3.2.2, popping `BP` from `(BP_A + 0)` and `IP` from `(BP_A – 2)`). This returns control to A's invoker (the entity that called `eval` on A). A's frame (and B's inactive frame above it) remains on the stack, ready for future `main` phase invocations or eventual cleanup.

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
    *   Signifies the end of the one-time `init` phase and the start of the re-entrant `main` phase.
    *   When the `init` phase reaches `main` and is about to yield:
        1.  Store the address of the first instruction of the `main` phase (or instruction immediately following `main`) into `(BP – 1)`.
        2.  Execute a normal `return` to the initiator (restore initiator's BP from `(BP + 0)`, then restore initiator's return address from `(BP – 2)`). The function's handle (its BP) is made available to the initiator.

* _`eval` operation_

  1. Extract initialized function's handle (its BP) from the data stack into `saved_BP`.
  2. Store invoker's BP into `(saved_BP + 0)`.
  3. Store invoker's return address (instruction after `eval`) into `(saved_BP – 2)`.
  4. Set `BP := saved_BP`.
  5. Fetch `main` entry address from `(BP – 1)` and jump there (starts/resumes the `main` phase).

* _Cleanup of initialized/active resumable function frames:_
    *   Occurs only when an ancestor ordinary function executes its final `return`. Its epilogue walks down every local slot in its own frame and any descendant resumable frames, performs reference-count cleanup, conceptually discards `main` entry address slots, and restores BP and return address for each frame, in descending order, effectively unwinding the stack.

By adhering to this specification—return address at `BP – 2`, `main` entry address at `BP – 1` (for resumables), old BP at `BP + 0`, locals above—all functions manage their frames correctly, with resumable functions relying on an ancestor ordinary function for cleanup.
