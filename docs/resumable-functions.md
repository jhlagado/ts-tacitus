# Resumable Functions in Tacit

Resumable functions are a powerful feature in Tacit, enabling programming patterns like generators and stateful computations where logic is executed over multiple distinct calls. They allow a function's `main` phase to be invoked multiple times, with each invocation accessing a persistent internal state established during an initial `init` call. The `main` phase can return an intermediate result and signal that it can be called again, or signal that its work is complete, all while its state is preserved across these calls.

## 1. Introduction

### 1.1. What are Resumable Functions?

A resumable function in Tacit is a special type of function whose `main` phase can be entered multiple times, maintaining its state across these entries. Unlike conventional functions that typically compute their entire result in a single invocation, resumable functions can be called repeatedly via their `main` phase. Each call can perform a part of the computation, return an intermediate result, and be ready for a subsequent call. Each time their `main` phase is called, they operate with their persistent local state variables intact.

This is achieved through a two-phase execution model:
1.  **Initialization (`.init` phase):** Sets up the function's persistent state.
2.  **Re-entry (`.main` phase):** Executes a portion of the function's logic, potentially producing a value and signaling whether it can be called again or has completed.

### 1.2. Motivation: Why Resumables?

Resumable functions provide elegant solutions for several programming challenges:

*   **Generators:** Creating sequences of values on demand, without computing them all at once (e.g., Fibonacci sequence, data stream processing).
*   **Stateful Iteration:** Structuring operations that produce a sequence of results or manage state over multiple distinct calls. This can be useful in contexts like managing I/O driven interactions or event loops where state needs to be preserved between events or steps.
*   **Encapsulated State:** Creating components or functions that encapsulate their own persistent state, similar to closures or objects, but with a specific `init` and `main` invocation pattern for managing that state over successive calls.
*   **State Machines:** Defining complex, stateful logic in a more linear and readable fashion.

### 1.3. Key Characteristics

*   **Two-Phase Execution:** An `init` phase for setup and a `main` phase for iterative execution.
*   **Persistent State:** Local variables declared as `state` persist across multiple calls to its `main` phase.
*   **Return Stack Allocation:** The persistent state of a resumable function is stored on the return stack, within its own call frame.
*   **Explicit Resume Token:** The `init` phase returns a "resume token" (typically the function's base pointer, `BP_child`). This token is required to call the `main` phase.
*   **Parent-Scope State Lifetime:** The persistent state of a resumable function is an extension of its parent caller's stack frame and is reclaimed automatically when the parent scope exits. Resumable functions do not have an explicit self-cleanup mechanism.

## 2. Core Concepts and Syntax

### 2.1. Defining a Resumable: `resumable : name ... ;`

A resumable function is defined using the `resumable :` keyword, followed by its name, state declarations, and the body of its `main` phase. The compiler automatically splits this definition into two distinct callable words: `name.init` and `name.main`.

```tacit
resumable : my_generator
  state { 0 -> counter }  // Persistent state variable
  state { 10 -> limit }
  ;
  // Body of my_generator.main starts here
  counter limit < IF
    counter 1 +
    DUP -> counter      // Update state and provide new counter value
    BP_child            // Signal: has value, can be called again
    EXIT
  THEN
  0                     // Signal: done
  EXIT
;
```

### 2.2. The Two Phases: `name.init` and `name.main`

#### 2.2.1. `name.init`: Initialization and State Allocation

*   **Purpose:** To allocate space on the return stack for the resumable's persistent state variables and initialize them.
*   **Invocation:** Called once to set up the resumable instance.
*   **Arguments:** Takes any initial arguments required for setup from the data stack.
*   **Return Value:** Pushes a single "resume token" (its own `BP_child`) onto the data stack. This token is essential for subsequent calls to `name.main`.
*   **Stack Effect:** Allocates `N_state` slots on the return stack for persistent locals. The Return Stack Pointer (`RSP`) remains elevated above these locals upon returning to the caller, ensuring they persist.

#### 2.2.2. `name.main`: Re-entrant Execution and Value Production

*   **Purpose:** To execute one step or iteration of the resumable function's logic.
*   **Invocation:** Called one or more times using the resume token obtained from `name.init`.
*   **Arguments:** Expects the resume token (`BP_child`) on the data stack. This token is used to locate its persistent state on the return stack.
*   **Return Value(s) on Data Stack:**
    *   If `main` produces a value and can be called again: `value(s)... BP_child`
    *   **Done:** Pushes `0` to signal completion.
    *   **Error:** Pushes `-1` (or another distinct sentinel) to signal an error.
*   **Stack Effect:** Operates on its persistent state variables. Before returning, it ensures `RSP` is reset to its `BP_child`, preserving its locals for the next resumption or cleanup.

### 2.3. State Variables: `state { ... }`

Persistent local variables for a resumable function are declared using the `state { initial_value -> variable_name }` syntax within the `resumable : ... ;` block but before the main body logic. These variables are allocated on the return stack within the resumable's frame and retain their values across calls to `name.main`.

### 2.4. The Resume Token (`BP_child`)

The resume token is the base pointer (`BP`) of the resumable function's own stack frame, established during its `init` phase. It's returned by `name.init` and is required by `name.main` to locate its persistent state variables on the return stack. It also serves as a signal from `name.main` (when positive) that the function has produced a value and can be called again.

## 3. Calling Conventions and Stack Management

Understanding how Tacit manages the return stack is fundamental to grasping resumable functions. This section details the roles of the Return Stack Pointer (`RSP`) and Base Pointer (`BP`), the mechanics of standard function calls, and then delves into the specific stack operations for the `init` and `main` phases of resumable functions, emphasizing how persistent state is managed.

### 3.1. The Return Stack: `RSP` and `BP`

*   **Return Stack Growth:** In this document, we assume the return stack grows towards **higher memory addresses**.
*   **`RSP` (Return Stack Pointer):** This register always points to the **next available free slot** on the top of the return stack. When data is pushed onto the stack, `RSP` is incremented *after* the write.
*   **`BP` (Base Pointer):** This register points to a fixed location within the currently active function's stack frame. Saved context (like the caller's `BP` and the Return Address) and the function's local variables are accessed at known, fixed offsets relative to the current `BP`.

### 3.2. Standard Function Call Mechanics

Understanding these standard call mechanics is crucial for appreciating the distinct calling conventions and stack management employed by resumable functions. This section details the typical sequence of operations for a conventional function call, which serves as a baseline.

#### 3.2.1. Standard Function Prologue: Entering a Function

When a function (the `callee`) is invoked by another (the `caller`), the following steps typically occur to set up the `callee`'s execution environment (its stack frame):

1.  **Caller Prepares Arguments (Data Stack):**
    *   **Action:** The `caller` pushes any arguments intended for the `callee` onto the **data stack**.
    *   **Rationale:** The data stack is the standard place for passing parameters between functions in Tacit.

2.  **`CALL` Instruction Execution (Transfer of Control & Context Saving):**
    *   **Action (a) - Save Return Address (`RA_caller`):** The `CALL` instruction automatically pushes the address of the next instruction in the `caller` (the `RA_caller`) onto the **return stack**. `RSP` (Return Stack Pointer) is incremented to point to the new top of the stack.
    *   **Rationale (a):** This saved address is essential so the `callee` knows where to return control once its execution is complete.
    *   **Action (b) - Save Caller's Base Pointer (`BP_parent`):** The `CALL` instruction (or convention immediately following it) pushes the `caller`'s current `BP` register value (which we'll term `BP_parent`) onto the **return stack**. `RSP` is again incremented.
    *   **Rationale (b):** The `caller`'s `BP` defines its own stack frame. Saving it allows the `callee` to use the `BP` register for its own frame, and then restore the `caller`'s `BP` upon return, thus restoring the `caller`'s context.

3.  **Callee Establishes Its Stack Frame:**
    *   **Action (a) - Set New Base Pointer (`BP_child`):** The `callee` now establishes its own `BP` (which we'll term `BP_child`). A common convention is to set `BP_child` to the current `RSP` minus one word (or to the address where `BP_parent` was just stored). For example: `BP_child := RSP - wordsize` (if `RSP` points to the slot *after* `BP_parent`).
    *   **Rationale (a):** `BP_child` provides a stable reference point for the `callee` to access its arguments (if passed via return stack, though less common in Tacit for primary args), its saved context (`BP_parent`, `RA_caller`), and its own local variables.
    *   **Action (b) - Allocate Space for Pre-calculated Local Variables:** The `callee` increments `RSP` to reserve space for its local variables (`N_locals`) whose sizes are known at compile time. `RSP := RSP + N_locals * wordsize`.
    *   **Rationale (b):** This carves out a dedicated memory region on the stack for the `callee`'s private data.
    *   **Note on Dynamic Stack Growth:** Even in a conventional function, the `RSP` can be further incremented *dynamically* during its execution if more stack space is needed beyond the initially allocated locals. This might occur for complex temporary calculations, or significantly, if this `callee` itself calls another function (including the `init` phase of a resumable function), which would then build its own frame on top of the current `RSP`.

**Conceptual Return Stack after Standard Prologue:**

```
Higher Addresses ^
                 |
RSP ->           +---------------------+  (Points to next free slot)
                 | Local Variable N-1  |
                 | ...                 |
                 | Local Variable 0    |  (Accessed via BP_child + offset)
BP_child ->      +---------------------+  (BP_child points here, typically to saved BP_parent)
                 | Saved BP_parent     |
                 +---------------------+ 
                 | Saved RA_caller     |  (RA_caller is at BP_child - wordsize if BP_child points to BP_parent)
                 +---------------------+
                 | ... (Caller's Frame below) |
Lower Addresses  v
```

#### 3.2.2. Standard Function Epilogue: Exiting a Function

When the `callee` finishes its work and is ready to return control to the `caller`:

1.  **Prepare Return Value(s) (Data Stack):**
    *   **Action:** The `callee` places any return values onto the **data stack**.
    *   **Rationale:** Consistent with argument passing, the data stack is used for results.

2.  **Deallocate Callee's Local Variables & Restore Caller's Context:**
    *   **Action (a) - Deallocate Locals:** `RSP` is reset to point to `BP_child`. `RSP := BP_child`.
    *   **Rationale (a):** This effectively discards the `callee`'s local variables and any temporary space it might have used above them, reclaiming that stack space.
    *   **Action (b) - Restore Caller's Base Pointer:** The saved `BP_parent` is popped from the location pointed to by the current `RSP` (which is `BP_child`) into the `BP` register. `RSP` is decremented. `BP := [RSP]; RSP := RSP - wordsize` (assuming `BP_child` pointed to `BP_parent`).
    *   **Rationale (b):** This restores the `caller`'s stack frame context, so it can again access its own locals and context correctly.
    *   **Action (c) - Restore Return Address:** The saved `RA_caller` is popped from the current `RSP` into a temporary location or directly used by the `RETURN` instruction. `RSP` is decremented. `RA_to_return_to := [RSP]; RSP := RSP - wordsize`.
    *   **Rationale (c):** This retrieves the address where execution must resume in the `caller`.

3.  **`RETURN` Instruction Execution (Transfer of Control):**
    *   **Action:** The `RETURN` instruction causes execution to jump to the `RA_to_return_to`.
    *   **Rationale:** Control is handed back to the `caller`.
    *   **Outcome:** `RSP` is now restored to its exact position before the `CALL` instruction was executed by the `caller`. The `caller` can now access its return values from the data stack.

### 3.3. Resumable Function `init` Phase (`name.init`)

The `init` phase is unique: it establishes a *persistent* stack frame for the resumable function's state variables. This frame will outlive the `init` call itself and is effectively an extension of its caller's stack scope.

#### 3.3.1. `name.init` Prologue: Setting Up Persistent State

1.  **Caller Initiates `(resumable_init_call)` Protocol:**
    *   **Action:** The caller uses a special syntax or mechanism (conceptually `(resumable_init_call)`) to invoke the resumable function's `init` phase. This typically involves pushing any initial arguments for `name.init` onto the **data stack**.
    *   **Rationale:** This distinct invocation signals the need to create a persistent stateful instance, not just a standard function call.

2.  **`name.init` Invocation (Similar to Standard Call Start):**
    *   **Action (a) - Save Return Address (`RA_caller_of_init`):** As with a standard call, the address to return to in the caller is pushed onto the **return stack**. `RSP` increments.
    *   **Rationale (a):** `init` needs to return to its caller once setup is complete.
    *   **Action (b) - Save Caller's Base Pointer (`BP_caller_of_init`):** The caller's `BP` is pushed onto the **return stack**. `RSP` increments.
    *   **Rationale (b):** Standard procedure to preserve the caller's frame context.

3.  **`name.init` Establishes the Persistent Frame:**
    *   **Action (a) - Set `BP_persistent_frame`:** `name.init` sets its `BP` register to mark the base of what will become the persistent state frame. This value, `BP_persistent_frame`, *is the resume token*. Conventionally: `BP_persistent_frame := RSP - wordsize` (pointing to where `BP_caller_of_init` was saved).
    *   **Rationale (a):** This `BP` serves as the anchor for the persistent state and will be used by `name.main` (via the resume token) to locate this state.
    *   **Action (b) - Allocate Space for All Persistent State Variables (`N_state`):** `RSP` is incremented to reserve space for *all* state variables declared in the `resumable : ... ; state { ... }` definition. `RSP := RSP + N_state * wordsize`.
    *   **Rationale (b):** This is the core action of `init` – allocating the memory on the stack that will hold the resumable's state across multiple `main` calls.

#### 3.3.2. `name.init` Body: Initializing State

*   **Action:** `name.init` executes its defined logic, which typically involves popping initialization arguments from the data stack and storing them (or derived values) into the allocated persistent state variable slots (e.g., `[BP_persistent_frame + wordsize + offset_var_A] := value_A`).
*   **Rationale:** To give the persistent state its initial, well-defined values.

#### 3.3.3. `name.init` Epilogue: Returning the Token, Preserving State

The epilogue of `init` is critically different from a standard function because it must leave the newly allocated persistent state on the stack.

1.  **Push Resume Token onto Data Stack:**
    *   **Action:** The value of `BP_persistent_frame` (the resume token) is pushed onto the **data stack**.
    *   **Rationale:** This provides the caller with the handle needed to make subsequent calls to `name.main`.

2.  **Restore Caller's Context (Standard Part):**
    *   **Action (a) - Restore `BP_caller_of_init`:** The `BP` register is restored by popping the saved `BP_caller_of_init` from `[BP_persistent_frame]`.
    *   **Rationale (a):** Standard step to restore the caller's `BP`.
    *   **Action (b) - Retrieve `RA_caller_of_init`:** The return address is retrieved from `[BP_persistent_frame - wordsize]` (assuming `BP_persistent_frame` points to `BP_caller_of_init`).
    *   **Rationale (b):** To know where to return.

3.  **`RSP` Management for Return (Critical Difference):**
    *   **Action:** The `RSP` is **not** reset to below the persistent frame (i.e., not set to `BP_persistent_frame`). Instead, it remains pointing to the top of the allocated persistent state: `RSP_after_init_return := BP_persistent_frame + N_state * wordsize`.
    *   **Rationale:** This is the key mechanism that leaves the persistent state variables on the return stack, effectively making them part of an extended stack frame for the original caller of `init`.

4.  **`RETURN` Instruction Execution:**
    *   **Action:** Execution jumps to `RA_caller_of_init`.
    *   **Outcome:** The `BP` register holds `BP_caller_of_init`. The `RSP` in the caller's context is now `RSP_after_init_return`. The caller's stack effectively appears to have grown by the size of the resumable's persistent state frame. The caller now has the resume token from the data stack.

### 3.4. Resumable Function `main` Phase (`name.main`)

The `main` phase executes a step of the resumable function. It operates using its own standard, *temporary* call frame for its immediate execution needs, while accessing the *persistent* state (established by `init`) via the resume token.

#### 3.4.1. `name.main` Prologue: Setting Up for Re-entrant Execution

1.  **Caller Prepares for `main` Call (Data Stack):**
    *   **Action:** The `caller` pushes the resume token (`BP_persistent_frame_token` obtained from `init`) onto the **data stack**. Any other arguments for this specific `main` invocation are also pushed.
    *   **Rationale:** The resume token is essential for `main` to locate the correct persistent state. Other arguments are for the current step's logic.

2.  **`CALL name.main` Execution (Standard Call Start):**
    *   **Action (a) - Save Return Address (`RA_main_caller`):** Standard operation; `RA_main_caller` is pushed onto the **return stack**. `RSP` increments.
    *   **Rationale (a):** `main` needs to return to its caller (often a trampoline loop).
    *   **Action (b) - Save Caller's Base Pointer (`BP_main_caller`):** Standard operation; `BP_main_caller` is pushed onto the **return stack**. `RSP` increments.
    *   **Rationale (b):** To preserve the `main` caller's frame context.

3.  **`name.main` Establishes Its Own *Temporary* Execution Frame:**
    *   **Action (a) - Retrieve Resume Token:** `name.main` pops the `BP_persistent_frame_token` from the data stack and stores it in a known location for its use (e.g., a dedicated register if available, or a specific slot in its upcoming temporary local variables, let's call this `STATE_POINTER_STORAGE`).
    *   **Rationale (a):** `main` needs this token to calculate addresses for accessing persistent state variables.
    *   **Action (b) - Set `BP_current_main`:** `name.main` establishes its own `BP` for its *temporary* frame: `BP_current_main := RSP - wordsize` (pointing to where `BP_main_caller` was saved).
    *   **Rationale (b):** This `BP` is for `main`'s current execution only, for its temporary locals and saved context. It is distinct from `BP_persistent_frame_token`.
    *   **Action (c) - Allocate Space for `main`'s Temporary Local Variables:** If `name.main` requires its own non-persistent local variables for its current execution step (`N_main_temp_locals`), space is allocated: `RSP := RSP + N_main_temp_locals * wordsize`.
    *   **Rationale (c):** These locals are for the current invocation of `main` only and will be discarded when `main` returns.
    *   **Note on Dynamic Stack Growth within `main`:** Just like any conventional function, if `name.main` itself calls other functions (including initiating another resumable via its `(resumable_init_call)` protocol), `RSP` will be further incremented from its current position to accommodate the stack frames of those callees. These new frames are built on top of `main`'s temporary frame.

**Conceptual Return Stack during `name.main` Execution (Simplified):**

```
Higher Addresses ^
                 |
RSP ->           +---------------------------------+ (Points to next free slot for main's execution)
                 | main's Temp Local M-1 (if any)  |
                 | ...                             |
                 | main's Temp Local 0 (if any)    |
                 | (STATE_POINTER_STORAGE if local)| (Holds BP_persistent_frame_token)
BP_current_main->+---------------------------------+ (BP for main's temporary frame)
                 | Saved BP_main_caller            |
                 +---------------------------------+
                 | Saved RA_main_caller            |
RSP_before_main->+=================================+ (RSP was here before CALL name.main)
                 | Persistent State Var N_state-1  | <┐ 
                 | ...                             |  | These are part of the persistent frame,
                 | Persistent State Var 0          |  | established by init, located via
BP_pers_frame_tok| Saved BP_caller (of init)       |  | STATE_POINTER_STORAGE which points to
(points here) -->| Saved RA_caller (of init)       | <┘ BP_persistent_frame_token.
                 +---------------------------------+
                 | ... (Original Caller's Frame)   |
Lower Addresses  v
```

#### 3.4.2. Interaction with Persistent State from `name.main`

*   **Action:** `name.main` accesses/modifies persistent state variables indirectly. It uses the `BP_persistent_frame_token` (stored in its `STATE_POINTER_STORAGE`) as the base address. For example, to access the first persistent variable: `[ [STATE_POINTER_STORAGE] + wordsize ]`.
*   **Rationale:** This allows `main` to operate on the correct state instance across multiple calls.
*   **Action:** `main`'s own temporary local variables are accessed directly via `BP_current_main`, e.g., `[ BP_current_main + wordsize + offset_of_main_temp_var ]`.
*   **Rationale:** Standard access for a function's own locals.

#### 3.4.3. Calling Other Functions from `name.main`

*   **Action:** If `name.main` calls another standard function or initiates another resumable, it follows the standard call prologue (Section 3.2.1). `BP_current_main` acts as the `BP_parent` for this new callee. The new callee's frame is built on top of `name.main`'s current `RSP`.
*   **Rationale:** This is normal nested function call behavior. The persistent state frame (referenced by `STATE_POINTER_STORAGE`) remains untouched and safe further down the stack.
*   **Outcome:** When the called function returns, `name.main`'s context (`BP_current_main`, `RSP`, its temporary locals, and `STATE_POINTER_STORAGE`) is correctly restored, allowing `main` to continue its execution.

#### 3.4.4. `name.main` Epilogue: Returning from a Step, Preserving Persistent State

When `name.main` completes its current step, its epilogue is similar to a standard function's epilogue *for its own temporary frame only*.

1.  **Push Produced Value(s) and Signal onto Data Stack:**
    *   **Action:** `name.main` pushes any results from the current step onto the **data stack**. It then pushes the appropriate signal: `BP_persistent_frame_token` (its own resume token) to indicate it can be called again, `0` for done, or `-1` for error.
    *   **Rationale:** To communicate results and status back to the caller (trampoline).

2.  **Perform Standard Epilogue for `main`'s *Temporary* Frame:**
    *   **Action (a) - Deallocate `main`'s Temporary Locals:** `RSP` is reset to `BP_current_main`. `RSP := BP_current_main`.
    *   **Rationale (a):** Discards `main`'s temporary working storage for this invocation.
    *   **Action (b) - Restore `main`'s Caller's Base Pointer:** `BP_main_caller` is restored into `BP` from `[RSP]` (which is `BP_current_main`). `RSP` decrements. `BP := [RSP]; RSP := RSP - wordsize`.
    *   **Rationale (b):** Restores the `BP` of the function that called `main`.
    *   **Action (c) - Restore `main`'s Caller's Return Address:** `RA_main_caller` is retrieved from `[RSP]`. `RSP` decrements. `RA_to_return_to := [RSP]; RSP := RSP - wordsize`.
    *   **Rationale (c):** Gets the address to return to in `main`'s caller.

3.  **`RETURN` Instruction Execution:**
    *   **Action:** Execution jumps to `RA_to_return_to`.
    *   **Outcome:**
        *   The `RSP` (in the context of `main`'s caller) is now restored to the exact value it held just before `name.main` was called. This value is `BP_persistent_frame_token + N_state * wordsize` (i.e., the top of the persistent state frame).
        *   **Crucially, the persistent state variables of the resumable function, and the entire stack segment they occupy, remain entirely untouched and are still live.** `name.main` has only cleaned up its own, immediate, temporary call frame.
        *   Control returns to `main`'s caller, with the persistent state preserved for potential future re-entry into `name.main`.

### 3.5. Persistent State Cleanup: Parent Scope Responsibility

Resumable functions in Tacit do **not** have an explicit `name.cleanup_resumable` word or a self-initiated cleanup phase for their persistent state.

*   **Mechanism:** The persistent state, allocated by `name.init`, is an extension of the stack frame of the function that originally invoked `name.init` (the "parent scope"). This state remains on the return stack for the entire lifetime of that parent scope.
*   **Cleanup Trigger:** Cleanup of the resumable's persistent state occurs **automatically and implicitly** only when this parent function itself completes its execution and performs its own standard function epilogue (as described in Section 3.2.2).
*   **Process:** As the parent function's epilogue deallocates its own local variables and restores its caller's `BP` and `RSP`, the stack space that was occupied by the resumable function's persistent state (which was part of, or an extension of, this parent frame) is naturally reclaimed. The `RSP` of the parent's caller is restored to its value from before the parent was ever called.
*   **No Caller Action for Resumable Cleanup:** The direct caller of `name.main` (e.g., a trampoline loop) does not, and should not, attempt to perform any cleanup action on the resumable's persistent state. When the trampoline decides to stop calling `name.main`, the persistent state simply remains on the stack until the function containing the trampoline (the parent scope) exits.

### 3.6. Implicit Cleanup (Parent Scope Exit)

If no explicit cleanup is called, the persistent state remains on the stack. When the original function that called `name.init` (the "parent scope") eventually exits, its own standard epilogue will unwind the stack. Since the resumable's persistent state was allocated as an extension of this parent's stack frame, it will be naturally deallocated as part of the parent's stack unwinding.

## 4. Lifecycle and Interaction

### 4.1. Initial Invocation: Triggering `name.init` and Obtaining the Resume Token

A resumable function is not called in the same way as a standard Tacit word for its initial setup. Instead, a special calling protocol or syntax (hereafter referred to as `(resumable_init_call)`) is used to invoke the resumable function for the first time. This special invocation triggers the `name.init` phase.

The primary purpose of this initial call is to:
1.  Execute the `name.init` logic, which allocates space for persistent state variables on the return stack and initializes them using any provided arguments.
2.  Return the "resume token" (the `BP_persistent_frame` established by `init`) on the data stack.

Example:
```tacit
// Conceptual syntax for initial invocation:
10 my_generator (resumable_init_call) -> r_token
// This call passes '10' as an argument to my_generator.init
// and stores the returned resume token in r_token.
```
(Note: The `(resumable_init_call)` syntax is conceptual. The actual mechanism in Tacit should be detailed here once finalized.)

This `r_token` is then used for all subsequent calls to `name.main`. The original arguments passed via `(resumable_init_call)` are consumed by `name.init` and typically stored in the persistent state.

### 4.2. Re-entering: Calling `name.main`

Subsequent calls are made to `name.main`, providing the resume token obtained from `init`.

```tacit
r_token my_generator.main
// ... inspect results ...
```

### 4.3. Signaling from `name.main`

`name.main` communicates its status and any yielded data back to the caller via the data stack.

#### 4.3.1. Producing a Value and Signaling Continuation (Returning `BP_child`)
If `main` has produced an intermediate result and signals it can be called again, it pushes the result(s) onto the data stack, followed by its own `BP_child` (the resume token).

```tacit
// Inside my_generator.main, after updating counter to 1:
1        // Push yielded value (new counter)
    BP_child // Push resume token (signal: has value, can be called again)
EXIT
```
Caller sees `1 r_token` on the data stack.

#### 4.3.2. Signaling Completion (Returning `0`)
When `main` has finished its work, it pushes `0` onto the data stack.

```tacit
// Inside my_generator.main, when counter reaches limit:
0        // Push 0 (signal: done)
EXIT
```
Caller sees `0` on the data stack.

#### 4.3.3. Signaling an Error (Returning `-1`)
If `main` encounters a non-recoverable error, it pushes `-1` (or another designated error code) onto the data stack.

```tacit
// Inside my_generator.main, if an error occurs:
-1       // Push -1 (signal: error)
EXIT
```
Caller sees `-1` on the data stack.

### 4.4. Persistent State Lifetime and Cleanup (Parent Scope Responsibility)

Resumable functions in Tacit do not have an explicit cleanup phase (e.g., a `name.cleanup_resumable` word). Their persistent state is not self-managed for deallocation.

The persistent state variables allocated by `name.init` are considered an extension of the calling function's (the "parent scope's") stack frame. This state remains on the return stack for the lifetime of the parent scope that initiated the resumable function.

Cleanup occurs automatically and implicitly when the parent function (the one that originally invoked the resumable function's `init` mechanism) finishes its execution and returns. As part of the parent function's standard epilogue, its entire stack frame is unwound. Since the resumable function's persistent state resides within (or as an extension of) this parent frame, it is naturally deallocated at this time.

There is no need for the caller of `name.main` to perform any specific cleanup action on the resumable function's state itself. The state will persist as long as the parent context is active and will be reclaimed when that parent context ends.

### 4.5. Caller Responsibilities and Loop Patterns (e.g., Trampoline)

Once the resume token is obtained from the initial invocation (see Section 4.1), the caller is responsible for repeatedly calling the `name.main` phase. This is often managed by a loop pattern, sometimes referred to as a "trampoline."

The trampoline logic typically involves:
1.  Calling `name.main` with the current resume token.
2.  After `name.main` returns, inspecting the signal(s) on the data stack:
    *   If `name.main` returns `BP_child` (the resume token itself, possibly along with produced values): This signals that `main` has produced a value and can be called again. The caller processes the value(s) and continues the loop with the same token.
    *   If `name.main` returns `0` (or another designated "done" signal): This signals that the resumable function has completed its work. The caller typically exits the loop. The resumable's state remains on the stack until the parent scope (containing this trampoline) exits.
    *   If `name.main` returns `-1` (or another "error" signal): This signals an error. The caller usually exits the loop and may handle the error. The state also remains until parent scope exit.

Example of a caller loop (trampoline):
```tacit
: use_generator_trampoline
  // Assume r_token was obtained from an initial call like:
  // initial_params my_generator (resumable_init_call) -> r_token

  BEGIN
    r_token my_generator.main // Call the main phase
    DUP 0 = IF                // Check for 'done' (0)
      POP                     // Drop the 0 signal
      ." Generator finished." CR
      BREAK                   // Exit trampoline loop
    ELSE DUP -1 = IF          // Check for 'error' (-1)
      POP                     // Drop the -1 signal
      ." Generator error." CR
      BREAK                   // Exit trampoline loop
    ELSE                      // `main` produced a value and returned its token
                              // Stack: <value(s)> <r_token_from_main>
      SWAP                    // -> <r_token_from_main> <value(s)> (assuming one value)
      .                       // Process the value (e.g., print)
      SPACE
                              // The r_token_from_main is ready for the next REPEAT.
    THEN THEN
  REPEAT
  // Loop finished. Resumable state for 'r_token' persists until
  // 'use_generator_trampoline' (or its own parent scope) exits.
;
```
This pattern ensures that `name.main` is called iteratively, and its state is preserved between calls, with cleanup handled by the eventual exit of the scope that owns `r_token`.

## 5. Interaction with Other Functions

### 5.1. Calling Normal Functions from a Resumable
When a resumable function's `main` phase calls a normal (non-resumable) Tacit function:
*   The normal function executes with the standard calling convention (its own prologue/epilogue).
*   It uses the return stack above the resumable's persistent state.
*   When the normal function returns, it properly restores `RSP` and `BP` to the resumable's context.
*   The resumable's persistent state remains untouched and available.

### 5.2. Calling a Resumable from a Normal Function
A normal function can initialize and drive a resumable function using the `init`/`main`/`cleanup` pattern described. The resumable's frame will be allocated on the return stack above the normal function's frame.

## 6. Recursive and Reentrant Resumable Calls

Resumable functions can call themselves or other resumables, leading to recursive or reentrant behavior. Their stack-based state allocation makes this feasible.

### 6.1. Direct Recursion (A Resumable Calling Itself)

A resumable's `main` phase can call its own `init` phase to create a new, nested instance of itself. Or, it might call another resumable that eventually calls back to the original type.

Each call to `name.init` (even recursively) creates a new frame on the return stack, allocating fresh space for that instance's state variables. The `BP_child` of the calling instance becomes the `BP_parent` for the new nested instance.

Example: `rec_demo.main` calls `rec_demo.init`.

```tacit
resumable : rec_demo
  state { 0 -> depth }
  ;
  // rec_demo.init: depth_arg -> depth; ... returns BP_child_outer

  // rec_demo.main:
  depth 0 > IF
    depth 1 - rec_demo.init -> r_token_inner // Recursive init
    // ... use r_token_inner to drive the inner instance ...
    r_token_inner rec_demo.cleanup_resumable
    BP_child_outer // Signal value from outer, can continue
    EXIT
  THEN
  0 // Outer done
  EXIT
;
```

### 6.2. Mutual Recursion (Resumables Calling Each Other)
Two or more resumables can call each other's `init` (to create new instances) or `main` (to resume existing ones) phases.

Example: `foo.main` calls `bar.init`, and `bar.main` could potentially call `foo.init`.

```tacit
resumable : foo state { 0 -> x } ; /* foo.main body */ ;
resumable : bar state { 0 -> y } ; /* bar.main body */ ;

// Inside foo.main:
y_val bar.init -> r_bar // foo creates an instance of bar
// ... foo might yield r_bar, or drive bar.main itself ...

// Inside bar.main:
x_val foo.init -> r_foo // bar creates an instance of foo
```

### 6.3. Stack Layout in Recursive Scenarios
In recursive calls, new resumable frames are stacked on top of existing ones on the return stack. For instance, if `foo.init` (frame `F1`) is called, and then `foo.main` (of `F1`) calls `bar.init` (frame `F2`), `F2`'s state will be allocated above `F1`'s state. `F2`'s `BP_parent` will be `F1`'s `BP_child`.

The persistent state of these nested instances is reclaimed in LIFO order as their respective parent scopes exit. For example, if `foo.main` (of `F1`) invokes `bar (resumable_init_call)` creating `F2`, then when the scope containing the call to `bar (resumable_init_call)` exits (this could be `foo.main`'s execution or `foo`'s parent), `F2`'s state is reclaimed. Subsequently, when `F1`'s original parent scope exits, `F1`'s state is reclaimed.

### 6.4. Managing Multiple Resume Tokens
If a resumable function creates and manages multiple child resumable instances, it is responsible for storing their resume tokens (e.g., in its own state variables or a data structure on the data stack) and ensuring they are all properly resumed and/or cleaned up.

## 7. Compiler Code Generation Strategy (Conceptual Overview)

The Tacit compiler transforms a `resumable : name ... ;` definition into distinct components:

### 7.1. Transforming `resumable` into `init` and `main`

The Tacit compiler transforms a `resumable : name ... ;` definition into two primary distinct components:
1.  **`name.init`:** Code for the initialization phase.
2.  **`name.main`:** Code for the re-entrant execution phase.

There is no separate `name.cleanup_resumable` word generated; cleanup is handled by parent scope unwinding.

### 7.2. Key Steps in Code Generation

#### 7.2.1. `init` Phase (`name.init`)
1.  **Prologue:** Standard function prologue: save RA, save `BP_parent`, set `BP_child = RSP`.
2.  **State Allocation:** Increment `RSP` by `N_state` (number of `state` variables).
3.  **State Initialization:** Generate code to pop initial values from the data stack (if any) and store them into `[BP_child + offset]` for each state variable.
4.  **Token Return:** Push `BP_child` (the resume token) onto the data stack.
5.  **Epilogue:** Standard function epilogue (restore `BP_parent`, restore RA, return), but `RSP` is *not* reset to `BP_child` before this; it remains above the allocated state, ensuring persistence.

#### 7.2.2. `main` Phase (`name.main`)
1.  **Prologue:** Standard function prologue: save RA, save `BP_parent`. Then, **pop the resume token from the data stack into `BP_child`**. This re-establishes the context for accessing persistent state.
2.  **State Restoration:** No explicit restoration needed beyond setting `BP_child`. Variables are accessed directly via `[BP_child + offset]`.
3.  **Body Execution:** Compile the user's logic for one iteration.
4.  **Signaling:** Generate code to push produced value(s) and the appropriate signal (`BP_child` to indicate it can be called again, `0` for done, or `-1` for error) onto the data stack.
5.  **Epilogue:** **Reset `RSP = BP_child`**. Then, standard function epilogue (restore `BP_parent`, restore RA, return).



## 8. Example: Fibonacci Generator

This example demonstrates a resumable function `fib` that generates Fibonacci numbers up to a given limit.

### 8.1. Tacit Source Code for `fib` Resumable

```tacit
resumable : fib
  state { 0 -> a }        // Current Fibonacci number
  state { 1 -> b }        // Next Fibonacci number
  state { 0 -> limit }    // Upper bound (exclusive)
  ;

  // fib.init part (conceptual - compiler handles this split)
  // Expects: <limit_val> on data stack
  // Action: limit_val -> limit; 0 -> a; 1 -> b
  // Returns: BP_child (resume token for this fib instance)

  // fib.main part (actual body provided by user)
  LOAD [BP_child + 0] -> current_a  // Load 'a' from state
  LOAD [BP_child + 2] -> current_limit // Load 'limit' from state

  current_a current_limit < IF
    current_a             // Produce current 'a'

    LOAD [BP_child + 1] -> next_a_val // b
    LOAD [BP_child + 0] LOAD [BP_child + 1] + -> next_b_val // a+b

    next_a_val -> [BP_child + 0]     // Update state: a = old b
    next_b_val -> [BP_child + 1]     // Update state: b = old a + old b

    BP_child              // Signal: has value, can be called again
    EXIT
  THEN
  0                       // Signal: done (a >= limit)
  EXIT
;
```

### 8.2. Caller Logic for `fib-test`

```tacit
: fib-test
  100 fib.init -> r_fib   // Initialize fib with limit = 100

  BEGIN
    r_fib fib.main
    DUP 0 = IF            // Check for 'done' (0)
      POP                 // Drop the 0
      // No explicit cleanup call needed; state persists until parent scope exits.
      ." Done." CR
      BREAK
    ELSE                  // Produced value: stack has <fib_value> <r_fib_token>
      SWAP                // -> <r_fib_token> <fib_value>
      .                   // Print fib_value
      SPACE
                        // r_fib_token is now on top for the next REPEAT
    THEN
  REPEAT
  CR
;
```

### 8.3. Conceptual Compiled Output

*   **`fib.init`:**
    *   Prologue (save RA, `BP_parent`, set `BP_child`, `RSP += 3` for a, b, limit).
    *   Pops `limit_val` from data stack, stores into `[BP_child + 2]`.
    *   Stores `0` into `[BP_child + 0]` (a).
    *   Stores `1` into `[BP_child + 1]` (b).
    *   Pushes `BP_child` onto data stack.
    *   Epilogue (restore `BP_parent`, RA, return; `RSP` remains elevated).

*   **`fib.main`:**
    *   Prologue (save RA, `BP_parent`, pop resume token from data stack into `BP_child`).
    *   Body: Implements the IF/THEN logic from the source, loading from/storing to `[BP_child + offset]`.
        *   If producing a value and can continue: Pushes Fibonacci value, then pushes `BP_child`.
        *   If done: Pushes `0`.
    *   Epilogue (`RSP = BP_child`, restore `BP_parent`, RA, return).


## 9. Best Practices and Summary

### 9.1. Checklist for Resumable Function Implementation

*   **Two-Label Split:** Compiler correctly generates `name.init` and `name.main`.
*   **Exact State Count:** `N_state` accurately reflects `state{}` declarations; state is fixed at `init`.
*   **Uniform Prologue/Epilogue:** `init` and `main` adhere to the defined stack frame setup and teardown, especially `BP_child` handling and `RSP` management.
*   **Caller Inspection:** Callers must check return codes from `main` (`BP_child`, `0`, `-1`) and act accordingly.
*   **Parent-Scope State Lifetime:** Understand that persistent state is reclaimed only when the parent scope that initiated the resumable function (via its special `init` call) exits. No explicit cleanup of the resumable instance itself is performed by the caller of `main` or by the resumable function.
*   **No Hidden Persistent Frame Growth in `main`:** `main` does not further increment `RSP` to allocate more *persistent* locals; it uses the state frame established by `init`. (Temporary locals for `main`'s own execution are managed within its separate, temporary call frame and are deallocated when `main` returns.)
*   **`init` Invocation Protocol:** Be aware that the initial call to a resumable function (to trigger `name.init` and get the resume token) uses a special protocol/syntax, distinct from standard function calls.
*   **`main` Loop Management:** Callers (e.g., trampolines) must correctly loop on `name.main`, interpreting signals for continuation, completion, or errors.
*   **Recursive Depth Management:** When resumables create other resumable instances, their persistent states are reclaimed in LIFO order as their respective parent scopes unwind.

### 9.2. Key Advantages and Use Cases Recap

Resumable functions in Tacit provide a structured way to implement generators and other stateful computations where a function's `main` phase can be re-entered multiple times while maintaining its internal state. Their integration with the return stack for state persistence and clear `init`/`main` interaction model, with state lifetime managed by the parent scope makes them a powerful tool for advanced Tacit programming.

This completes the detailed specification of Resumable Functions in Tacit, covering syntax, code generation, runtime conventions, and examples.
