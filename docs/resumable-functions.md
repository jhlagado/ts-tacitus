# Resumable functions

## Table of Contents

1. [Purpose and Motivation](#1-purpose-and-motivation)
2. [Core Concepts of Two-Phase Execution](#2-core-concepts-of-two-phase-execution)
3. [Call and Return Mechanics](#3-call-and-return-mechanics)
4. [Syntax and Keywords](#4-syntax-and-keywords)
5. [Interaction Scenarios and Stack Management](#5-interaction-scenarios-and-stack-management)
6. [Error Handling & Early Termination in Resumables](#6-error-handling--early-termination-in-resumables)
7. [Reentrant & Recursive Resumable Calls](#7-reentrant--recursive-resumable-calls)
8. [Integration into the Tacit Compiler & Full Example](#8-integration-into-the-tacit-compiler--full-example)


## 1. Purpose and Motivation

Resumable functions exist to fill a gap in Tacit’s execution model: the need for lightweight, stack-allocated routines that can suspend, preserve local state, and resume later, all without relying on heap allocation or language-level closures. In conventional Tacit, a standard function call allocates a fresh stack frame, runs to completion, and then immediately unwinds its frame—its local variables and any state vanish at return time. That behavior makes it hard to write code that must “pause” partway through, retain its local variables, and pick up exactly where it left off on the next invocation.

Consider two common patterns:

1. **Streaming or generator-style loops**. You want a function that yields one value at a time—say, iterating through a range or producing values from a computation—while holding on to internal counters and state between yields. In many languages, you’d use a generator or coroutine, which implicitly captures local variables in a heap-allocated frame. Tacit does not have built-in heap-allocated closures, so implementing that pattern is clumsier: you must manually allocate and manage structures on the heap or complicate your caller with explicit state passing. Neither approach fits Tacit’s goal of keeping everything simple, low-overhead, and stack-based.

2. **Persisting local state across repeated calls**. Imagine a function that needs to set up some information once—open a file, establish network parameters, initialize counters—and then on subsequent calls merely perform incremental work, using the previously initialized state. In a conventional Tacit function, you’d either re-run the setup each time (wasting work) or push state into global variables or an explicitly allocated heap structure (adding complexity and breaking modularity).

Resumable functions address these scenarios by allowing a single function to behave like both an “initializer” and a “stepper.” On the very first call—the **init phase**—the function allocates its local variables on the return stack, performs any one-time setup, and then returns a handle (a saved base pointer) to the caller. Crucially, the return stack frame is left in place rather than unwound. The function exits, leaving its locals intact. When the caller later wants “the next step,” it invokes the same function again—but at a different entry point, the **main phase**, passing in that saved base pointer. Execution resumes from where the function left off, with all its locals still accessible. After each “main” call, the function again returns, leaving its stack frame intact for future resumption. Only when the function finally indicates it is completely done does its frame get unwound.

In technical terms, resumable functions implement a **two-entry-point** model (init and main) that share one continuous stack frame. The **init entry** sets up state, then yields and returns the child’s base pointer. The **main entry** uses that saved base pointer to reestablish the function’s frame and continue executing until the next yield or final return. At main-exit, only the base pointer and return address are restored to parent scope; the stack pointer doesn’t change, so the child’s locals remain available for the next resume.

By adopting this pattern, Tacit achieves:

* **Stack-allocated persistence**. All local variables live on the return stack. No heap, no explicit allocation, no garbage collection.

* **Closure-like behavior**. A resumable function can capture its entire local environment (all variables) without needing an anonymous function or heap closure. The saved base pointer effectively *is* the closure handle.

* **Transparent caller interface**. From the parent’s perspective, calling a resumable’s init just returns a pointer; calling its main is just like any function call, except that locals persist invisibly on the stack.

* **Efficient incremental execution**. Code that needs to produce one item at a time or maintain state between steps can do so without re-initialization overhead.

* **Predictable, linear control flow**. There is no runtime scheduler or event loop. Everything is encoded as structured assembly-like jumps and returns. The essential mechanism is that the function’s stack frame is not unwound between calls, preserving its state.

Because Tacit aims for a **single-pass compiler** with minimal runtime complexity, resumable functions align perfectly with the language’s philosophy. They leverage the return stack’s natural ability to hold local state, they use fixed offsets for locals (ensuring that variable access is just a constant offset from base pointer), and they rely on two known entry offsets (start of func for init, and a fixed offset for main) to implement suspension and resumption. In other words, resumables give Tacit the expressive power of generators, coroutines, and simple closures—while preserving a tiny, explicit, stack-focused runtime.

Putting it all together, the purpose of resumable functions is to provide a **first-class, stack-safe, incremental** execution primitive. Instead of mimicking closures through unpredictable heap mechanics, Tacit’s resumables let you interleave “setup once” and “step many times” code in a single function, with **persistent stack frames** and **strictly controlled return behavior**. That solves problems around streaming sequences, event loops, interactive data generators, and any scenario where local state must outlive a single invocation—without ever leaving the return stack.

**2. Structure of a Resumable Function**

This section defines the internal anatomy of a resumable function in Tacit—how its code is arranged into two linked “phases” (init and main), how those phases share a single stack frame, and how control flows between them.

---

## 2. Core Concepts of Two-Phase Execution

### 2.1 Two Canonical Entry Points

1. **Init Entry (offset 0)**

   * When you first call a resumable, you invoke its *init* entry point. In compiled form, this is literally the start of the function body (byte‐offset 0).
   * The init entry handles all one‐time setup, including:

     * Pushing the return address (RA) and the *parent* base pointer (BPₚ) onto the return stack
     * Establishing a *new* base pointer (BPᶜ) that marks the child scope
     * Allocating local variables (including any “state” blocks) by bumping the return stack pointer (RSP) relative to BPᶜ
     * Copying any initialization arguments from the data stack into those locals
   * At the conclusion of init, the function must:

     1. Push **BPᶜ** (the child’s new base pointer) onto the data stack
     2. Restore the *parent* BP (BPₚ) and RA by popping them from the return stack
     3. Execute a normal RET, so control returns to the caller—but leaving RSP extended (so the child’s locals remain in place)

2. **Main Entry (fixed offset)**

   * To resume, you invoke main. That call jumps not to byte‐offset 0, but to a known “resume offset” a few bytes in (e.g. offset 3). All compiled resumables use a convention: offset 0 = init; offset 3 (or whatever fixed displacement) = main.

   * When you call main, you supply only one data‐stack argument: the previously returned BPᶜ. Main does:

     1. Push RA (the new return address) and the *caller’s* BP onto the return stack—but it does **not** bump RSP beyond the child’s locals. Instead, it leaves RSP where it was after init.
     2. Pop the passed‐in BPᶜ from the data stack and assign it to BP. Now the local frame (child’s state) is reestablished.
     3. Proceed to execute “step” logic, starting precisely at the first byte after where init ended.

   * At the end of main, the function must:

     1. Pop RA and the *old* BP from just below RSP—these were the values pushed on main entry
     2. Assign the popped old BP back to BP, restoring the caller’s context
     3. RET, which returns control to the caller—again leaving RSP unchanged so that the child’s locals remain intact for any further resumes

---

### 2.2 Shared, Persistent Stack Frame

* **Single Frame for Both Phases**
  Init and main share exactly the same region of return‐stack memory: they both use BPᶜ as their frame base. There is never a second allocations region. Once init allocates (bumps RSP) for all local variables, that RSP remains fixed—no further pushes or pops alter it, except when nested calls or nested resumables intervene.

* **Layout Example (after init completes)**
  (Addresses grow “upwards” as RSP increases—lowest address at BPᶜ.)

  ```
   ┌─────────────────────────┐  ‹‹‹‹  RSP after init  
   │ … (higher‐level frames) │  
   ├─────────────────────────┤  
   │ child-local-N           │  (BPᶜ + (N − 1))  
   │ …                      │  
   │ child-local-2           │  (BPᶜ + 1)  
   │ child-local-1           │  (BPᶜ + 0)  
   ├─────────────────────────┤  ‹‹‹‹  BPᶜ  
   │ saved BPₚ               │  (BPᶜ − 1) — pushed by init  
   │ saved RA                │  (BPᶜ − 2) — pushed by init  
   ├─────────────────────────┤  ‹‹‹‹  (older return stack)  
  ```

  Key points:

  * The region from BPᶜ up to just below RSP holds *all* child locals (state variables, temporaries, any additional bump‐allocated variables).
  * Immediately below BPᶜ are two slots: (BPᶜ − 1) holds the parent BPₚ, and (BPᶜ − 2) holds the RA that was pushed at init entry.

---

### 2.3 Control‐Flow Between Init and Main

1. **Init → Normal Return**

   * Init does not jump into main at all. Instead, after finishing all one‐time setup, it executes:

     * `PUSH BPᶜ` (onto the data stack)
     * `POP RA` and `POP BPₚ` from the return stack
     * `RET` (return to caller’s continuation)
   * RSP remains where it was immediately after init’s last local allocation. That ensures the child’s locals persist.

2. **Caller Holds BPᶜ**

   * The caller receives BPᶜ on its data stack, typically storing it in a local variable or passing it to a trampoline. The returned BPᶜ is the “resume token.”

3. **Main → Resume Execution**

   * When the caller wants the next step, it does something like:

     ```
     <BPᶜ> CALL‐MAIN function-address  
     ```

     i.e. push BPᶜ onto the data stack, then call at offset +3.

   * Main entry code:

     1. **PUSH** current RA and current BP (caller’s BPₚₚ) onto return stack
     2. **POP** BPᶜ from data stack; assign to BP
     3. Run the “body” starting where init left off (the first instruction after init’s return sequence)
     4. When that body executes a `RET` (or yields again), it must:

        * **POP** RA and **POP** old BPₚₚ from return stack
        * **RET** to caller (the trampoline or parent) with RSP unchanged

Each time main returns, RSP is unchanged (child locals still reside), and the child’s frame can be reentered again with the same BPᶜ—allowing arbitrarily many resumes.

---

### 2.4 Key Characteristics of This Two‐Phase Structure

* **No Heap or Closure Overhead**
  All local variables—even persistent ones—live on the return stack. There is no extra “heap frame” or GC. Once init allocates them, main continues to reuse the same memory.

* **Predictable Offsets**
  Because both init and main share BPᶜ, every local variable has a fixed offset from BPᶜ. Field accesses, temporary slots, or any promoted data do not shift at runtime—there is no dynamic re‐layout.

* **Clear Separation of One‐Time vs. Repeated Work**
  Init is guaranteed to run exactly once. Any code that must set up state goes there. Main never re‐encounters init code, because the compiler ensures that init’s `RET` is executed before any main instructions.

* **Minimal Resume Token**
  The only data the caller needs to hold is BPᶜ. There is no need to return or manage a separate “resume address,” since main’s entry offset is fixed and known to both compiler and caller.

* **Flat, Single‐Pass Compilation**
  The entire function body (init + main) is emitted in one linear sequence. Macros and patching insert jumps to skip sections depending on entry point. No backpatch tables or multi‐pass label resolution are required.

* **Stack Hygiene**

  * Init’s `RET` restores parent BPₚ and RA but leaves RSP extended.
  * Main’s `RET` restores caller BPₚₚ and RA but again leaves RSP extended.
  * This ensures that child locals never get popped until the parent chooses to do so (e.g., final cleanup or explicit promotion of the child).

Together, this two‐entry‐point, shared‐frame design is the core structure of every resumable function. It enables persistent, stack‐allocated state across calls, tightly controlled return behavior, and a minimal resume token—exactly what Tacit needs for efficient, closure‐like routines without a heap.
**3. Comparison to Normal Functions**

Resumable functions may appear, at first glance, similar to standard Tacit functions, but under the hood their calling conventions, lifetime rules, and stack‐management semantics differ in crucial ways. This section examines those differences in depth, illustrating exactly how init/main behavior contrasts with a typical function call and why those contrasts matter.

---

## 3. Call and Return Mechanics

### 3.1 Call/Return Sequence

#### 3.1.1 Standard Function Call

1. **Caller Setup**

   * The caller places any required arguments onto the *data stack*.
   * The caller executes a `CALL` (or equivalent), which:

     1. Pushes the return address (RA) onto the *return stack*.
     2. Pushes the current base pointer (BPₚ) onto the return stack.
     3. Sets a new base pointer (BPₙ) to the current return stack pointer minus any fixed offset.
     4. Optionally bumps RSP further to allocate space for locals (if the function has local variables).

2. **Callee Execution**

   * The function body executes, using *BPₙ* as the frame base:

     * Local variables occupy slots at BPₙ + 0, BPₙ + 1, etc.
     * Further temporaries or function‐nested blocks can bump RSP above BPₙ.

3. **Return**

   * When the callee executes `RET` (or reaches its final instruction):

     1. It pops RA and the old BPₚ from the return stack.
     2. Assigns old BPₚ back into BP.
     3. Pops local stack space (if any) by resetting RSP to the value implied by BP.
     4. Jumps to RA, resuming the caller.

As a result, **every local allocation is fully de‐allocated** on return; the caller’s return‐stack pointer is in exactly the same state as before the call. Data‐stack arguments have been consumed (or overwritten) by callee‐provided results.

---

#### 3.1.2 Resumable Function Call

Resumables have two distinct call patterns—**init** and **main**—each of which shares a single persistent frame. Because that frame must remain open across calls, their call/return sequence omits the usual stack unwind.

**`Init` Phase Call (first invocation)**

1. **Caller Setup**

   * Place *initialization arguments* onto the data stack (e.g., setup parameters).
   * Execute a special `CALL‐INIT` (or equivalent jump) to *offset 0* of the function.

2. **Callee (`init`) Entry**

   * Callee pushes RA onto the return stack.
   * Callee pushes caller’s BPₚ onto the return stack.
   * Callee assigns BPᶜ = current return‐stack pointer (marking the child’s frame base).
   * Callee bumps the return stack pointer (RSP) upward by *N* slots to allocate all locals (`state` vars, counters, etc.).

3. **One‐Time Setup**

   * The code inside `state { … }` blocks (and any other init‐only logic) executes, storing values into locals at offsets relative to BPᶜ.
   * If there are additional calculated expressions (e.g., `3 + 2 -> x` inside a `state` block), they run exactly once, consume data‐stack values if any, and assign to the appropriate local.

4. **Return with Persistent Frame**

   * Callee pushes the *child’s BPᶜ* onto the data stack as the “resume token.”
   * Callee pops old BPₚ and RA from the return stack, restoring the caller’s BP and return address.
   * Crucially, **RSP remains at the top of the child‐local region**. The frame is left intact (locals still allocated).
   * Callee executes a normal `RET`. The caller receives BPᶜ and can now resume later.

At this point, the parent’s BP and RA are restored *exactly* as if a normal function had returned—but the child’s locals (“state”) remain laid out on the return stack immediately above BPᶜ. The parent can store BPᶜ anywhere (often in a local variable) and call it back.

---

**`Main` Phase Call (subsequent resumes)**

1. **Caller Setup**

   * Push the saved BPᶜ onto the data stack (no other arguments).
   * Execute a `CALL‐MAIN` jump to the *fixed resume offset* (e.g., byte 3) of the same function.

2. **Callee (`main`) Entry**

   * Callee pushes RA onto the return stack.
   * Callee pushes caller’s BP (BPₚₚ) onto the return stack—but **does not** alter RSP (child locals remain below).
   * Callee pops the passed BPᶜ from the data stack and assigns BP = BPᶜ, reestablishing the child’s frame base.
   * The code pointer is already at the first `main` instruction (immediately after init).

3. **One‐Step Execution**

   * Any code outside `state {}`—the “body” of the resumable—executes, using locals at BP + offset. This might:

     * Read or modify the locals initialized by `init`.
     * Perform a `return` if done, or push new data for the caller to consume.

4. **Return Without Unwind**

   * Callee reads old RA from BPᶜ − 2 and pops it into a temporary.
   * Callee reads old BPₚₚ from BPᶜ − 1 and restores BP to BPₚₚ.
   * **RSP remains unchanged**, leaving child locals intact.
   * Callee executes `RET` to old RA.

After `main` returns, the child’s locals remain allocated between BPᶜ and RSP. The caller can again invoke `CALL‐MAIN` with the same BPᶜ to continue executing the next step. Only when the child signals final completion (e.g., running out of loop or reaching an explicit “done” condition) does the parent choose to pop its locals manually—there is no implicit automatic cleanup.

---

### 3.2 Local‐Variable Lifetime

* **Normal Functions**: All locals are ephemeral. On return, the function’s frame is completely unwound—BP and RSP are restored to their pre‐call values.
* **Resumables**: Locals allocated during `init` become *persistent state*. They live on after the first `RET`, and `main` can use and update them across multiple invocations. The only way for those locals to be removed is if the parent explicitly reduces RSP (e.g., by popping local slots), usually after the resumable is fully done.

Because no function call implicitly pops RSP when returning from a readable resumable, the child’s locals effectively “merge” into the parent’s stack. This design choice ensures that nested or repeated resumables all share one continuous stack region.

---

### 3.3 Argument Passing Differences

1. **Standard Function**

   * Each call consumes its arguments immediately, and possibly returns a value.
   * Caller and callee agree on an argument‐count contract: for example, if `: add ( a b -- sum )`, then two values are on the data stack at call.

2. **Resumable Init**

   * The init phase is the only time the resumable consumes arguments. These arguments might be configuration parameters, initial values, or setup tokens.
   * Init assigns them to locals (via `->`) at offsets relative to BPᶜ—for example, storing `arg1 -> x` and `arg2 -> y` in the child frame.
   * After that, `init` *only* returns BPᶜ. No other return values.

3. **Resumable Main**

   * Main takes exactly **one** argument: BPᶜ. All “real” data for the computation lives in the child’s locals already.
   * It never expects or consumes any further parameters on the data stack (unless the user explicitly pushes additional arguments each time, but that is discouraged because those new args would clash with the existing locals).
   * If the resumable needs to accept fresh parameters at each step, those must be written into the child’s locals (e.g., \`stack  passes new values into locals via specialized macros or a dedicated assignment).

By enforcing this split—init consumes real “setup” args once, main consumes only BPᶜ—Tacit avoids confusion and stack‐mismatch errors when resuming a function.

---

### 3.4 Cleanup and Scope Restoration

* **Normal**: `RET` always pops local frame entirely.
* **Resumable Init**: `RET` restores BPₚ and RA, but leaves RSP extended. (Child locals live on.)
* **Resumable Main**: `RET` restores BPₚₚ and RA, but again leaves RSP extended. (Child locals remain.)

The key is that *neither* init nor main unwinds the child’s local frame on their own. Only the *caller* may, at some later point, shrink RSP if it wants to “delete” that child’s locals. This allows multiple nested resumables to coexist in the same ancestor’s frame without interfering with one another.

---

### 3.5 Use‐Case Illustration

**Scenario**: A resumable that generates Fibonacci numbers, taking a pair of seed arguments once, then returning each Fibonacci value on demand.

1. **Init Call** (`fib‐init`):

   * Caller pushes seeds `1 1` on data stack and does `CALL‐INIT fib`.
   * `init` pushes RA, pushes BPₚ, sets BPᶜ, allocates `a`, `b` locals, and does `1 -> a`, `1 -> b`.
   * Returns BPᶜ on data stack, restoring BPₚ and RA.

2. **First Main Call** (`fib‐main BPᶜ`):

   * Caller gets BPᶜ, pushes it, and jumps to `fib+3`.
   * Callee pushes RA, pushes BPₚₚ, pops BPᶜ into BP. Now locals `a=1`, `b=1`.
   * Calculates `a` (1), pushes that as output, then computes `new = a + b` (2), updates `a = b (1)`, `b = new (2)`.
   * `RET` pops BPₚₚ and RA, leaving BPᶜ unchanged and leaving `a=1, b=2` in locals. Caller sees “1” as result.

3. **Second Main Call** (`fib‐main BPᶜ`):

   * Caller re‐pushes BPᶜ, calls offset 3.
   * Callee pushed RA & BPₚₚ, restored BPᶜ. Locals `a=1, b=2`.
   * Calculates `a` (1), updates `a=2, b=3`, returns “1”.

4. **Third Main Call** → returns “2”, with locals now `a=3, b=5`.

Notice how *at no point* does the function re‐initialize `a` and `b` or lose their values. They survive entirely on the child’s frame. A normal function would have to re‐compute or rely on external storage for this behavior; the resumable does it purely on the return stack.

---

### 3.6 Why These Differences Matter

1. **Performance**

   * No heap allocations → no GC or malloc overhead. Local state resides in pre‐allocated return stack slots.

2. **Simplicity**

   * Calling a resumable—push one pointer, jump to offset—is straightforward. No need for wrapper closures or callback objects.

3. **Stack Discipline**

   * Every resumable’s locals flow into the same ancestor frame. You never end up with multiple disparate heaps or closures scattered throughout memory. You simply walk RSP backward if you want to free everything.

4. **Expressiveness**

   * Patterns like generators, event‐driven callbacks, and interactive loops become trivial to express without introducing new runtime abstractions. A single Tacit function can “pause” via `main` return, then “resume” automatically with its locals intact.

Because Tacit’s design emphasizes a **single‐pass, stack‐oriented compiler**, these resumable conventions fit naturally. By carefully contrasting normal and resumable behavior—especially around argument consumption, return semantics, and cleanup rules— programmers understand exactly how to write init‐only versus main‐only code, how to manage persistent locals, and how to integrate resumables seamlessly with existing Tacit functions.

**4. Function Structure: Init and Main**

Every resumable function in Tacit is conceptually one contiguous block of code, but it is logically split into two distinct “phases,” each with its own entry point and responsibilities. This section examines how those two phases—**init** and **main**—are laid out in the compiled output, how control transfers between them, and how local‐variable allocation is handled across both.

---

### 4.1 Two Named Phases, One Shared Frame

1. **Init Phase**

   * Entry: byte‐offset 0 of the function.
   * Purpose: perform *exactly once* all one‐time setup, allocate the local frame, initialize persistent state, then immediately return a resume token (BPᶜ) to the caller.
   * Exit: restore the caller’s BP and return address, but leave RSP extended—so all locals remain in place.

2. **Main Phase**

   * Entry: a fixed, small byte‐offset from the start (commonly 3 or 4 bytes in).
   * Purpose: treat the previously allocated locals (from init) as persistent state. Execute exactly one “step” of the function’s body, then return—again leaving the frame intact for future resumes.
   * Exit: restore the caller’s BP and return address (the parent’s), but again leave RSP unchanged.

Both phases operate on a single, continuous return‐stack frame rooted at BPᶜ, the “child” base pointer created by init.

---

### 4.2 Byte‐Level Layout

When the compiler emits a resumable function called, say, `: foo`, the raw code typically looks like this (pseudocode with byte offsets):

```
; ---------------------------------------
; foo (Init entry point at offset 0)
; ---------------------------------------
00:   <push RA>                 ; push return address to R-stack  
01:   <push BPₚ>                ; push caller’s BP to R-stack  
02:   <mov BP, RSP>             ; BPᶜ = current RSP (new child frame base)  
03:   <bump RSP for N locals>    ; allocate N local slots (state + temps)  
04:   ←— begin init‐only code  
     … state‐block assignments, computations …  
…                                   ; initialize each local at BPᶜ+offset  
XX:  <push BPᶜ to data stack>    ; return resume token  
YY:  <pop BPₚ>                   ; restore caller’s BP  
ZZ:  <pop RA>                    ; restore return address  
   <RET>                         ; return to caller  
; ---------------------------------------
; main (Resume entry point at offset M)  
; ---------------------------------------
MM:   <push RA>                 ; new return address  
MN:   <push BPₚₚ>               ; push caller’s BP onto R-stack  
MO:   <pop BPᶜ from data>       ; reestablish child frame (BP = BPᶜ)  
MP:   ←— begin main‐only code  
     … body code that uses locals at BPᶜ+offset …  
QR:  <pop BPₚₚ>                 ; restore caller’s BP  
QS:  <pop RA>                   ; restore return address  
QT:  <RET>                      ; return to caller  
```

* **Offsets 00–03**: standard function prologue, modified to allocate all child locals in one lump (no separate prologue for init vs. main).
* **Init‐only region (bytes 04–XX)**: code within `state { … }` blocks, plus any other “first‐time” assignments. This region is never executed on a `main`‐phase call, because the main entry (MM) leaps directly to it’s own offset.
* **Return from Init (bytes XX–ZZ)**: pushes BPᶜ onto the data stack for the caller, then pops BPₚ and RA and `RET`s.
* **Main entry (offset MM)**: immediately follows init’s return sequence. The compiler knows exactly where to place it (e.g. at offset M = `ZZ + 1`).

Because both init and main live in one contiguous code segment, the compiler must ensure that:

* The **init return sequence** (`push BPᶜ; pop BPₚ; pop RA; RET`) appears *before* `MM`.
* All **main‐only instructions** begin exactly at `MM` (byte 3 or 4).

---

### 4.3 Init Phase in Detail

**4.3.1 Prologue**

* **Push RA**:
  The very first instruction at offset 0 saves the return address on the return stack. This is exactly what a normal function call does.
* **Push BPₚ**:
  Next, push the caller’s BP onto the return stack. This preserves the parent’s frame base so it can be restored after init.
* **Set BPᶜ = RSP**:
  Immediately after pushing BPₚ, the compiler assigns the top of the return stack to BPᶜ. From this moment on, any local variable references in init (“child locals”) use BPᶜ + offset.
* **Bump RSP for N Locals**:
  The compiler has counted exactly how many child locals (both `state` variables and any other locals encountered during parsing) must be reserved. It emits a single “bump RSP by N” instruction (or equivalent series of pushes) to allocate those slots.

**4.3.2 Initialization Code**

* Inside the init region, any code inside `state { … }` blocks or other one‐time initializations executes in the order encountered. Each `→ var` assignment compiles to: “compute the expression, push its result to the data stack, then store that result at (BPᶜ + field\_offset(var)), and pop the value.”
* Because RSP is already reserved for all child locals, storing to `(BPᶜ + field_offset)` never adjusts RSP further; it simply places a value in a known slot.
* Any temporary expressions needed for initialization (e.g. `3 + 2` inside a `state` block) will push/pop data‐stack values as usual, but those temporaries are consumed immediately. State assignments, however, persist in child locals.

**4.3.3 Init Exit Sequence**

* **Push BPᶜ on the Data Stack**:
  Immediately before leaving init, the function must push BPᶜ for the caller. That single value is the “resume token.”
* **Pop BPₚ from Return Stack**:
  Pop the parent’s BPₚ (saved at init entry) back into BP, reestablishing the caller’s frame context.
* **Pop RA and RET**:
  Pop the saved RA and execute `RET`. Control transfers to the caller (the parent function), which now receives BPᶜ on its data stack. Crucially, **RSP is left where it was**—all child locals remain resident between BPᶜ and RSP.

At the moment of init’s `RET`, the parent’s stack pointers are exactly as they were before the call, except that the child’s locals live “above” the old BP. The parent is free to store BPᶜ in a local and then later jump into main to resume execution.

---

### 4.4 Main Phase in Detail

**4.4.1 Caller Prepares for Resume**

* Caller pushes BPᶜ (the resume token) onto the data stack.
* Caller performs a direct jump or call to the *main entry offset* (MM). Since main lives at a known offset, no label lookup is needed.

**4.4.2 Main Prologue**

* **Push RA**:
  Save the new return address for the resume call on the return stack.
* **Push BPₚₚ**:
  Immediately push the current BP (the parent’s, which was restored by init). We’ll need to bring this back on exit.
* **Pop BPᶜ from Data Stack → BP**:
  The caller’s BPᶜ is popped into BP, re‐establishing the child’s frame. Because init left RSP above all child locals, BPᶜ points directly at the bottom of the child frame.

At this moment, child locals (variables allocated by init) are again addressable at fixed offsets from BPᶜ—nothing has changed or moved.

**4.4.3 Main‐Only Code**

* Main executes precisely the portion of code that follows the init return sequence. This is the run‐one‐step logic that depends on child locals. For example, a generator’s “yield next value,” an iterator’s “restore saved loop variables and advance,” or any other stateful computation.
* During this step, main may read and update child locals, push new data results onto the data stack for the caller, or even call other functions (resumable or normal).

**4.4.4 Main Exit Sequence**

* When main reaches its `RET` (explicit or implicit fallthrough), it must restore the caller’s frame:

  1. **Pop BPₚₚ** from return stack back into BP. This reestablishes the “grandparent” frame.
  2. **Pop RA** from return stack and `RET` to that address.
* **RSP is left unchanged**—child locals remain in place for any subsequent resumes.

Because main never touches RSP (beyond allocating its own temporary locals if it calls normal functions), the child’s locals that were allocated during init persist unchanged. The only effect of main’s exit is that control returns to the caller, and BP is restored.

---

### 4.5 Local‐Variable Allocation Across Phases

In a standard function, the compiler can allocate locals on the stack *on demand*—as soon as it encounters their first assignment—and generate code like “bump RSP by 1; assign to BP + offset.” With resumables, however, we must decide at compile time how many locals total will be needed across *both* init and main phases. That way:

1. On init entry, the compiler emits a single “bump RSP by N” to reserve slots for all locals—not just the stateful ones, but also any temporary locals required by main.
2. During `init`, the compiler knows exactly which offsets correspond to each local, and it can initialize them in any order.
3. During `main`, the compiler again refers to the same BPᶜ + offsets to read or write those locals—no further bumping or allocation is needed.

**Why compile‐time reservation is essential**:

* If the compiler allowed separate allocations at init and main, we would not know how much space main’s locals need until after init runs. But init must *return* before main can run, and we must leave the entire region intact. So all locals—static (`state`) and dynamic (temporaries needed for main)—must be counted ahead of time.
* Therefore, Tacit’s resumable function compiler performs a **two‐pass symbol scan** (or an equivalent single‐pass that accumulates a local‐count as it parses) to determine:

  1. How many total locals (including `state` variables and main‐phase temporaries) the function will require.
  2. The final fixed offset for each named local relative to BPᶜ.

Once that is known, init’s first instructions can raise RSP by exactly N, and both init and main refer to BPᶜ + offset to access locals.

---

### 4.6 Example Walkthrough

Below is a concrete, annotated example of a resumable function that prints numbers from 1 to 3, showing exactly how the compiler lays out both phases:

```tacit
: count‐to‐3
  state {
    1 -> n         ; (BPᶜ + 0) = 1
  }

  state {
    4 -> limit     ; (BPᶜ + 1) = 4
  }

  ; init ends here; init reserved 2 locals (n, limit)
  ; push BPᶜ; pop BPₚ; pop RA; RET

  n limit <= exit ; <---- main starts here at offset M
  n print
  n 1 + -> n
  RET
;
```

**Compiler’s Steps**:

1. **Scan for locals**:

   * Two `state` definitions → 2 locals (“n” at offset 0, “limit” at offset 1).
   * No additional named locals or temporaries needed by main.
   * So N = 2.

2. **Emit Init Prologue (offsets 0–3)**:

   ```
   00: PUSH_RA
   01: PUSH_BPₚ
   02: MOV BP = RSP
   03: ADD RSP, 2    ; allocate slots for n, limit
   ```

3. **Emit Init‐Only Code (offsets 4–10)**:

   ```
   04: LIT 1
   05: STORE (BP + 0)   ; n = 1
   06: LIT 4
   07: STORE (BP + 1)   ; limit = 4
   08: PUSH BP          ; push BPᶜ for caller
   09: POP BPₚ          ; restore parent BP
   10: POP RA           ; restore return address
   11: RET              ; return to caller
   ```

4. **Add Main Entry Label (offset M = 12)**:

   ```
   12: MAIN_LABEL:
   13: PUSH RA            ; new return address
   14: PUSH BPₚₚ          ; push caller’s BP
   15: POP BP             ; pop BPᶜ into BP
   ```

5. **Emit Main Code (offsets 16–…)**:

   ```
   16: LOAD (BP + 0)    ; fetch n  
   17: LOAD (BP + 1)    ; fetch limit  
   18: LEQ               ; compare n <= limit  
   19: IF_FALSE GOTO end_main  ; if n > limit, exit  
   20: LOAD (BP + 0)    ; fetch n  
   21: PRINT             ; print n  
   22: LOAD (BP + 0)    
   23: LIT 1             
   24: ADD               ; n + 1  
   25: STORE (BP + 0)    ; update n  
   26: POP BPₚₚ          ; restore caller’s BP  
   27: POP RA            ; restore return address  
   28: RET               ; return to caller  
   29: end_main: POP BPₚₚ  ; restore caller’s BP  
   30: POP RA            ; restore return address  
   31: RET  
   ```

Notes:

* At offset 11, init’s `RET` jumps back to whatever code called `count‐to‐3 init`. The data stack now has one item: BPᶜ.
* When the caller wants the first “print,” it pushes BPᶜ and does `CALL count‐to‐3+12` (main entry). That runs offsets 12–28 and returns with n updated to 2.
* Caller can repeat `CALL count‐to‐3+12` again to print “2,” and again to print “3.” Once n > limit, the code at offset 29–31 restores the parent’s BP and RA and returns without printing. At that point, child locals still exist in memory, but the function has logically “finished.” The parent may decide to pop off those slots by manually lowering RSP if it no longer needs them.

---

### 4.7 Summary of Init/Main Responsibilities

* **Init** (offset 0–11):

  * Save RA, BPₚ → return stack
  * BPᶜ = RSP; bump RSP by N locals
  * Initialize each `state` var in sequence
  * Push BPᶜ (child’s base pointer) → data stack
  * Pop BPₚ, pop RA → return to caller (leaving child locals on R-stack).

* **Main** (offset 12–):

  * Save RA, BPₚₚ → return stack  (RSP unaffected)
  * Pop BPᶜ → BP (child’s frame reestablished)
  * Execute exactly one “step” of body code, reading/updating child locals
  * Pop BPₚₚ, pop RA → return to caller (leaving child locals intact).

Because the compiler reserves the sum total of locals (init + main) in one lump, every local has a fixed offset from BPᶜ. The function’s code is linear and contiguous, but the two entry points—init at byte 0, main at byte M—allow Tacit to “jump over” half the function as needed and preserve state entirely on the return stack.

In effect, *init* is a standard function prologue that never unwinds its locals, while *main* is a specialized “reentry” subroutine that re‐establishes BPᶜ on an already‐allocated frame. Together, these two phases give Tacit functions the power to behave like generators or coroutines, all using a purely stack‐based, single‐pass compilation model.

**5. State Blocks and Conditional Initialization**

Resumable functions often require certain pieces of code to run **exactly once**—on the very first `init` call—while ensuring that those same statements are never re-executed during any subsequent `main` resumes. In Tacit, this is accomplished via **`state { … }` blocks**, which act as *phase-guarded* regions: their contents compile into code that executes only during the **init** phase and is entirely skipped when running in **main**. This section explains the syntax, compilation, and runtime behavior of `state { … }`.

---

### 5.1 Why State Blocks?

* **One-Time Setup:** Certain variables or resources must be initialized just once. For example:

  ```tacit
  state { 0 -> count }       ; initialize “count” to 0 only on first call  
  state { open‐file "log.txt" -> file‐handle }  
  ```

  If that same code ran on every `main` invocation, it would reset `count` to 0 repeatedly or reopen the file each time—undesirable side effects.

* **Clean Separation:** By grouping all one-time assignments inside `state { … }`, the programmer clearly distinguishes “persistent” initialization from the step-by-step logic in main.

* **Compile-Time Efficiency:** The compiler can emit code for `state` blocks in one contiguous region and patch jumps around them for `main`. This eliminates the need for runtime checks like `if (firstCall) { … }`.

---

### 5.2 Syntax of `state { … }` Blocks

1. **Declaration:**

   * A `state` block always appears inside a resumable function, at the outermost level (not nested inside loops or conditionals).
   * The syntax is:

     ```
     state {
       <zero or more Tacit statements>
     }
     ```
   * Each Tacit statement within the braces follows normal RPN form, often an expression followed by `-> var` to assign a local variable.

2. **Multiple Blocks Allowed:**

   * You may declare multiple `state { … }` blocks in any order (though ordering matters if they reference each other’s state).
   * All `state` blocks are considered part of the **init** phase; their relative order in the source is the order in which their code will execute.

3. **Empty State Block:**

   * A block with no statements is allowed but has no effect—rarely useful, but syntactically valid.

---

### 5.3 Compilation of `state { … }`

During the single-pass parse/compile of a resumable function:

1. **First Pass: Counting Locals**

   * As the parser scans the function body, it identifies each `state { … }` block and notes any variable assignments inside.
   * Each assignment of the form `<expr> -> var` inside a `state` block is treated as defining a **persistent local**—one that must be allocated in the child’s frame.
   * The compiler assigns each such `var` a unique integer offset relative to the child frame base (BPᶜ).

2. **Second Pass: Emitting Code**

   * **Init Region Start (offset 0)**

     * Emit:

       ```
       PUSH_RA      
       PUSH_BPₚ     
       MOV BP = RSP 
       ADD RSP, N   ; N = total number of locals (state + any main locals)
       ```
     * Now BPᶜ points at the first reserved slot for child locals.

   * **Emit Each `state` Block in Source Order**
     For each statement inside `state { … }`, the compiler:

     * *Compiles the RPN expression* to produce code that pushes intermediate values onto the data stack and computes results.
     * *Emits a store instruction* writing that result into `(BPᶜ + offset_of(var))`.
     * *Drops the value* from the data stack (since it’s now stored).

     For example, if `state { 3 2 + -> count }` and `count` was assigned offset 0:

     ```
     LIT 3             ; push constant 3  
     LIT 2             ; push constant 2  
     ADD               ; pop 3 and 2, push 5  
     STORE (BP + 0)    ; pop 5 and store at BPᶜ+0  
     ```

   * **After All `state` Blocks Execute**
     Emit:

     ```
     PUSH BP            ; push BPᶜ (resume token) onto data stack  
     POP BPₚ             ; restore parent BP from (BPᶜ − 1)  
     POP RA             ; restore return address from (BPᶜ − 2)  
     RET                ; return to caller  
     ```

     The child’s local region (BPᶜ … BPᶜ + N − 1) stays allocated; only BP is restored and RA is popped.

   * **Main Entry Label (immediately after init’s RET)**

     * Emit:

       ```
       MAIN_LABEL:        ; offset M  
       PUSH RA            ; save return address  
       PUSH BPₚₚ          ; save caller’s BP  
       POP BP             ; pop BPᶜ (resume token) into BP  
       ```
     * Following this prologue, the compiler emits all code that is *not* inside any `state` block—i.e., the “main‐only” logic.

**Key Points in Compilation**

* The entire `state { … }` region compiles to code that executes only at init time (offsets 04…XX).
* The “main‐only” region is placed entirely after init’s RET. When the compiler stitches together the code, it ensures there is no fall‐through from init into main; init’s RET jumps back to the caller, skipping over all main instructions.
* No dynamic “flag checks” appear in the generated code. A simple forward jump (the init’s RET) achieves the skipping behavior.

---

### 5.4 Runtime Flow of `state` Blocks

1. **First Invocation → Init**

   * Caller: `CALL‐INIT foo`
   * On entering foo @ offset 0: push RA, push BPₚ, set BPᶜ, bump RSP by N.
   * Begin executing each `state` block in order:

     * Compute expression(s), store into `(BPᶜ + offset)`.
   * After last `state` statement: push BPᶜ, pop BPₚ, pop RA, `RET`.
   * Caller receives BPᶜ; child locals remain on stack.

2. **Subsequent Invocation → Main**

   * Caller:

     ```
     PUSH BPᶜ  
     CALL foo+M        ; M = main offset  
     ```
   * On entering foo @ offset M: push RA, push BPₚₚ, pop BPᶜ → BP.
   * Each “main‐only” statement runs (these are statements that were *outside* all `state` blocks).
   * When main’s logic finishes one step, it does: pop BPₚₚ, pop RA, `RET`.
   * Child locals still reside; `state` blocks are never re-executed.

Because `state` contents run only once and are skipped on resumes, they effectively act as “compiled‐in” initialization. There is no runtime dispatch or check to see if init ran; the structure of the code guarantees it.

---

### 5.5 Patching and Phase Skipping

Under the hood, Tacit’s single‐pass compiler uses a **patching system** (similar to Forth’s compile-time “here” and “patch” mechanics) to manage forward references and skip over entire code regions:

1. **Encounter `state { … }`**

   * Compiler sees the start of a `state` block. It knows these statements belong in the “init region.”
   * It continues emitting code for those statements.

2. **Encounter End‐of‐`state` Block**

   * No additional action beyond normal statement emission—each stored assignment writes directly to child locals.

3. **Encounter Code Outside All `state` Blocks**

   * If this is *still* within the “init” area, the compiler must emit no direct branch; instead, it allows the flow to continue.
   * However, at the point just *before* emitting the very first “main‐only” instruction, the compiler inserts the init’s exit sequence (`PUSH BPᶜ; POP BPₚ; POP RA; RET`). This has the effect of “cutting off” init and jumping back to caller, bypassing all main instructions.

4. **Marking the Main Label**

   * Immediately after that inserted RET, the compiler emits a label (`MAIN_LABEL`) so that any `CALL foo+M` will jump to this exact point. Thus, main code is reachable only by a resume call.

Because a simple RET in init effectively jumps over the entire main section, no runtime flag is needed. Synthesizing init and main into one contiguous code block with a single RET in init suffices.

---

### 5.6 Interaction with `take` or Other Sequence Stages

Within a resumable, you may embed sequence‐stage logic (e.g., filters, forks, batching). All such logic that must run repeatedly belongs in the main region; any one‐time setup—for example, opening a network stream or precomputing a table—goes inside a `state { … }` block. The compiler’s two‐phase layout automatically ensures:

* **Init region (all `state` code + return sequence)**
* **Main region (streaming or loop logic)**

An example combining `state` with a simple countdown:

```tacit
: countdown
  state {
    5 -> n            ; start at 5, only once
  }

  ; init’s RET goes here

  n 0 <= exit        ; if n <= 0, done
  n print            ; otherwise print n
  n 1 - -> n         ; n = n − 1
;
```

* On `countdown init`, `n` is set to 5, and code jumps out.
* Each `countdown main BP` prints one number and decrements `n`.
* Once `n` is 0, the `exit` in main causes the function to pop parent BP & RA and return, winding down.

---

### 5.7 Best Practices and Tips

1. **Declare All Persistent Locals Inside `state` Blocks**

   * Any local that must survive across resumes belongs in a `state { var_init }` block.
   * Do *not* assign to that same variable outside of a `state` block if you intend it to be persistent; main’s code will overwrite or revert it unexpectedly.

2. **Limit Complexity Inside `state`**

   * Only perform minimal, guaranteed‐safe operations inside `state`—simple arithmetic, literal assignments, or resource opens. Avoid any code that may itself need to resume or loop.

3. **Keep `state` Blocks at Top Level**

   * Do not nest `state` blocks inside loops or conditionals. They are meant solely for init. The compiler expects to see them at the top level of a resumable’s definition.

4. **Reserve Space for All Locals in One Shot**

   * The compiler must know the total number of child locals (from all `state` blocks plus any named locals in main). You cannot dynamically add new locals in main; they must be declared (via assignments) so that init can reserve adequate space.

5. **Avoid Side Effects Outside `state`**

   * If your function needs a one-time side effect (e.g., logging, network handshake), do it in `state`. Main should be side-effect–free except for intended repeated actions.

By following these guidelines and relying on the compile-time behavior of `state { … }`, Tacit programmers can ensure that initialization logic runs once, state variables persist between calls, and the main body executes exactly once per resume—achieving clear, efficient, and predictable phase separation without any runtime checks.

**6. Return Behavior in Init and Main**

Resumable functions must return in two distinct contexts—after the **init** phase and after each **main** invocation—while preserving the child’s stack frame for future resumes. This section analyzes exactly how each return sequence works, the values pushed or popped, and how the stack pointers (RSP and BP) are manipulated (or left intact).

---

### 6.1 Init Phase Return Sequence

After all one‐time initialization code (inside `state { … }` blocks) has executed, the **init** phase must accomplish three goals before returning to the caller:

1. **Expose the Resume Token** (BPᶜ) on the Data Stack
2. **Restore the Caller’s Base Pointer (BPₚ)**
3. **Jump Back to the Caller’s Return Address (RA), Leaving RSP Extended**

Below is a step‐by‐step breakdown of how those goals are achieved.

#### 6.1.1 Preliminaries

At the onset of init (byte offset 0):

* RA and BPₚ have already been pushed onto the return stack.
* BPᶜ was set to the current RSP.
* RSP was bumped upward by *N* local slots, reserving space for all child locals.

During this period, any `state { … }` code stored values into child‐local slots at offsets `BPᶜ + k` for each declared state or named local.

#### 6.1.2 Pushing the Child Base Pointer (BPᶜ)

Right after the last `state { … }` assignment, the compiler emits:

```
PUSH BPᶜ
```

* **Effect**: The child’s base pointer is placed on the data stack.
* **Rationale**: This value is the **resume token** the caller must keep. It is the only handle needed to re‐enter the function at its “main” offset later.

Example Bytecode (conceptual):

```
…  ; last state‐block STORE (BPᶜ + offset)
BPᶜ → data_stack   ; “PUSH BPᶜ”
```

After this instruction, the data stack top contains BPᶜ.

#### 6.1.3 Restoring Parent BP (BPₚ)

Immediately after pushing BPᶜ to the data stack, the compiler emits:

```
POP BPₚ
```

* **Effect**: Pop the saved parent base pointer (which resides at `(BPᶜ − 1)` on the return stack) back into BP, restoring the caller’s frame context.
* **Rationale**: The caller’s local frame must be reestablished so that when we return (RET), the caller’s code sees its own BP and can continue normally.

Internally, this compiles to:

```
POP BP      ; Pop the word at (BPᶜ − 1) from return stack into BP
```

Because during init entry we had pushed BPₚ to `(BPᶜ − 1)`, popping that slot now gives BP the caller’s original base pointer.

#### 6.1.4 Restoring Return Address (RA) and RET

Next, the compiler emits:

```
POP RA
RET
```

* **POP RA**: Retrieves the saved return address (which resides at `(BPᶜ − 2)` on the return stack) into the program counter.
* **RET**: Performs a normal function return—jumps to RA—leaving RSP unchanged.

Since BP was just restored to BPₚ and RA was popped, the call to `RET` returns execution to the caller’s next instruction. Importantly, **no instruction pops or otherwise reduces RSP**. The return stack pointer is still positioned above all child‐local slots (`BPᶜ + N`). Those locals remain in memory.

##### 6.1.4.1 Example Sequence (Pseudo‐Assembly)

Assume:

* BPₚ was at address X.
* BPᶜ = X + 2 (two pushes occurred at offsets −2 and −1).
* N = 3 (child locals at offsets 0, 1, 2).

Init stack at final moment:

```
… (older frames)
[BPᶜ + 2]:   child‐local‐3
[BPᶜ + 1]:   child‐local‐2
[BPᶜ + 0]:   child‐local‐1
[BPᶜ − 1]:   saved BPₚ (value = X)
[BPᶜ − 2]:   saved RA (value = RET_ADDR)
Return Stack Pointer (RSP) = BPᶜ + 3
```

The init return code:

```
PUSH BPᶜ        ; push X+2 onto data stack
POP BP          ; pop X from (BPᶜ − 1), restore BP = X
POP RA          ; pop RET_ADDR from (BPᶜ − 2)
RET             ; jump to RET_ADDR, leaving RSP = BPᶜ + 3
```

After RET:

* BP = X (caller’s BP)
* RA popped, returned to caller
* RSP still = X + 2 + 3 = X + 5, with `child‐local‐1…3` still occupying offsets X+2…X+4

---

### 6.2 Main Phase Return Sequence

Each time the caller invokes **main** (by passing BPᶜ and jumping to the main offset), the function must:

1. **Save a New Return Address (RA) and Save the Caller’s BP (BPₚₚ)**
2. **Restore BPᶜ from the Data Stack**
3. **Execute One Step of Body Code**
4. **Pop BPₚₚ and RA from the Return Stack**
5. **Return to Caller, Leaving RSP Unchanged**

#### 6.2.1 Prologue of Main

At the top of `main` (offset M), the sequence is:

```
PUSH RA       ; save the current return address
PUSH BPₚₚ     ; save the caller’s BP onto return stack
POP BPᶜ       ; pop passed‐in BPᶜ from data stack → BP
```

* **PUSH RA**: The return address for this main call is pushed, ensuring we can come back here after one “step.”
* **PUSH BPₚₚ**: The caller’s BP (whatever it was, likely the ancestor’s BP) is pushed so we can restore it later.
* **POP BPᶜ**: The resume token (BPᶜ) is popped from the data stack into BP, reestablishing the child’s frame pointer.

RSP is never changed by these three instructions—child locals remain intact below RSP.

#### 6.2.2 One‐Step Body Execution

Following the prologue, the compiler emits “main‐only” instructions—code outside any `state { … }` blocks. Typical operations:

* Load child locals: `LOAD (BPᶜ + offset)`
* Perform computations or I/O
* Potentially assign back to child locals: `… → (BPᶜ + offset)`
* Optionally push a return value onto the data stack for the caller

This region is guaranteed to run exactly once per main call.

#### 6.2.3 Epilogue of Main (Return Sequence)

Once main’s body code executes its intended “one‐step,” it must restore the caller’s context and return. The compiler emits:

```
POP BPₚₚ    ; restore the caller’s base pointer from (BPᶜ − 1)
POP RA      ; restore the return address from (BPᶜ − 2)
RET         ; return to caller’s continuation
```

Here’s how it works:

* **POP BPₚₚ**: At main entry, we pushed BPₚₚ onto the return stack just above RSP—even though RSP covered child locals. By popping from precisely `(BPᶜ − 1)`, we retrieve the parent’s BP.
* **POP RA**: We then pop the RA from `(BPᶜ − 2)`, so `RET` can jump back.
* **RET**: Returns control to the caller’s code that invoked main, leaving RSP unchanged.

##### 6.2.3.1 Layout Example (Pseudo‐Assembly)

Assume at the moment before main entry:

* RSP = X + 5 (from earlier)
* Child locals are at X+2…X+4, BPᶜ = X+2

Then main prologue:

```
… (RSP = X+5)
PUSH RA      ; pushes RA at X+5 → RSP = X+6
PUSH BPₚₚ    ; pushes parent’s BP at X+6 → RSP = X+7
POP BPᶜ      ; pops BPᶜ = X+2 from data stack into BP
```

* Now return‐stack has:

  * At X+6 = new BPₚₚ
  * At X+5 = new RA
  * Below that, X+2…X+4 = child locals from init

Main body runs, reading/writing `(BPᶜ + offsets)`.

Then main exit:

```
POP BPₚₚ    ; pop X+6 → restore the caller’s BP  
POP RA      ; pop X+5 → restore the caller’s return address  
RET         ; jump to popped RA  
```

RSP returns to X+5 (child locals still at X+2…X+4).

---

### 6.3 Leaving the Frame Intact vs. Cleanup Responsibility

* **Init** leaves the entire child frame (BPᶜ → RSP) intact. Only BP is restored, never RSP.
* **Main** does likewise: it restores BP and RA but never touches RSP.

Because neither phase automatically pops child locals, the **parent function** remains responsible for eventual cleanup. That cleanup typically happens when the parent decides the resumable’s work is done—at that moment, the parent can execute:

```
MOV RSP = <value just below BPᶜ>
```

or a sequence of pops to lower RSP, effectively discarding the child’s locals in one batch.

---

### 6.4 Edge Cases and Special Considerations

1. **Child signifying “complete”**

   * In `main`, if the child determines it has no further work (e.g., a generator exhausted), it should execute a final cleanup routine that:

     * Pops BPᶜ (optionally) and/or signals to the parent that it may now free the locals.
     * Jumps to a special “done” RA so that parent can collapse RSP.
   * In most designs, the parent manually tests a return‐value flag (e.g., `nil` or a special sentinel) to know when to pop the child frame.

2. **Stack Underflow Avoidance**

   * If a buggy “main” mistakenly contained a `POP BPᶜ` or additional `RET` beyond what’s needed, it could corrupt RSP or clobber parents’ locals.
   * Compiler must verify that all child locals are addressed only at offsets ≥ 0 (never touching slots below `(BPᶜ − 2)`).

3. **Error Conditions in Init**

   * If `init` fails partway (e.g., invalid parameters), the compiler may generate a direct “error‐return” that:

     * Pops BPₚ and RA (as usual)
     * Pops child locals (reduces RSP by N)
     * Returns an error sentinel to the caller
   * This ensures no remnant child locals linger on the stack.

4. **Interleaving with Normal Function Calls**

   * If `init` or `main` calls a conventional (non‐resumable) function, that call’s cleanup temporarily lowers RSP for its own locals, but when it returns, RSP is restored back to the child frame.
   * The resumable’s return sequences must continue to assume RSP points to exactly `(BPᶜ + N)` at exit.

---

### 6.5 Summary of Return Mechanics

* **Init Return**

  * Push child BP → data stack
  * Pop parent BPₚ from return stack → BP
  * Pop RA from return stack → PC
  * **RSP unchanged** (child locals remain)

* **Main Return**

  * Pop parent BPₚₚ from return stack → BP
  * Pop RA from return stack → PC
  * **RSP unchanged** (child locals remain)

Both phases share the invariant: **“Do not alter RSP on return.”** That invariant is what makes a resumable’s frame persist across calls. By carefully pushing, popping, and restoring BP and RA—but never touching RSP—the compiler guarantees that child locals remain in place between invocations, enabling durable, stack‐allocated state.

This precise return behavior is the linchpin that distinguishes resumable functions from standard Tacit functions: it allows a function to “pause,” yield its BPᶜ, and then be *resumed* later at a known entry point—all while all local variables stay exactly where they were left.

**7. Nested Resumables and Stack Hygiene**

Resumable functions may call other resumables (grandchildren) or invoke normal functions; each scenario must preserve a coherent, single return‐stack frame for the top‐most ancestor. This section explains precisely how nested resumables allocate and share the parent’s frame, how pointers and stack pointers propagate, and how “stack hygiene” is maintained so that each function call (resumable or normal) unwinds exactly what it should.

---

### 7.1 Overview of a Resumable Call Chain

Consider three layers of functions:

```
Parent (P)  → calls  Child Resumable (C)  → which calls  Grandchild Resumable (G)
```

* **P** is a normal Tacit function whose frame begins at BPₚ.
* **C (init)**: pushes RA and BPₚ, sets BPᶜ = RSP, bumps RSP to allocate slots for C’s locals. On return, P’s BP and RA are restored, but RSP remains at the top of C’s frame. P holds BPᶜ as the resume token.
* **C (main)**: pushes RA and BPₚₚ, pops BPᶜ back into BP, runs one step of C, pops BPₚₚ and RA, returns, leaving C’s frame intact.
* **G (init)**—from within C(main)**:** will push RA and BPᶜ (C’s BP) onto return stack, set BPᵍ = RSP, bump RSP to allocate G’s locals, initialize G’s state, then return BPᵍ as G’s resume token—restoring BPᶜ and RA but leaving RSP extended.
* **G (main)** similarly preserves G’s frame across resumes, always saving and restoring its caller’s (C’s) BP but never touching RSP beyond that.

In every case, **all resumable frames (C’s, G’s, etc.) occupy contiguous slots on the same return stack**, rooted at the original ancestor (P)’s BP. Each level’s init pushes a new BP, pushes its parent’s BP underneath that, and allocates its locals. Each level’s return pops exactly its parent BP and RA, but does *not* shrink RSP. Hence, the entire chain of locals—from the deepest grandchild up through C’s locals—remains allocated until the very top‐most caller chooses to unwind.

---

### 7.2 Calling a Resumable From Within a Resumable

#### 7.2.1 Child Resumable (C) in Main Calls Grandchild Init (G)

When C (in its **main** phase) calls G’s **init**, the stack is in this state:

```
…  
[BPᶜ − 2]   saved RA for C(main)  
[BPᶜ − 1]   saved BPₚₚ for C(main)  
[BPᶜ + 0]   C‐local‐0  
…  
[BPᶜ + (N_C−1)] C‐local‐(N_C−1)  
RSP points here  
```

1. **Push RA (for G) and BP (which is BPᶜ)**

   * G’s init code executes:

     ```
     PUSH RA_G         ; pushes caller’s (C’s) return address  
     PUSH BPᶜ          ; pushes C’s BP onto return stack  
     MOV BPᵍ = RSP      ; BPᵍ points at next free slot above C’s locals  
     ADD RSP, N_G       ; allocate G’s N_G locals  
     … initialize G’s state …  
     PUSH BPᵍ          ; return G’s resume token (BPᵍ)  
     POP BPᶜ           ; restore C’s BP  
     POP RA_G          ; restore C’s RA  
     RET               ; return to C(main), with RSP still above G’s locals  
     ```
   * After G’s init RET, C’s BP is restored (pointing at C’s frame), G’s locals remain between BPᵍ and RSP, and C receives BPᵍ on its data stack.

2. **Calling G’s Main from C**

   * Later, when C wants to resume G, it pushes BPᵍ and jumps to G+M. At that entry:

     ```
     PUSH RA_G2       ; save C’s RA for this main call  
     PUSH BPᶜ         ; save C’s BP again  
     POP BPᵍ          ; restore G’s BP to BP  
     … run one step of G’s main …  
     POP BPᶜ          ; restore C’s BP  
     POP RA_G2        ; restore C’s RA  
     RET              ; return to C(main), leaving G’s frame intact  
     ```
   * Now G’s locals still occupy stack slots above BPᵍ, and C’s frame (between BPᶜ and RSP) contains both C’s locals and G’s locals “above” them.

Because both C and G leave their frames intact, successive resumes of G never re‐allocate G’s locals, and successive resumes of C never zap C’s locals. All child‐level frames accumulate above BPᵖ.

---

### 7.3 Resuming C After Invoking G

After G’s init or main returns to C(main), C sees G’s resume token on its data stack, uses it as needed, then continues C’s logic. C does **not** pop G’s locals; they remain until the top‐level parent finally chooses to clean them up.

When C’s main returns to P, C’s frame (including G’s frame) still resides above P’s BP. P may hold both BPᶜ (for C) and BPᵍ (for G) somewhere in its locals. At some point, P can decide to terminate C (and implicitly G) by manually resetting RSP:

```
MOV RSP = BPᶜ         ; drop all slots at or above BPᶜ
```

At that moment, G’s locals, C’s locals, and any deeper nested locals all vanish from the return stack in one batch. P then pop BPₚ as normal to return from C’s original init, effectively cleaning everything up.

---

### 7.4 Calling Normal (Non‐Resumable) Functions from Within a Resumable

A resumable (either init or main) may need to call a conventional function `f` that uses its own local frame. The call sequence must preserve the resumable’s BP and RSP so that, on return, the resumable can continue with its own frame intact.

1. **In C’s Main or Init**:

   * At the call site, code simply emits a standard `CALL f`. Internally, that compiled code does:

     ```
     PUSH RA_f        ; save return address for f  
     PUSH BPᶜ         ; save C’s BP onto return stack  
     MOV BP_f = RSP   ; set f’s BP  
     ADD RSP, N_f     ; allocate f’s locals  
     … execute f’s body …  
     POP BPᶜ         ; restore resumable’s BP  
     POP RA_f        ; restore return address for resumable  
     RET            ; return to resumable’s code  
     ```
   * Critically, when f returns, RSP is restored to exactly where it was before the call—just above C’s locals. F’s locals never persist outside its own call.
   * Because C’s BP was saved and restored, C’s frame and all nested frames (such as G’s) remain entirely unaffected by f’s execution.

2. **No Interference with G**:

   * If G’s init or main is active (i.e., G’s locals are allocated above C’s locals), then a call to a normal function f from C must not pop G’s slots. Because f’s prologue/restoration uses BPᶜ (which was pushed/popped), RSP is reset to BPᶜ + (#C’s state slots + #C’s temp slots + #G’s slots), not to BPᶜ. In other words:

     * f uses BPᶜ as its *saved* BP, but it resets RSP to that same pointer on exit. Since RSP never moved into G’s region, G’s locals persist.

Hence, nested resumables and normal functions coexist without conflict if both adhere to the rule: **“On return, restore BP exactly, and restore RSP exactly as it was at call time.”**

---

### 7.5 Stack Hygiene Invariants

To guarantee correctness, the compiler enforces these invariants at each phase of every call:

1. **Init/Resume Prologue**

   * Always `PUSH RA`, `PUSH parent_BP`, `MOV BP = RSP`, and—*only if init*—`ADD RSP, #locals`.
   * This strictly increases the depth of the frame for every nested resumable.

2. **Main Prologue (Resume Only)**

   * Always `PUSH RA`, `PUSH parent_BP`, `POP BPᶜ`.
   * RSP is left where init set it; there is no `ADD RSP` in main.

3. **Any Call to a Normal Function**

   * Must follow standard Tacit rules:

     ```
     PUSH RA  
     PUSH BP_resumer  
     MOV BP_normal = RSP  
     ADD RSP, #normal_locals  
     … normal function body …  
     POP BP_resumer  
     POP RA  
     RET  
     ```
   * Because BP\_resumer is restored and RSP resets to the same “top of child frame,” nested resumables (grandchildren) remain allocated as needed.

4. **Return from Init or Main**

   * Always `POP BP_parent`, `POP RA`, `RET`, with RSP unchanged.

5. **Final Cleanup (Parent)**

   * When P decides to discard C (and all deeper frames), it executes one of:

     ```
     MOV RSP = BPᶜ     ; drop everything above C’s frame base  
     ```

     or

     ```
     SUB RSP, #total_slots_of_C_and_descendants  
     ```
   * Only after that should P execute the usual `POP BPₚ` if returning from its own call.

By maintaining these invariants, Tacit’s compiler ensures that:

* **No frame “leaks”**: A resumable never loses its locals prematurely, nor does it accidentally free someone else’s locals.
* **No stale pointers**: Every `POP BP` matches exactly the prior `PUSH BP`.
* **Consistent RSP across calls**: No code inadvertently pushes or pops outside the prescribed slots, so nested resumables can coexist without conflict.

---

### 7.6 Example: Three‐Level Nested Resumable

Below is a highly annotated pseudo‐assembly showing P → C → G calls and returns, highlighting exactly how BP and RSP move.

#### 7.6.1 Parent Calls Child Init

```
; Parent’s frame: BP = BPₚ
CALL C+0            ; call C’s init
→ C:init:  
  PUSH RA₁          ; RSP’ = RSPₚ + 1  
  PUSH BPₚ          ; RSP’ = RSPₚ + 2  
  MOV BPᶜ = RSP      ; BPᶜ = RSPₚ + 2  
  ADD RSP, N_C      ; allocate C’s locals slots  
  … initialize C’s state …  
  PUSH BPᶜ          ; push child’s BP  
  POP BPₚ          ; restore parent’s BP  
  POP RA₁           ; restore parent’s RA  
  RET               ; return to P, leaving RSP at BPᶜ + N_C  
; P resumes, holds BPᶜ on its data stack
```

#### 7.6.2 Parent Calls Child Main (Step 1)

```
PUSH BPᶜ
CALL C+M           ; jump to C’s main offset  
→ C:main:  
  PUSH RA₂         ; save P’s return address  
  PUSH BPₚₚ        ; push P’s BP onto return stack  
  POP BPᶜ          ; restore C’s BP  
  … C’s step logic …  
  RET_SEQ_C:       
  POP BPₚₚ         ; restore P’s BP  
  POP RA₂          ; restore P’s RA  
  RET              ; return to P, RSP still above C’s locals  
```

#### 7.6.3 C’s Main Calls G’s Init

```
; Within C’s step logic:
CALL G+0           ; call G’s init
→ G:init:  
  PUSH RA₃         ; push C’s RA (for G)  
  PUSH BPᶜ         ; push C’s BP  
  MOV BPᵍ = RSP     ; BPᵍ = RSP (just above C’s local region)  
  ADD RSP, N_G     ; allocate G’s N_G locals  
  … initialize G’s state …  
  PUSH BPᵍ         ; return G’s BP  
  POP BPᶜ          ; restore C’s BP  
  POP RA₃          ; restore C’s RA  
  RET              ; return to C’s logic, leaving RSP above G’s locals  
; C’s logic resumes, has G’s BP on data stack
```

#### 7.6.4 C’s Main Calls G’s Main (Step 1)

```
PUSH BPᵍ
CALL G+M           ; jump to G’s main  
→ G:main:  
  PUSH RA₄         ; save C’s RA (for G main)  
  PUSH BPᶜ         ; push C’s BP  
  POP BPᵍ          ; restore G’s BP  
  … G’s step logic …  
  RET_SEQ_G:       
  POP BPᶜ          ; restore C’s BP  
  POP RA₄          ; restore C’s RA  
  RET              ; return to C’s logic, leaving RSP above G’s locals  
```

At this point, both C’s and G’s locals are allocated on the return stack. RSP = BPᶜ + N\_C + N\_G.

#### 7.6.5 C Main Returns to P

```
POP BPₚₚ         ; restore P’s BP  
POP RA₂          ; restore P’s RA  
RET              ; return to P, still leaving C’s and G’s locals allocated  
```

#### 7.6.6 P Finally Cleans Up

```
MOV RSP = BPᶜ   ; drop C’s and G’s frames in one shot  
POP BPₚ         ; now P can pop its own BP to return higher if needed  
POP RA₁         ; restore wherever P was called from  
RET             ; P returns, all nested frames gone  
```

---

### 7.7 Key Takeaways on Stack Hygiene

1. **Single Continuous Frame**

   * All resumable locals (C’s, G’s, etc.) pile up above the original caller’s BP in one contiguous region.
   * No intermediate function unwinds RSP below that region until the top‐level parent explicitly does so.

2. **BP Restoration Only**

   * Each init/main pops and restores only *its own* saved BP and RA—never touching RSP.
   * This guarantees that no frame pointers get overwritten and no locals get dropped prematurely.

3. **Manual Cleanup at Top Level**

   * The ultimate caller (often the script’s main or a trampoline) is responsible for popping all residual locals by resetting RSP to the saved BP at the proper time.

4. **Isolation of Normal Function Calls**

   * A normal function call inside any resumable uses the caller’s (C or G) BP as its parent, bumps RSP temporarily, then restores RSP precisely to that same position.
   * This ensures that nested resumables (or other normal calls) never clobber each other’s frames.

By adhering to these disciplined push/pop conventions, Tacit’s compiler ensures **perfect stack hygiene**:

* **No memory leaks** (locals persist only until parent chooses to free them).
* **No collisions** (each frame knows exactly where it lives).
* **Predictable lifetime** (init allocates once, main never deallocates, parent cleans up in one operation).

This rigorous approach is what makes nested resumable functions robust, efficient, and safe—empowering Tacit to implement coroutines, generators, and stateful iterators using *only the return stack* and *no heap allocation*.

**8. Calling Conventions and Usage Patterns**

This section describes exactly how a Tacit programmer invokes a resumable function (both its **init** and **main** phases) in user code. It clarifies the low-level instructions emitted, the data-stack protocol (what values must be pushed or popped), and common idioms for looping, termination, and nested use.

---

### 8.1 High-Level View

From the user’s perspective, a resumable function `: foo … ;` is called in two distinct ways:

1. **Initialization Call** (`init`):

   * Push any required setup arguments (e.g., seeds or configuration) onto the data stack.
   * Execute a call to `foo + 0` (offset 0 in the function), which runs **init** and returns a single value, the child base pointer (BPᶜ).
   * Store that returned BPᶜ somewhere (often in a local variable) for later resumption.

2. **Resume Call** (`main`):

   * Push the previously obtained BPᶜ onto the data stack.
   * Jump or call to `foo + M` (offset M, the “main” entry point), which runs exactly one iteration of the function’s body and returns control to the caller.
   * The caller may capture or inspect any data results left on the data stack by that main step.
   * Repeat pushing BPᶜ and calling `foo + M` as long as the function has work left. Once the function’s body signals completion, the caller should stop calling it and manually pop child locals.

Below we detail exactly what happens at each of these steps, including data-stack and return-stack manipulations.

---

### 8.2 Initialization Call Pattern

Suppose the user writes:

```tacit
<arg₁> <arg₂> … <argₖ>  foo + 0  →  resume_token
```

#### 8.2.1 Data Stack Before Init

* Top of data stack (TOS) contains `argₖ`.
* Just below that: `argₖ₋₁`, …, `arg₁`.

These arguments correspond to whatever the function’s `state { … }` blocks expect to consume. For example, if `foo`’s first state block says `arg₁ arg₂ + → total`, the caller must place those two values before calling `foo + 0`.

#### 8.2.2 Return-Stack and BP Before Init

* Return stack (`RSP`) holds the parent’s frame (possibly several nested frames).
* Parent’s BP (`BPₚ`) points somewhere below.

When the caller does `CALL foo + 0`, Tacit emits:

```
CALL foo_offset0
```

(which assembles to `PUSH_RA; PUSH_BPₚ; JUMP foo+0`).

#### 8.2.3 During `foo` Init

Inside `foo` at offset 0, the code is:

```
00:  PUSH RA₀           ; save return address for init  
01:  PUSH BPₚ           ; save parent’s BP  
02:  MOV BPᶜ = RSP       ; child BP (resume token)  
03:  ADD RSP, N_total    ; reserve N_total slots (all locals: state + main temporaries)  
    …  ; Now execute each state { … } block in source order, which consumes arguments and stores in (BPᶜ + offset) …  
XX:  PUSH BPᶜ           ; expose BPᶜ → data stack  
YY:  POP BPₚ            ; restore parent’s BP from return stack  
ZZ:  POP RA₀            ; restore parent’s return address  
    RET                 ; return to caller
```

* **Arguments Consumption**: Any RPN expressions inside `state { … }` consume their required arguments from the data stack. By the time init’s last `state` block is done, all initial arguments (`arg₁ … argₖ`) have been popped and stored into child locals.
* **Expose Resume Token**: The single `PUSH BPᶜ` places the new child frame base pointer on the data stack. This is the only value returned to the caller.
* **Restore Parent State**: The subsequent `POP BPₚ` and `POP RA₀` restore the caller’s BP and RA.

When init’s `RET` executes:

* **Data Stack**: holds exactly one value—BPᶜ—above whatever data the caller had previously.
* **Return Stack**: exactly as it was before the `CALL`; RSP was extended by `ADD RSP, N_total`, but after `POP BPₚ` and `POP RA`, RSP still sits above the child locals.
* **BP**: restored to the parent’s BPₚ.

#### 8.2.4 Data-Stack After Init

Caller sees:

```
… (caller’s previous data items)
BPᶜ
```

The downstream code typically binds that to a local, e.g.:

```tacit
<arg₁> <arg₂> foo + 0 → my_resume_ptr
```

so `my_resume_ptr` holds the integer pointer value for BPᶜ.

---

### 8.3 Resume Call Pattern

Once init has returned, the user loops (or otherwise repeatedly resumes) by:

```tacit
my_resume_ptr  foo + M   →  (possibly some return values)
```

Here `M` is the main‐entry offset, known at compile time (e.g., 3 or 4 bytes past the init return).

#### 8.3.1 Data Stack Before Main

* TOS holds `my_resume_ptr` (the BPᶜ returned by init).
* If the user desires, they may first push other data values to be consumed by a main step—though standard practice is to let main rely exclusively on its locals, so typically the data stack contains only `my_resume_ptr`.

#### 8.3.2 Calling `foo + M`

Tacit emits:

```
CALL foo+M
```

(equivalent to `PUSH_RA; PUSH_BPₚₚ; JUMP foo+M`)

#### 8.3.3 Inside `foo` at Offset M (Main Entry)

```
MM:  PUSH RA₁           ; save C’s return address  
MN:  PUSH BPₚₚ          ; save parent’s BP  
MO:  POP BPᶜ            ; pop BPᶜ from data stack into BP  
    …  ; one iteration of main’s body, reading/writing (BPᶜ + offsets) …  
PQ:  POP BPₚₚ           ; restore parent’s BP  
PR:  POP RA₁            ; restore parent’s return address  
    RET                 ; return control to caller
```

* **POP BPᶜ**: Restores the child’s frame pointer. Now any `LOAD (BPᶜ + k)` or `STORE (BPᶜ + k)` refers to the exact same locals initialized by init.
* **Main Code**: Executes a single “step”—for example, producing one output value (pushed onto the data stack), or updating some counters.
* **Return Sequence**: Restores BPₚₚ and RA₁, then does `RET`.

#### 8.3.4 Data-Stack After Main

* If main’s body pushed a result (e.g. `some_value → data_stack`), that value is now on top.
* The child’s BPᶜ has been popped (consumed) by the `POP BPᶜ` at offset MO. If the user wishes to resume again, they must re-push BPᶜ before the next resume call. Typically, the code that just ran inside main writes BPᶜ into a local or leaves it on an auxiliary stack for reuse.

For example, a common pattern is:

```tacit
arg₁ arg₂ foo + 0 → r    \ initialization, r is BPᶜ  
: loop_body  (
    r foo + M → maybe_value   \ resumes one step and returns a value or flag  
    … check maybe_value …  
    r dup → r               \ duplicate r for next resume (since previous POP consumed it)  
    branch_if_more loop_body  
);
```

Here `r` must be duplicated before re-calling `foo+M` because `POP BPᶜ` inside main consumes the pointer.

---

### 8.4 Common Usage Idioms

#### 8.4.1 Simple Generator Loop

```tacit
: fibo
  state { 1 -> a }  \ first Fibonacci term  
  state { 1 -> b }  \ second Fibonacci term  

  state { 0 -> step }  \ counter  
  ;  init immediately returns BPᶜ

  step 10 >= exit     \ if we’ve already generated 10 values, finish  
  a print             \ otherwise, print current ‘a’  
  a b +    → next     \ compute next term  
  b → a               \ shift values: a = b  
  next → b            \ b = next  
  step 1 + → step     \ increment step counter  
;

\ In user code:
1 1 0 fibo + 0 → r   \ init (push seeds “1 1 0”, return pointer r)

\ Loop 10 times:
: print‐10
  10 0 do
    r dup fibo + M    \ resume one step (prints a)  
  loop  
  drop              \ drop leftover pointer  
;
```

**Notes**:

* The `init` call `1 1 0 fibo+0` consumes three arguments, initializes locals `(a,b,step)`, and returns `BPᶜ` in `r`.
* Each `fibo+M` invocation consumes and restores `r`. We use `dup` to preserve `r` before each call so that it remains on the data stack for the next iteration.
* After 10 iterations, `step 10 >= exit` in main causes the function to `RET` without printing. At that point, `r dup …` will consume `r` one final time, so we must `drop` the leftover.

---

#### 8.4.2 Early Termination and Cleanup

A more robust pattern ensures child frame cleanup once done:

```tacit
: gen‐until‐nil
  state { <setup code> -> … }  
  ; init returns BPᶜ

  <body code>         \ may push ‘nil’ to signal “done”  
  dup nil? if
    drop              \ discard nil  
    exit              \ will restore parent and leave child frame intact  
  then
  swap → BPᶜ          \ keep BPᶜ for next resume  
;

\ Usage:
…  foo + 0 → r
: run‐until‐nil
  begin
    r dup  foo + M    \ resume next step  
    nil? until       \ loop until nil is returned  
  drop               \ pop leftover pointer  
  \ Now manually free child frame:
  r 0> if            \ ensure r isn’t zero  
    MOV RSP = r      \ drop all child locals at or above r  
    LINEARIZE r      \ (optional) pop any deeper nested resumables  
  then
;
```

* Inside main, when `nil` is produced, we `exit` directly. This leaves BP and RA restored to the parent, but RSP still above child locals.
* In `run‐until‐nil`, once we detect `nil` on the data stack, we `drop` any leftover pointer and then manually reset `RSP = r` to discard all child locals in one shot.
* If nested resumables had allocated additional locals deeper in the same frame, `MOV RSP = r` would drop them as well.

---

### 8.5 Nested Resumable Invocation from Parent

A parent may choose to interleave multiple child resumables:

```tacit
\ Suppose foo and bar are both resumable functions returning BPᶜ tokens
arg_x  foo + 0 → r1    \ initialize foo
arg_y  bar + 0 → r2    \ initialize bar

\ Now interleave their main steps:
: interleave‐both
  10 0 do
    \ Step foo:
    r1 dup foo + M  
    \ Step bar:
    r2 dup bar + M  
  loop
  \ Clean up both frames:
  r2 0> if MOV RSP = r2 then
  r1 0> if MOV RSP = r1 then
;
```

* We keep two pointers, `r1` and `r2`, for separate resumable frames.
* Each `foo+M` or `bar+M` consumes its pointer, so we `dup` before calling in order to preserve it.
* After all looping, we first restore `RSP = r2` (dropping bar’s locals and any deeper grandchildren), then `RSP = r1` (dropping foo’s frame).

---

### 8.6 Common Pitfalls and How to Avoid Them

1. **Forgetting to `dup` Before Resume**

   * Since `main`’s `POP BPᶜ` consumes the pointer, failing to `dup` will lose your handle and make re-entry impossible.

2. **Mixing Argument Conventions in Main**

   * Avoid pushing arbitrary arguments before `foo+M`; by design, main expects only `BPᶜ`. Any extra values will confuse the function’s body or cause wrong stack alignment.

3. **Never Manually `RET` From Main**

   * Always allow the compiler’s generated `POP BPₚₚ; POP RA; RET` sequence to run. Writing your own `RET` inside main (e.g., within `if…then`) should be avoided unless you duplicate the correct restore sequence. Instead, use `exit` (which jumps to main’s return sequence) or structure your code so that a fall-through `RET` is the last instruction.

4. **Ensuring Cleanup in Parent**

   * Child locals remain allocated until the parent resets RSP. Always include a final “cleanup” step in user code if the parent does not immediately exit. This is especially important in long-running scripts to avoid unbounded return-stack growth.

5. **Nested Resumables Must Share the Same RSP Region**

   * Do not attempt to free a child’s frame from inside that child; only the *parent* should adjust RSP. Otherwise, you risk corrupting the return-stack layout for deeper frames.

---

### 8.7 Summary of Key Steps

1. **Init Call**

   ```tacit
   <arg₁> … <argₖ>  CALL foo+0   →  BPᶜ  
   ```

   * **Effect**: initialize all state once, return `BPᶜ`.

2. **First Resume**

   ```tacit
   BPᶜ dup  CALL foo+M   →  (some output)  
   ```

   * `dup` preserves `BPᶜ`.
   * After main’s `POP BPᶜ`, data stack no longer contains `BPᶜ` unless you `dup`’d it.
   * Main leaves its body’s return value(s) on the data stack.

3. **Looping**

   * Repeat step 2 as needed, always `dup`‐ing `BPᶜ`.

4. **Termination**

   * When done, drop the final `BPᶜ` and execute a manual cleanup:

     ```tacit
     BPᶜ 0> IF  
       MOV RSP = BPᶜ   \ drop all child locals  
     THEN
     ```
   * Now no child locals remain on the return stack.

By following these conventions—always pushing exactly `BPᶜ` before each main call, never allowing main to pop RSP, and letting the parent perform the single bulk cleanup—the Tacit programmer can reliably control the lifecycle of resumable functions with clarity and safety.

**9. Promoting Locals to the Parent Scope**

In many resumable‐function scenarios, you must allow a resumable (child) to “grow” its parent’s frame by adding new locals that persist across multiple calls—effectively promoting variables upward so that parent and child share the same underlying stack region. This section explains **why** and **how** promotion works, the exact compiler and runtime steps needed to bump the parent’s frame, and the implications for both performance and correctness.

---

### 9.1 Why Promotion Is Necessary

1. **State Persistence Beyond a Single Resumer**
   A resumable frequently needs to hold onto state not just for itself, but for its entire call lineage. If a child (resumable) declares additional locals after the parent has already reserved its own locals, those new slots must live in a region that persists across future calls to parent and child.

2. **Single Return‐Stack Frame**
   Tacit employs only one return‐stack region. We cannot allocate a completely separate frame for each nested resumable—otherwise, nested resumables could never “see” each other’s locals or share common state. Promotion ensures that all locals (parent’s and child’s) live contiguously on the single return‐stack, so that each level can refer to its own offsets without fragmentation.

3. **Avoiding Heap Allocation**
   By promoting locals onto the existing return‐stack frame, Tacit avoids any need for heap‐based closures or garbage collection. State always resides on the stack, and the parent can later clean everything up in one shot by resetting RSP to the appropriate BP.

---

### 9.2 Promotion Strategy Overview

Whenever a resumable (child) is initialized or resumed, if it discovers that **new** variables must be allocated (beyond what was allocated during its own init), it must:

1. **Compute the number of *additional* slots needed** (call this Δ).
2. **Increase the parent’s RSP by Δ**, thereby extending the return‐stack frame to include those new locals.
3. **Assign symbolic offsets** for the newly promoted locals relative to the child’s BP (which points to the start of the child’s—now expanded—frame).
4. **Initialize those locals** (often inside a `state { … }` block) if this is the init phase.

The key invariant is:

> **At the moment of *any* local‐declaration, the child’s BP must already reflect all previously allocated locals.**

Therefore, promotion always occurs at well‐defined “declaration points.” After promotion, any access to those new locals uses offsets ≥ 0 relative to BPᶜ.

---

### 9.3 Explicit vs. Implicit Promotion

#### 9.3.1 Explicit Declaration (Recommended)

Most straightforward is to require that a resumable’s **entire set** of persistent locals be declared up‐front inside `state { … }` blocks. This way, the compiler computes a single **total** count *N* of persistent locals at compile time, and emits exactly one `ADD RSP, N` in init. There is **no dynamic promotion** in main.

* **Pros**:

  * Simplicity—promotion happens exactly once, at init.
  * No runtime overhead or checks needed in main.
  * Offsets for all locals are known statically.

* **Cons**:

  * Less flexibility if you truly need to allocate additional locals *later* (e.g., after some condition or nested call).

#### 9.3.2 Implicit (Just‐In‐Time) Promotion

Tacit also supports a more dynamic “just‐in‐time” mechanism: if, inside main or deeper in init, you encounter an assignment to a **new** persistent variable (one never seen before), the compiler effectively:

1. **Bumps RSP by 1 (or by however many slots the new var needs)**.
2. **Assigns the new offset** to that variable (immediately above the previous highest offset).
3. **Initializes or later updates** that variable as normal.

Each time you “assign to a brand‐new variable name,” the compiler recognizes it as a promotion request and extends the frame. In practice, to implement this:

* **Compiler Phase**:

  * Maintain a growing map from variable‐name → offset, stored in the current compile context.
  * On first occurrence of `→ var_name` (with `var_name` flagged as “persistent”), compute `offset = current_child_local_count`, increment `current_child_local_count`.
  * Emit—*immediately as part of that assignment statement*—the code sequence to bump RSP by 1.

* **Runtime Effect**:

  * The generated code at that point does:

    ```
    MOV BPᶜ = RSP   ; child’s BP was already RSP at init, so remains correct  
    ADD RSP, 1     ; allocate one new slot  
    … compute expression …  
    STORE (BPᶜ + offset)  
    ```
  * Future references to `var_name` use that same `offset`.

* **Main Phase**:

  * Promotion is only allowed if the call is still in **init**. Once main begins, no further promotion occurs. (Allowing main to dynamically promote would collide with init’s one‐time cleanup logic and muddy the “main runs exactly one step” invariant.)

In short, **dynamic promotion is permissible only during init**—any persistent variable declared in main must have been allocated during init.

---

### 9.4 Compiler Implementation Details

#### 9.4.1 Tracking Variable Offsets

* **Compile‐Time Symbol Table:**

  * Each resumable has its own dictionary (or “scope context”) in which persistent variable names map to integer offsets.
  * Initially, that dictionary is empty. Each time we compile `state { … }` or encounter an explicit “let‐like” declaration (depending on syntax), we assign the next free offset.

* **Counting Slots (Nₚersist + Nₜemp)**:

  * `Nₚersist` = number of distinct persistent variables discovered in all `state { … }` blocks.
  * `Nₜemp` = number of *temporary* locals used inside main (only needed if the compiler wants to pre‐allocate space for transient temporaries). In Tacit’s standard model, temporaries can share slots or be kept entirely on data stack, so often `Nₜemp = 0`.

* **Init Prologue Emission:**
  After scanning all `state` blocks—either in a separate first pass or by collecting them on‐the‐fly—the compiler knows `N_child = Nₚersist + Nₜemp`. It emits exactly one:

  ```
  PUSH RA  
  PUSH BPₚ  
  MOV BPᶜ = RSP  
  ADD RSP, N_child
  ```

  Then it emits each `state` assignment, storing into `(BPᶜ + offset)`.

* **No Further `ADD RSP` in Main:**
  Once init’s `ADD RSP, N_child` is done, all persistent variables are fully allocated. The `main` code that follows never emits any further `ADD RSP`; it only reads/writes from those offsets.

#### 9.4.2 Handling Explicit Late Declarations

If a programmer forgets to declare a persistent variable in `state` but attempts to assign to it in main, the compiler must either:

1. **Emit an Error:** Preventing undefined behavior by requiring all persistent locals be declared up‐front.
2. **Support a “late‐init” hack:** (Not recommended) In which case, the compiler would insert an `ADD RSP, 1` on that assignment. But this breaks the single‐step guarantee of main and complicates return logic.

Tacit’s preferred design is to require all **persistent** locals to be declared in `state { … }`. Any local used only within a single invocation of main (i.e., purely transient) should be kept on the data stack or reused via ephemeral compiler temporaries.

---

### 9.5 Example: Pre‐Allocating vs. Just‐In‐Time

#### 9.5.1 Pre‐Allocation in Init (All Locals Known Ahead)

```tacit
: compute‐stats
  state {  0 → count  }      \ persistent integer  
  state {  0 → sum    }  
  state {  nil → max ?    }  \ maybe an optional value; stored at offset 2  
  ;  
  \ init now knows N_persist = 3, so ADD RSP, 3 in prologue  
  ;  
  count 10 while {           \ hypothetical loop: for i in 1..10  
    i + → sum  
    i sum > if → max then  
    count 1 + → count  
    \ …  
  }  
  \ main is not “re‐invoked” repeatedly here; this is a one‐call example  
;
```

* **Offsets:**

  * `count` → offset 0
  * `sum`   → offset 1
  * `max`   → offset 2

* **Prologue Emits:**

  ```
  PUSH RA  
  PUSH BPₚ  
  MOV BPᶜ = RSP  
  ADD RSP, 3        ; allocate 3 slots  
  ```

* **Each `state` Assignment Stores Into (BPᶜ + offset)** without further RSP adjustments.

#### 9.5.2 Disallowed Late Declaration in Main

```tacit
: bad‐example
  state { 0 → a }    \ allocate offset 0  
  ;  
  … logic …  
  5 → b             \ ❌ “b” not declared in state—cannot allocate offset 1 here  
  ;                 \ Compiler error
```

If the compiler allowed this, it would need to do `ADD RSP, 1` at that exact point, which would break the expectation that main runs a single, unbroken step. Hence Tacit forbids late declarations.

---

### 9.6 Promotion in a Nested Call Scenario

Suppose parent `P` defines no persistent locals initially:

```tacit
: P
  \ No state { … } block—so initial frame has N = 0  
  foo + 0 → r1        \ initialize child C (allocates C’s locals)  
  bar + 0 → r2        \ initialize child D (allocates D’s locals)  
  …  
  ;  P may now loop over C and D, or interleave them  
  \ Finally, cleanup:  
  r2 0> IF MOV RSP = r2 THEN   \ free D’s frame + any deeper promotions  
  r1 0> IF MOV RSP = r1 THEN   \ free C’s frame  
  \ Now RSP = BPₚ again; P can RET  
;
```

* **At P’s Entry:**

  * BPₚ points to P’s base; RSP = BPₚ (no locals).

* **`foo + 0` (C’s init):**

  * C’s init pushes RA and BPₚ on return stack, sets BPᶜ = RSP = BPₚ, bumps RSP by N\_C, and returns BPᶜ to `r1`.
  * Now C’s locals occupy slots BPᶜ … RSP−1. P’s BP is restored, RSP remains above C’s frame.

* **`bar + 0` (D’s init):**

  * D’s init pushes RA and BPₚ (still P’s BP, since C only temporarily set BPᶜ during its init), sets BPᴰ = RSP (which is C’s former RSP), bumps RSP by N\_D, and returns BPᴰ to `r2`.
  * Now D’s locals live above C’s locals, above P’s BP.

Hence, **promotion** for both C and D occurred in exactly the same slot region: parent’s frame was “grown” first by C’s `ADD RSP, N_C`, then immediately further by D’s `ADD RSP, N_D`. All locals are now stacked:

```
[BPᶜ + (N_C−1)]   C‐local (N_C−1)
…  
[BPᶜ + 0]        C‐local 0
[BPᶜ − 1]       (C’s saved BPₚ)
[BPᶜ − 2]       (C’s saved RA)
[BPᴰ + (N_D−1)]   D‐local (N_D−1)
…  
[BPᴰ + 0]        D‐local 0
[BPᴰ − 1]       (D’s saved BPₚ)
[BPᴰ − 2]       (D’s saved RA)
RSP points here
```

* At no point did we need a separate region for D; it simply piggybacked on the same return‐stack.
* When P eventually executes `MOV RSP = r2`, RSP drops down to `BPᴰ`, removing D’s locals and D’s saved RA/BP slots. Similarly, `MOV RSP = r1` removes C’s locals and C’s saved RA/BP.

---

### 9.7 Implications for Performance and Correctness

1. **Constant‐Time Promotion**

   * Both pre‐allocation in init (`ADD RSP, N`) and a hypothetical single-slot bump (`ADD RSP, 1`) are **O(1)** operations.
   * There is no loop to clear or traverse memory on promotion.

2. **Contiguous Layout**

   * By always growing the same return‐stack, all locals—across parent, child, grandchild, etc.—reside in a **single contiguous block**. This locality is cache‐friendly and simplifies cleanup.

3. **Compile‐Time Safety**

   * If all persistent locals are declared in `state { … }`, the compiler verifies that `N_persist` is correct and that no “bare” assignments appear in main. This **static check** prevents runtime frame corruption.

4. **Late Declarations Prohibited**

   * Avoiding dynamic promotion in main preserves the invariant “init entirely allocates all persistent locals.” This simplifies reasoning about “main executes exactly one step” and guarantees that `POP BPₚₚ; POP RA; RET` in main never collides with unanticipated local slots.

5. **Potential Stack Growth**

   * If a resumable (or nested resumables) repeatedly promotes new locals at each init, the parent’s return‐stack could eventually become large. It is the programmer’s responsibility to explicitly clean up when no longer needed by resetting RSP.

---

### 9.8 Best Practices for Promotion

1. **Declare All Persistent State in `state { … }`**

   * Collect every variable you know you will need in any subsequent step.
   * This yields a single, predictable `ADD RSP, N` at init time.

2. **Avoid Repeated Promotions**

   * Do not declare new “persistent” locals mid‐main. Instead, refactor them into init or redesign so that all persistence is known up‐front.

3. **Clean Up as Soon as Possible**

   * After you finish using a child (and its descendants), immediately execute `MOV RSP = BP_child`. This frees all memory and prevents unbounded growth.

4. **Document Offsets If Needed**

   * In low‐level code, you may occasionally need to know that a variable at offset 2 was declared in init. Comment your code so that future maintainers understand which variable maps to which offset.

5. **Be Cautious with Overlapping Promoters**

   * If multiple nested resumables allocate state in unpredictable order, carefully track which BP values reside on data or local stacks. Mismanaging them can easily corrupt frames.

---

### 9.9 Summary

Promotion in Tacit’s resumable functions is the mechanism by which **persistent locals** (state variables) get allocated **on the parent’s return‐stack frame** so that they remain available across multiple calls to `main`. By centralizing all so‐called “persistent” variables into a single contiguous region (via `ADD RSP, N_total` in init) and forbidding any new persistent allocation in main, the compiler retains a simple, one‐time promotion model. Nested resumables simply share and further grow that same region, ensuring that a single cleanup at the top level can reclaim every allocated slot.

This design keeps Tacit’s resumable functions both **efficient** (constant‐time allocation) and **safe** (static verification of offsets), while fully preserving the convenience of stack‐allocated state without any need for the heap.

**10. Code Generation for Resumable Functions**

This section describes, in full detail, how the Tacit compiler transforms a user‐written resumable into low‐level code. We cover every step—from parsing `state { … }` blocks and computing frame size to emitting the precise sequence of instructions for both **init** and **main** entry points. After reading this section, a compiler implementer will be able to generate correct, single‐pass code for any resumable, complete with proper BP/RSP management, nested contexts, and symbolic‐to‐offset resolution.

---

### 10.1 Overview of the Two-Code-Block Model

Every resumable `: foo … ;` compiles to exactly two labeled code blocks:

1. **`foo.init`**  – One‐time initialization code (runs once per run of `foo`).
2. **`foo.main`** – Per-iteration “step” code (runs once per resume).

Both blocks live back-to-back in the final output stream. Control flows look like:

```
… 
  jump foo.init            ; external “call” to init 
foo.init:  
  …  (prologue for init)
  …  (all state { … } assignments)
  push BP_child  
  pop BP_parent  
  pop RA  
  ret                     ; return to caller  
foo.main:  
  …  (prologue for main)  
  …  (one iteration of body)  
  pop BP_parent  
  pop RA  
  ret  
…
```

No other hidden labels or loops are inserted. These two blocks suffice for every resumable, regardless of nested calls.

---

### 10.2 Parsing and Analyzing a Resumable Declaration

Given a high-level definition:

```tacit
: foo   
  state { … }  
  state { … }  
  …  
  <main‐body>  
;
```

the compiler performs these steps:

1. **Collect All `state { … }` Blocks (Init Phase)**

   * Scan sequentially through each `state { … }` block.
   * For each, parse its RPN expressions, recording which symbolic names (variables) appear on the left side of `→`.
   * Build a list of unique persistent‐variable names in declaration order.

2. **Compute `N_persist =` Number of Distinct Persistent Variables**

   * Each name (e.g. `count`, `sum`, `max`) is assigned a sequential offset `0, 1, 2, …` in the order first encountered.
   * Internally store a symbol table (string → integer offset) for the lifetime of this function’s compilation.

3. **Decide on Temporary Locals (Optional)**

   * If the compiler generates or recognizes any *ephemeral* temporaries inside `<main‐body>` (for complex expressions), it may choose to allocate them on the data stack or reuse slots in the same child frame.
   * Typically, we set `N_temp = 0` and rely on data-stack temporaries or direct code emission to avoid extra slots.

4. **Total Frame Size**

   * Set

     ```
     N_child = N_persist + N_temp  
     ```
   * This is the exact number of stack‐slots the *init* block must reserve via `ADD RSP, N_child`.

5. **Assign Symbolic Offsets**

   * For each persistent variable name (in order), record:

     ```
     variable_name  →  offset_in_child_frame  (0 ≤ offset < N_persist)  
     ```
   * Example:

     ```
     count → 0  
     sum   → 1  
     max   → 2  
     ```
   * Later, any access `variable_name` will be compiled as `LOAD (BP_child + offset)` or `STORE (BP_child + offset)`.

6. **Mark the Breakpoint Between `foo.init` and `foo.main`**

   * Determine the byte‐offset M of the first instruction in `foo.main` (immediately after the code for `foo.init`).
   * This offset (or label) becomes the “main entry” for external callers.

After this analysis, the compiler is ready to emit `foo.init` and `foo.main`.

---

### 10.3 Emitting the `foo.init` Block

Below is a step‐by‐step template for `foo.init`. The labels shown (`foo.init:` and `foo.main:`) correspond to actual assembler or VM label names. Indentation indicates unique instructions; comments clarify purpose.

```
foo.init:
   ; —── Prologue: Save caller’s context and allocate child frame ──—
00: PUSH RA                    ; (1) Save return address for init
01: PUSH BP_parent            ; (2) Save parent’s BP on return stack
02: MOV BP_child, RSP         ; (3) Set child’s BP = current RSP
03: ADD RSP, N_child          ; (4) Reserve N_child slots for all child locals
                              ; Now child-local slots span [BP_child .. RSP−1]

   ; —── Init: Execute each persistent assignment in textual order ——
   ; For each `state { <RPN‐expr> → var }` block, compile:
   ;    a) generate code to compute <RPN‐expr> (pushing result onto data stack)
   ;    b) emit “STORE (BP_child + offset_of(var))” to save the value
   ;      (This pops the computed result and writes into child frame.)

04:   …  RPN code for first state block (push arguments, operations) …
05:   STORE [BP_child + offset_var1]   ; assign to var1
06:   …  RPN code for second state block …
07:   STORE [BP_child + offset_var2]
   :    …  (repeat for all N_persist state blocks) …
   :    (By the end, all persistent variables are initialized.)

   ; —── Return: Expose child’s BP and restore parent context ──—
XX: PUSH BP_child              ; (5) Return BP_child as resume token
YY: POP BP_parent              ; (6) Restore the parent’s BP from return stack
ZZ: POP RA                    ; (7) Restore parent’s return address
    RET                        ; (8) Return to caller, RSP unchanged
```

#### 10.3.1 Key Details

* **Instruction 03 (`ADD RSP, N_child`)** must use the **computed** `N_child` from Section 10.2.4.
* **RPN code** for a `state { … }` block follows standard Tacit rules: each token (literal, local, operation) is emitted as load/store or arithmetic instructions. The final result sits on the data stack, ready for `STORE`.
* On `STORE [BP_child + offset_var]`:

  * The compiler emits exactly:

    ```
    POP TMP        ; pop top of data stack into a temp register  
    MOV [BP_child + offset_var], TMP  
    ```
  * This ensures the computed expression is written into the correct slot.
* At **instruction XX**, `PUSH BP_child` places the integer address (BP\_child) on the data stack. This is the **only** return value from init.
* The subsequent `POP BP_parent; POP RA; RET` restore exactly what was pushed at the beginning (instructions 00–01) with no alteration to RSP. The frame remains above RSP for future resumes.

---

### 10.4 Emitting the `foo.main` Block

Immediately after the last `RET` of `foo.init`, emit `foo.main:` at the next byte boundary. It compiles as follows:

```
foo.main:
   ; —── Prologue: Re-establish child BP and save caller’s context ——
00: PUSH RA                    ; (1) Save return address for this main call
01: PUSH BP_parent            ; (2) Save parent’s BP                 
02: POP BP_child              ; (3) Pop resume token from data stack into BP_child
                              ; Now BP = BP_child, RSP still points above child locals.

   ; —── One Step of Main: Compile the “rest” of the function body ——
   ; The remainder of the user’s function definition, excluding state blocks, is compiled here.
   ; Every symbolic reference to a persistent variable “var” is turned into:
   ;    LOAD [BP_child + offset_var]   or   STORE [BP_child + offset_var]
   ; Normal local or stack‐based operations are compiled as usual.

03:   …  code for main’s body (exactly one step) …

   ; —── Epilogue: Restore parent’s BP and return ──—
XX: POP BP_parent              ; (4) Restore caller’s BP from return stack
YY: POP RA                    ; (5) Restore caller’s return address
    RET                        ; (6) Return to caller, RSP unchanged
```

#### 10.4.1 Translating Main‐Body References

* **Reading a persistent variable** `var` assembles as:

  ```
  MOV TMP, [BP_child + offset_var]
  PUSH TMP
  ```

  which places its value on the data stack for further operations.

* **Writing to a persistent variable** uses:

  ```
  POP TMP
  MOV [BP_child + offset_var], TMP
  ```

  which pops a value from the data stack and stores it at the correct offset.

* **Temporary inter‐expression values** can be kept on the data stack or in compiler temporaries; they do not require extra `ADD RSP` since they do not persist beyond this single invocation.

#### 10.4.2 No `ADD RSP` in Main

* By design, `foo.main` does **not** emit any `ADD RSP`. All persistent slots are pre-allocated by `foo.init`.
* If main tried to allocate more slots for new persistent variables, it would break the “one-step” guarantee—so the compiler forbids any new `state { … }` or equivalent in main.

---

### 10.5 Integrating Nested Resumables (Recursive Codegen)

If `foo`’s body (either in init or main) calls another resumable `bar`, the compiler must:

1. **Emit a call to `bar.init` or `bar.main`** exactly as if from top‐level, but with the *current* return stack layout.
2. **Capture the returned resume token** (`BP_bar`) into a local or data‐stack variable for later use.
3. **Resume** building code for `foo` body after that call.

Behind the scenes, the call to `bar` simply invokes the same two‐block model:

* From inside `foo.init`, the compiler emits `CALL bar+0`, then `POP BP_bar` to grab bar’s resume token.
* From inside `foo.main`, compiler emits `bar BP_bar	→ (call to bar.main)` via `CALL bar+M`.

The nested `bar` code itself uses its own offsets relative to `BP_bar`, and its own prologue/epilogue. Because both `bar.init` and `bar.main` follow the same push/pop rules, their locals land just above `foo`’s locals in a single continuous return‐stack region.

### 10.6 Symbol Resolution and Scope Management During Codegen

Throughout code generation, the compiler must resolve symbols in these contexts:

1. **Persistent Variable Names (state)**

   * Resolved to `(BP_child + computed_offset)`.
   * No runtime lookup; every reference compiles to a constant offset.

2. **Calling Other Resumables or Functions**

   * A bare symbol `bar` in code is recognized as either a normal function or a resumable.
   * For *init* calls, the compiler rewrites `bar` to `bar+0`; for *main* calls, to `bar+M`.
   * The correct offset (`M`) is determined during the earlier parsing phase.

3. **Local (Ephemeral) Variables**

   * Can be stored entirely in CPU registers or on the data stack. The compiler allocates no extra slots in the child frame for pure temporaries.

4. **Shadowing Rules**

   * Within nested blocks (e.g., inside a sub‐routine or nested `restart` inside foo), a new scope marker is pushed. Symbols in that scope—temporary or persistent—do not collide with outer scopes.
   * Once the nested block ends, the compiler “forgets” those temporary symbols, but keeps the offsets for any persistent names (since they were recorded when encountered in a `state` block).

---

### 10.7 Handling Edge Cases in Code Generation

#### 10.7.1 No `state { … }` Blocks at All

* If a user writes a resumable without any `state` sections, then `N_child = 0`.

* The compiler still emits the same prologue:

  ```
  PUSH RA  
  PUSH BP_parent  
  MOV BP_child, RSP  
  ADD RSP, 0        ; no change  
  ```

* Execution continues, and init immediately does `PUSH BP_child; POP BP_parent; POP RA; RET`. The only effect is returning `BP_child = RSP_parent` for potential future resumes, even if foo has no persistent locals.

#### 10.7.2 Compile-Time Errors

* **Mismatched Braces or Missing `→` in `state`**

  * The parser must catch syntactic errors (e.g. `state { 3 4 + }` with no `→ var`).
  * Emit a compile‐error: “Every `state` block must end with `→ <name>`.”

* **Duplicate Persistent Variable Names**

  * If a `state` block assigns to `sum` and a later `state` also assigns to `sum`, that’s acceptable: the offset remains the same (no promotion).
  * If a user re-declares a new variable in main without prior `state`, the compiler rejects it.

* **Invalid Symbol Reference**

  * Any reference to a name not found in persistent offset table (for `LOAD`/`STORE`) is an error unless it’s a global word or local ephemeral. The compiler should issue: “Unknown variable or function: `xyz`.”

#### 10.7.3 Ensuring Correct Label Arithmetic

* The byte offset `M` of `foo.main` must be computed precisely—if any instructions in `foo.init` are longer or shorter than expected (due to variable‐length encoding), the compiler must adjust `M` accordingly.
* The assembler or VM module must assign unique label names (e.g. `foo.init` and `foo.main`) and patch any internal `JUMP foo.main` or `CALL foo+M` instructions with correct addresses.

---

### 10.8 Verifying Generated Code

After codegen, a compiler should run a set of sanity checks:

1. **Prologue/Epilogue Pairing**

   * Ensure that for every `PUSH BP` there is a matching `POP BP` in the same code block.
   * Similarly, each `PUSH RA` has a matching `POP RA; RET`.

2. **Frame Size Consistency**

   * Confirm that `ADD RSP, N_child` occurs exactly once in `foo.init`, never in `foo.main`.
   * If any “main” code appears before the prologue in `foo.main`, that is an error.

3. **Offset Bounds Checking**

   * For every `LOAD [BP_child + offset]` or `STORE [BP_child + offset]`, verify `0 ≤ offset < N_child`.
   * If the user references an offset outside that range (e.g. using an undeclared variable), emit a compile‐error.

4. **No RSP Decrements**

   * Aside from `POP BP` and `POP RA`, no other instruction should reduce RSP.
   * A pass through the emitted instruction stream can check for extraneous `SUB RSP, …` or `POP` that might collapse the frame prematurely.

Once these checks pass, the generated code is guaranteed to follow the invariants described in earlier sections (particularly Sections 6–9).

---

### 10.9 Example: Full Codegen of a Simple Resumable

Suppose the user writes:

```tacit
: counter
  state { 0 → idx    }    \ idx offset 0  
  state { 10 → limit }    \ limit offset 1  
  ;  
  idx limit >= if        \ if idx ≥ limit, done  
    nil                  \ signal completion  
    exit  
  then  
  idx → result           \ produce current idx  
  idx 1 + → idx          \ increment idx  
;
```

Below is a line-by-line annotated assembly snippet that a compiler might emit. (Assume each instruction is exactly one “word” for simplicity.)

```
; ---------- foo.init ----------
counter.init:
  PUSH RA1                     ; save caller’s RA
  PUSH BP_parent               ; save caller’s BP
  MOV BP_child, RSP            ; BP_child = old RSP
  ADD RSP, 2                   ; allocate 2 slots (idx, limit)
                                ; child frame now at BP_child..BP_child+1

  ; state { 0 → idx }  
  PUSH 0                       ; push literal 0
  STORE [BP_child + 0]         ; idx ← 0

  ; state { 10 → limit }  
  PUSH 10                      ; push literal 10
  STORE [BP_child + 1]         ; limit ← 10

  PUSH BP_child                ; return BP_child (resume token)
  POP BP_parent                ; restore caller’s BP
  POP RA1                      ; restore caller’s RA
  RET                          ; return to caller

; ---------- foo.main ----------
counter.main:
  PUSH RA2                     ; save caller’s RA
  PUSH BP_parent               ; save caller’s BP
  POP BP_child                 ; restore child’s BP from data stack

  ; --- main body: one step ---  
  LOAD [BP_child + 0]          ; push idx  
  LOAD [BP_child + 1]          ; push limit  
  GE                           ; is idx ≥ limit ?
  IF ZERO?                     ; conditional branch
    PUSH nil                   ; push nil to signal completion
    POP RA2                    ; pop RA2 into PC?  (instead, “ret” below handles return)
    POP BP_parent              ; (redundant) we’ll do this after THEN  
    RET  
  THEN
  LOAD [BP_child + 0]          ; push idx (produce as “result”)
  DUP                          ; duplicate idx so we can increment
  PUSH 1                       
  ADD                          ; idx + 1
  STORE [BP_child + 0]         ; idx ← idx + 1

  ; --- Epilogue ---  
  POP BP_parent                ; restore caller’s BP
  POP RA2                      ; restore caller’s RA
  RET                          ; return to caller
```

**Notes on this example**:

* We allocated exactly 2 child locals in `init`.
* In `main`, we fetched those two slots by `LOAD [BP_child+0]` and `LOAD [BP_child+1]`.
* The `GE; IF ZERO? … THEN` sequence branches to return `nil` when `idx ≥ limit`.
* We duplicate and increment `idx` in one step, storing back into offset 0.
* We finish by restoring parent’s BP and RA, then `RET`.
* Only one `ADD RSP, 2` appeared—in init. There is no `ADD RSP` in main.

---

### 10.10 Summary

By following a **two‐block, single-pass** codegen strategy—collect all persistent locals in `state { … }`, compute `N_child`, emit a single `ADD RSP, N_child` in the init prologue, and then compile all `state` assignments—Tacit guarantees that every resumable is:

* **Correctly framed**: variables live at known offsets in one contiguous region.
* **Efficiently allocated**: no repeated pushes or pops beyond the single `ADD RSP`.
* **Easy to resume**: `main` restores BP from the popped resume token and performs exactly one step.
* **Safe to nest**: nested resumables emit identical prologues/epilogues, piling frames upward in a single redundant‐free return stack.

This disciplined approach eliminates ambiguity about frame sizes, jump targets, or variable lifetimes. A Tacit compiler can thus generate resumable functions that behave like efficient, stack-allocated coroutines, without ever leaving the realm of constant-time, single-pass routines.

**11. Return‐Stack Cleanup and Reference Management**

After a resumable (child) function has finished all its work, its entire stack‐allocated frame—along with any nested grandchildren frames—must be reclaimed in one operation. This section specifies exactly **how** and **when** the Tacit runtime (or generated code) restores the return‐stack pointer (RSP) to drop all child and descendant locals, and how it invokes any necessary reference‐count decrements or frees for heap‐allocated objects that reside in those slots.

---

### 11.1 Why Explicit Cleanup Is Necessary

1. **Persistent Child Locals Remain Allocated**
   Recall that every call to `foo.init` does `ADD RSP, N_child` to allocate persistent locals, and `foo.main` never undoes that. Thus, after init (and any subsequent main calls), the child’s frame still sits on the return stack. If the parent never explicitly resets RSP, those slots remain “reserved” indefinitely.

2. **Nested Frames Accumulate**
   Each nested resumable (grandchild, great‐grandchild, etc.) also allocates its own locals above the parent’s frame. When the deepest child finally completes, its slot remains until the **topmost caller** frees it.

3. **Heap‐Allocated Values May Live in Local Slots**
   A child’s locals can hold tagged pointers to heap‐allocated buffers, reference‐counted objects, or other resources. Before dropping the child’s frame, each such slot must be visited so that any “live” heap objects receive a final `DEC-REF` (or equivalent) to avoid leaks.

4. **Single Bulk Operation for Efficiency**
   Instead of walking and popping each individual slot at runtime, Tacit performs a **single** bulk reset of RSP (e.g., `MOV RSP, BP_child`) and then iterates (if needed) to decrement references. This is still linear in the number of locals, but avoids repeated push/pop instructions for each slot.

---

### 11.2 Data Structures: Tagged Values and Reference Counts

Tacit represents every value on the data stack or in local slots as a **tagged word**. A typical 32‐ or 64‐bit layout:

```
[ 63        …        48 | 47           …           0 ]
  ───────────────────────────────────────────────────  
  |  TYPE TAG  |  PAYLOAD (e.g., integer, pointer)   |
  └────────────┴─────────────────────────────────────┘  

TYPE TAG:  
  0x0  →  Immediate small integer (no ref‐count).  
  0x1  →  Heap‐allocated string or buffer (ref‐counted).  
  0x2  →  List or array object (ref‐counted).  
  0x3  →  Struct pointer (stack pointer; not ref‐counted).  
  … etc.  
```

* **Ref‐Counted Object Slots**: Whenever a local slot is assigned a `ref‐counted` value (e.g., a string), the compiler inserted an implicit `INC-REF` at assignment time.
* **On Cleanup**, we must call `DEC-REF` for each slot containing a `ref‐counted` tag, then overwrite (or simply drop) that slot.

The runtime provides two primitives:

1. **`is_refcounted(tagged_value) → bool`**
   At cleanup time, checks the high‐order bits of the tagged word to see if it belongs to a ref‐counted category.

2. **`dec_ref(ptr)`**
   Decrements the reference count of a heap object. If count falls to zero, frees the object (and recursively decrements any references it held).

---

### 11.3 Cleanup Algorithm Overview

When a parent (or top‐level caller) decides it no longer needs a child’s frame, it invokes **two phases**:

1. **Bulk Reset of Return Stack Pointer**

   ```asm
   MOV RSP, BP_child  
   ```

   * This immediately “forgets” all local slots *above* `BP_child`. However, underlying memory still holds the old values, so we must scan them *before* or *during* cleanup.

2. **Reference‐Counting Walk**

   * Starting from the old RSP (before bulk reset) and descending down to `BP_child + 1`, inspect each slot for a ref‐counted tag. For each:

     * Extract its payload pointer and call `dec_ref(payload)`.
   * Once all ref‐counts have been decremented, the slots can be safely considered “dead.”
   * Finally, pop BP and RA of the child (stored just below `BP_child`) to restore the parent’s context.

Because Tacit stores locals at offsets ≥ 0 from `BP_child`, the cleanup must remember the original top‐of‐frame. The typical code sequence is:

```
; Assume RSP_cur = (old top of frame)  
; and BP_child is known (passed or stored)

MOV TEMP_RSP_TOP, RSP      ; save original top-of-frame
MOV RSP, BP_child          ; drop RSP down to BP_child
\ Now slots [BP_child .. TEMP_RSP_TOP−1] are “visible” only by address
SET PTR = TEMP_RSP_TOP−1   ; start scanning from highest slot

WHILE PTR ≥ BP_child DO
   SLOT := READ [PTR]      ; retrieve tagged value  
   IF is_refcounted(SLOT) THEN
     dec_ref( PAYLOAD(SLOT) )  
   ENDIF
   PTR = PTR − 1           ; move to next lower slot
ENDWHILE

; Now that all ref-counts are handled, the slots can be considered free.
; Next, restore BP_parent and RA stored below BP_child:

POP BP_parent             ; restores the parent’s base pointer
POP RA_child              ; restores child’s return address
RET                        ; return to parent’s code
```

Because Tacit’s calling convention always pushes `BP_child` at offset `BP_child` and `RA_child` at offset `BP_child − 1` during init, the cleanup code must account for these saved values accordingly. In practice, one usually writes:

```
; Cleanup entry (parent code):
BP_child → TEMP_BP        ; local copy of child’s BP

; Walk ref-counted slots above child’s frame:
MOV PTR, (PREVIOUS_RSP)   ; but previous RSP is lost after MOV RSP, BP
— so actually we must have stored original RSP in a temporary register or in a known variable right before we do MOV RSP. —

; Pseudocode that respects proper ordering:
ORIG_RSP := RSP           ; the true top of the child frame
MOV RSP, BP_child         ; drop frame
FOR PTR = ORIG_RSP − 1 DOWNTO BP_child DO
   SLOT = [PTR]
   IF is_refcounted(SLOT) THEN dec_ref(PAYLOAD(SLOT))  
END FOR

; Now pop saved BP and RA:
POP BP_parent
POP RA_child
RET
```

---

### 11.4 When Cleanup Occurs

Tacit does **not** automatically clean up a child’s frame when its `main` returns `nil` or completes. Instead, cleanup is always the **responsibility of the top‐level code that called `foo.init`**. Typical usage patterns:

1. **Immediate One‐Shot Use**

   ```tacit
   <args> foo + 0 → r
   \ Loop or single call to foo+M omitted if not needed
   \ Now parent cleans up:
   r 0> IF  cleanup_resumable(r)  THEN
   ```

   Where `cleanup_resumable(r)` generates the exact code sequence in Section 11.3 to free all locals at or above `r`.

2. **Interleaved Children**
   If a parent interleaves two children `r1` and `r2`, it must clean them in descending‐order of addresses:

   ```tacit
   r2 0> IF cleanup_resumable(r2) THEN
   r1 0> IF cleanup_resumable(r1) THEN
   ```

   This ensures that the deepest frame is dropped first; after that, the next child’s frame is adjacent to the restored RSP.

3. **Nested Resumables**
   If `foo` (child) itself spawned `bar` (grandchild), then `bar`’s cleanup must precede `foo`’s:

   ```tacit
   ; Within foo's main or resource-release code:
   g_r 0> IF cleanup_resumable(g_r) THEN  ; drop grandchild frame
   ; Then later, once foo is also done:
   r  0> IF cleanup_resumable(r)  THEN   ; drop foo frame
   ```

4. **Final Program Termination**
   If a long‐running coroutine or script finishes altogether, a final cleanup of **all** active child frames is done (e.g., in `MAIN` or driver code). In practice, one may store the “oldest” BP (the first child) and simply reset `RSP` to that BP, which cascades to drop all frames above it in one operation, then restore the original BP and RA of the top‐level caller (often the VM or REPL).

---

### 11.5 Reference‐Counting Walk: Implementation Strategies

The core challenge is: **How do we know the precise range of slots to scan for ref‐counted values?** Two main strategies exist:

#### 11.5.1 Save Original RSP in a Temporary Slot

Before doing `MOV RSP, BP_child`, the parent code does:

```
MOV TEMP_ORIG_RSP, RSP  
MOV RSP, BP_child  
```

* Now, `TEMP_ORIG_RSP` holds the numeric address of the first slot *past* the last child local.
* Perform the downward scan from `PTR = TEMP_ORIG_RSP − 1` to `PTR = BP_child`.

Finally, `POP BP; POP RA; RET`.

**Advantages**

* Clear bounds: we know exactly which slots were allocated by the child (those at addresses `[BP_child … TEMP_ORIG_RSP − 1]`).
* No extra metadata needed.

**Disadvantages**

* Requires saving `RSP` in a temporary register or local variable before cutting it. The compiler must allocate exactly one ephemeral slot for `TEMP_ORIG_RSP`.

#### 11.5.2 Implicit Knowledge of Frame Size

Because the compiler computed `N_child` at compile time, the parent (or cleanup function) can simply do:

```
; Suppose child’s BP is in register R or local variable r
ORIG_RSP := BP_child + N_child  
MOV RSP = BP_child  

FOR CUR = (BP_child + N_child − 1) DOWNTO BP_child DO
  SLOT = [CUR]
  IF is_refcounted(SLOT) THEN dec_ref(PAYLOAD(SLOT))
END FOR  

POP BP_parent
POP RA_child
RET
```

Here, `N_child` is known statically (encoded into the cleanup code).

**Advantages**

* No need for a temporary variable to hold original RSP at runtime.
* Cleaner generated code when `N_child` is a constant.

**Disadvantages**

* If there are nested grandchildren whose `N_grandchild` was not known at the time `foo` was compiled, `N_child` alone is insufficient. In a nested scenario, you must also account for all deeper allocations. In other words, the parent must know the exact **sum of all N\_persist for child + grandchildren + …**.

Because nested resumables can be created on the fly, the compiler cannot always know how many descendants exist. Therefore, the **preferred** strategy is 11.5.1—saving the actual `RSP` at the moment of cleanup—to guarantee correctness.

---

### 11.6 Pseudocode for a Generic `cleanup_resumable` Helper

Tacit’s standard library (or the compiler’s codegen template) provides a helper word, `cleanup_resumable`, that encapsulates the steps described. Its specification:

```tacit
: cleanup_resumable  ( child_BP -- )  
  \ Consume a nonzero child_BP; if zero, do nothing  
  dup 0= if drop exit then 

  \ Save original RSP into a temp slot
  RSP → temp_rsp  

  \ Restore RSP to child’s base, dropping all child locals  
  DUP → bp_child  
  MOV RSP, bp_child  

  \ Walk from temp_rsp − 1 down to bp_child  
  temp_rsp 1 -  bp_child 1 -  FOR-REVERSE ( end_exclusive )  
    DUP [ ]  \ load slot at PTR  
    DUP is_refcounted IF  
      PAYLOAD  dec_ref  
    THEN  
    DROP  
  NEXT

  \ Pop saved BP and RA for the child  
  POP BP_parent         \ BP_parent was at (bp_child − 1)  
  POP RA_child          \ RA_child was at (bp_child − 2)  

  \ At this point, RSP = bp_child, BP = bp_parent  
; 
```

**Explanation of each step**:

1. **`dup 0= if drop exit then`**

   * If `child_BP` is zero (the zero pointer), we do nothing and return immediately. This allows callers to write `child_BP cleanup_resumable` without guarding against zero.

2. **`RSP → temp_rsp`**

   * Store the current return‐stack pointer in a temporary local/stack slot (the compiler arranges for this slot to exist, typically in a register or ephemeral location).

3. **`DUP → bp_child`**

   * Duplicate the child’s BP on the stack for future use, and name it `bp_child`. At this point, stack has two copies of `child_BP`.

4. **`MOV RSP, bp_child`**

   * Reset `RSP` to `bp_child`, effectively discarding all allocated locals for child and any descendants.

5. **`temp_rsp 1 -  bp_child 1 - FOR-REVERSE … NEXT`**

   * Iterate from `(temp_rsp − 1)` down to `bp_child`, inclusive of `bp_child`. At each iteration:

     * `DUP [ ]` loads the slot at address `PTR` without consuming `PTR`.
     * `DUP is_refcounted IF … THEN` checks if the loaded value needs a `dec_ref`. If so, pushes its payload pointer and calls `dec_ref`.
     * `DROP` discards the slot value.
   * This loop ensures every local slot—whether it contains an immediate, a heap string, a list, or a struct pointer—is visited. Only ref‐counted slots trigger `dec_ref`; struct pointers (tag 0x3) do not.

6. **`POP BP_parent; POP RA_child`**

   * The saved parent BP and return address were sitting at offsets `(bp_child − 1)` and `(bp_child − 2)` before `MOV RSP`. Because we reset `RSP` to `bp_child`, those slots are now at the **top** of the return stack. Popping them restores the parent’s context.

7. **Final State**

   * **RSP** is now exactly where it was **before** the child’s `init` prologue (i.e., equal to `BP_child`).
   * **BP** has been restored to the parent’s BP.
   * The return‐stack’s top‐most return address (`RA_child`) is popped, so the caller’s next `RET` will resume at the correct return site.

---

### 11.7 Example: Cleaning Up a Single Child

Assume parent code did:

```tacit
10 20  100 200  foo + 0 → r    \ init foo, allocating 4 slots
… (foo.main calls, producing results) …
r  cleanup_resumable
```

* Right before `cleanup_resumable`, suppose the return stack looked like:

```
[ lowest addresses … ]  
  RA_anc  
  BP_anc  
  … (other ancestor frames) …  
  RA_foo_init  
  BP_anc           ← was parent’s BP  
  [BP_foo + 0]     idx or other local  
  [BP_foo + 1]     …  
  [BP_foo + 2]     …  
  [BP_foo + 3]     …  
  RSP_current      ← temp_rsp
```

* **`temp_rsp := RSP_current`** stores that top‐of‐frame pointer.

* **`MOV RSP, BP_foo`** collapses the stack so that `RSP = BP_foo`. Now the slots above `BP_foo` can be scanned by iterating `PTR` from `temp_rsp − 1` down to `BP_foo`.

  For each `PTR` in `[BP_foo .. temp_rsp − 1]`:

  * `SLOT = [PTR]` → a tagged value, e.g., an immediate or a pointer to heap.
  * If `is_refcounted(SLOT) == true`, call `dec_ref(PAYLOAD(SLOT))`.

* After scanning, **`POP BP_parent; POP RA_foo_init`** restores the caller’s (parent’s) BP and the return‐address that brought control to `cleanup_resumable`. A final `RET` returns to the caller site with full cleanup done.

---

### 11.8 Edge Cases and Special Considerations

#### 11.8.1 Child with No Persistent Locals (`N_child = 0`)

* If `N_child = 0`, child’s `init` simply did `ADD RSP, 0` (no real change). However, `cleanup_resumable` will still:

  1. Save `ORIG_RSP` (which equals `BP_child` in this case).
  2. Do `MOV RSP, BP_child` (no change).
  3. Loop from `PTR = ORIG_RSP − 1` down to `BP_child` → but `ORIG_RSP − 1 < BP_child`, so loop body never executes.
  4. `POP BP_parent; POP RA_child` cleans up even the saved BP/RA words.

Hence, even zero‐slot resumables properly clean up.

#### 11.8.2 Nested Frames and Cleanup Ordering

* If a parent manages multiple resumables (`r1`, `r2`, `r3`), **always clean them in descending‐order of BP**—from highest address (deepest frame) to lowest. Otherwise, prematurely resetting RSP to a lower BP may drop frames that a later cleanup expects to scan, leading to undefined behavior.

#### 11.8.3 Interleaved Resumables

* A parent may hold onto multiple child BPs for parallel interleaving. It must track them and ensure none is cleaned before its descendants. Typically, store them in a local stack or array and pop them in reverse order of allocation.

#### 11.8.4 Reference Counts During Nested Cleanup

* If a child’s local slot contains another resumable’s BP (i.e., a pointer to a nested child), that pointer is **not** ref‐counted. The cleanup code must treat a “struct pointer” tag differently—never `dec_ref` it, but eventually call `cleanup_resumable` on it if the parent still intends to free the nested child.

In other words, the parent’s code is responsible for two passes:

1. **Ref‐Count Sweep**: for every slot tagged “heap object,” `dec_ref`.
2. **Resumable Sweep**: for every slot tagged “resumable BP,” invoke `cleanup_resumable(BP)`.

Tacit’s standard library often provides a combined helper:

```tacit
: cleanup_recursive  ( bp -- )  
  dup is_resumable? if 
    \ If this slot is a nested resumable, clean its entire subtree first  
    cleanup_resumable  
  else 
    dup is_refcounted? if dec_ref then  
  then  
  drop 
;
```

And the outer loop in Section 11.3 can simply call `cleanup_recursive` on each slot to handle either case.

---

### 11.9 Built‐In Helper: `cleanup_resumable`

Tacit’s core distribution includes a built‐in word:

```tacit
: cleanup_resumable  ( child_BP -- )  
  \ Implementation as described in Section 11.6  
;
```

**Usage**: Always call this in parent code when done with a resumable. For example:

```tacit
\ Initialize:
1 2 3 my_resumable + 0 → child_bp

\ … interleave resume calls …  

\ Final cleanup:
child_bp  cleanup_resumable  
```

If you have nested resumables stored in local slots, use:

```tacit
: cleanup_all  ( bp_list_count list_of_bps -- )  
  \ pops ‘count’ then loops over BPs, calling cleanup_resumable on each  
;
```

---

### 11.10 Summary of Cleanup Invariants

* **Single Bulk RSP Reset**

  * Always `MOV RSP, BP_child` to drop all child/descendant locals in one shot.

* **Linear Reference Sweep**

  * Walk from `(ORIG_RSP − 1)` down to `BP_child`, calling `dec_ref` on any ref‐counted tagged value and `cleanup_resumable` recursively for any nested resumable.

* **Mandatory BP/RA Pop**

  * After sweeping, pop exactly two words: saved BP and saved RA of the child.

* **No Partial Cleanups**

  * Never attempt to drop a subset of a child’s locals—always use the child’s BP as the boundary.

By following these rules, Tacit programs avoid memory leaks, maintain stack integrity, and ensure that every heap object and nested resumable is properly released at the correct time.

Apologies for the digression. Here’s a concise, platform-agnostic description of resumable calling conventions, with no architecture-specific instructions or unnecessary detail.

---

## 12. Calling Conventions & Stack Hygiene for Resumable Functions

When Tacit calls a function—whether it’s a “normal” (one-shot) function or a resumable—the runtime uses a single return-stack, and every call frame pushes exactly:

1. **Return Address (RA)**
2. **Caller’s Base Pointer (BP)**

After that, the callee establishes its own BP and may reserve space for locals. On return, it restores BP and RA in the opposite order, ensuring the caller’s frame remains intact.

---

### 12.1 Uniform Prologue/Epilogue Pattern

Every function (resumable or not) follows exactly these two steps on entry and exit:

1. **On Entry (Prologue):**

   * **Push** the return address onto the return stack.
   * **Push** the caller’s BP onto the return stack.
   * **Set** this function’s BP = current RSP.
   * **Allocate** any locals by bumping RSP upward by `N_locals`.

2. **On Exit (Epilogue):**

   * **Reset** RSP back to this function’s BP (dropping all locals).
   * **Pop** the saved BP (that restores the caller’s BP).
   * **Pop** the saved RA (that returns to the caller’s instruction).

Because both steps are always present, no frame can ever be skipped or left half-torn.

---

## 4. Syntax and Keywords

### 4.1 `resumable : name ... ;`

A **resumable** `foo` compiles into exactly two labeled blocks:

* **`foo.init`**  (one-time initialization)
* **`foo.main`**  (one-step “resume”)


#### 4.1.1 `foo.init` (Initialization Phase)

* Prologue (same as above): Push RA, push BP, set BP, allocate `N_persist` slots for persistent locals.
* Execute each `state { … } → var` assignment exactly once.
* **Return Value:** Instead of discarding its own BP, `foo.init` pushes **its BP** back onto the data stack as a “resume token.”
* Epilogue: Pop BP and RA to return to the caller; RSP remains upraised by `N_persist` so that the locals stay resident for future resumes.

In other words:

```
foo.init():
    push RA
    push BP_parent
    BP_child = RSP
    RSP += N_persist
    <evaluate state‐assignments>
    push BP_child         ← return the resume token
    pop BP_parent
    pop RA
    return
```

After this, `RSP` still points past all of `foo`’s locals.

#### 4.1.2 `foo.main` (Resume Phase)

* Prologue: Push RA, push BP, then **pop** a BP from the data stack (this is the resume token).
  That restored BP becomes `BP_child` again.
* Execute exactly one “step” of the function body, using the locals stored at `BP_child + offsets`.
* Epilogue: Reset RSP to `BP_child` (so locals remain in place), pop BP\_parent and RA, and return.

In pseudocode:

```
foo.main(resume_token):
    push RA
    push BP_parent
    BP_child = resume_token  ← resume_token popped from data stack
    <execute one iteration, reading/writing locals via BP_child + offset>
    pop BP_parent
    pop RA
    return
```

Note that `foo.main` never changes RSP except to restore it to `BP_child`. Persistent locals stay on the caller’s frame between calls.

---

## 5. Interaction Scenarios and Stack Management

### 5.1 Calling a Normal Function from Inside a Resumable

If a resumable `foo` (inside its `main`) calls a conventional `bar`, the same uniform pattern applies:

1. **Before calling** `bar`, `foo` has:

   * `BP = BP_foo`
   * `RSP` above all of `foo`’s locals
2. **`CALL bar`:**

   * Push RA, push BP (which is `BP_foo`), set `BP_bar = RSP`, allocate `bar`’s own locals.
   * When `bar` finishes, it: reset `RSP = BP_bar`, pop its BP (restoring `BP_foo`), pop its RA, and return to `foo.main`.

Because `bar` resets RSP before popping BP, none of `bar`’s locals remain. `foo`’s `BP` and its persistent locals remain unaffected.

---

### 5.2 Calling One Resumable from Another

When `foo.main` calls `bar.init` or `bar.main`:

* **`bar.init` call**

  * From `foo.main`: push `bar`’s arguments, then `CALL bar.init`.
  * Inside `bar.init`: push RA, push BP (which is `BP_foo`), set `BP_bar = RSP`, allocate `N_bar` slots, do its state assignments, then push `BP_bar` as the resume token and pop parent BP and RA to return to `foo.main`.
  * Back in `foo.main`, the data stack now holds `BP_bar` (for later resumes), and `BP_foo` is restored. Meanwhile, `RSP` still sits past all of `bar`’s locals and `foo`’s locals.

* **Later, to resume `bar`:**

  * In `foo.main` (or any ancestor), do `resume_token = BP_bar; CALL bar.main(resume_token)`.
  * Inside `bar.main`: push RA, push BP (which is `BP_foo`), pop `BP_bar` from the data stack, set `BP = BP_bar`, execute one step, then pop BP\_parent and RA, returning to `foo.main` with `BP_foo` intact and all locals still on the stack.

All nested resumables share a single return stack. Each new child simply pushes RA/BP and raises RSP by its own `N`, stacking on top of its parent’s frame. Cleanup must happen in reverse order of BP addresses.

---

### 5.3 Calling a Resumable from a Conventional Function

If a *normal* function `baz` (one-shot) calls a resumable `bar`:

* In `baz`:

  * Prologue: push RA, push BP, set `BP_baz`, allocate `baz`’s locals.
  * To call `bar.init`, push `baz`’s BP as `BP_parent` for `bar`: inside `bar.init`, it pushes RA, pushes BP\_parent, sets `BP_bar = RSP` (above `baz`’s locals), bumps RSP, does its state assignments, pushes `BP_bar`, then pops BP\_parent and RA to return to `baz`.
  * Back in `baz`, `bar`’s locals remain in `bar`’s frame (stacked above `baz`’s), and `baz`’s BP is restored. Later, `baz` can call `bar.main` or eventually `cleanup_resumable` on `BP_bar`.

* On `bar.cleanup_resumable`:

  * It resets `RSP = BP_bar`, sweeps all child + grandchild values for ref-counts, pops `BP_parent (BP_baz)`, pops `RA_bar_init`, and returns to `baz` with `BP_baz` and `RSP` restored to just past `baz`’s locals.

Thus, a normal function may interleave resumables, but the resumable’s persistent locals still “live” on the frame until an explicit cleanup.

---

### 5.4 Stack Hygiene Rules (Summary)

1. **Every function push/pops exactly two words (BP, RA).**
2. **Every function that allocates locals must reset RSP before popping BP.**
3. **Resumable `init` pushes its own BP as a return value; `main` expects that token.**
4. **Nested resumables stack on each other; cleanup must proceed from deepest BP down.**
5. **Normal functions called inside resumables never permanently grow the frame—they reset RSP before popping.**

If you follow these rules precisely, no frame can ever be inadvertently overwritten or leaked.

## 6. Error Handling & Early Termination in Resumables

Resumable functions may encounter situations where they need to signal an error or halt early (e.g., invalid input, irrecoverable state, or user‐requested cancellation). Because a resumable’s locals persist across invocations and share the caller’s frame, we need a consistent, low-overhead way to propagate “early exit” or “fail” without corrupting the parent’s stack. This section describes:

1. How a resumable signals an error or “done” state.
2. How the parent detects that and responds (e.g., cleanup or skip further resumes).
3. Ensuring that no partial state remains on the child’s frame when an early exit occurs.

---

### 6.1 Signaling an Error or Completion

Within `foo.main`, two outcomes are possible on any invocation:

* **Yield a “next value” normally**:
  The function executes its one‐step body, stores any updated locals, and returns control. The caller may choose to resume again.

* **Signal “done” (no more work) or “error”**:

  * **Done**: Indicates that the sequence has finished all iterations.
  * **Error (or cancel)**: Indicates that something went wrong and no further resumes should be attempted.

Tacit represents these outcomes via a **special tagged return code** on the data stack. By convention:

* A **nonzero pointer** (the child BP) indicates a successful “yield.”
* A **zero (`0`)** indicates “done.”
* A **distinct negative or reserved tag** (e.g., `–1`) can indicate “error.”

❖ **Implementation:**

```tacit
\ Inside foo.main …
<normal‐case‐path>
  BP_child                \ push resume token (child stays valid)
  EXIT                     \ return to caller

<done‐case‐path>
  0                        \ push 0 (done signal)
  EXIT

<error‐case‐path>
  –1                       \ push –1 (error signal)
  EXIT
```

* The first two steps (push RA, push BP\_parent, etc.) are implicitly handled at entry.
* At “done” or “error,” we jump directly to the exit epilogue without modifying any locals.

---

### 6.2 Caller Behavior on Return Code

When the caller invokes `foo.main`, it always does:

```tacit
r_foo  foo.main
DUP 0= IF 
  \   “done” detected; clean up foo immediately  
  POP               \ remove the 0  
  r_foo cleanup_resumable  
  EXIT‐TO‐PARENT    \ stop resuming foo  
ELSE
  DUP –1 = IF
    \ “error” detected; caller decides whether to cleanup or retry  
    POP             \ remove –1
    r_foo cleanup_resumable  
    handle_error   \ e.g., log or propagate up  
    EXIT‐TO‐PARENT
  THEN
  \ Otherwise (normal yield):  
  \ leave r_foo on stack for next resume  
  … (use yielded value(s) if any) …  
THEN
```

1. **`DUP 0=`** tests if return is “done.” If so,

   * `POP` removes the 0.
   * `cleanup_resumable(r_foo)` performs full frame cleanup (see Section 11).
   * Caller stops resuming.

2. **`DUP –1 =`** tests for an “error.” If so,

   * `POP` removes –1.
   * `cleanup_resumable(r_foo)` drops the frame.
   * Caller invokes a user‐defined `handle_error` routine (could raise an exception or simply halt).

3. **Else (positive BP)**:

   * Leave the child’s BP (`r_foo`) on the stack so the caller can resume again later.
   * Process any values that `foo.main` returned via other stack pushes.

---

### 6.3 Ensuring No Partial Locals on Early Exit

Because `foo.main` exits via the same epilogue (reset RSP to `BP_child`; pop BP\_parent and RA) whether it “yields,” “done,” or “error,” the child’s locals remain intact until the caller explicitly invokes `cleanup_resumable`. In particular:

* On **“done” or “error”:**

  1. `foo.main` pushes `0` or `–1`.
  2. It restores `RSP = BP_child` (locals remain allocated).
  3. Pops `BP_parent` and `RA` to return to caller.
  4. **The child’s locals still sit on the return stack** above `BP_child`, waiting for `cleanup_resumable`.

Thus, no matter where an early “done” or “error” is triggered inside `foo.main`, the frame’s shape remains consistent. The parent’s cleanup code (Section 11) will sweep those locals exactly once.

---

### 6.4 Example: Early Termination

```tacit
: foo
  state { 0 → i }       \ offset 0  
  state { 5 → limit }   \ offset 1  
  ;  

  \ foo.main:
  LOAD [BP + 0]  LOAD [BP + 1]  LT IF
    \ Normal path: push resume token
    DUP [BP + 0] → i        \ (for example)
    BP_child               \ push own BP
    EXIT
  ELSE
    \ i >= limit → “done”
    0                       \ push done signal
    EXIT
  THEN
;
```

Caller logic:

```tacit
i  limit  foo.init → r_foo  \ r_foo = BP_foo  
BEGIN
  r_foo foo.main
  DUP 0= IF
    POP
    r_foo cleanup_resumable
    BREAK
  THEN
  \ Otherwise, normal yield:  
  \ (use updated [BP_foo + 0], e.g., new i)  
  r_foo
UNTIL
```

1. First resume: `i=0, limit=5 → i < limit` is true. We do work, push `BP_foo`, and return.
2. Caller sees a nonzero BP, so it loops back, resumes again.
3. Eventually `i` reaches 5: `i < limit` is false. So `foo.main` pushes `0` and returns.
4. Caller sees `0`:

   * `POP` the 0.
   * `cleanup_resumable(r_foo)` to free all of `foo`’s locals.
   * Break out of loop.

No locals linger on the stack once done.

---

### 6.5 Recoverable vs. Nonrecoverable Errors

By convention, Tacit reserves positive BPs and zero for “normal” and “done.” If a resumable detects a recoverable condition (e.g., a transient network failure), it can:

```tacit
: foo
  state { … }  
  ;  

  \ foo.main:
  fetch-data → result  
  result nil? IF
    \ transient failure → retry this call  
    BP_child                   \ push own BP  
    EXIT
  THEN  
  result error? IF
    \ nonrecoverable error → signal  
    –1                          \ push error code  
    EXIT
  THEN  
  \ otherwise, normal processing → push BP_child  
  BP_child
  EXIT
;
```

* **`result nil?`** means “no data yet—try again.” Returning `BP_child` causes the caller to immediately re‐invoke `foo.main` (no cleanup).
* **`result error?`** means a fatal error—push `–1`, caller will clean up and abort.
* Otherwise, successful: push `BP_child` and exit.

Caller:

```tacit
r_foo foo.main
DUP 0= IF … done …  
ELSE DUP –1 = IF  … error cleanup … THEN  
ELSE 
  \ (normal) continue…  
ENDIF
```

Because `foo.main` only pushes `–1` or `0` in failure modes, and always restores `RSP=BP_child` before pop/pops, the parent’s cleanup remains uniform.

---

### 6.6 Summary of Early Exit Semantics

* **One‐Word Return Signal:**

  * `BP_child > 0`: normal yield.
  * `0`: done/completed.
  * `–1`: nonreversible error.

* **Child’s Frame Remains Allocated Until Parent Cleans Up:**

  * `foo.main` never actually `POP`s its locals.
  * Parent must inspect the return code and call `cleanup_resumable` if `0` or `–1`.

* **No Partial States Left on Stack:**

  * Because `foo.main` always does `RSP = BP_child` before popping BP and RA, locals remain in place and can be fully swept during cleanup.

By following this convention, Tacit’s resumables can signal “done” or “error” in a uniform way—without risking an inconsistent stack—and leave it up to the caller to decide when to tear down the frame.
## 7. Reentrant & Recursive Resumable Calls

Tacit allows a resumable function to invoke itself (direct recursion) or to invoke another resumable that (eventually) calls back into it (mutual recursion). Because each resumable pushes its own BP and allocates locals onto the **same** return‐stack frame, recursion must be carefully managed to avoid clobbering the caller’s state. This section explains:

1. **Why recursion is feasible with resumables** (unlike closures on the heap).
2. **The precise stack layout when a resumable calls itself**.
3. **Mutual recursion between two resumables**.
4. **How resume tokens work in recursive contexts**.
5. **What cleanup order is required to avoid leaks or invalid memory access**.

---

### 7.1 Why Resumable Recursion Works

A conventional recursive function allocates a fresh frame for each call. Tacit resumables, by contrast:

* **Do not allocate new “independent” frames in memory**; instead, they allocate additional locals **above** the existing frame.
* Each call to `foo.init` or `foo.main` pushes `BP_parent` and returns a new `BP_child` on the data stack.

Because the return‐stack is effectively a contiguous region of memory, each nested resume simply “grows” the caller’s frame. Provided we always restore `RSP = BP_child` before popping BP, the recursive chain remains correct:

```
BP_anc
 RA_init
 BP_anc
 [ancestors’ locals]
 RA_foo_init     ← call #1
 BP_anc = BP_foo_level1
 [foo’s level‐1 locals]
 RA_foo_main
 BP_anc = BP_foo_level1
 [maybe some locals used by main]
     …
 RA_foo_init     ← call #2
 BP_foo_level1 = BP_foo_level2
 [foo’s level‐2 locals]
 RA_foo_main
 BP_foo_level1 = BP_foo_level2
 [etc.]
```

Each time `foo` calls itself, it treats its **own BP** as the “parent BP” for the next generation. Because `foo`’s locals are simply stacked deeper, each recursive level has access to its own copy of locals at offsets from its own BP.

---

### 7.2 Direct (Single‐Function) Recursion Example

```tacit
\ A resumable that counts down from N to zero, emitting each value
: countdown
  state { 0 → cur }      \ offset 0  
  state { 0 → limit }    \ offset 1  
  ;  

  \ countdown.init:
  \   Expects initial N on data stack
  \   Prologue: push RA, push BP_parent, set BP_child, allocate 2 slots
  \   Assign:   cur ← N; limit ← 0
  \   Push BP_child; pop BP_parent; pop RA; return (resume token on stack)
  \  

  \ countdown.main:
  LOAD [BP + 0] → cur     \ current value
  LOAD [BP + 1] → limit   \ stopping value
  cur limit ≥ IF
      0                   \ “done” signal
      EXIT
  THEN

  cur                     \ push current value to caller
  LOAD [BP + 0] 1 - → new_cur
  new_cur → [BP + 0]      \ update cur ← cur − 1

  BP_child                \ push resume token
  EXIT
;
```

#### 7.2.1 Invoking `countdown`

1. **Initial Call (init):**

   ```tacit
   5 countdown.init → r1   \ r1 = BP_level1  
   ```

   * Frame after init:

     ```
     …  
     RA_c1_init  
     BP_parent     ← BP_level1  
     [ cur = 5 ]   (at BP_level1 + 0)  
     [ limit = 0 ] (at BP_level1 + 1)  
     RSP = BP_level1 + 2  
     ```
   * Caller now has `r1` on data stack.

2. **First Resume (main) with `r1`:**

   ```tacit
   r1 countdown.main → r2  
   ```

   * Prologue of `main`:

     * Push RA\_c1\_main; push BP\_parent ← BP\_level1;
     * Pop BP\_child ← r1; set `BP_level1` again;
   * Body:

     * `cur = 5; limit = 0; 5 ≥ 0 → false;` skip “done.”
     * Push `cur = 5` onto data stack (emitted to caller).
     * Compute `new_cur = 4; cur ← 4`.
     * Push `BP_child` (still `BP_level1`) onto data stack so the caller can resume.
   * Epilogue: pop BP\_parent; pop RA\_c1\_main; return.
   * Caller sees `r2 = BP_level1` (same as r1) and value `5`.

3. **Second Resume (still r1, which equals BP\_level1):**

   ```tacit
   r2 countdown.main → r3  
   ```

   * Now `cur=4`; same process continues until `cur=0`.

4. **Eventually, when `cur=0`:**

   * `cur=0; limit=0; 0 ≥ 0 → true;` so `main` pushes `0` (done) and returns.
   * Caller sees `0`, pops it, calls `cleanup_resumable(r1)`.

No deep recursion yet—because each resume reused the same BP. This particular resumable is **tail‐recursive**: it never calls a fresh `init` inside `main`.

---

### 7.3 Non‐Tail Recursion: Calling `init` Recursively

If a resumable wants to “restart” itself with a new subcount, it can call `countdown.init` inside its own `main`. That allocates a brand‐new set of locals “above” the previous frame. Example:

```tacit
: nested-countdown
  state { 0 → stage }     \ offset 0  
  state { 0 → x }         \ offset 1  
  state { 0 → N }         \ offset 2  
  ;  

  \ nested-countdown.init:
  \   Expects initial N on stack
  \   Prologue: push RA, push BP_parent, set BP_child, allocate 3 slots
  \   Assign: stage ← 0; x ← N; N ← N
  \   Push BP_child; pop BP_parent; pop RA; return
  \  

  \ nested-countdown.main:
  LOAD [BP + 0] → stage
  LOAD [BP + 1] → x
  LOAD [BP + 2] → N

  stage 0 = IF
    x 0 > IF
      \ First phase: count down x to 0, then advance stage
      x → cur
      0 → limit
      cur limit ≥ IF
         0
         EXIT
      THEN
      cur                  \ emit current x
      cur 1 - → new_x
      new_x → [BP + 1]      \ update x
      BP_child              \ push same BP to resume later
      EXIT
    ELSE
      \ Second phase: count down N to 0, then done
      N 0 > IF
        N → cur2
        0 → limit2
        cur2 limit2 ≥ IF
           0
           EXIT
        THEN
        cur2                \ emit current N
        cur2 1 - → new_N
        new_N → [BP + 2]     \ update N
        BP_child             \ push same BP
        EXIT
      THEN
      0                      \ done (both phases complete)
      EXIT
    THEN
```

Here, there is no recursive `init` call inside `main`. Instead, `main` maintains a `stage` variable that toggles from phase 0 to phase 1. Each resume loops until that part is done, then switches `stage` to 1 on the final iteration of phase 0.

If we **did** want to call `init` recursively—e.g., to process nested subcounts—we could write:

```tacit
: rec-init-demo
  state { 0 → depth }     \ offset 0  
  state { 0 → N }         \ offset 1  
  ;  

  \ rec-init-demo.init:
  \   Expects initial N on stack
  \   Assign: depth ← N; N ← N
  \   Push BP_child; return  
  \  

  \ rec-init-demo.main:
  LOAD [BP + 0] → depth
  LOAD [BP + 1] → N

  depth 0 = IF
    \ Base case: done
    0
    EXIT
  THEN

  \ “Recurse” by calling init with N-1
  depth 1 - → new_depth
  new_depth 
  rec-init-demo.init      \ recursively allocate a new frame
  → r_child

  \ Caller sees r_child, can resume that child fully before continuing
  \ Once child is done, control returns here (parent’s next op).
  \ [Note: parent’s own locals (depth, N) remain allocated.]  
  r_child  rec-init-demo.main   \ resume the child to completion  
  DROP                          \ drop child’s “done” signal
  \ Now resume parent’s next step:
  0
  EXIT
```

#### 7.3.1 Stack Layout for Two Levels

1. **First `rec-init-demo.init` call:**

   ```
   RA_r1_init  
   BP_parent_of_r1  
   [ depth = N_1 ] (at BP_r1 + 0)  
   [ N = N_1 ]     (at BP_r1 + 1)  
   RSP = BP_r1 + 2  
   ```

2. **Inside `r1.main`:**

   * `depth_1 = N_1 > 0`, so compute `new_depth = N_1 − 1`.
   * Call `rec-init-demo.init` again (child `r2`):

   ```
   RA_r2_init  
   BP_parent_of_r2 = BP_r1   ← reused from above  
   [ depth = new_depth ]   (BP_r2 + 0)  
   [ N = new_depth ]       (BP_r2 + 1)  
   RSP = BP_r2 + 2  
   ```

   Notice that `BP_r2_parent = BP_r1`, so children stack seamlessly on top of parent’s locals.

3. **Resuming `r2.main` to completion** (eventually `depth = 0` pushes `0` and returns):

   * Caller (which is `r1.main`) gets `0`, does `cleanup_resumable(r2)`, fully dropping `r2`’s `[depth, N]`.
   * `RSP` is reset to `BP_r2`, then sweep ref‐counts (none), pop `BP_r1`, pop `RA_r2_init`, returning to `r1.main` with `BP_r1` restored.

4. **Back in `r1.main`:**

   * Now that the recursive child is done, `r1` pushes its own `0` and returns.
   * Caller (e.g., top‐level) uses `cleanup_resumable(r1)` to drop `r1`’s `[depth, N]`.

---

### 7.4 Mutual Recursion Between Two Resumables

Suppose `foo` can call `bar` and `bar` can call `foo`. Both are resumables, each allocating its own locals.

```tacit
: foo
  state { 0 → x }    \ offset 0  
  state { 5 → limit } \ offset 1  
  ;  

  \ foo.init: push BP_foo, allocate 2 slots (x,limit), x←N,limit←limit  
  \ foo.main:  
  x  limit  < IF
    x x * → y         \ compute x^2  
    bar.init          \ call bar for y  
    → r_bar  
    x 1 + → x  
    r_bar             \ push bar’s BP for later resume  
    EXIT
  THEN  
  0                  \ done  
  EXIT
;

: bar
  state { 0 → z }    \ offset 0  
  state { 0 → threshold } \ offset 1  
  ;  

  \ bar.init: push BP_bar, allocate 2 slots, z←N, threshold←10  
  \ bar.main:  
  z threshold  < IF
    z z + → z        \ accumulate  
    foo.init         \ call foo for next iteration  
    → r_foo  
    r_foo            \ push foo’s BP  
    EXIT
  THEN  
  0                 \ done  
  EXIT
;
```

#### 7.4.1 First-Level Calls

1. **`foo.init` from top** with `x = 1` and `limit = 5`:

   ```
   RA_f1_init  
   BP_top    
   [ x = 1 ]  
   [ limit = 5 ]  
   RSP = BP_f1 + 2  
   ```

   Caller sees `r_foo1 = BP_f1`.

2. **`foo.main(r_foo1)`**:

   * x=1 < 5, so `y = 1 * 1 = 1`.
   * Call `bar.init` with `N=y=1`.

   **Inside `bar.init`:**

   ```
   RA_b1_init  
   BP_parent=BP_f1   ← BP_bar  
   [ z = 1 ]         (BP_b1 + 0)  
   [ threshold = 10 ](BP_b1 + 1)  
   RSP = BP_b1 + 2  
   ```

   Returns `r_bar1 = BP_b1`.

   Back in `foo.main`:

   * Update `x ← 2`.
   * Push `r_bar1` onto data stack and return.
   * `BP_f1` remains under `[2,5]`, and now below `[1,10]`.

#### 7.4.2 `bar.main(r_bar1)`

1. **`bar.main(r_bar1)`:**

   * Restore `BP_bar=BP_b1`, z=1, threshold=10.
   * z=1 < 10, so `z ← 2`.
   * Call `foo.init` with `N=2`.

   **Inside `foo.init` (second level):**

   ```
   RA_f2_init  
   BP_parent=BP_b1   ← BP_f2  
   [ x = 2 ]         (BP_f2 + 0)  
   [ limit = 5 ]     (BP_f2 + 1)  [inherited constant]
   RSP = BP_f2 + 2  
   ```

   Returns `r_foo2 = BP_f2`.

2. **Resume order** (for clarity):

   * Caller of `bar.main` (which was `foo.main`) receives `r_foo2` and returns to its own epilogue (restoring `BP_f1`).
   * Then top‐level sees `r_foo2` on data stack for next resume.

At this point, the stack looks like (bottom to top):

```
RA_top  
BP_top  
RA_f1_init  
BP_top = BP_f1   (first foo frame)  
[  x=2  ]  
[ limit=5 ]  
RA_f1_main  
BP_top=BP_f1  
RA_b1_init  
BP_top=BP_b1   (first bar frame)  
[  z=2  ]  
[ threshold=10 ]  
RA_b1_main  
BP_top=BP_b1  
RA_f2_init  
BP_top=BP_f2  (second foo frame)  
[  x=2  ]  
[ limit=5 ]  
RSP_current
```

Notice how each new init for `foo` or `bar` simply stacked on top.

#### 7.4.3 Cleanup Sequence

To tear down all nested frames from deepest to shallowest:

1. **Clean up second `foo` (BP\_f2):**

   * Caller does `r_foo2 cleanup_resumable`.
   * That resets RSP to `BP_f2`, sweeps `[x=2, limit=5]`, pops `BP_b1, RA_f2_init`, returning to `bar.main` context.

2. **Resume `bar.main` where it left off** (after `CALL foo.init`).

   * It now continues (if it had more code) or eventually signals `0` (done).
   * Caller invokes `r_bar1 cleanup_resumable`, which drops bar’s frame (`[z, threshold]`) and pops `BP_f1, RA_b1_init`.

3. **Resume `foo.main` (first level) where it left off** (after `CALL bar.init`).

   * It updates `x=3`, pushes `r_bar2` (if it recursed again) or eventually signals `0`.
   * Caller invokes `r_foo1 cleanup_resumable`, which drops `foo`’s first frame (`[x, limit]`) and pops `BP_top, RA_f1_init`.

At the end, only the top‐level BP (`BP_top`) remains, and control returns to the original caller of `top`.

---

### 7.5 Resume Tokens in Recursive Contexts

* **Every `init` call returns exactly one BP:** That BP is unique for that particular invocation.
* You can have multiple coexisting resume tokens for different levels of recursion. Each token points to a distinct BP.
* It is the caller’s responsibility to resume them in a safe order—deepest first. In mutual recursion, you typically resume one branch until it returns “done,” then clean it, then resume the other.

If you accidentally resume a parent token while its child is still allocated, you risk clobbering the child’s frame. Always:

1. **Resume child to completion** (possibly through several `main` calls).
2. **Invoke `cleanup_resumable(child_BP)`** to drop the child’s frame.
3. **Then safely resume the parent’s next step**.

---

### 7.6 Best Practices & Common Pitfalls

1. **Always Clean Up Deepest First:**

   * If you hold multiple resume tokens (e.g., `r_foo1`, `r_bar1`, `r_foo2`), discover which has the highest BP address (deepest) and clean it first.

2. **Do Not Reuse the Same BP Token Twice:**

   * Once you call `cleanup_resumable(r)`, that BP is invalid. Do not attempt to resume it again.

3. **Avoid Interleaving Resumes Out of Order:**

   * If `foo` calls `bar` and obtains `r_bar`, do not call `foo.main(r_foo)` again until you have fully cleaned up `r_bar`. Otherwise, `foo`’s next resume might pop BP or RA that belong to `bar`.

4. **Maintain Explicit Knowledge of Each Depth Level:**

   * Keep resume tokens in a stack or list so you know which BP is associated with which recursion depth. This makes cleanup predictable.

5. **If a Child Signals “Error” or “Done,” Immediately Clean Up That Child:**

   * Only after `cleanup_resumable(child_BP)` should you resume or clean up the parent.

By following these guidelines, recursive or mutually recursive resumable calls remain safe and yield correct results, with each level’s locals staying isolated at known offsets.

## 8. Integration into the Tacit Compiler & Full Example

This final section ties together all resumable‐function concepts with practical compiler guidance and a complete end‐to‐end example. It shows exactly how a Tacit compiler should:

1. Recognize and parse resumable definitions.
2. Emit the correct prologue/epilogue labels and stack operations for both `init` and `main` phases.
3. Allocate and index state variables in the shared return‐stack frame.
4. Generate the “resume‐token” return values.
5. Produce the caller logic that inspects the return code (BP token, 0, or –1) and either loops, cleans up, or propagates an error.

---

### 8.1 Compiler Phases for Resumables

When the compiler encounters a `: foo … ;` definition marked as resumable, it must break the body into two labeled code blocks:

* **`foo.init`** – one‐time initializer
* **`foo.main`** – single‐step resume

The steps for the compiler are:

1. **Parsing & Front‐Matter**

   * Identify any `state { … } → var` lines.
   * Assign each named `var` a consecutive “field index” (0, 1, 2, …).
   * Record `N_state = total number of state variables`.

2. **Emit `foo.init` Label & Prologue**

   * Output a unique label `foo.init:`.
   * Emit:

     ```
     PUSH_RETURN_ADDRESS foo.init_prologue_return
     PUSH_BASE_POINTER
     MOV  BP_child, RSP
     ADD  RSP, N_state
     ```

     (In pseudocode, “PUSH\_RETURN\_ADDRESS” and “PUSH\_BASE\_POINTER” correspond to the platform‐agnostic instructions that save caller’s RA and BP, then set `BP_child` = current `RSP`, then bump `RSP` by `N_state` slots.)

3. **Generate State Assignments in `init`**

   * For each `state { expr → var }`:

     * Compile `expr` as usual, leaving its result(s) on the data stack.
     * Generate a store into `[BP_child + index_of(var)]`.
   * After all `state` assignments, emit:

     ```
     PUSH  BP_child            ; return the resume‐token
     POP   BP_parent          ; restore caller’s BP
     POP   RA_return          ; restore return address
     RETURN
     ```
   * The `RETURN` jumps back to whatever instruction the caller placed after calling `foo.init`.

4. **Emit `foo.main` Label & Prologue**

   * Output a unique label `foo.main:`.
   * Emit:

     ```
     PUSH_RETURN_ADDRESS foo.main_prologue_return
     PUSH_BASE_POINTER
     POP   BP_child            ; restore child’s BP from resume token
     ```
   * (Do **not** bump `RSP` here—locals were already allocated in `init`.)

5. **Generate Main Body**

   * Compile the user‐provided code that constitutes one iteration.
   * The user may:

     * Read or write state variables by generating loads/stores at `[BP_child + index]`.
     * Push a positive “BP\_child” onto the data stack to signal “yield and continue.”
     * Push `0` to signal “done.”
     * Push `–1` (or another reserved sentinel) to signal “error.”
   * After emitting all user logic, append:

     ```
     POP   BP_parent           ; restore caller’s BP
     POP   RA_return           ; restore return address
     RETURN
     ```

6. **Emit Caller Stub / Trampoline**

   * When `foo` is invoked by user code, the compiler rewrites a call to `foo` as either:

     * **Initialization call:**

       ```
       <arguments…>
       CALL foo.init  
       → r_foo               ; pop resume token into r_foo  
       ```
     * **Resume call:**

       ```
       r_foo foo.main
       ```
   * The compiler must ensure that after each resume, the caller inspects the return code on the data stack and dispatches cleanup or re‐invoke logic. See Section 13.

7. **Generate Cleanup Routine**

   * For each resumable `foo`, emit a hidden word `foo.cleanup_resumable:` that:

     1. Takes one argument on the data stack (the resume token = `BP_child`).
     2. Does:

        ```
        MOV   RSP, BP_child       \ drop all locals and descendants
        [ optional: walk from BP_child..BP_child+N_state−1 and dec‐ref any pointers ]
        POP   BP_parent           \ restore caller’s BP
        POP   RA_return           \ restore return address (which was pushed by init)
        RETURN
        ```
     3. This cleanup is invoked by the caller whenever `foo.main` returns `0` or `–1`.

---

### 8.2 Complete Example: “Fibonacci Resumable”

Below is a full illustrative example of a resumable that generates Fibonacci numbers up to a limit. We show:

1. The **source** Tacit code.
2. The **compile-time transformation** into two labels (`fib.init` and `fib.main`) plus a `fib.cleanup_resumable`.
3. The **caller** logic that drives initialization, repeated resumes, and final cleanup.

#### 8.2.1 Source Code in Tacit

```tacit
\ Define a resumable called fib that computes Fibonacci sequence up to “limit”
: fib
  state { 0 → a }        \ offset 0
  state { 1 → b }        \ offset 1
  state { 0 → limit }    \ offset 2
  ;  

  \ fib.init (expects initial limit on stack):
  limit → [BP + 2]       \ assign limit
  0     → [BP + 0]       \ a ← 0
  1     → [BP + 1]       \ b ← 1
  PUSH  BP_child         \ return resume token
  POP   BP_parent
  POP   RA
  RETURN

  \ fib.main (no explicit “main” keyword; compiler knows to split):
  LOAD [BP + 0] → a
  LOAD [BP + 1] → b
  LOAD [BP + 2] → limit

  a limit > IF
    \ Done: Fibonacci exceeds limit
    0
    POP BP_parent
    POP RA
    RETURN
  THEN

  a → value               \ push current Fibonacci number
  \ Compute next pair: (a,b) ← (b, a+b)
  LOAD [BP + 1] → next_a
  LOAD [BP + 0] LOAD [BP + 1] + → next_b
  next_a → [BP + 0]        \ a ← next_a
  next_b → [BP + 1]        \ b ← next_b

  BP_child                 \ push resume token to signal “yield and continue”
  POP   BP_parent
  POP   RA
  RETURN
;

\ Caller code that uses this resumable:
: fib-test
  10 fib.init → r_fib   \ initialize with limit=10
  BEGIN
    r_fib fib.main      \ resume
    DUP 0= IF
      POP               \ drop 0
      r_fib fib.cleanup_resumable
      EXIT
    THEN
    DUP fib.print       \ print the yielded Fibonacci number
    r_fib               \ leave resume token for next iteration
  REPEAT
;
```

#### 8.2.2 Compilation Sketch

##### 8.2.2.1 `fib.init` (expanded)

```
LABEL fib.init:
    ; Prologue
    PUSH_RETURN_ADDRESS  fib.init_prologue_return
    PUSH_BASE_POINTER
    MOV  BP_child, RSP
    ADD  RSP, 3                ; three state slots: a, b, limit

    ; Body of init:
    POP   TMP                  ; pop incoming “limit”
    TMP → [BP_child + 2]       ; store limit
    0   → [BP_child + 0]       ; a ← 0
    1   → [BP_child + 1]       ; b ← 1

    ; Return the resume token (BP_child)
    PUSH  BP_child
    POP   BP_parent            ; restore caller’s BP
    POP   RA_return            ; restore return address
    RETURN                     ; return to fib.init_prologue_return
LABEL fib.init_prologue_return:
```

* After returning, the caller’s RSP now sits at `BP_child + 3`.

##### 8.2.2.2 `fib.main` (expanded)

```
LABEL fib.main:
    ; Prologue
    PUSH_RETURN_ADDRESS  fib.main_prologue_return
    PUSH_BASE_POINTER
    POP   BP_child             ; resume token popped from data stack

    ; Body of main:
    [BP_child + 0] → a
    [BP_child + 1] → b
    [BP_child + 2] → limit
    a  limit  > IF
        PUSH  0
        POP   BP_parent        ; restore caller’s BP
        POP   RA_return        ; restore return address
        RETURN
    THEN

    ; emit current value (a)
    PUSH  a

    ; compute next a, b
    b → next_a
    a  b  + → next_b
    next_a → [BP_child + 0]
    next_b → [BP_child + 1]

    ; signal “yield and continue”
    PUSH  BP_child
    POP   BP_parent
    POP   RA_return
    RETURN
LABEL fib.main_prologue_return:
```

* `fib.main` always leaves either `0` (done) or `BP_child` as its one‐word return code.

##### 8.2.2.3 `fib.cleanup_resumable` (hidden)

```
LABEL fib.cleanup_resumable:
    POP   BP_child          ; resume token as argument
    MOV   RSP, BP_child     ; drop all locals above BP_child
    ; [optional: ref‐count sweep across BP_child..BP_child+2]
    POP   BP_parent         ; restore caller’s BP
    POP   RA_return         ; restore return address from init’s prologue
    RETURN
```

* This word is invoked by the caller exactly once, when `fib.main` returns `0`.
* It restores `RSP` so that the entire `[a,b,limit]` region is popped, then restores `BP` and `RA`.

---

### 8.3 Final Caller Loop (Expanded)

The code for `fib-test` becomes:

```
LABEL fib-test:
    ; Push 10, call fib.init
    PUSH 10
    CALL fib.init
    POP   r_fib             ; store resume token
    
LABEL fib_loop:
    PUSH  r_fib
    CALL  fib.main
    POP   R0                ; `R0` now holds fib’s return code
    DUP   R0, 0= IF
        POP                 ; drop the 0
        PUSH  r_fib
        CALL  fib.cleanup_resumable
        RETURN
    THEN
    DUP   R0                ; yield token still on stack
    ; `fib.main` also pushed the yielded Fibonacci number just below R0
    SWAP                    ; bring the number on top
    CALL  print             ; print it
    ; Now R0 still holds the resume token
    GOTO fib_loop
```

Explanation:

1. **`PUSH 10; CALL fib.init; POP r_fib`**

   * Caller pushes the limit (10), calls `fib.init`, and pops its return (which is `BP_child`) into local `r_fib`.

2. **Loop Label `fib_loop`**

   * `PUSH r_fib; CALL fib.main` → `fib.main`’s prologue and body run.
   * `fib.main` pushes either `0` or `BP_child` as its return code, and (if continuing) pushes the yielded Fibonacci number.

3. **`POP R0`**

   * Grab the return code into `R0`.

4. **`DUP R0, 0=`**

   * If `R0 == 0`, we detect “done.”

     * `POP` the `0`.
     * `PUSH r_fib; CALL fib.cleanup_resumable` cleans the entire frame.
     * `RETURN` from `fib-test`.

5. **Otherwise (`R0 > 0`), normal yield path:**

   * `DUP R0` leaves the resume token on the stack for the next loop.
   * Next‐below‐top on the stack is the yielded value.

     * `SWAP; CALL print` prints the Fibonacci number.
   * Now the stack again has just the resume token.
   * `GOTO fib_loop` to resume again.

---

### 8.4 Best Practices Checklist

When integrating resumables into the Tacit compiler or writing new resumables, always verify:

* **Two‐Label Split**

  * The compiler must split each `: name … ;` into exactly `name.init` and `name.main`.
  * No other hidden entry points.

* **Exact State Count**

  * Count every `state { … }` declaration. That count becomes `N_state`, the number of slots to allocate.
  * Do not allow on‐the‐fly adding of new state slots in `main`. All state variables must be declared in the `init` block.

* **Uniform Prologue/Epilogue**

  * Every generated label must begin with “push RA; push BP; MOV BP, RSP; ADD RSP, … ” (if in `init`) or “push RA; push BP; pop BP;” (if in `main`).
  * Every exit path must produce exactly one word (BP, 0, or –1), then restore `RSP = BP`, pop BP, pop RA, and return.

* **Caller Inspection**

  * Every callsite to a resumable must:

    1. Retrieve (pop) the return code.
    2. Test for `0` (done) or `–1` (error).
    3. On `0` or `–1`, immediately call `cleanup_resumable` and stop further resumes.
    4. Otherwise, keep the resume token around and consume any “yielded” values that were pushed.

* **Cleanup at Most Once**

  * After cleanup, the resume token is invalid. A second cleanup or resume on that token is an error.

* **No Hidden Frame Growth**

  * Normal functions called inside resumables must always restore RSP to their own BP before popping BP.
  * Resumable `main` must never perform `ADD RSP, … `. It may read/write via `[BP + offset]` but does not bump RSP again.

* **Recursive Depth Management**

  * If multiple resume tokens are held simultaneously, store them in a data‐structure (e.g., an array or local stack) to ensure proper LIFO cleanup.

---

### 8.5 Summary

By following the steps outlined in this section, the Tacit compiler will correctly:

* **Allocate** the shared return‐stack frame for resumable locals.
* **Emit** `init` and `main` labels with consistent prologues and epilogues.
* **Produce** a one‐word “resume token” or “done/error” code.
* **Enable** caller loops that interpret those codes, print or process yielded values, and invoke cleanup exactly once.
* **Support** tail‐recursive and mutually recursive resumables without any additional runtime bookkeeping.

This completes the detailed specification of **Resumable Functions** in Tacit, from syntax through code generation, runtime conventions, and a full working example.
