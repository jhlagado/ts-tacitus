# Local Variables

## Table of Contents
- [1. Overview and Purpose](#1-overview-and-purpose)
- [2. Storage Model](#2-storage-model)
- [3. Local Symbol Management: Scope, Resolution, and Dictionary Interaction](#3-local-symbol-management-scope-resolution-and-dictionary-interaction)
- [4. Memory Layout and Stack Management](#4-memory-layout-and-stack-management)
- [5. Access and Assignment Semantics](#5-access-and-assignment-semantics)
- [6. `with` Blocks and Field Access](#6-with-blocks-and-field-access)
- [7. Function Calls and Frame Layout](#7-function-calls-and-frame-layout)
- [8. Struct Local Variables](#8-struct-local-variables)
- [9. Cleanup and Exit Semantics](#9-cleanup-and-exit-semantics)
- [10. Deferred Allocation and Dynamic Growth](#10-deferred-allocation-and-dynamic-growth)
- [11. Dictionary Scoping and Symbol Lifecycle](#11-dictionary-scoping-and-symbol-lifecycle)
- [12. Compiler Implementation Details](#12-compiler-implementation-details)
- [13. Promotion of Local Variables to Parent Scope](#13-promotion-of-local-variables-to-parent-scope)
- [14. Design Philosophy Summary](#14-design-philosophy-summary)

## 1. Overview and Purpose

In Tacit, local variables provide named access to stack-allocated values scoped to the body of a function. Unlike global symbols, which persist in the dictionary, local variables are ephemeral: they are created during function compilation and discarded afterward. This minimizes memory usage, supports recursion and reentrancy, and ensures that symbol definitions do not pollute the global namespace. They are introduced to improve code readability by reducing the need for complex stack manipulations (like `SWAP`, `DUP`, `DROP`), simplify the management of intermediate values and parameters within functions, and make programs easier to maintain, all without fundamentally altering Tacit's stack-based execution model.

Local variables are stored on the return stack and referenced by offset from a dedicated base pointer (`BP`). When a function is called, the return address and current `BP` are saved on the return stack. A new `BP` is then established, pointing to the base of the local frame. As each local is declared, a slot is reserved above `BP`. On function return, the return stack is unwound: first by walking back from the current stack pointer to `BP` (freeing any reference-counted locals), then by restoring the old `BP` and jumping to the return address.

This frame-based model guarantees that local variables are properly isolated between function calls. It also allows fast access by fixed offsets without requiring named lookups at runtime. Shadowing of global or outer-scope symbols is supported implicitly by maintaining a separate local symbol table during compilation. Symbol resolution always favors locals first.

The syntax for accessing and updating locals follows a postfix style:

- Referencing a local by name pushes its value onto the data stack.
- Assigning to a local is done with the `->` operator:

  ```
  42 -> counter
  ```

This model generalizes seamlessly to scalar values and opaque structures. Struct-based locals are also stored on the return stack but return a pointer to their memory region rather than a value when accessed. Field access is handled separately through `with`.

Local variables are typed only by their storage semantics—there is no runtime type tagging for them. Allocation is either static (by declaration) or dynamic (by just-in-time expansion of the local frame as new variables are encountered). This supports both simple and complex allocation strategies without heap usage.

### 1.1 Core Principles: Scope, Lifetimes, and `{}` Blocks

A fundamental aspect of Tacit's local variable system is its simplicity and predictability, rooted in a few core principles:

- **No Closures**: Tacit functions do not create closures. Local variables are strictly bound to their defining function's stack frame and lifetime. They cannot be "captured" by other functions or outlive the function scope in which they were defined. This design choice eliminates a common source of complexity and potential memory management issues found in languages with full lexical closures.
- **`{}` Blocks are Compile-Time Constructs**: Curly brace blocks (`{}`), typically used with combinators (e.g., `if`, `map`, `filter`) or for grouping code, are compile-time grammar structures, not runtime objects. They execute within the *same stack frame* as their enclosing function. Consequently:
    - They can directly access and modify local variables defined in the parent function scope.
    - They do not establish new, independent local variable scopes that would require separate environment frames.
    - They do not involve any form of environment capture or heap allocation for their execution context.
- **Predictable Lifetimes**: The lifetime of a local variable is unequivocally tied to the execution of its containing function. All locals are created after the function's stack frame is established and are destroyed when the frame is dismantled upon function exit.
- **Explicit Data Flow**: Data that needs to persist beyond a function call or be shared between non-nested functions must be explicitly passed via the data stack or stored in heap-allocated structures (which are then passed by reference on the stack).

These principles ensure that Tacit's local variable system remains lightweight, efficient, and easy for developers to reason about, aligning with the language's overall philosophy of explicit control and transparent execution.

## 2. Storage and Lifetime of Local Variables

Tacit uses a dedicated return stack for storing local variables, separate from the data stack used for intermediate computation. This ensures that local state is isolated and managed with predictable lifetimes, aligned with function call and return boundaries.

### 2.1 Stack Frame Layout

When a function is entered, a new frame is established on the return stack:

1. The caller pushes:

   - Return address (for reentry after function completion).
   - Old base pointer (BP), which marks the previous frame.

2. The callee updates:

   - `BP` is set to the current return stack pointer (RSP).
   - `SP` is updated as local variables are declared.

This frame grows upward (i.e., toward higher addresses). Each local variable occupies one slot unless it is a struct, in which case it occupies as many contiguous slots as defined by its `$length` constant.

### 2.2 Variable Lifetime

Local variables persist for the duration of the function. Upon function return, the return stack frame is dismantled, and any necessary cleanup (such as releasing reference-counted values) is performed. This process ensures that local storage is strictly bounded to the lexical scope of the function and prevents memory leaks. For a detailed breakdown of the cleanup protocol, see Section 9: Cleanup and Exit Semantics.

### 2.3 Allocation Strategy

Two allocation strategies are supported:

- **Just-In-Time Allocation (JITA)**: The return stack grows dynamically as the compiler encounters variable declarations or first-time assignments.
- **Preallocation**: The total size of the local frame is computed during compilation and reserved immediately at function entry. This is primarily useful when all variables are known ahead of time.

Currently, JITA is preferred due to its simplicity and alignment with the RPN style of Tacit.

### 2.4 Struct-Type Variables

Struct-type local variables are allocated on the return stack as contiguous blocks of memory. Their size is determined at compile time by the `struct-def` declaration (e.g., `<struct-name>$length`). Unlike scalar locals, a struct variable name typically resolves to the base address (pointer) of this memory block. Accessing individual fields within the struct instance is then managed using the `with` keyword and the field offset constants generated by `struct-def`.

For a comprehensive explanation of struct definition, memory layout, and field access, refer to the `structured-memory.md` document. This section focuses on how struct instances are handled as local variables.

## 3. Local Symbol Management: Scope, Resolution, and Dictionary Interaction

Tacit relies on a dictionary-based name resolution system for all symbols. This section defines how local symbols are registered, how scopes are managed, how names are resolved (including shadowing), and the nature of the metadata stored for symbols.

### 3.1 Compiler Dictionary Mechanics for Local Scopes

The compiler maintains a logical dictionary stack to manage symbol scopes. When compiling a function:

1.  The current dictionary pointer (often referred to as `DICT_TOP` or a similar marker) is saved before processing the function's body.
2.  All new symbols introduced within the function (i.e., local variables) are added to the dictionary *above* this saved mark.
3.  Upon completion of the function's compilation, all symbols added since the saved `DICT_TOP` mark are effectively discarded or made inactive. This can be conceptualized as popping them from the dictionary stack.

This mechanism ensures that local symbols are temporary and confined to their function's compilation context, preventing them from polluting the global symbol space or interfering with other functions' local symbols. It forms the basis of lexical isolation for local variables.

### 3.2 Symbol Categories and Kinds

All named symbols in Tacit fall into one of these primary categories, typically distinguished by a `Kind` attribute in their dictionary entry:

-   **Local Variables**: Defined within a function, their `Value/Offset` attribute usually stores their offset relative to the base pointer (`BP`) on the return stack. They are scoped exclusively to the function body.
-   **Global Words**: Persistent symbols defined at the top level, such as functions defined with `colon` syntax, global constants, and macros. Their `Value/Offset` might point to executable code or a constant value.
-   **Struct Field Offset Constants**: These are global constants automatically created by `struct-def`. For a field like `name` in a `person` struct, a constant (e.g., `person-name`) is created whose value is the numeric offset of that field from the start of any `person` struct instance. These entries typically have a `Prefix` attribute (e.g., `person`) and a `Name` attribute (e.g., `name`).
-   **Struct-Type Local Variables**: These are local variables whose allocated space on the return stack is large enough to hold an entire struct instance. The variable name resolves to the base address of this multi-slot memory block. They might have a specific flag (e.g., `is-struct-pointer`) in their dictionary entry.

### 3.3 Symbol Definition, Resolution Order, and Shadowing

When a name (symbol) is encountered in Tacit code, the compiler attempts to resolve it by searching in the following order of priority:

1.  **Local Symbols**: The current function's active local symbol table (symbols above the saved `DICT_TOP`) is checked first. If the name is found here, it refers to the local variable.
2.  **Struct Fields (within `with` blocks)**: If the code is inside a `with <struct-type>` block and the name was not resolved as a local symbol, the compiler checks if the name corresponds to a field of `<struct-type>`. This is typically done by looking for a dictionary entry whose `Name` matches the symbol and whose `Prefix` attribute matches `<struct-type>` (see Section 3.6 for details on `with` block field resolution and Section 3.8 for dictionary attributes).
3.  **Global Symbols**: If the name is not found in the local scope or as a struct field (if applicable), the global dictionary is checked. This includes globally defined functions, constants, and struct definitions.

If the symbol is not found in any of these locations, a compilation error is typically raised.

**Shadowing:**
Shadowing occurs when a local variable is defined with the same name as a symbol in a broader scope (a global symbol or a struct field name). Due to the resolution order described above, the local variable takes precedence within its scope.

For example:
```tacit
: example-shadow
  10 -> print       (Defines a local variable named 'print')
  print             (This refers to the local variable 'print', not the global 'print' word)
;
```
In this `example-shadow` function, the local `print` effectively hides or *shadows* the standard global `print` word for the duration of the function's execution. The compiler achieves this by finding `print` in the local symbol table first (step 1 of resolution) and generating code to access the local variable's slot. This allows for convenient naming within functions without risking accidental modification or invocation of global words.

### 3.4 Re-assignment to Local Symbols

When a name is assigned to within a function (e.g., `value -> name`):

1.  **First Assignment and Potential Shadowing**: If `name` is not already an active local symbol in the current function's scope (i.e., it's not found above the current function's `DICT_TOP` mark), this first assignment defines it as a new local variable. The compiler allocates a new slot on the return stack for this local and records its offset. If a global symbol or struct field with the same `name` exists, this new local variable *shadows* it, as per the resolution order in Section 3.3.

2.  **Subsequent Assignments (Re-assignment)**: If `name` already exists as a local variable within the current function's scope, a subsequent assignment (e.g., `another-value -> name`) updates the value in the *existing* local variable's allocated slot. No new slot is created, and no new layer of shadowing occurs; the existing local symbol's dictionary entry and stack slot are simply reused for the new value.

For example:
```tacit
: test-reassignment
  1 -> x  ( 'x' becomes a local, potentially shadowing a global 'x' )
  x       ( accesses local 'x', value is 1 )
  2 -> x  ( updates the *same* local 'x'. No new variable is created )
  x       ( accesses local 'x', value is 2 )
;
```
In this case, the second `-> x` reuses the dictionary entry and stack slot established by the first `-> x`.

### 3.5 Syntax for Symbol Introduction

Tacit primarily uses first-assignment for introducing local symbols, though explicit declaration is a potential future feature. This implicit declaration mechanism allows for dynamic stack growth during function body compilation.

-   **First-Assignment Declaration** (current default):
    ```tacit
    42 -> x
    ```
    If `x` is not found in the current scope:
    1. A new dictionary entry is created for `x`.
    2. A return stack slot is reserved (effectively bumping the conceptual `RSP` for local allocation).
    3. The variable’s offset from `BP` is recorded in the dictionary entry.
    4. Its `Kind` is marked as `local`.

-   **Explicit Declaration** (future support):
    ```tacit
    let x
    ```
    This syntax would explicitly declare `x` as a local variable, potentially with a default initial value or uninitialized state, depending on the language specification for `let`.

Once a local symbol `x` is introduced, it can be referenced as a read:
```tacit
x
```
This pushes the value stored at `x`'s return stack offset onto the data stack.

This dynamic approach enables patterns like:
```tacit
1 -> a
call-child
2 -> b
```
Even though `b` appears after `call-child`, it will be correctly allocated and accessed within its function's scope.

### 3.6 Field Access Resolution in `with` Blocks

When compiling code inside a `with <struct-type>` block (e.g., `my-instance with my-struct-type`), symbol lookup for potential fields is handled specially if a name is not first resolved as a local variable (as per Section 3.3):

1.  The compiler identifies the active `with` context (e.g., receiver `my-instance`, type `my-struct-type`).
2.  It then searches the dictionary for an entry where:
    *   The entry's `Name` attribute matches the unresolved symbol (e.g., `field-name`).
    *   The entry's `Prefix` attribute matches the type specified in the `with` block (e.g., `my-struct-type`).
3.  If such a dictionary entry is found (representing, for example, the `my-struct-type-field-name` field offset constant, see Section 3.2 and 3.8), its `Value/Offset` (the numeric offset) is used to generate code for memory access relative to the base address of `my-instance`.

This mechanism, which relies on `struct-def` creating appropriately prefixed field offset constants (see `structured-memory.md`), allows field names to be simple (e.g., `age`) within a `with` block while still being unambiguously scoped to their struct type. It ensures that `age` inside `bob with person` correctly maps to the `person-age` field offset without runtime string manipulation.

### 3.7 Compile-Time Symbol Table Cleanup

Symbol table cleanup for locals is purely a **compile-time** operation. At the end of a function’s compilation (conceptually, when `end-locals` or its equivalent is processed), all dictionary entries that were added for that function's local variables (i.e., those above the `DICT_TOP` mark saved at the function's start, see Section 3.1) are discarded or marked as inactive. This ensures a flat and clean symbol table from the perspective of the global scope and other functions, maintaining lexical isolation.

### 3.8 Symbol Metadata and Dictionary Entry Attributes

Each dictionary entry in Tacit includes several key attributes to support its symbol management, scoped field resolution, and code generation. The primary attributes are:

-   **Name**: The raw symbol name as it appears in the source code (e.g., `x`, `myFunction`, `age`).
-   **Kind**: Categorizes the symbol (e.g., `local`, `global`, `field-offset`, `struct-type-id`). This dictates how the symbol is treated by the compiler and runtime (see Section 3.2).
-   **Prefix**: Crucial for struct field resolution.
    -   For most symbols (locals, globals, struct type IDs), this is `null` or absent.
    -   For struct field offset constants (e.g., the constant representing the offset of the `age` field within a `person` struct), the `Name` would be `age` and the `Prefix` would be `person`. This allows the compiler to find the `age` field of a `person` struct by looking for a dictionary entry with `Name: "age", Prefix: "person"`. (See `structured-memory.md` Appendix A for more details on how these entries are created by `struct-def`.)
-   **Value/Offset**: The actual data or pointer associated with the symbol.
    -   For local variables: their offset from the base pointer (`BP`).
    -   For struct field offset constants: the numeric offset from the start of the struct.
    -   For global words: typically a pointer to executable code or a constant value.
-   **Flags**: Additional boolean attributes indicating properties such as `is-struct-pointer` (for local variables that are instances of structs), `is-constant`, `is-macro`, `is-hidden`, etc. These flags help the compiler generate correct code and enforce language semantics.

This structured dictionary entry, particularly the `Name`, `Kind`, and `Prefix` combination, enables precise, scoped lookup for all symbols, including struct fields, without relying on runtime string manipulation and clearly distinguishes fields from other symbols that might share the same base name.

## 4. Memory Layout and Stack Management

Tacit separates its data and control concerns via two distinct stacks:

- The **data stack** holds intermediate computation results and expression operands.
- The **return stack** holds function return addresses, base pointers, and **local variable frames**.

Local variables are allocated exclusively on the **return stack**, in the form of contiguous slots within a frame. Struct instances are also stored here as opaque multi-slot allocations.

#### 4.1 Entry Protocol: Setting Up the Stack Frame

Every function begins execution with a **prologue** that sets up its local frame:

```assembly
push old-bp
bp := rsp
```

This stores the previous base pointer (`bp`) and sets `bp` to the current top of the return stack (`rsp`). From this point forward, local variables are indexed as offsets from `bp`.

#### 4.2 Allocation: Just-in-Time Frame Growth

Unlike traditional fixed-frame models, Tacit allows **incremental allocation** of locals during function compilation:

- Each time a **new local variable** is encountered (via assignment), the return stack pointer (`rsp`) is bumped up by one.
- The current offset from `bp` is recorded in the dictionary for that symbol.
- No memory is reserved ahead of time; stack growth happens **on demand**.

##### Example:

```tacit
42 -> a      \ allocates offset 0
7  -> b      \ allocates offset 1
```

Each assignment triggers a bump in the return stack and records a new symbol offset.

#### 4.3 Late Allocation Scenario

Tacit's model supports **mid-function local declarations**, even after calls:

```tacit
42 -> a        \ allocates offset 0
some-call      \ executes with only 'a' present
7  -> b        \ allocates offset 1 after the call
```

This is legal and safe, because stack cleanup will only walk back to the current `rsp`, regardless of when allocations occurred.

#### 4.4 Exit Protocol: Cleaning Up the Frame

When a function completes (via `exit` or normal return), its stack frame is dismantled. This involves restoring the previous stack pointer (`bp`), popping the old base pointer, and returning to the caller. Crucially, any reference-counted values stored in the local frame are released during this process to prevent memory leaks. The detailed steps for this cleanup are covered in Section 9: Cleanup and Exit Semantics.

## 5. Access and Assignment Semantics

Tacit uses a uniform and concise syntax for reading and writing local variables. The semantics are simple: variables live on the **return stack**, and symbol references are rewritten at compile time into fixed-offset stack access.

Tacit distinguishes between **scalar locals** (single-slot values) and **struct instances** (multi-slot pointers), but both are stored and indexed uniformly from the base pointer (`bp`).

#### 5.1 Reading Local Variables

Accessing a local variable pushes its value onto the data stack:

```tacit
a
```

This is compiled to:

```assembly
bp + offset[a] load
```

The compiler looks up the symbol `a` in the local scope and replaces it with a fixed offset from `bp`. The resulting address is then loaded into the data stack.

This behavior is standard for **scalars**. If `a` is a pointer to a struct, this loads the pointer itself.

#### 5.2 Writing Local Variables

Assignments use a `->` operator:

```tacit
value -> a
```

This is compiled to:

```assembly
value
bp + offset[a] store
```

The compiler ensures that `a` is present in the current local scope or allocates it if this is the first encounter. The offset is calculated relative to `bp`, and a store instruction is generated to write the value into that location.

#### 5.3 Declaration and Assignment in One

Tacit does not use a separate declaration syntax for scalars. The first assignment **implicitly defines and allocates** the variable:

```tacit
42 -> x
```

This results in:

- Bumping the `rsp` by 1.
- Recording `x` as a local symbol at offset 0 from `bp`.
- Emitting a store instruction for `bp + 0`.

If the symbol `x` already exists, the store is emitted without any reallocation. When a heap-allocated (reference-counted) value is assigned to a local variable, its reference count is typically incremented at that point. Conversely, the count is decremented during cleanup when the local variable goes out of scope (see Section 9).

#### 5.4 Shadowing Behavior

Tacit permits **shadowing**: a local variable may reuse the name of a global word or previously declared symbol.

```tacit
: example
  10 -> print
  print
;
```

This is valid. Inside the function body, `print` refers to the local variable, not the global word, due to shadowing. As explained in Section 3.3, local symbols take precedence over global symbols during name resolution within a function's scope.

1. Local scope (checked first)
2. Global dictionary

The dictionary uses a flag to distinguish local variables from global symbols, ensuring correct resolution at compile time.

#### 5.5 Symbol Type Flags

Each symbol in the dictionary carries metadata, including a `Kind` attribute and various flags, to define its behavior (e.g., `LOCAL`, `GLOBAL`, `STRUCT_PTR`, `STRUCT_FIELD`). These attributes, set at declaration time, govern how the symbol is compiled and accessed. For a detailed breakdown of dictionary entry attributes, see Section 3.8.

## 6. Struct Locals and Address Semantics

Struct instances, when used as local variables, are allocated as contiguous blocks of memory on the return stack. A local struct variable typically holds the base address (pointer) to this block. The compiler distinguishes these from scalar locals (e.g., via a `STRUCT_PTR` flag or specific `Kind` in the dictionary entry), ensuring that referencing the variable name yields this address rather than attempting to dereference the first slot.

Field access and manipulation then proceed via this pointer, typically within a `with` block, as detailed in `structured-memory.md`. This current section focuses on the declaration, assignment, and address semantics specific to struct *local* variables.

#### 6.1 Declaring a Struct Local

Syntax:

```tacit
<field-values...> struct <struct-type> <var-name>
```

This behaves similarly to a scalar local declaration, but with key differences:

- The variable `var-name` refers to a pointer to the base of a struct instance.
- The memory is reserved on the return stack, of size `<struct-type>$length`.
- Each field value on the data stack is copied into its corresponding offset.

Example:

```tacit
"Jane" 42 struct person alice
```

Expands to:

```assembly
rsp += 2                 ; reserve 2 slots
stack[rsp-2] := "Jane"   ; person-name = offset 0
stack[rsp-1] := 42       ; person-age  = offset 1
dictionary["alice"] = { offset: rsp-2, type: STRUCT_PTR }
```

This declares a struct-type local `alice`, occupying two slots.

#### 6.2 Referencing a Struct Local

When a struct local is referenced:

```tacit
alice
```

The compiler emits:

```assembly
push &stack[bp + offset[alice]]
```

That is, the pointer to the struct's base is pushed. This is unlike scalar locals, which push the **value at** the offset. Struct locals always return the **address** of the base.

This enables further indirect field access using `with`.

#### 6.3 Accessing Fields via `with`

To access fields, use the `with` keyword:

```tacit
alice with person
  name print
```

The compiler enters a scoped mode in which all field symbols (e.g. `name`) are rewritten as:

```assembly
load [alice + person-name]
```

Both `alice` and `person-name` are resolved at compile time. No runtime lookups occur.

The receiver variable (`alice`) must have the `STRUCT_PTR` flag set, and the struct type (`person`) must be a known `struct-def`.

#### 6.4 Writing to Fields

Assignments to fields within a `with` block use the same `->` operator:

```tacit
"Janet" -> name
```

Compiles to:

```assembly
store [alice + person-name] := "Janet"
```

This matches scalar assignment semantics, but the pointer + offset combination is compiled using the `with` receiver context.

#### 6.5 Shadowing and Scope Resolution

Field symbols like `name` are resolved **only if**:

1. They are not found as a local or global symbol.
2. A `with` block is active with a known receiver type (e.g. `person`).
3. The prefixed symbol (e.g. `person-name`) is found in the dictionary.

This allows field names to coexist with global and local names without conflict. Resolution precedence is:

1. Local symbols (scalar or struct)
2. Global symbols
3. Prefixed field symbols in current `with` scope

#### 6.6 Structs Are References

Importantly, all struct local variables are passed, stored, and returned by **reference**:

- They are represented as a pointer to a memory block on the return stack.
- Assigning the variable to another is just pointer copying.
- No deep copy or clone is performed.

Thus:

```tacit
bob
```

Pushes a pointer. If passed to a function:

```tacit
bob print-person
```

Then `print-person` must accept and operate on that pointer.

## 7. Function Calls and Frame Layout

Tacit functions follow a strict stack frame discipline that ensures local variable lifetimes are isolated, cleanup is predictable, and access is efficient. This section specifies the complete entry and exit sequences for function calls, the handling of local variable slots, and the interaction between the return stack (`RSP`) and base pointer (`BP`).

#### 7.1 Register Semantics

- `RSP`: Return stack pointer (grows upward).
- `BP`: Base pointer (marks start of current frame).
- `IP`: Instruction pointer (PC).
- `RET`: Temporary register used to store the return address during a call.

#### 7.2 Function Entry Sequence

When a function is called:

```assembly
CALL func_label
```

The following happens at runtime:

```assembly
push RET             ; save return address
push BP              ; save base pointer
BP := RSP            ; establish new frame
```

At this point:

- `BP` points to the top of the return stack (pre-allocated space will be above this).
- All local variable offsets are relative to `BP`.
- The dictionary stack is marked for cleanup after compilation.

This sequence is emitted at the start of every function body.

#### 7.3 Local Variable Allocation

Local variables are allocated upward from `BP`. Each new symbol reserves one slot (unless a struct). Example:

```tacit
42 -> foo
```

If `foo` is not yet defined, the compiler:

1. Assigns it the next offset from `BP`.
2. Emits: `store [BP + offset(foo)] := 42`
3. Increments the frame size tracker.

If `foo` is already known, just emits the store.

Struct locals allocate multiple contiguous slots and store a tagged pointer in the symbol:

```tacit
"Jane" 42 struct person alice
```

Reserves `person$length` slots and stores base address at `alice`.

#### 7.4 Accessing Locals

To **load** a scalar local:

```tacit
foo
```

Emit:

```assembly
load [BP + offset(foo)]
```

To **store** a scalar local:

```tacit
42 -> foo
```

Emit:

```assembly
store [BP + offset(foo)] := 42
```

#### 7.5 Function Exit Sequence

At the end of a function, or if an `exit` word is used, the frame must be dismantled and any reference-counted items freed.

Standard exit sequence:

```assembly
SP := BP              ; discard stack-allocated locals
walk SP->RSP cleanup  ; walk from SP to RSP, dec-ref any values
pop BP                ; restore caller base pointer
pop RET               ; restore return address
JMP RET               ; return to caller
```

The compiler emits this code after the final instruction in every function.

#### 7.6 Lifetime and Cleanup

Local values are only accessible within the current frame. On return:

Local values are accessible only within the current frame. On function return, the frame is typically dismantled completely, which includes releasing any reference-counted items stored in local slots. This cleanup procedure is essential for maintaining memory integrity and is detailed in Section 9. An exception to complete dismantlement is variable promotion, where parts of the child's frame can be retained by the parent, as described in Section 13.

#### 7.7 Summary Diagram

```
Before CALL:

  Caller Frame
  +------------+
  | ret addr   |
  | old BP     |
  | args…      |
  +------------+

After Entry:

  Callee Frame
  +------------+
  | ret addr   |
  | old BP     |
  | <BP>       | ←── BP
  | locals…    | ↑
  | structs…   | | grows up
  | tmp space… | ↑
  +------------+ ←── RSP
```

### 7.8 Detailed Stack Frame Walkthrough

To further illustrate how locals are physically laid out and managed, let’s walk through a concrete example.

#### 7.8.1 Example Program

Consider the following Tacit function:

```tacit
: example-fn ( x y -- sum )
  -> b       ( assign y from stack to local 'b' )
  -> a       ( assign x from stack to local 'a' )
  a b +     ( add 'a' and 'b', sum is on data stack )
  -> result  ( store the sum in local 'result' )
  result    ( push 'result' to data stack for return )
;
```

This function:
1. Takes two arguments from the data stack (let's assume `x` was pushed first, then `y`, so `y` is on top).
2. Stores them as local variables `b` (from `y`) and `a` (from `x`).
3. Adds `a` and `b`.
4. Stores the sum in a local variable `result`.
5. Pushes the value of `result` onto the data stack to be returned to the caller.

#### 7.8.2 Step-by-Step Stack Frame Layout

**1. At Function Entry (after `example-fn` is called, before its code executes):**

*   **Return Stack (`RSP` grows upwards/towards higher addresses):**
    ```
    +------------------+ Higher Addresses / RSP after setup
    | ...              |
    +------------------+
    | Return Address   | (Pushed by the call mechanism)
    +------------------+
    | Caller's BP      | (Pushed by the call mechanism)  <-- New BP will point here after setup
    +------------------+
    | ...              |
    +------------------+ Lower Addresses
    ```
*   **Data Stack (`DSP` grows upwards/towards higher addresses):**
    ```
    +------------------+ Higher Addresses / DSP
    | y (e.g., value 20) | (Top of stack)
    +------------------+
    | x (e.g., value 10) |
    +------------------+
    | ...              |
    +------------------+ Lower Addresses
    ```

**2. After Frame Setup and Local Variable Assignments:**

The function prologue will:
- Push Return Address (if not already done by a generic call instruction).
- Push the caller's `BP`.
- Set the current `BP` to `RSP` (pointing to the saved caller's `BP`).

Then, as locals are assigned (assuming JITA, and `b` then `a` then `result`):
- `-> b`: `y` (20) is popped from data stack, `RSP` is incremented, 20 is stored at `[BP+1]`. `b` is mapped to offset +1.
- `-> a`: `x` (10) is popped from data stack, `RSP` is incremented, 10 is stored at `[BP+2]`. `a` is mapped to offset +2.
- `a b +`: 10 and 20 are pushed to data stack, added. Sum (30) is on data stack.
- `-> result`: Sum (30) is popped from data stack, `RSP` is incremented, 30 is stored at `[BP+3]`. `result` is mapped to offset +3.

*   **Return Stack State (before `result` is pushed for return):**
    ```
    +------------------+ Higher Addresses
    | result (value 30)| RSP points here (BP+3)
    +------------------+
    | a      (value 10)| (BP+2)
    +------------------+
    | b      (value 20)| (BP+1)
    +------------------+
    | Caller's BP      | BP points here
    +------------------+
    | Return Address   |
    +------------------+
    | ...              |
    +------------------+ Lower Addresses
    ```
*   **Data Stack State (after `-> result`, before final `result` word):**
    ```
    +------------------+ Higher Addresses / DSP
    | (empty or other) |
    +------------------+ Lower Addresses
    ```

#### 7.8.3 Accessing Locals

During the function's execution:
- `a` is accessed by loading from memory at `[BP + 2]`.
- `b` is accessed by loading from memory at `[BP + 1]`.
- `result` is accessed by loading from memory at `[BP + 3]`.

The compiler translates these names into fixed `BP` offsets.

#### 7.8.4 At Function Exit (after `result` is pushed to data stack)

Before the function epilogue fully unwinds the stack:

*   **Return Stack:** Same as above.
*   **Data Stack:**
    ```
    +------------------+ Higher Addresses / DSP
    | result (value 30)| (Top of stack, ready for caller)
    +------------------+
    | ...              |
    +------------------+ Lower Addresses
    ```

The function epilogue then performs cleanup (see Section 9):
1.  Any necessary reference count decrements for `result`, `a`, `b` occur.
2.  `RSP` is reset to point to where `BP` points (effectively discarding `result`, `a`, `b`).
3.  The caller's `BP` is popped from the return stack into `BP`.
4.  The return address is popped, and execution jumps there.

The data stack is left with the return value (`sum`) for the caller.



## 8. Struct Local Variables

Struct local variables allocate multiple contiguous slots on the return stack and are typically treated as opaque references (pointers) to these structured memory regions. Their memory layout and access semantics differ from scalar locals.

For the fundamentals of struct definition, how `struct-def` generates field offset constants, and the general use of `with` for field access, please refer to `structured-memory.md`. This section focuses on aspects unique to using struct instances as *local variables*.

#### 9.1 Declaration Syntax

Struct locals use the `struct` keyword and follow this format:

```tacit
<field-values…> struct <struct-type> <var-name>
```

Example:

```tacit
"John" 25 struct person bob
```

This expands to:

- Allocate `person$length` contiguous slots on the return stack.
- Initialize fields left-to-right.
- Bind `bob` to the base address of this memory region.
- Mark `bob` in the dictionary as a struct pointer.

#### 9.2 Storage and Access Behavior

- Struct locals are not dereferenced automatically.
- Accessing `bob` pushes a **pointer** (a tagged stack address) onto the data stack.
- You must enter a `with` block to manipulate its fields.

```tacit
bob with person
  "Johnny" -> name
  age
```

Inside `with`, field names resolve as offsets from the receiver pointer.

#### 9.3 Dictionary Flags

Struct locals are recorded in the dictionary as:

- **Name:** e.g. `bob`
- **Kind:** `local`
- **Flags:**

  - `is-struct-pointer = true`
  - `type = person`

- **Offset:** return stack index

These flags distinguish struct locals from scalars, allowing the compiler to emit address loads instead of value loads.

#### 9.4 Stack Allocation Semantics

Unlike scalar locals, which allocate a single slot, struct locals allocate `N` slots, where `N = <type>$length`.

This happens immediately upon encountering the `struct` declaration. The return stack pointer is incremented accordingly.

No later mutation can change the size or type of a struct local.

#### 9.5 Field Resolution and the `with` Context

Inside a `with` block, unqualified field names like `name`, `age`, or `title` are rewritten by the compiler as `<type>-<field>` and resolved in the dictionary.

Only struct fields carry a non-null **prefix** field in their dictionary entries. This allows field lookups to be scoped by type.

If `name` is not found as a local, and `with person` is active, then the compiler tries:

```
lookup("person-name")
```

If found, the compiler emits:

```tacit
bob person-name +  ; for loads
bob person-name + store  ; for -> assignments
```

#### 9.6 Value Semantics vs. Reference Semantics

Struct locals are always passed **by reference**:

```tacit
bob some-method
```

This passes a pointer, not a copy.

In contrast, scalar locals:

```tacit
x some-method
```

Pass a **copy** of the value.

This distinction is critical for functions that mutate their arguments.

#### 9.7 Reuse and Nesting

Multiple struct locals can be used in the same scope:

```tacit
"Alice" 30 struct person a
"Bob" 31 struct person b
```

Field access is context-dependent via `with`:

```tacit
a with person name print
b with person age print
```

Each `with` applies only within its lexical block. The compiler maintains a temporary prefix binding during this region.

## 9. Cleanup and Exit Semantics

Tacit uses an explicit cleanup mechanism for local variables at function exit, ensuring that all values stored on the return stack—particularly reference-counted values—are properly released.

#### 9.1 Cleanup Trigger Point

Cleanup is performed **only on function exit**, not during tail calls or loop iteration. It occurs after the function body has completed execution, but before the return address is popped.

This ensures:

- Stack integrity is preserved across nested calls.
- Reference-counted values are released in reverse allocation order.
- Temporary stack growth from `let`/`struct` variables is correctly reclaimed.

#### 9.2 Cleanup Steps (Pseudocode)

At function exit, the following sequence occurs:

```tacit
; -- Top of function exit --
SP := current return stack pointer
BP := current base pointer

; Walk backwards and release values
while SP > BP:
    SP := SP - 1
    release_if_refcounted(*SP)

; Restore caller context
pop BP
pop return address
jump to return address
```

This is executed by a generated function epilogue. The values between `BP` and `SP` are all locals of the current function scope and are no longer valid after return. This standard cleanup ensures all local resources are reclaimed. A notable exception is the mechanism for promoting local variables to a parent scope (detailed in Section 13), which alters how the stack frame boundary (`BP`) is adjusted for the promoted variables, thereby allowing them to persist into the caller's scope.

#### 9.3 Why Cleanup is Required

Tacit avoids automatic garbage collection by using reference counting. Stack-allocated locals may contain:

- Heap-allocated strings
- Lists or boxed structures
- Structs with pointer fields

If these are not explicitly released, memory will leak. Therefore, each function must clean up its own stack allocations.

#### 9.4 Stack Ownership Model

Each function owns the region of the return stack between:

```tacit
[ BP , SP )
```

This ownership starts when the function is called and ends when it returns. The base pointer (`BP`) is saved at call entry, and `SP` is adjusted during local declarations (`let`, `struct`, etc.).

#### 9.5 Interaction with Struct Locals

Structs are allocated as opaque blocks on the return stack. The fields themselves may contain reference-counted values.

Therefore, the cleanup loop must treat struct locals the same as any other locals:

- They occupy multiple slots.
- Each slot must be checked individually.
- Struct locals do not require special cleanup logic beyond per-slot release.

#### 9.6 Example

Function with scalar and struct locals:

```tacit
: foo
  "Alice" -> name
  42      -> age
  "Bob" 30 struct person p
  ...
;
```

Cleanup walks these locals in reverse order:

1. Releases each field of `p` (slot 3 and 4).
2. Releases `age` (slot 2).
3. Releases `name` (slot 1).

After release:

```tacit
SP := BP
pop BP
pop return address
jump
```

## 10. Deferred Allocation and Dynamic Growth

Tacit permits **just-in-time (JIT) allocation of local variables** as they are encountered during compilation. Rather than requiring all local variables to be declared up front, the compiler expands the return stack frame dynamically whenever a new local symbol is introduced.

This strategy enables:

- Flexible variable scoping across branches
- Reduced pre-analysis of declarations
- Efficient memory layout tailored to actual use

#### 10.1 JIT Allocation Mechanism

When the compiler encounters a new local symbol (e.g., `x -> foo`) that has not previously been declared in the current function body:

- It allocates a new slot on the return stack by emitting `SP++`
- It assigns an offset (relative to the current `BP`) to the new symbol
- The symbol is added to the current _local dictionary scope_

Subsequent references to the same symbol reuse the assigned offset.

##### Example:

```tacit
1 -> a    \ allocates a new slot for 'a'
a 2 + -> b \ allocates a new slot for 'b'
```

Even though `b` is declared later, it gets a later offset. This means the return stack grows during code generation.

#### 10.2 Implications for Function Calls

Function calls may appear before all local symbols are known:

```tacit
1 -> a
some-function-call
42 -> b
```

In this example:

- At call time, only `a` is allocated.
- After the call, `b` is declared, and the return stack is bumped again.

There is no need to pre-allocate `b` before the call. On exit, the cleanup logic simply walks back from `SP` to `BP`, regardless of when slots were allocated.

#### 10.3 Offset Tracking

The compiler maintains a monotonically increasing **local offset counter**, initialized to 0 at the start of the function. Every new local:

- Gets the current offset
- Increments the counter
- Pushes `SP++` at that point in code generation

Thus, allocation is always forward-moving, and the offset assignment is deterministic based on source ordering.

#### 10.4 Struct Locals and Dynamic Growth

Struct declarations also trigger JIT allocation:

```tacit
"Bob" 30 struct person p
```

If `person$length` = 2, this allocates two new slots:

- Offsets `n` and `n+1` are reserved
- The symbol `p` is assigned offset `n`
- `SP := SP + 2` is emitted

Structs are treated as opaque blocks, and their fields are accessed via fixed offsets (like `person-name` = 0).

#### 10.5 Scope Lifetime

Once a local symbol is declared, it remains valid until the function exits. There is no attempt to reclaim slots early or optimize lifetime ranges. This simplifies:

- Symbol resolution
- Cleanup
- Stack layout

#### 10.6 Benefits of Dynamic Growth

| Feature                  | Benefit                                    |
| ------------------------ | ------------------------------------------ |
| No up-front declarations | Reduces verbosity, fits RPN style          |
| Allocation at first use  | Minimizes unused locals                    |
| Natural compatibility    | Matches with dynamic control flow patterns |
| Simple implementation    | Local offset = allocation order            |

## 11. Dictionary Scoping and Symbol Lifecycle

Tacit uses a flat symbol table (dictionary) to manage all named entities, including colon definitions, constants, macros, local variables, and struct metadata. However, local variables and certain struct-specific entities are **temporary** and should not persist beyond the compilation of a function body. This section describes how symbol scoping is managed during compilation and how temporary entries are cleaned up.

### 11.1 Dictionary Top Marker

When the compiler begins compiling a function, it records the current “top” of the dictionary. This is a pointer or index marking the most recent permanent symbol defined globally. Any subsequent symbols created during compilation of the function are **local** to that function and can be discarded afterwards.

```text
At function entry:
  save current dictionary pointer as $dict-top
```

This ensures that when the function’s compilation completes, the compiler can walk back and remove any entries added since `$dict-top`.

### 11.2 Temporary Symbol Entries

During compilation of the function body, any new symbols introduced by:

- **local variable definitions**
- **struct instance declarations (via `struct`)**
- **temporary macros**

…are added to the dictionary as usual, but flagged as **non-exported** and **temporary**.

Each entry should store a `temporary` flag that distinguishes it from permanent definitions.

### 11.3 Cleanup on Function Exit

At the end of compilation:

```text
At function exit:
  restore dictionary pointer to $dict-top
  (remove all symbols defined after it)
```

This removes all temporary definitions. Struct metadata (`person-name`, etc.) defined via `struct-def` is **not** affected—they are global and persist for the program lifetime.

### 11.4 Symbol Lookup Behavior

During compilation, symbol lookup proceeds as follows:

1. Look in the dictionary from most recent to oldest.
2. If multiple symbols match a name, take the most recent one (i.e., innermost scope).
3. Shadowing occurs naturally due to order of insertion.

Local variables thus shadow global words. A word `foo` declared as a local will override a global `foo` when referenced inside the function body.

### 11.5 Summary

- Dictionary entries are cleaned up at the end of function compilation.
- Local symbols shadow global ones and are always temporary.
- `struct-def` entries are global and permanent.
- Dictionary scoping is enforced entirely at **compile time**; there is no runtime dictionary.

## 12. Compiler Data Structures for Locals

To support local variables in Tacit, the compiler maintains an internal environment that maps symbol names to stack offsets and tracks additional metadata such as type flags. This section details the structures used and how they evolve during compilation.

### 12.1 Local Symbol Table

A **local symbol table** is created at the beginning of function compilation. It maps symbol names to:

- An offset from the function’s base pointer (`BP`)
- A symbol type (e.g. scalar, struct)
- Optional metadata (e.g. struct layout reference)

Each entry in this table represents a single variable and must remain valid for the duration of function compilation.

Example:

| Symbol | Offset | Type   | Metadata        |
| ------ | ------ | ------ | --------------- |
| `x`    | 0      | scalar | —               |
| `y`    | 1      | scalar | —               |
| `bob`  | 2      | struct | `person$length` |

### 12.2 Stack Offset Allocation

As the compiler encounters new local symbols, it assigns them **consecutive offsets** from the current stack pointer (`SP`), which is initially set just above the base pointer (`BP`). The return stack grows upwards.

Two approaches are supported:

1. **Just-in-time allocation** (preferred):
   When a local symbol is encountered **for the first time**, it is added to the local table and `SP` is bumped.

2. **Pre-allocation**:
   When using explicit declarations (e.g., `let x`), `SP` is advanced in advance for that symbol, and it is entered into the table.

This mechanism supports interleaved variable declarations and control flow (see Section 10 for JIT allocation details).

### 12.3 Lookup Strategy During Compilation

When a symbol is encountered during code generation, the compiler attempts the following:

1. Look up in the local table. If found:

   - Use the associated stack offset and emit code accordingly.

2. Otherwise, look in the global dictionary.

   - If found and it is a struct field, resolve according to active `with` context.
   - If found as a global function/constant, compile as global access.

### 12.4 Access Code Emission

- **Read access** (e.g., `x`) compiles to:
  `BP + offset → fetch`
  and pushes the value to the data stack.

- **Write access** (e.g., `42 -> x`) compiles to:
  `BP + offset → store`
  popping the value from the data stack and storing it at the computed address.

- **Struct references** behave differently and return a **pointer**, not a value.

### 12.5 Cleanup

No runtime cleanup is needed—locals are stored on the return stack, and the function epilogue rewinds `SP` to `BP`. However, temporary compiler state (e.g., the local symbol table) is discarded after code generation for the function completes.

## 13. Promotion of Local Variables to Parent Scope

In certain cases, it is desirable to promote a local variable (or set of variables) from the current function's scope to its caller's scope. This allows the caller to retain access to the memory region associated with a local variable declared inside a child function.

### 13.1 Mechanism

Tacit's return stack-based variable model allows for this kind of promotion, because the return stack pointer (SP) governs the lifetime of local storage. By default, all local variables are discarded on function exit by resetting SP to BP, then restoring the saved BP and return address.

To promote a variable (e.g., `x`) into the parent scope:

1. **Identify the target offset** of `x` relative to the base pointer (BP).
2. **Rewrite BP** to an earlier position—specifically to the base address of `x`.
   This causes the parent function's stack frame to now include all variables from the start up to and including `x`.

This is equivalent to saying: "all variables from the beginning of the current stack frame up to `x` are now part of the caller’s frame."

### 13.2 Implicit Promotion of Earlier Variables

Because Tacit's return stack uses contiguous linear memory, **you cannot promote a single variable without promoting all earlier-declared variables** in that scope.

Example:

```tacit
1 -> a
2 -> b
3 -> c
promote c
```

In this case, `a`, `b`, and `c` will all be retained in the parent frame. If only `c` was needed, the compiler must be informed to re-order declarations so that `c` is declared first. This enables finer control over what is promoted and what is discarded.

### 13.3 Efficiency Consideration

Efficient promotion requires ordering variable declarations so that those most likely to be promoted are declared earliest. Since promotion rewrites BP to a lower address, memory above that is retained, but memory below it is still discarded.

The compiler should support this behavior via a directive or macro, and the return logic should honor the updated BP when deciding what to clean up on exit.

## 14. Design Philosophy Summary

The local variable system in Tacit is designed to provide a balance between the raw efficiency and predictability of stack-based computation and the improved readability and maintainability offered by named variables. Key philosophical underpinnings include:

- **Clarity and Simplicity**: Locals reduce the cognitive overhead of complex stack manipulations, making code easier to write, read, and debug.
- **Performance**: By binding locals to return stack offsets at compile time, access is direct and fast, avoiding runtime lookup costs. Stack frame management is lightweight.
- **Safety and Predictability**: Lifetimes are strictly tied to function scope, and automatic cleanup (including reference counting for heap objects) prevents memory leaks and dangling pointers without requiring a complex garbage collector.
- **No Hidden Mechanisms**: The absence of closures and runtime environment capture means that data flow and variable lifetimes are explicit and transparent. What you see is what happens.
- **Alignment with Tacit's Core**: The system integrates seamlessly with Tacit's two-stack architecture and its emphasis on compile-time resolution where possible.

This approach aims to empower developers to build robust and scalable programs in Tacit without sacrificing the language's inherent speed, directness, or control over execution.
