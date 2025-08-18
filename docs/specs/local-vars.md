# TACIT Local Variables and Function Stack Frame Specification

## Stack Architecture Overview

TACIT VM uses a dual-stack architecture similar to Forth:

- **Data Stack (SP)**: STACK segment for computation, parameter passing, and return values
- **Return Stack (RP)**: RSTACK segment for function calls, return addresses, and local variables

Local variables are stored on the return stack (RSTACK), not the data stack. The Base Pointer (BP) addresses local variable slots within the return stack frame.

## 1. Function Structure and Stack Frame Model

TACIT functions are declared in Forth style:

```
: function-name ... ;
```

When a function is called:

- The return address is pushed onto the return stack (RP).
- The current base pointer (BP) is pushed onto the return stack (RP).
- BP is set to point to the saved base pointer (the value of RP before reserving locals).
- Local variable slots are reserved by advancing RP above the saved BP.

The return stack frame layout immediately after prologue is:

```
Return Stack (RSTACK):
[ return addr ]
[ previous BP ] ← BP (points to saved base pointer)
[ local N     ]
[ local N-1   ]
...
[ local 0     ] ← RP (grows upward from here)
```

The stack frame is the space between BP and RP.
RP continues growing upward above locals for additional calls.
SP (data stack) operates independently for computation.

BP provides an anchor for named local variable access. Variable offsets are relative to BP.

## 2. Local Variable Declaration

A local variable is declared using:

```
value var name
```

Semantics:

- The `value` is evaluated at runtime and stored at a reserved offset from BP.
- `name` is added to the dictionary with a binding to `[BP + offset]`.
- The offset is assigned at compile time by incrementing a per-function local counter.

All locals must be declared at the **top level of the function**, not inside code blocks.

The order of declaration determines offsets: first declared gets lowest offset (closest to BP).

## 3. Dictionary Management and Variable Reuse

On function compilation start:

- A dictionary mark is recorded.

Each `var` adds a word to the dictionary with:

- Name = variable name.
- Value = stack offset from BP.
- Kind = local variable.

On function end (`;`):

- The dictionary is forgotten back to the function's mark.
- This removes all locals, allowing names to be reused in other functions.

Nested functions are not allowed. Only top-level function definitions are legal.

## 4. Variable Access Semantics

A reference to a variable `x` compiles to:

```
LOAD_LOCAL offset(x)
```

Assignment compiles to:

```
STORE_LOCAL offset(x)
```

No runtime name lookup occurs. Variable name resolution is purely static.

Variables cannot be shadowed within the same function scope.

## 5. Code Block Behavior

Code blocks are declared using `{ ... }`.

They are used in conditionals and combinators:

```
if { condition } then { block } else { block } endif
```

Semantics:

- Code blocks do not create new stack frames.
- BP remains unchanged when entering a block.
- Return address is pushed onto RP.
- SP continues as normal.

Blocks may be nested arbitrarily.

## 6. Variable Visibility Inside Blocks

Code blocks may reference local variables declared in the surrounding function.

All variable accesses inside a block compile to the same offsets relative to BP.

No variable declarations are allowed inside a block.

Attempting:

```
if { 3 var x } then { x } endif
```

results in a compile-time error: "Illegal variable declaration inside code block."

## 7. Function Exit

Function epilogue behavior:

- RP is reset to BP (dropping all locals).
- Previous BP is popped from RP and restored.
- Return address is popped from RP.
- Execution resumes at the return address.

This ensures local variables are destroyed and do not persist beyond function return.

## 8. Code Block Exit

Code blocks do not adjust BP.

On exit:

- Return address is popped from RP.
- Execution resumes at continuation point.

Since code blocks do not reset RP (local frame), all data pushed inside a block on the data stack (SP) must be manually managed or discarded.

## 9. Variable Lifetime and Stack Discipline

Local variables:

- Are live from point of declaration until function return.
- Are addressed via static offsets from BP.
- Cannot be returned by reference.

If a local is referenced after function return, behavior is undefined.

Values may be copied from local variables to the data stack (SP) for safe return.

## 10. Enforcement of Declaration Timing

All local variables must be declared before use.

Compiler performs single-pass forward scan:

- Variables must appear before any use.
- If a reference to `x` appears before `x var`, compilation fails.

Variables must be declared at function scope. No mid-block declarations are allowed.

Valid:

```
: ok
    var a
    var b
    a b add
;
```

Invalid:

```
: bad
    a b add
    var a
    var b
;
```

Error: "Variable used before declaration."

## 11. Scratch Allocation for Blocks

Blocks may use temporary scratch storage, not named locals.

The compiler may allocate anonymous slots for internal computation.

These slots:

- Are allocated within the function’s frame.
- Are reused and never visible by name.
- Are not accessible after block exit.

## 12. Illegal Escapes

Returning references to local variables is illegal.

Example:

```
: bad
    var x
    x → return
;
```

Error: "Illegal return of local variable reference."

Variables must be copied:

```
: ok
    var x
    x copy → return
;
```

The copy instruction ensures the value is moved to the data stack before returning.

## 13. Globals and Capsules

Global variables are allocated in a separate global segment.

Writing a reference to a local variable into a global is illegal.

```
: bad
    var x
    x → global-store
```

Error: "Cannot store local reference into global."

Only values (not references) may be written to global memory.

Capsules must also copy values from locals before sealing.

## 14. Return Address Placement and Code Block Nesting

Code blocks, unlike functions, do not establish a new base pointer. They preserve the caller’s BP and do not introduce a new stack frame. However, code blocks still push a **return address** onto the return stack (RP) before executing.

Nested code blocks follow the same rule:

- Each block pushes its own return address onto RP.
- Upon block completion, the return address is popped.
- The BP is never touched by blocks.
- All variable access remains relative to the enclosing function’s BP.

This model permits arbitrarily nested code blocks while preserving access to function locals.

### Example: Nested Code Blocks

When inside two nested code blocks within a function, the return stack looks like:

```
Return Stack (RSTACK):
[ return addr ]
[ previous BP ] ← BP (function's base pointer)
[ local N     ]
[ local N-1   ]
...
[ local 0     ]
[ return addr1] (first code block's return address)
[ return addr2] ← RP (second code block's return address)
```

Each code block pushes only its return address. BP remains unchanged, so all locals remain accessible at their original offsets from BP.

## 15. Nested Block Access to Locals

A block may access any variable declared at the top level of the enclosing function. This includes:

- Direct reads or writes to local variables.
- Use of locals in expressions or control combinators.

Example:

```
: process
    var x
    x 0 gt if {
        x print
    } endif
;
```

This is legal and compiles as `LOAD_LOCAL x` inside the block.

No additional context or closure is created. Blocks always operate within the function's frame.

## 16. Prologue and Epilogue Instructions

### Function Prologue:

1. Push return address to RP.
2. Push current BP to RP.
3. Set BP to point to the saved base pointer (current RP - 4 bytes).
4. Reserve slots for all locals by advancing RP (offset tracking during compile time).

### Function Epilogue:

1. RP := BP + 4 (drops locals, points to just above saved BP).
2. Pop old BP from RP and restore BP.
3. Pop return address from RP.
4. Jump to return address.

### Code Block Entry:

1. Push return address to RP.
2. Execute block body (no BP modification, no stack frame creation).

### Code Block Exit:

1. Pop return address from RP.
2. Jump to return address.

## 17. Frame Layout and Addressing

Each variable's address is computed at compile time:

```
address = BP + offset
```

Offset is determined by declaration order relative to BP:

- First declared variable: offset +4 (BP + 4, first slot above saved BP)
- Second: offset +8 (BP + 8)
- Third: offset +12 (BP + 12)
- ...

This mapping is one-to-one within the function. Variables are never renamed or re-ordered post-declaration.

## 18. Dictionary Entry Structure for Locals

Each `var` declaration creates a dictionary entry of the form:

- name: symbol
- kind: local
- offset: relative integer (e.g. +0, +1)
- binding: generated `LOAD_LOCAL`, `STORE_LOCAL`

On function exit (`;`), the compiler discards all dictionary entries added since the mark.

This enables variable reuse:

```
: a var x ;
: b var x ;  // allowed; x from a is forgotten
```

## 19. Restrictions on Nesting and Closures

TACIT functions are **flat**:

- Functions cannot be defined within other functions.
- Closures are not supported.
- Code blocks do not capture environment; they use lexical, resolved-at-compile-time addresses.

All local name binding is static.

## 20. Stack Register Summary

- **SP (Stack Pointer):** Top of data stack (STACK segment) for computation.
- **RP (Return Stack Pointer):** Top of return stack (RSTACK segment) for calls and locals.
- **BP (Base Pointer):** Points to the start of current function's local frame on return stack.
- **IP (Instruction Pointer):** Current instruction location in bytecode.

BP is updated only on function entry and restored on function exit.
RP is updated for both functions and blocks.
SP operates independently for data stack operations.

## 21. Return Address Safety and Escape Checking

To prevent illegal reference escapes:

- All references to locals must be copied before being stored in globals or returned.
- Return-time checking may compare the stack address of the reference with the function's frame start (BP). If the reference is within the current frame, return is rejected.
- Alternatively, the compiler performs static analysis to forbid returning local references.

No tag or heap mechanism is used to track lifetimes. The enforcement is structural and positional.

## 22. Future Considerations: Dedicated Locals Stack

As an optional future enhancement, TACIT may introduce a dedicated **locals stack**:

- Used solely for variable frames.
- Allows block-local allocations and more flexible scope modeling.
- Adds `LSP` (Locals Stack Pointer) and `LBP` (Locals Base Pointer).

Under the current model, however, all locals reside in the return stack (RSTACK), at BP and above.

## 23. Example: Legal Function

```
: calculate
    10 var a
    5 var b
    a b add
    if { a 0 gt } then { a print } endif
;
```

- `a` and `b` declared at top level.
- Used both inside function and inside code block.
- Legal and resolved via static offset from BP.

## 24. Example: Illegal Block Declaration

```
: fail
    if { 3 var x } then { x } endif
;
```

- `x` declared inside code block.
- Compile-time error: “Illegal variable declaration inside block.”

## 25. Block Scratch Example

```
: compute
    var x
    x 100 lt if {
        42   // scratch value
        x add
    } endif
;
```

- The `42` is a temporary, unnamed value.
- May occupy a transient compiler-allocated slot during the block.
- Not addressable or declared via `var`.
