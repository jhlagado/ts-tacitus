# Tacit Local Variable and Stack Frame Model

---

# Table of Contents

1. **Overview**
   1.1 Rationale for Local Variables
   1.2 Key Principles of the Tacit Local Variable System

2. **Stack Frame Structure**
   2.1 Entering a Colon Function
   2.2 Managing Locals Inside the Frame
   2.3 Exiting a Colon Function
   2.4 Stack Safety Guarantees

3. **Local Variable Handling**
   3.1 Creating Local Variables
   3.2 Reading Local Variables
   3.3 Mutating Locals
   3.4 Lifespan and Cleanup
   3.5 No Environment Capture

4. **No Deferred Blocks, No Closure Capture**
   4.1 Removal of Deferred Blocks
   4.2 No Closures
   4.3 Behavior of `{}` Blocks Inside Functions
   4.4 Summary of Environment Handling

5. **Shadowing and Lexical Scoping**
   5.1 Symbol Lookup at Compile-Time
   5.2 No Nested Function Definitions
   5.3 Lifetime of Locals
   5.4 Locals Inside `{}` Blocks

6. **Memory and Reference Management**
   6.1 Assigning Heap Objects to Locals
   6.2 Cleaning Up Locals at Function Exit
   6.3 No Manual Freeing Needed
   6.4 Safety Guarantees

7. **Visual Example of Stack Frame and Locals**
   7.1 Example Program
   7.2 Step-by-Step Stack Frame Layout
   7.3 How the locals are accessed
   7.4 At function exit
   7.5 Diagram

8. **Closing**
   8.1 Summary of the Model
   8.2 Why This Model Matters
   8.3 Future-Proofing the Design

---

## 1. Overview (Expanded)

Tacit is designed around a **pure stack execution model**.
Local variables are introduced into this model to improve readability, simplify parameter passing inside functions, and reduce the need for excessive stack manipulation instructions like `SWAP`, `DUP`, and `DROP`.

This local variable system:

- Works **entirely inside colon functions (`:`...`;`)** and combinator-controlled blocks `{}`.
- Introduces **temporary named storage** linked to the **return stack** (`RP`), without heap allocation.
- **Does not introduce closures** or runtime environment capture.
- **Does not require declarations at the top** of a block — locals are created dynamically when first assigned.
- **Cleans up automatically** when the function or block completes.

Locals in Tacit are a **convenience feature**,
but they fit perfectly into Tacit's guiding principles of **clarity**, **stack-purity**, and **predictability**.

They **do not replace** the stack model —
they simply make it easier to write clean and readable programs without unnecessary stack noise.

---

### 1.1 Rationale for Local Variables

Tacit's Reverse Polish Notation (RPN) is compact but sometimes becomes unwieldy when:

- Passing multiple arguments between operations.
- Reusing intermediate results multiple times.
- Writing more complex pipelines that would otherwise need deep stack juggling.

Locals allow:

- **Assigning** intermediate results to names temporarily.
- **Retrieving** them cleanly.
- **Reducing** stack manipulation overhead.

Locals make Tacit more **pleasant** and **maintainable**,
without abandoning its stack-based nature.

---

### 1.2 Key Principles of the Tacit Local Variable System

- **Scope is per-function**: locals belong to their defining colon function or combinator block.
- **No heap allocation**: locals live only on the return stack.
- **No closures**: functions cannot capture locals from other frames.
- **Automatic cleanup**: frame unwinding destroys locals automatically.
- **Dynamic creation**: locals are created when first assigned, not pre-declared.
- **Symbol-to-offset mapping**: compile-time symbol tables translate names to stack offsets.

---

## 2. Stack Frame Structure (Expanded)

Tacit implements **classic stack frame management** using its return stack (`RP`) and a **Base Pointer** (`BP`) register.

The structure closely resembles the stack frames used in C, but adapted cleanly for Tacit's two-stack design.

---

### 2.1 Entering a Colon Function

When a colon function is called:

1. **Push the return address** onto the return stack (`RP`).
   - This is where execution should resume after the function finishes.

2. **Push the caller’s Base Pointer (`BP`)** onto the return stack (`RP`).
   - This saves the previous frame's base position.

3. **Set the current Base Pointer (`BP`)** to the new top of the return stack.

The return stack now contains:

```
[ return address ]
[ old BP ]
[ --- locals will be allocated here --- ]
```

The `BP` register now marks the beginning of this frame.

---

### 2.2 Managing Locals Inside the Frame

Local variables are placed **above BP**, growing upward into the return stack space.

Each new local variable assigned during execution:

- Occupies the next available slot.
- Is referenced by an **offset relative to BP**.

For example:

| Slot | Meaning |
|------|---------|
| `BP + 1` | First local |
| `BP + 2` | Second local |
| `BP + 3` | Third local |

Each slot holds a 32-bit value (same as all Tacit values).

---

### 2.3 Exiting a Colon Function

At function exit:

1. **Unwind locals**:
   - Reset `RP` to the saved `BP` (destroying locals).
   - Decrement reference counts on any heap-allocated values.
2. **Restore previous `BP`** from the return stack.
3. **Jump to the return address** that was saved.

The entire frame is **automatically discarded** without explicit free instructions.

---

### 2.4 Stack Safety Guarantees

- Every colon function **resets the return stack** cleanly upon exit.
- No need to track individual locals manually.
- No memory leaks, no dangling pointers.

Even nested combinator `{}` blocks simply use the same frame,
so no additional complexity is introduced for normal conditional branching or mapping.

---

## 3. Local Variable Handling (Expanded)

Local variables are a **stack management feature** built entirely atop the return stack and compile-time symbol mapping.

They are simple, fast, and safe.

---

### 3.1 Creating Local Variables

Locals are **created dynamically** the moment they are first assigned.

At compile-time:

- When the parser encounters a `set!` operation on a symbol that has not been seen before in the current frame,
- It **allocates a new offset** relative to `BP`.
- It **updates the symbol table** to associate that symbol name with the slot.

At runtime:

- When `set!` executes, it **writes** the value to `[BP + offset]`.

---

**Example Flow:**

Source code:

```tacit
x 10 set!
```

Compiler behavior:

- See `set!` on `x`.
- Allocate slot at `BP + 1`.
- Generate runtime code:
  - Write `10` into `[BP + 1]`.

---

### 3.2 Reading Local Variables

When a local variable is read (with `get`),
the compiler:

- Looks up the symbol in the compile-time symbol table.
- Emits code to **load** from `[BP + offset]`.

Example:

```tacit
x get
```

Runtime:

- Load value at `[BP + 1]`.
- Push it onto the data stack (`SP`).

---

### 3.3 Mutating Locals

You can overwrite a local with a new value by simply using `set!` again:

```tacit
x 20 set!
```

This overwrites the slot at `[BP + 1]` with `20`.

---

### 3.4 Lifespan and Cleanup

Locals **live only** between:

- Entry to the colon function (or combinator block),
- Exit from that function or block.

At exit:

- The stack frame is unwound by resetting `RP = BP`.
- All locals are discarded.
- If a local held a reference-counted heap object (e.g., a vector or sequence):
  - The reference count is decremented at unwind time.
  - If it drops to zero, the object is destroyed.

No leaks.
No leftover references.

---

### 3.5 No Environment Capture

Tacit functions **never capture** locals from an outer scope.

- Colon functions are self-contained.
- `{}` blocks inside combinators execute in the **same frame** as their enclosing function.
- No deferred runtime function objects exist.
- No closure memory management is required.

Thus:

- Locals are **purely dynamic**, living **only during execution**.
- Every variable is either passed via the stack or assigned as a local in the active frame.

---

## 4. No Deferred Blocks, No Closure Capture (Expanded)

One of Tacit's major design goals is to **eliminate** the complexity associated with deferred runtime functions and captured environments.
This makes locals simpler, stack management safer, and programs easier to reason about.

---

### 4.1 Removal of Deferred Blocks

In early prototypes, Tacit experimented with runtime deferred blocks using parentheses `()`.
These were found to introduce:

- Runtime environment capture issues,
- Ambiguities about which variables were live,
- Complexities in memory management (potential heap pressure).

**In the final design**, Tacit abolishes runtime deferred blocks entirely:

- **No `()` syntax** exists anymore.
- **All deferred behavior** is handled by **structured `{}` blocks** at compile-time.
- **Blocks are grammar structures**, not runtime heap objects.

Thus, when you see a `{}` block in Tacit,
you know it:

- Is parsed at compile-time,
- Does not allocate memory,
- Does not create closures,
- Operates within the current stack frame.

---

### 4.2 No Closures

Because there are no deferred blocks,
Tacit **never needs to capture** an environment for later execution.

**Locals** are:

- **Bound to the stack frame** of the executing function,
- **Destroyed** when the function exits,
- **Not available** outside their intended lifetime.

If you need data to survive,
you must **explicitly pass it on the stack** or store it in a heap structure (like a vector).

This strict rule keeps programs:

- **Predictable** (no "magic" late binding),
- **Safe** (no hidden memory leaks),
- **Simple** (easy-to-trace variable lifetimes).

---

### 4.3 Behavior of `{}` Blocks Inside Functions

When a `{}` block is written inside a colon function:

- It **shares the same stack frame** as its parent function.
- It **can access** locals defined earlier in the function.
- It **cannot** outlive the function.
- No extra environment or heap object is created.

This makes `{}` blocks ideal for structured control flow (like `?`, `map`, `reduce`),
but they are **not general-purpose deferred functions**.

---

### 4.4 Summary

| Feature | Behavior in Tacit |
|---------|-------------------|
| Deferred blocks `()` | **Not allowed** |
| Curly blocks `{}` | **Compile-time grammar only** |
| Closures | **Not supported** |
| Locals | **Live only during function execution** |
| Function arguments | **Passed via the stack only** |

---

## 5. Shadowing and Lexical Scoping (Expanded)

Tacit allows **simple local name shadowing** within functions,
but keeps the scoping model very tight and minimal.

---

### 5.1 Symbol Lookup at Compile-Time

When the compiler encounters a variable name:

- It **first searches the current function's local symbols** (those created with `set!`).
- If not found, it **looks up globally defined words** (colon functions, constants).

Thus, local variables **always shadow** global names inside a function.

Example:

```tacit
: example ( -- )
  x 10 set!
  x get ;
```

- Here, even if there was a global `x`, the local `x` takes precedence inside the function.

---

### 5.2 No Nested Function Definitions

Tacit **does not allow** defining a new colon function inside another colon function.

There are no nested function scopes.

This keeps symbol lookup **flat** and **unambiguous**:

- One colon function = one local variable table.
- `{}` blocks within the function **share** this table.
- No need to create nested environments.

---

### 5.3 Lifetime of Locals

Locals exist:

- From the moment they are created (first `set!`),
- Until the function exits.

They **cannot be exported** outside their defining function.

---

### 5.4 Locals Inside `{}` Blocks

Structured `{}` blocks (like those used by combinators) are **allowed** to access locals defined earlier in the function.

Example:

```tacit
: categorize ( x -- )
  x set!
  x get 0 > ?
    { "positive" print }
    { "non-positive" print } ;
```

- `x` is assigned outside the `{}` block,
- Read again inside the `{}` block — valid and safe.

Because `{}` blocks are parsed immediately and share the same stack frame,
there is **no danger** of referencing a dead variable.

---

## 6. Memory and Reference Management (Expanded)

Locals in Tacit are **value slots** —
but they may sometimes contain **references** to heap-allocated objects (like sequences, vectors, or strings).

Tacit handles these safely with **reference counting**, without needing full garbage collection.

---

### 6.1 Assigning Heap Objects to Locals

When a heap-allocated object is assigned to a local:

- Its **reference count is incremented** at the time of assignment.

This ensures that even if the original stack value is consumed,
the local still safely owns a reference to the object.

---

**Example:**

```tacit
data [1,2,3] set!
```

- Creates a vector `[1,2,3]`.
- Stores it in local `data`.
- Increments the vector’s reference count.

---

### 6.2 Cleaning Up Locals at Function Exit

When the function exits:

- Tacit **walks the return stack** from `RP` down to the saved `BP`.
- For each slot:
  - If the slot contains a heap pointer,
  - **Decrement** the reference count.
  - If the count drops to zero, **destroy** the object.

This way:

- Heap objects survive only as long as they are referenced.
- Memory is automatically reclaimed once all references are gone.

---

### 6.3 No Manual Freeing of Locals Needed

Programmers **never manually free** locals.

The **stack frame unwind** takes care of all cleanup —
whether the local is a simple number or a complex object.

---

### 6.4 Safety Guarantees

This model ensures:

- **No leaks** if locals are properly managed.
- **No surprises** — lifetimes are tied strictly to stack frames.
- **No double frees** — reference counts ensure correct deletion.

Tacit remains **safe** and **predictable**, even as programs become larger and more complex.

---

## 7. Visual Example of Stack Frame and Locals (Expanded)

To understand how locals are physically laid out and cleaned up,
let’s walk through a real example step-by-step.

---

### 7.1 Example Program

```tacit
: example-fn ( x y -- )
  a set!        ( assign x to local 'a' )
  b set!        ( assign y to local 'b' )
  a get b get + ( add 'a' and 'b' )
  result set!   ( store the sum in 'result' )
  result get ;
```

This function:

- Takes two arguments from the stack (`x` and `y`).
- Stores them as locals `a` and `b`.
- Adds them together.
- Stores the sum in a local `result`.
- Returns the result on the stack.

---

### 7.2 Step-by-Step Stack Frame Layout

**At function entry:**

Return stack (`RP`), from newest to oldest:

```
[ return address ]
[ caller's BP ]
```

Data stack (`SP`):

```
[ y ]
[ x ]
```

---

**After setting up BP and creating locals:**

Return stack (`RP`):

```
[ return address ]
[ old BP ]       <-- BP points here
[ a ]            ( slot BP+1 )
[ b ]            ( slot BP+2 )
[ result ]       ( slot BP+3 )
```

Data stack (`SP`):

```
[ ]  (empty if 'result' is about to be pushed back)
```

---

### 7.3 How the locals are accessed

- `a` is at `BP + 1`
- `b` is at `BP + 2`
- `result` is at `BP + 3`

The compiler generates fixed offsets to access these variables relative to BP.

---

### 7.4 At function exit

Cleanup happens automatically:

1. Set `RP` back to `BP` (discarding `a`, `b`, `result`).
2. Restore the old `BP`.
3. Return to the saved return address.

Any heap objects stored in locals have their reference counts decremented during the unwind.

---

### 7.5 Diagram

Before Exit:

```
Return Stack:
[ return address ]
[ old BP ]       <-- BP
[ a ]
[ b ]
[ result ]       <-- RP

Data Stack:
[ sum ]           <-- SP
```

After Exit:

```
Return Stack:
[ caller state restored ]

Data Stack:
[ sum ]
```

---

## 8. Closing (Expanded)

The local variable and stack frame system in Tacit is **simple, powerful, and robust**.

---

### 8.1 Summary of the Model

- **Local Variables** are **bound to the return stack**.
- **Stack Frames** are explicitly managed using `BP` and `RP`.
- **No Closures**, **No Deferred Blocks**, **No Captured Environments**.
- **Cleanup is automatic** at function exit — no manual memory management needed.
- **Reference counting** handles safe and predictable heap object management.

---

### 8.2 Why This Model Matters

Compared to traditional stack languages (like FORTH) or full closure-based languages (like Scheme):

- Tacit **stays close to FORTH** in spirit: fast, predictable, stack-first.
- But Tacit **borrows modern structural clarity** from functional languages: structured blocks, modularity, clean naming.
- It **avoids** the heavy complexity of garbage collection by using simple reference counting for heap structures.

Tacit's model is:

- **Faster** because stack access and frame setup are minimal overhead.
- **Safer** because locals cannot outlive their frames.
- **More readable** because names reduce the cognitive load of stack manipulation.

---

### 8.3 Future-Proofing the Design

This foundation allows Tacit to grow over time without introducing unnecessary complexity.

- More advanced features like **limited deferred computation** could still be added **if needed** later,
  but only in tightly structured, stack-safe ways.
- Structural patterns like **structured exceptions**, **generators**, and **tasks** can naturally build on this foundation without altering the local variable model.

In short:

> Tacit’s local variable system is ready to support serious, scalable programs without sacrificing the language’s speed, predictability, or stack clarity.
