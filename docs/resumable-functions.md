# Table of Contents

- [Table of Contents](#table-of-contents)
- [Resumable Functions](#resumable-functions)
  - [1. Conceptual Overview: Resumable Functions with Init/Main Phases](#1-conceptual-overview-resumable-functions-with-initmain-phases)
    - [1.1 Purpose and Design Goals](#11-purpose-and-design-goals)
    - [1.2 How the Model Works](#12-how-the-model-works)
  - [2. The Ordinary Tacit Function](#2-the-ordinary-tacit-function)
    - [2.1. Stack Frame Layout at Function Entry](#21-stack-frame-layout-at-function-entry)
    - [2.2. Constructing the Stack Frame](#22-constructing-the-stack-frame)
    - [2.3. Executing the Function Body](#23-executing-the-function-body)
    - [2.4. Final Return and Cleanup in Ordinary Functions](#24-final-return-and-cleanup-in-ordinary-functions)
      - [1. Unified Stack Value Cleanup](#1-unified-stack-value-cleanup)
      - [2. Restore the Caller’s BP](#2-restore-the-callers-bp)
      - [3. Discard the Reserved `main` Entry Slot](#3-discard-the-reserved-main-entry-slot)
      - [4. Restore the Caller’s Return Address and Transfer Control](#4-restore-the-callers-return-address-and-transfer-control)
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
  - [7. Summary of Stack Offsets and Operational Semantics](#7-summary-of-stack-offsets-and-operational-semantics)
    - [Stack Frame Layout (Relative to `BP`)](#stack-frame-layout-relative-to-bp)
    - [`main` Keyword: Transition Marker for Resumables](#main-keyword-transition-marker-for-resumables)
    - [`eval`: Re-entering a Resumable Function](#eval-re-entering-a-resumable-function)
    - [Cleanup: Resumable Frames Are Cleared by Ancestors](#cleanup-resumable-frames-are-cleared-by-ancestors)
    - [Key Invariants](#key-invariants)


# Resumable Functions

## 1. Conceptual Overview: Resumable Functions with Init/Main Phases

In Tacit, *resumable functions* represent a core abstraction for building stateful computations with stack-local persistence. Unlike conventional functions, which execute in one uninterrupted pass and clean up their own frames upon returning, resumable functions are structured to retain their stack frames across invocations. This enables them to act as reentrant closures—entirely without heap allocation or garbage collection.

Resumable functions are designed around a _two-phase execution model_: a one-time *initialization* phase, and a resumable *main* phase. A function becomes resumable simply by including the `main` keyword in its body. Until execution reaches this point, the function behaves exactly like a normal function. The transformation into a resumable is triggered explicitly and precisely by reaching the `main` keyword.

### 1.1 Purpose and Design Goals

The motivation behind resumables is both philosophical and practical. In systems where predictability, memory locality, and stack discipline matter—such as embedded systems, real-time logic, or compact VM environments—heap-based closures introduce complexity and uncertainty. Traditional closures capture variables via dynamic environments and require runtime memory management. Tacit avoids this entirely by using the return stack (`RP`) as the storage medium for persistent function state.

A resumable function captures its execution environment by simply *not cleaning up* when it returns from the init phase. Its stack frame remains live. A handle—represented by the function's `BP`—is returned to the caller. This handle can be used later to invoke the function’s `main` phase as many times as needed, always resuming with the original state.

This gives resumables a unique blend of _stack persistence_, _heap-free memory safety_, and _composable control flow_. They support generator-like patterns, long-lived computations, or even coroutines (if layered appropriately), but all within the same predictable, linear memory model.

### 1.2 How the Model Works

Resumables are divided by the `main` keyword into two regions:

1. _Initialization Phase (Init)_
   This is all code from the function’s start up to the `main` keyword. When the function is called normally, this code executes just like any other Tacit function. Local variables declared during this phase are allocated on the return stack, above the `BP`, and may include complex state like counters, accumulators, or configuration data.

2. _Transition via `main`_
   The `main` keyword signals the end of the initialization phase. When encountered, it executes a special instruction that does two things:

   * Records the entry point for the main phase by writing the address of the instruction immediately after `main` into the slot at `(BP – 1)`.
   * Performs a return that *does not clean up* the function’s stack frame. Instead, it returns the base pointer (`BP`) as a resumable handle to the caller. The caller now holds a reference to a suspended computation whose locals remain valid.

3. _Main Phase_
   Later, the caller can invoke the resumable’s main phase using `eval` and the saved handle. The runtime re-enters the function at the address stored in `(BP – 1)`, restoring the caller’s `BP` and return address as needed. Each invocation of the main phase sees the same preserved locals from the init phase, as if the function had simply paused.

Conceptually, the `init` phase "closes over" the persistent state, making it available each time the `main` phase is subsequently entered. The term *resumable* refers to this ability to pause and later resume execution at a defined entry point, with the function's state intact. Multiple resumables may coexist within the same return stack scope, independently retaining their own frames and persistent variables. Importantly, they are not linked in a chain or hierarchy; rather, they are all enclosed within the dynamic extent of a conventional ancestor function that ultimately manages their cleanup. This model enables efficient stack-based persistence without requiring heap allocation, closures, or complex scheduler infrastructure.

## 2. The Ordinary Tacit Function

### 2.1. Stack Frame Layout at Function Entry

When a function is entered—whether it is an ordinary function or a resumable one—the VM constructs a new stack frame on the return stack. This frame includes both metadata and space for local variables. The layout of this frame is fixed and consistent, using the base pointer (`BP`) as a stable reference.

Immediately after function entry, the layout of the return stack from lower to higher addresses is as follows:

* `BP – 2`: The caller’s return address — the instruction pointer to return to when this function completes.
* `BP – 1`: A reserved slot for a possible resumable `main` entry point. For ordinary functions, or for resumables before reaching the `main` keyword, this slot holds an unused placeholder value.
* `BP + 0`: The caller’s base pointer. This enables the function to restore the caller’s frame upon return.
* `BP + 1 … BP + N`: The current function’s local variables. These slots are reserved based on the number of locals determined at compile time.

No function code may overwrite the three metadata slots at `BP – 2`, `BP – 1`, or `BP + 0`. All local variables are stored at positive offsets from `BP`, starting at `BP + 1`.

### 2.2. Constructing the Stack Frame

To establish the layout described above, the caller performs the following steps during a function call:

1. **Write the return address.**
   The instruction pointer for the return address is written to the current top of the return stack. This will become `BP – 2` in the callee’s frame.

2. **Write a placeholder for the main entry.**
   A second value is written to the next available return stack slot. This is reserved for storing the entry point of a resumable function’s `main` phase. At this point, it contains a placeholder (e.g., zero). This becomes `BP – 1` in the callee’s frame.

3. **Write the caller’s base pointer.**
   The current `BP` is stored into the next slot. This becomes `BP + 0` in the callee’s frame.

4. **Set the new base pointer.**
   The base pointer for the new function is now updated to point to the location where the caller’s BP was just stored. In effect, `BP := RP` at this point, where `RP` is the current return stack pointer.

5. **Reserve space for local variables.**
   The return stack pointer is incremented by the number of local variables required. These new slots begin at `BP + 1` and end at `BP + N`, where `N` is the number of local variables known at compile time.

After these steps, the complete frame layout is:

```
BP – 2 : caller’s return address
BP – 1 : reserved slot for main entry address
BP + 0 : caller’s base pointer
BP + 1 … BP + N : function’s local variables
RP     : points at BP + N
```

Execution of the function body then begins. Any access to local variables is performed relative to `BP`, using offsets starting from `+1`.

Here is a clearer, more readable version of **Sections 2.3 and 2.4**, with no information lost. All stack behavior is preserved exactly as in your original, but the flow and structure have been improved for better comprehension.

---

### 2.3. Executing the Function Body

Once the function has entered and the stack frame is in place, execution proceeds as follows:

* **Accessing locals**: Writing to a local variable stores into the slot at `BP + k`, where `k` is the local’s index.
* **Calling another function**: When this function invokes another function (ordinary or resumable), the runtime creates a new stack frame on top of the current one. This includes:

  * The callee’s return address,
  * A reserved slot for a possible `main` entry (used only by resumables),
  * The current function’s `BP`, which becomes the callee’s `BP + 0`.
    The callee then allocates its own locals above that.
* **Returning from a callee**: When the called function finishes, its stack frame is removed, and control returns to the calling function. The base pointer (`BP`) is restored to this function’s frame, allowing local access to resume correctly.

If the current function is an ordinary function, it continues executing until it reaches its final `return`, at which point it performs a complete teardown of its own stack frame.

---

### 2.4. Final Return and Cleanup in Ordinary Functions

Ordinary (non-resumable) functions in Tacit are responsible for fully cleaning up their own stack frames upon returning. This is done through a systematic process that ensures all values within the function’s dynamic extent—locals and any descendant resumable frames—are removed.

The return sequence consists of the following steps:

#### 1. Unified Stack Value Cleanup

Before returning, the function performs a cleanup loop that walks down the return stack from the current return stack pointer (`RP`) to the function’s base pointer (`BP`). This loop is responsible for releasing all values the function is responsible for, including:

* Its own local variables,
* Any leftover values from resumable functions it created or invoked.

For each slot above `BP`, the function:

* Checks whether the value is reference-counted, and if so, decrements the reference count,
* Then decrements `RP`, effectively removing the value from the return stack.

This continues until `RP == BP`. At this point, the return stack is cleared of all values associated with this function or any functions it called within its dynamic scope.

#### 2. Restore the Caller’s BP

The slot at `BP + 0` contains the caller’s base pointer. This value is copied into the `BP` register to restore the previous frame. The return stack pointer is then decremented.

#### 3. Discard the Reserved `main` Entry Slot

The value at `BP – 1` is a placeholder used by resumables for their `main` phase entry point. In ordinary functions, this is always a dummy value. It is now discarded, and `RP` is decremented.

#### 4. Restore the Caller’s Return Address and Transfer Control

Finally, the slot at `BP – 2` holds the return address. This address is copied into the instruction pointer (`IP`), and execution resumes at that location. The stack pointer `RP` is decremented one last time.

**Result:**
After these four steps, the ordinary function has fully removed its stack frame, restored the caller’s context, and transferred control. The return stack is now exactly as it was before the function was called.

## 3. The Resumable Tacit Function (Init/Main Phases)

### 3.1. Initialization Phase and the `main` Keyword Demarcation

A resumable function—identified by the presence of a `main` keyword within its definition—is initially invoked using the standard calling protocol for ordinary Tacit functions (see Section 2.1, "Calling an Ordinary Function"). If the function completes and returns without reaching the `main` keyword, it behaves exactly like a normal function: it cleans up its own stack frame on return (as described in Section 2.4), and no resumable behavior is ever triggered.

However, if execution reaches the `main` keyword, this marks the end of the initialization phase. The `main` keyword itself is compiled into a special VM instruction (or opcode) that, when executed at runtime, performs a special epilogue to conclude initialization and convert the function into an initialized resumable:

* _Store the resume entry point_: Write the instruction address at or immediately following the `main` keyword into the frame slot at `(BP - 1)`. This marks the entry point for the resumable’s `main` phase.

* _Return control to the caller_: Perform a plain return by restoring two tagged values in sequence:

  1. Load `BP` from `(BP + 0)` to restore the caller’s base pointer.
  2. Load the instruction pointer from `(BP - 2)` and jump to it, returning to the caller.

Importantly, this return does _not_ adjust the return stack pointer or clean up any local variables. The region from `(BP + 1)` through `(BP + N_locals)` (along with the stored resume address at `(BP - 1)`) remains untouched. The entire frame is preserved on the return stack in its initialized state, ready for the `main` phase to be resumed at a later time. Cleanup is deferred to an ancestor frame.

### 3.2. Invoking the `main` Phase and Subsequent Exit

#### 3.2.1. Invoking the `main` Phase via `eval`

To resume the `main` phase of an initialized resumable function, the caller places the function’s handle—a tagged `BP` value returned from the `init` phase—on the data stack and invokes `eval`. The `eval` operation performs the following steps:

1. _Extract the function handle into a temporary (`saved_BP`)_
   This is the base pointer of the previously initialized resumable frame.

2. _Store the current `BP` into `(saved_BP + 0)`_
   This saves the caller’s base pointer into the resumed frame’s "old BP" slot, linking the two frames.

3. _Store the caller’s return address into `(saved_BP – 2)`_
   The return address—pointing to the instruction immediately following the `eval` call—is saved into the frame. This ensures that the resumed function will return to the right place.

4. _Set `BP := saved_BP`_
   This activates the resumable’s frame. At this point:

   * `(BP – 2)` holds the return address for when the `main` phase completes.
   * `(BP – 1)` holds the stored resume entry point (set during the `init` phase).
   * `(BP + 0)` holds the invoker’s saved `BP`.
   * `(BP + 1 … BP + N_locals)` remain unchanged, still holding the persistent local variables.

5. _Jump to the resume address at `(BP – 1)`_
   Execution of the `main` phase begins at the stored resume address. This address was captured during the `main` keyword execution in the `init` phase.

No pushes, pops, or return stack pointer adjustments are performed during `eval`. The resumed frame was already fully constructed during the `init` phase. `eval` simply links the current caller to it and jumps to the correct continuation point.

#### 3.2.2. Final Return from the `main` Phase (No Self-Cleanup)

When the `main` phase reaches its final `return`, the function must not attempt to clean up its own locals. Resumables preserve their stack frame; cleanup is deferred to an ancestor frame. The return sequence is:

1. _Restore the caller’s base pointer_
   Load the saved base pointer from `(BP + 0)` into `BP`. This reactivates the caller’s frame.

2. _Restore and jump to the caller’s return address_
   Load the return address from `(BP – 2)` and jump to it. This address was saved by the invoker during `eval`.

At this point, execution resumes in the caller as if `eval` had returned. The resumable frame remains completely intact on the return stack, including all local variables and the stored `main` entry point. It is now ready for another invocation or eventual cleanup by the ancestor that owns the stack.

## 4. Encapsulation and Unified Cleanup by Ancestor

Tacit's function protocol ensures that every resumable function (Section 3) operates within the encapsulating scope of a conventional (non-resumable) function (Section 2). This ancestor function—typically the one that initiates the resumable directly or indirectly—ultimately owns and manages the entire cleanup process.

When a resumable function reaches the end of its `main` phase and executes a `return`, it does not deallocate or alter its stack frame. All local variables, metadata, and the stored resume address remain intact. Responsibility for cleanup is deferred entirely to the enclosing conventional function.

The cleanup of all such descendant resumable frames is performed automatically when the ancestor conventional function completes and returns. This happens through the _unified cleanup loop_ described in Section 2.4, Step 1.

Specifically, when the ancestor function begins its final return:

* It initiates a single loop that walks the return stack from the current stack pointer (`RP`) back to its own base pointer (`BP`).
* Any resumable frames that were initialized within the ancestor’s dynamic call region (i.e., frames whose `init` phase completed but which have not been cleaned up) are located between `RP` and the ancestor's `BP`.
* As this loop proceeds:

  * It checks each stack slot, including persistent locals, metadata, and resume addresses (e.g., values at `(BP - 1)` of resumables).
  * For each slot, if the value is reference-counted, its count is decremented.
  * The stack pointer is decremented, removing the value from the stack.

This process naturally and completely erases all resumable state established within the ancestor’s frame scope. No special-case logic is required to handle resumables—the same linear scan over the stack suffices.

After this unified cleanup loop finishes (i.e., when `RP == BP`), the conventional function then restores its own return context via the remaining return steps (Section 2.4, Steps 2–4):

1. Restore the caller’s base pointer from `(BP + 0)`.
2. Discard the stored resume address (typically at `(BP - 1)`).
3. Fetch the return address from `(BP - 2)` and jump to it.

This protocol guarantees that all local frames—including those of resumables—are safely deallocated as part of the ordinary function return path. No resumable ever performs its own cleanup. The enclosing conventional function handles everything in one final, coherent pass.

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

## 7. Summary of Stack Offsets and Operational Semantics

### Stack Frame Layout (Relative to `BP`)

Each function’s stack frame—ordinary or resumable—follows the same base layout:

* **`BP – 2`** — *Caller’s Return Address*
  The address to jump to after the current function completes.

* **`BP – 1`** — *Reserved “main entry address” slot*
  Used only by resumable functions. After the `init` phase, this slot is updated to store the address where the `main` phase begins. Ordinary functions leave this as a dummy value.

* **`BP + 0`** — *Caller’s Base Pointer*
  The previous function’s `BP`, saved here so it can be restored during return.

* **`BP + 1 … BP + N`** — *Local Variables*
  This function’s local variables occupy these slots, with count `N` determined at compile time.

### `main` Keyword: Transition Marker for Resumables

In resumable functions, the `main` keyword marks the boundary between the `init` and `main` phases. It compiles into a dedicated VM instruction with the following runtime behavior:

1. **Store main entry point:**
   The VM writes the address of the instruction immediately following `main` into `BP – 1`. This becomes the resume address for future `eval` calls.

2. **Yield to caller via return:**
   The function performs a special return that:

   * Restores the caller’s `BP` from `BP + 0`.
   * Restores the caller’s return address from `BP – 2` and jumps to it.
   * Leaves the current function’s frame (including locals and main entry) intact on the return stack.

The returned value is a tagged handle representing the function’s `BP`. This handle can be passed or stored for later use.

### `eval`: Re-entering a Resumable Function

To invoke the `main` phase of an already-initialized resumable function, the caller places the tagged handle (i.e., the function’s `BP`) on the data stack and executes `eval`. Internally, this performs:

1. **Extract the handle:**
   Move the tagged `BP` from the data stack into a temporary register (`saved_BP`).

2. **Store the caller’s BP:**
   Write the current `BP` (i.e., the invoker's) into `saved_BP + 0`.

3. **Store the caller’s return address:**
   Write the address of the instruction following `eval` into `saved_BP – 2`.

4. **Switch base pointer:**
   Set `BP := saved_BP`, making the resumable’s frame active.

5. **Jump to main:**
   Fetch the stored resume address from `BP – 1` and begin execution of the `main` phase.

### Cleanup: Resumable Frames Are Cleared by Ancestors

Resumable functions do **not** clean up their own frames when `main` returns. Instead, cleanup is delegated to an enclosing **ordinary function** that initiated them. During that function’s final `return`, the cleanup process:

* Walks from the current return stack pointer (`RP`) down to its own `BP`.
* Performs reference-count cleanup on all local values in this region—including any live resumable frames.
* Discards reserved `main` entry slots and locals.
* Restores BP and return addresses for itself.

This unified cleanup ensures stack hygiene and consistent deallocation, without requiring resumables to manage their own frame teardown.

### Key Invariants

By following these rules:

* `BP – 2` always holds the return address.
* `BP – 1` is reserved for the `main` entry address (if needed).
* `BP + 0` stores the caller’s BP.
* Locals begin at `BP + 1`.

All functions—ordinary or resumable—can be composed and nested safely, with predictable behavior and a consistent frame structure.
