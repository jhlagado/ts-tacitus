# Resumable Functions in Tacit

Resumable functions are a powerful feature in Tacit, enabling programming patterns like generators, asynchronous operations, and coroutines. They allow a function to suspend its execution, return an intermediate result (or signal readiness for the next step), and then be resumed later from where it left off, with its internal state preserved.

## 1. Introduction

### 1.1. What are Resumable Functions?

A resumable function in Tacit is a special type of function that can be paused and resumed. Unlike conventional functions that run to completion in a single invocation, resumable functions can yield control back to their caller multiple times before finishing their task. Each time they are resumed, they continue from their last point of suspension, with their local state variables intact.

This is achieved through a two-phase execution model:
1.  **Initialization (`.init` phase):** Sets up the function's persistent state.
2.  **Resumption (`.main` phase):** Executes a portion of the function's logic and can yield or complete.

### 1.2. Motivation: Why Resumables?

Resumable functions provide elegant solutions for several programming challenges:

*   **Generators:** Creating sequences of values on demand, without computing them all at once (e.g., Fibonacci sequence, data stream processing).
*   **Asynchronous Operations:** Managing tasks that involve waiting for external events (e.g., I/O, timers) without blocking the main execution flow.
*   **Coroutines:** Implementing cooperative multitasking, where functions voluntarily yield control to allow other tasks to run.
*   **State Machines:** Defining complex, stateful logic in a more linear and readable fashion.

### 1.3. Key Characteristics

*   **Two-Phase Execution:** An `init` phase for setup and a `main` phase for iterative execution.
*   **Persistent State:** Local variables declared as `state` persist across suspensions and resumptions.
*   **Return Stack Allocation:** The persistent state of a resumable function is stored on the return stack, within its own call frame.
*   **Explicit Resume Token:** The `init` phase returns a "resume token" (typically the function's base pointer, `BP_child`). This token is required to call the `main` phase.
*   **Explicit Cleanup:** The caller is responsible for cleaning up a resumable function's stack frame when it's no longer needed.

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
    DUP -> counter      // Update state and yield new counter value
    BP_child            // Signal: yield and can continue
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

#### 2.2.2. `name.main`: Execution and Yielding

*   **Purpose:** To execute one step or iteration of the resumable function's logic.
*   **Invocation:** Called one or more times using the resume token obtained from `name.init`.
*   **Arguments:** Expects the resume token (`BP_child`) on the data stack. This token is used to locate its persistent state on the return stack.
*   **Return Value(s) on Data Stack:**
    *   **Yield:** Pushes any yielded value(s), followed by its `BP_child` (the resume token) to signal it can be resumed again.
    *   **Done:** Pushes `0` to signal completion.
    *   **Error:** Pushes `-1` (or another distinct sentinel) to signal an error.
*   **Stack Effect:** Operates on its persistent state variables. Before returning, it ensures `RSP` is reset to its `BP_child`, preserving its locals for the next resumption or cleanup.

### 2.3. State Variables: `state { ... }`

Persistent local variables for a resumable function are declared using the `state { initial_value -> variable_name }` syntax within the `resumable : ... ;` block but before the main body logic. These variables are allocated on the return stack within the resumable's frame and retain their values across calls to `name.main`.

### 2.4. The Resume Token (`BP_child`)

The resume token is the base pointer (`BP`) of the resumable function's own stack frame, established during its `init` phase. It's returned by `name.init` and is required by `name.main` to locate its persistent state variables on the return stack. It also serves as a signal from `name.main` (when positive) that the function has yielded and can be resumed.

## 3. Calling Conventions and Stack Management

Tacit employs a uniform calling convention for all functions, whether normal or resumable, to ensure consistent stack management.

### 3.1. Uniform Calling Convention for All Tacit Functions

#### 3.1.1. Call Frame Layout
When any function is called, the caller is responsible for pushing arguments onto the data stack. The call instruction itself then typically manages the return stack by saving:
1.  **Return Address (RA):** The address of the instruction to return to in the caller.
2.  **Caller's Base Pointer (BP_parent):** The base pointer of the calling function's frame.

#### 3.1.2. Uniform Prologue and Epilogue

*   **Prologue (Generic Function Entry):**
    1.  Save Return Address (RA) (implicitly by `CALL` or explicitly).
    2.  Save caller's Base Pointer (`BP_parent`) onto the return stack.
    3.  Set current function's Base Pointer (`BP_child`) to the current Return Stack Pointer (`RSP`).
    4.  Allocate space for local variables by incrementing `RSP` by `N_locals`.

*   **Epilogue (Generic Function Exit):**
    1.  Reset `RSP` to the current function's `BP_child` (deallocates locals).
    2.  Restore caller's Base Pointer (`BP_parent`) from the return stack.
    3.  Restore Return Address (RA) from the return stack.
    4.  Return to caller (e.g., via `RETURN` instruction, which uses the restored RA).

### 3.2. Resumable `init` Phase Stack Operations

*   **Prologue:** Follows the uniform prologue: saves RA, saves `BP_parent`, sets `BP_child = RSP`. Then, it allocates `N_state` slots for its persistent state variables by incrementing `RSP`.
*   **Body:** Initializes state variables, typically using arguments popped from the data stack and storing them at offsets from `BP_child`.
*   **Epilogue:**
    1.  Pushes its own `BP_child` (the resume token) onto the data stack.
    2.  Restores `BP_parent` (caller's BP).
    3.  Restores RA (caller's RA).
    4.  Returns. Critically, `RSP` remains at `BP_child + N_state`, keeping the persistent locals alive on the return stack.

### 3.3. Resumable `main` Phase Stack Operations

*   **Prologue:**
    1.  Saves RA, saves `BP_parent`.
    2.  **Pops the resume token (which is its own `BP_child` for this instance) from the data stack.** This `BP_child` is used to establish its frame and access its persistent state.
    3.  Does *not* re-allocate locals; they were allocated by `init` and persist.
*   **Body:** Executes its logic, reading/writing persistent state variables at `[BP_child + offset]`.
*   **Epilogue:**
    1.  Pushes yielded value(s) (if any) and then the appropriate signal (`BP_child`, `0`, or `-1`) onto the data stack.
    2.  **Resets `RSP` to its `BP_child`.** This is crucial: it ensures that any temporary data used by `main` on the return stack above its locals is discarded, but the persistent locals themselves remain.
    3.  Restores `BP_parent`.
    4.  Restores RA.
    5.  Returns.

### 3.4. Return Stack (RSP) and Base Pointer (BP) Interaction

The `BP` points to the base of the current function's frame on the return stack. Locals are accessed at positive offsets from `BP`. `RSP` points to the top of the return stack. For resumables, the key is that `init` allocates space and `main` reuses that space, with `RSP` carefully managed to preserve state between `main` calls.

## 4. Lifecycle and Interaction

### 4.1. Initialization: Calling `name.init`

To use a resumable function, the caller first invokes its `name.init` word. Any necessary initial parameters are pushed onto the data stack before the call.

```tacit
10 my_generator.init  // Initialize my_generator with limit=10
-> r_token             // Store the returned resume token
```

`my_generator.init` will set up its state (e.g., `counter=0`, `limit=10`) on the return stack and return `r_token` (its `BP_child`) on the data stack.

### 4.2. Resuming: Calling `name.main`

Subsequent calls are made to `name.main`, providing the resume token obtained from `init`.

```tacit
r_token my_generator.main
// ... inspect results ...
```

### 4.3. Signaling from `name.main`

`name.main` communicates its status and any yielded data back to the caller via the data stack.

#### 4.3.1. Yielding a Value and Continuing (Returning `BP_child`)
If `main` has produced an intermediate result and can continue, it pushes the result(s) onto the data stack, followed by its own `BP_child` (the resume token).

```tacit
// Inside my_generator.main, after updating counter to 1:
1        // Push yielded value (new counter)
BP_child // Push resume token (signal: can continue)
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

### 4.4. Return Stack Cleanup: `name.cleanup_resumable`

Because a resumable function's state persists on the return stack, it's crucial to explicitly clean up this state when the resumable instance is no longer needed. The compiler typically generates a hidden `name.cleanup_resumable` word for this purpose.

#### 4.4.1. When to Call Cleanup
Cleanup should be called when:
*   `name.main` signals completion (returns `0`).
*   `name.main` signals an error (returns `-1`).
*   The caller decides to prematurely terminate the resumable instance.

#### 4.4.2. Cleanup Mechanism

`name.cleanup_resumable` takes the resume token (`BP_child`) of the instance to be cleaned from the data stack.
1.  **Sets `RSP = BP_child`:** This effectively deallocates all persistent locals of the resumable and any data stacked above them by nested calls originating from this resumable's `main` phase.
2.  **(Optional) Reference Counting:** If state variables hold references to heap-allocated data, this is the point to iterate through them (from `BP_child` to `BP_child + N_state - 1`) and decrement their reference counts.
3.  **Restores Caller's Frame:** Pops `BP_parent` and `RA` that were saved by the original `name.init` call, restoring the stack to the state it was in before the resumable was initialized.

### 4.5. Caller Responsibilities and Loop Patterns

A typical caller loop involves:
1.  Calling `name.init` to get a resume token.
2.  Repeatedly calling `name.main` with the token.
3.  After each `main` call, inspecting the signal on the data stack:
    *   If `BP_child` (yield): Process yielded value(s), keep token for next iteration.
    *   If `0` (done) or `-1` (error): Call `name.cleanup_resumable` with the token, then terminate the loop.

```tacit
: use_generator
  10 my_generator.init -> r_token
  BEGIN
    r_token my_generator.main
    DUP 0 = IF          // Check for 'done' (0)
      POP               // Drop the 0
      r_token my_generator.cleanup_resumable
      BREAK
    ELSE DUP -1 = IF    // Check for 'error' (-1)
      POP               // Drop the -1
      r_token my_generator.cleanup_resumable
      BREAK
    ELSE                // Yield: stack has <value> <r_token>
      SWAP              // -> <r_token> <value>
      print             // Process value (e.g., print)
                      // r_token is now on top for the next iteration
    THEN THEN
  REPEAT
;
```

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
    BP_child_outer // Yield from outer
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

Cleanup must occur in the reverse order of initialization (LIFO - Last In, First Out). The innermost resumable must be cleaned up before its parent resumable instance can be fully cleaned up.

### 6.4. Managing Multiple Resume Tokens
If a resumable function creates and manages multiple child resumable instances, it is responsible for storing their resume tokens (e.g., in its own state variables or a data structure on the data stack) and ensuring they are all properly resumed and/or cleaned up.

## 7. Compiler Code Generation Strategy (Conceptual Overview)

The Tacit compiler transforms a `resumable : name ... ;` definition into distinct components:

### 7.1. Transforming `resumable` into `init`, `main`, and `cleanup`
1.  **`name.init`:** Code for the initialization phase.
2.  **`name.main`:** Code for the resumption/execution phase.
3.  **`name.cleanup_resumable`:** A hidden utility word for deallocating the resumable's frame.

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
4.  **Signaling:** Generate code to push yielded value(s) and the appropriate signal (`BP_child`, `0`, or `-1`) onto the data stack.
5.  **Epilogue:** **Reset `RSP = BP_child`**. Then, standard function epilogue (restore `BP_parent`, restore RA, return).

#### 7.2.3. `cleanup` Routine (`name.cleanup_resumable`)
1.  **Argument:** Pop `BP_child` (the resume token of the instance to clean) from the data stack.
2.  **Frame Deallocation:** Set `RSP = BP_child`. This effectively drops all persistent locals and any data from nested calls made by this resumable instance.
3.  **(Optional) Reference Decrement:** If state variables are pointers, iterate `[BP_child]` through `[BP_child + N_state - 1]` and decrement reference counts.
4.  **Restore Original Caller's Frame:** Pop `BP_parent` and RA (these are the ones saved by the *original* `name.init` call for this instance).
5.  **Return.**

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
    current_a             // Yield current 'a'

    LOAD [BP_child + 1] -> next_a_val // b
    LOAD [BP_child + 0] LOAD [BP_child + 1] + -> next_b_val // a+b

    next_a_val -> [BP_child + 0]     // Update state: a = old b
    next_b_val -> [BP_child + 1]     // Update state: b = old a + old b

    BP_child              // Signal: yield and can continue
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
      r_fib fib.cleanup_resumable
      ." Done." CR
      BREAK
    ELSE                  // Yield: stack has <fib_value> <r_fib_token>
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
        *   If yielding: Pushes Fibonacci value, then pushes `BP_child`.
        *   If done: Pushes `0`.
    *   Epilogue (`RSP = BP_child`, restore `BP_parent`, RA, return).

*   **`fib.cleanup_resumable`:**
    *   Pops `BP_child_to_clean` from data stack.
    *   `RSP = BP_child_to_clean`.
    *   (Optional ref-count sweep for a, b, limit if they were pointers).
    *   Restores `BP_parent` and RA (from `fib.init`'s original call).
    *   Returns.

## 9. Best Practices and Summary

### 9.1. Checklist for Resumable Function Implementation

*   **Two-Label Split:** Compiler correctly generates `name.init` and `name.main`.
*   **Exact State Count:** `N_state` accurately reflects `state{}` declarations; state is fixed at `init`.
*   **Uniform Prologue/Epilogue:** `init` and `main` adhere to the defined stack frame setup and teardown, especially `BP_child` handling and `RSP` management.
*   **Caller Inspection:** Callers must check return codes from `main` (`BP_child`, `0`, `-1`) and act accordingly.
*   **Cleanup at Most Once:** `cleanup_resumable` is called exactly once when a resumable instance is finished or aborted. The resume token becomes invalid after cleanup.
*   **No Hidden Frame Growth in `main`:** `main` does not further increment `RSP` to allocate more locals; it uses the frame established by `init`.
*   **Recursive Depth Management:** If managing multiple child resumables, ensure LIFO cleanup and proper token handling.

### 9.2. Key Advantages and Use Cases Recap

Resumable functions in Tacit provide a structured way to implement generators, coroutines, and other stateful, pausable computations. Their integration with the return stack for state persistence and clear `init`/`main`/`cleanup` lifecycle makes them a powerful tool for advanced Tacit programming.

This completes the detailed specification of Resumable Functions in Tacit, covering syntax, code generation, runtime conventions, and examples.
