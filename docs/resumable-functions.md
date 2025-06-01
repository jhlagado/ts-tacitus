# Understanding Resumable Functions in Tacit

Resumable functions are a powerful feature of the Tacit Virtual Machine (VM) designed to support operations that require persistent state across multiple distinct invocations. They allow a function to be entered, perform some work, exit, and then be re-entered later, seamlessly regaining access to its previously established internal state.

## 1.1. Core Idea: Re-entrant Functions with Persistent State

At their core, resumable functions provide a mechanism for stateful re-entrancy. When a function is designated as resumable, the Tacit compiler and VM handle it in a special two-phase manner:

*   An **`init` (initialization) phase**: This phase is executed once to set up the persistent state for the function.
*   A **`main` phase**: This is the primary logic of the function, which can be called multiple times. Each call to the `main` phase operates on the persistent state established by the `init` phase.

It's crucial to distinguish resumable functions from concepts like coroutines found in other languages. Resumable functions in Tacit do **not** "pause" or "yield" execution control in the typical coroutine sense. Instead, they complete their execution in each phase (`init` or `main`) and return. The "resumable" aspect refers to the ability to re-invoke the `main` phase and have it automatically operate within the context of its persistent state, effectively resuming its work with that state.

## 1.2. Purpose: Why Use Resumable Functions?

Resumable functions are particularly useful for:

*   **Generators**: Creating functions that produce a sequence of values, one at a time, across multiple calls (e.g., a Fibonacci sequence generator).
*   **State Machines**: Implementing complex stateful logic where the function's behavior in one call depends on its state from previous calls.
*   **Iterative Processes**: Managing operations that unfold in discrete steps, maintaining context between steps (e.g., incremental parsing or processing of large data).
*   **Resource Management**: Handling resources that have a distinct setup phase and then multiple operational phases, with state preserved throughout.

These use cases benefit from the clear separation of initialization and repeated execution, coupled with automatic state preservation.

# The Two Phases: `init` and `main`

Every resumable function in Tacit is conceptually divided by the compiler into two distinct operational phases: an `init` phase and a `main` phase. These phases have different purposes, entry points, and calling conventions.

## 2.1. The `init` Phase: Establishing Persistence

**Purpose:**
The primary role of the `init` phase is to allocate memory for the resumable function's persistent state variables and perform any initial setup or initialization of this state. This phase runs only once for a given instance of a resumable function's state.

**Invocation:**
The `init` phase is not called like a standard Tacit word. Instead, it's triggered by a special VM operation or calling protocol, often represented by a dedicated keyword like `INITIATE_RESUMABLE function_name`. This operation takes any arguments intended for initializing the persistent state.

**Entry Point:**
The compiled code for the `init` phase resides at a small, fixed offset from the function's base address. For example, if the function `foo` is at address `A`, its `init` phase might be entered by calling `A + N_offset` (e.g., `A + 3`). The `INITIATE_RESUMABLE` operation implicitly targets this offset.

**Outcome:**
Upon successful completion, the `init` phase returns a **resume token** to its caller. This token is opaque to the caller but internally represents the location or base pointer of the newly allocated and initialized persistent state frame on the return stack. This token is essential for all subsequent calls to the `main` phase of this specific resumable instance.

## 2.2. The `main` Phase: Executing with Persistent State

**Purpose:**
The `main` phase contains the primary, user-defined logic of the resumable function. It's designed to be executed multiple times, with each execution having access to the persistent state established by the `init` phase.

**Invocation:**
Similar to the `init` phase, the `main` phase is invoked via a special VM operation or calling protocol, such as `CALL_RESUMABLE function_name`. This operation requires the `resume token` (obtained from the `init` phase) to identify which instance of persistent state to use. It may also take additional arguments specific to the `main` phase's logic for that particular step.

**Entry Point:**
The compiled code for the `main` phase – which is the code written by the user when defining the resumable function – resides at the function's base address (e.g., `function_address + 0`). The `CALL_RESUMABLE` operation targets this base address, but the VM uses the provided resume token to set up the correct state context before execution begins.

**Behavior:**
Each call to the `main` phase executes its logic, potentially modifying the persistent state. It then returns, and the persistent state remains intact for future `main` phase calls using the same resume token. The `main` phase might also return values or signals to its caller indicating progress, completion, or errors.

# State, Scope, and Lifetime Management

A defining characteristic of Tacit resumable functions is how their persistent state is managed. Understanding the interplay between the resumable function, its caller, and the Tacit VM's stack is key to using them effectively.

## 3.1. Persistent State on the Return Stack

When a `STATE { ... }` block is declared within a resumable function, the variables defined within it constitute the function's persistent state. During the `init` phase, space for these state variables is allocated directly on the **return stack**. This allocation effectively extends the stack frame of the function that *called* `INITIATE_RESUMABLE`. The resume token returned by `init` points to this newly established persistent frame on the return stack.

## 3.2. Caller-Managed Scope: The Fundamental Principle

The most crucial aspect of resumable function state management is that **the resumable function itself does not manage the lifetime of its persistent state.** The lifetime of this state is entirely dictated by the scope of its caller – specifically, the function that executed `INITIATE_RESUMABLE`.

Because the persistent state is an extension of the caller's return stack frame:
*   **Implicit Cleanup:** When the caller function (the one that initiated the resumable) eventually finishes and its own stack frame is unwound from the return stack, the persistent state of the resumable function is automatically and implicitly reclaimed as part of this process.
*   **No Explicit `destroy`:** There is no special "cleanup" or "destroy" phase that the resumable function itself executes, nor is there a `CLEANUP_RESUMABLE` word. The cleanup is a natural consequence of standard stack unwinding in the parent scope.

This design ties the resumable's state lifecycle directly to standard lexical or dynamic scoping rules of the Tacit VM.

## 3.3. Interaction with Conventional (Non-Resumable) Functions

Typically, a conventional (non-resumable) Tacit function will be responsible for initiating and managing a resumable function:

1.  The conventional function calls `INITIATE_RESUMABLE some_resumable_func WITH init_args`.
2.  It receives and stores the `resume_token`.
3.  It can then, at its discretion, call `CALL_RESUMABLE some_resumable_func WITH resume_token, main_args` one or more times.
4.  When the conventional function itself returns or its scope ends, the `resume_token` becomes invalid, and the associated persistent state is reclaimed.

The lifetime of the resumable's state cannot exceed the lifetime of the conventional function instance that created it.

## 3.4. Nested Resumable Functions: Chained Scope Dependencies

Resumable functions can also initiate other resumable functions from within their `main` phase. This creates a chain of scope dependencies:

*   Suppose `ResumableA`'s `main` phase calls `INITIATE_RESUMABLE ResumableB`.
*   `ResumableB`'s persistent state will be allocated on the return stack, conceptually "above" or as a further extension of the stack relative to `ResumableA`'s current operational context (which includes `ResumableA`'s own persistent frame).
*   The lifetime of `ResumableB`'s state is now tied to the current invocation and persistent frame of `ResumableA`.
*   If `ResumableA`'s state is eventually reclaimed (because the function that initiated `ResumableA` returns), then `ResumableB`'s state (and any further resumables initiated by `B`) will also be implicitly reclaimed.

The ultimate anchor for the lifetime of any chain of resumable functions is the outermost non-resumable function scope that began the sequence. This ensures that all stack-allocated persistent state is properly managed without requiring manual deallocation by the resumable functions themselves.

## Calling Conventions and Stack Behavior

This section defines the stack layout and calling convention for the three entry modes used in Tacit: normal function calls, resumable `init` phase calls, and resumable `main` phase resumes. Each mode handles the return stack, base pointer (`BP`), and data stack differently, based on whether the call is temporary or persistent and whether stack growth is expected.

### 1. Normal Function Call

**Purpose:**
Used for one-shot execution with no persistent state. Temporary stack space is allocated and deallocated on entry and exit.

**Preamble (at call site):**
Caller performs:

* Push return address onto the return stack.
* Push current `BP` onto the return stack.
* Set `BP` to current return stack pointer (`RP`) after push.

No manipulation of the data stack unless arguments are being passed.

**Prologue (at callee):**

* Locals are allocated above the new `BP`.
* Local variable count determines how far `SP` is bumped during compilation.

**Epilogue (on return):**

* Walk backward from `SP` to `BP` to drop or clean up any references.
* Pop old `BP` and return address from return stack.
* Restore `BP` and jump to return address.

This ensures full cleanup: both the return stack and data stack are restored to their previous state.

### 2. Resumable `init` Phase

**Purpose:**
Initializes persistent state for a resumable function and returns a captured base pointer that can be used to resume.

**Preamble (at call site):**
Caller performs:

* Push current `BP` onto the return stack.
* Push return address onto the return stack (or in reversed order depending on convention).
* Set `BP` to the new position after both pushes.

No need to bump the data stack yet; that is done by the callee.

**Prologue (at callee):**

* Allocate persistent locals by bumping `SP`. These locals will *not* be unwound.
* Optionally, capture argument values from the data stack into persistent locals for later use.

At this point, a new persistent frame has been established, and the caller's `BP` and return address are stored below it.

**Epilogue (on init return):**

* Push current `BP` (the frame for later resume) onto the **data stack**.
* Load old `BP` from `BP - 1` and assign it back to `BP`.
* Load return address from `BP - 2` and jump to it.

**Key Distinction:**
Unlike a normal function, no attempt is made to clean up the data stack. The `SP` remains in its extended state, and the persistent locals are still live. The only cleanup is restoration of the `BP` and the jump return.

### 3. Resumable `main` Phase

**Purpose:**
Reenters the resumable using a saved `BP`. Runs one "step" of behavior.

**Preamble (at call site):**
Caller:

* Sets `BP` to the saved value passed in via data stack (from the init return).
* Saves previous `BP` to `BP - 1`.
* Saves return address to `BP - 2`.

This links the current resume frame into the existing persistent scope.

**Prologue (at callee):**

* No locals are reallocated.
* `BP` already points to persistent frame. Any variable access uses fixed offsets from here.
* Execution begins at the function's base address (e.g., `function_address + 0`), as this is where the user-defined `main` phase code resides.

**Epilogue (on yield or exit):**

* Load return address from `BP - 2`.
* Load previous `BP` from `BP - 1`.
* Restore `BP` and jump to return address.

The key is **no stack cleanup**: all live data remains intact, and the frame is ready for future resumes. The `SP` is never adjusted unless explicitly done by the main phase logic.

---

### Summary of Differences

| Call Type       | Allocates Locals | Cleans Up Stack | Restores BP | Captures Persistent Frame | Requires Resume Entry |
| --------------- | ---------------- | --------------- | ----------- | ------------------------- | --------------------- |
| Normal Function | Yes              | Yes             | Yes         | No                        | No                    |
| Resumable Init  | Yes (persistent) | No              | Yes         | Yes                       | No                    |
| Resumable Main  | No               | No              | Yes         | Yes                       | Yes (fixed offset)    |
