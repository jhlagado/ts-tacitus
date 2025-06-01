### Calling Conventions and Stack Behavior

This section defines the stack layout and calling convention for the three entry modes used in Tacit: normal function calls, resumable `init` phase calls, and resumable `main` phase resumes. Each mode handles the return stack, base pointer (`BP`), and data stack differently, based on whether the call is temporary or persistent and whether stack growth is expected.

#### 1. Normal Function Call

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

#### 2. Resumable `init` Phase

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

#### 3. Resumable `main` Phase

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
