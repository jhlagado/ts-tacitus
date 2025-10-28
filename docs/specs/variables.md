# Global Memory, Dictionary, and Variable Semantics in Tacit

This document summarises and formalises the discussions on Tacit's global memory model, dictionary structure, and handling of global and local variables. It reflects the current design direction and implementation strategy.

---

## 1. Global Heap and Stack Discipline

Tacit's global heap is a foundational structure that underpins the entire memory model for global values and symbol definitions. It is a dedicated, linear memory segment whose primary purpose is to hold long-lived values and metadata that must remain available throughout the lifetime of the program.

The global heap is **managed by the GP register**, which always points to the next open cell. Growth and reclamation happen through Tacit-native primitives that treat the heap as a disciplined stack:

- `gpush` copies the value at TOS onto the heap (materialising LIST payloads as needed) and does not return a value (stack-only effect: consumes TOS).
- `gpop` rewinds the heap by a single push span (1 for simple values, `N+1` for `LIST:N`) and does not interact with the data stack.
- `gpeek` materialises the current heap top onto the data stack (pushes simple value or `LIST` payload+header) without altering `GP`.
- `gmark` pushes the current `GP` (cell index) onto the data stack so callers can checkpoint the heap state.
- `gsweep` consumes a mark (`GP` cell index) and resets `vm.GP` to that value, discarding everything above the checkpoint.

### Heap as a Stack-Like Structure

Although the heap is not a stack in the traditional sense, it behaves like one: pushes happen through `gpush`, the newest entry can be reclaimed immediately with `gpop`, and bulk rewinds are handled by `gsweep` against prior marks. This discipline ensures stable references for heap-resident data while still allowing scoped groups of pushes to be discarded explicitly.

### Global Availability and Lifetime

References to items in the global heap are assumed to be **global and persistent**. When a value is stored in the dictionary (such as a global variable or a function definition), the dictionary entry typically includes the `DATA_REF` handle returned by `gpush`. Once created, such a reference remains valid for the **entire lifetime of the program** unless a `gsweep` deliberately rewinds past that allocation.

### Contents of the Global Heap

The global heap may contain:

- **Simple values**: such as numbers. These may be stored directly when needed, although usually simple values are stored inline in dictionary entries or frames.

- **Compound types**:
  - **Lists**: the core compound type in Tacit. Lists are contiguous blocks of elements stored in reverse order, with a header at the top and payload beneath.
  - **Buffers**: mutable list-like structures that allow in-place update and growth patterns. Buffers are implemented on top of lists with additional behavioral conventions.
  - **Dictionary records**: including both function entries and global variables. These records are stored in the heap and linked via backward pointers to form the live dictionary.

In all cases, the heap preserves structure and reference integrity. Once a compound structure is pushed, its layout is stable. This enables references to be freely shared across the runtime, embedded in capsules, or accessed via named dictionary entries. Scoped heap usage (e.g., temporary data created during compilation) should capture a mark before performing `gpush` and invoke `gsweep` afterward to release their footprint.

In summary, the heap is **stack-like**: it grows with each `gpush`, can drop the newest item with `gpop`, and can rewind to any saved mark. It provides the backbone of Tacit's global memory system and hosts all persistent values that must be available across function boundaries, time, and scopes.

---

---

## Chapter 2 — Dictionary Structure and Heap Integration

The Tacit dictionary is a globally persistent structure implemented using ordinary list values in the global heap. It acts as the primary symbol table, allowing symbolic resolution of functions, global variables, constants, and other named values. Every entry in the dictionary is a first-class Tacit list, indistinguishable in structure from any other compound value. This allows the dictionary to fully participate in the language’s type and memory model without special treatment.

---

### 2.1 Purpose and Design

All global symbols in Tacit are associated with dictionary entries. These entries are created as standard list structures in the global heap and are linked together via backward pointers to form a singly-linked list.

This design guarantees:

- Structural uniformity: dictionary entries are real lists, not synthetic records.
- Compatibility: entries obey all stack layout and mutation rules.
- Safety: references to dictionary entries are stable for the entire program lifetime.

There is no separate dictionary segment, registry, or namespace object. The dictionary _is_ the chain of lists built into the global heap.

---

### 2.2 Dictionary Entry Format and Layout

Each dictionary entry is a **list with three payload cells** and a `LIST:3` header, for a total of four contiguous slots in memory. As with all Tacit lists, the header is placed at the top of the stack (TOS), and the payload grows downward. This means **element 0** is immediately beneath the header, and **element 2** is the deepest (first) field on the stack.

The memory layout is as follows:

```
[ payload  name  prev  LIST:3 ]   ← TOS
  ↑       ↑     ↑      ↑
  e2      e1    e0   header
```

The fields are:

| Field     | Description                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIST:3`  | Header marking this as a 3-element list.                                                                                                       |
| `prev`    | A reference to the previous dictionary entry (or `nil` for the root).                                                                          |
| `name`    | A pointer to the interned symbol name. Sign bit encodes the `HIDDEN` flag.                                                                     |
| `payload` | The associated value (e.g., function code, capsule, literal, global ref). Sign bit encodes the `IMMEDIATE` flag for `CODE`/`BUILTIN` payloads. |

Meta flags now live in the **sign bits** of existing tagged values instead of a dedicated list slot:

- `IMMEDIATE` is stored in the sign bit of `Tag.CODE` and `Tag.BUILTIN` payloads.
- `HIDDEN` is stored in the sign bit of the `Tag.STRING` name.

All helpers that read dictionary entries MUST mask these sign bits before dereferencing the underlying address or string offset.

---

### 2.3 Allocation and Heap Integration

Each new dictionary entry is allocated using the global bump allocator, like any other heap compound. The steps are:

1. Push the payload cells in reverse order: `payload`, `name`, `prev`.
2. Emit the `LIST:3` header on top.
3. Update `DICT_HEAD` to point to the new list.

This results in a complete dictionary entry at the top of the global heap. The `prev` field links it to the previous head, maintaining the chain.

There is **no mutation or removal** of entries. Shadowing is accomplished by adding new entries. The old entry remains in the chain and is simply bypassed by name resolution.

---

### 2.4 Traversal and Lookup

Symbol resolution operates by walking the dictionary list backwards from `DICT_HEAD`. For each entry:

1. Compare the `name` field (element 1) to the symbol being resolved.
2. If matched, return the full entry or its payload.
3. If not matched, follow `prev` (element 0) to the next entry.
4. Stop when the symbol is found or `prev` is `nil`.

This process is linear but well-structured, and always resolves the most recently defined entry. Shadowed entries are not deleted but simply skipped.

---

### 2.5 Reference Stability

Because dictionary entries are ordinary lists in the global heap:

- Their memory layout is fixed and immutable after allocation.
- They are safe to reference from anywhere, including capsules and deferred code.
- Payloads that point to dictionary entries remain valid for the duration of the program.
- No dictionary entry is ever moved or reallocated once created.

This makes the dictionary a stable symbolic backbone for the language. Its entries can be introspected, duplicated, embedded, or linked without additional indirection or lookup.

---

### 2.6 Summary

- Dictionary entries are standard Tacit lists of 3 payload slots and a `LIST:3` header.
- Field order is: `[ payload  name  prev  LIST:3 ]`, with `payload` deepest and `LIST:3` at TOS.
- Symbol resolution proceeds from `DICT_HEAD` backward via the `prev` field.
- Entries are immutable, append-only, and shadowed rather than replaced.
- The dictionary is structurally identical to other list values, enabling full reuse of list semantics and memory discipline.

### 2.7 Marks, Reverts, and Transient Entries

- `dictHead` always points at the most recent dictionary entry; `NIL` means the dictionary is empty. Both `dictHead` and the heap bump pointer `GP` are part of the VM state.
- `gmark`/`gsweep` expose that state to Tacit code. Any component emitting transient entries (e.g., the parser while defining locals) must snapshot **both** `dictHead` and `GP` and restore them together so heap allocations and links remain in lockstep.
- Parser-driven mark/revert flows continue to call `SymbolTable.mark()` / `revert()`. Implementations must pair those calls with `gmark`/`gsweep` (or equivalent VM helpers) so that locals inserted into the dictionary during compilation disappear cleanly when the definition ends.

## Chapter 3 — Name Symbols and Interned Strings

Tacit uses interned strings to ensure all named entities in the program—such as functions, variables, and keywords—are uniquely identified by pointer equality. Every symbolic name is a tagged `STRING` value whose payload is an offset into the global string digest. This guarantees that two names with the same spelling resolve to the same address, allowing fast identity checks and reliable dictionary lookups.

### 3.1 Symbol Tag and Format

All names are encoded using the `STRING` tag. This is a NaN-boxed 32-bit value with a 6-bit tag (`Tag.STRING = 4`) and a 16-bit offset pointing into the global string segment. The content is immutable. For example:

```
'count      →  STRING:173     ; Offset 173 in string segment
"count"     →  STRING:173     ; Equivalent long-form
```

There is no distinct `SYMBOL` type at runtime—names are just tagged strings. The interning process ensures that duplicates are eliminated during parsing or loading.

### 3.2 Uses of Name Symbols

Name symbols appear in multiple contexts:

- **Dictionary entries**: Every global function or variable is keyed by a `STRING` tag. The `name` field of a dictionary record holds this interned reference.
- **Local variables**: During parsing, function-scoped local variables are assigned name symbols. These exist only during compilation and are associated with `Tag.LOCAL` to emit the appropriate `VarRef` opcodes. They do not persist into the runtime data stack.
- **Global variables**: Global values are registered by name and resolved by lookup into the global dictionary.
- **Immediate words**: Keywords, control structures, and compile-time macros are all encoded as `Tag.BUILTIN` or `Tag.CODE` entries and triggered immediately during parsing. Their names are resolved in the same way as regular symbols, using interning.

### 3.3 Parsing and Interning

All names in Tacit source code are interned at parse time. Both `'name` (short form) and `"name"` (quoted form) result in the same interned string reference. During parsing:

- If the name is already present in the string digest, its offset is reused.
- Otherwise, it is added to the digest and assigned a new offset.

Interned strings are canonical: equality is determined by pointer comparison, not string contents.

### 3.4 Dispatch and Lookup

At runtime, all dictionary lookups use the interned `STRING` tag to locate matching entries by name. This ensures consistency across global declarations, invocations, and reference resolution.

For example:

```tacit
'myFunc       → STRING:121
@myFunc       → CODE:4096        ; Resolved from dictionary via name
```

### 3.5 Summary

Tacit names are tagged string references into a global, immutable digest. They serve as canonical symbols throughout the language and support all name-based features—functions, globals, locals, and macros—without distinction in runtime representation. Their stable identity enables efficient lookup, dispatch, and structural referencing.

## Chapter 4 — Dictionary Lookup and Shadowing

Tacit stores all top-level definitions—functions, global variables, constants, immediate words—in a global dictionary implemented as a reverse-linked list of heap-allocated records. Each record is a uniform 4-slot list containing a `LIST:3` header and three payload elements.

### 4.1 Lookup Semantics

Dictionary lookup proceeds linearly, starting from the most recent entry. At each step:

- The `name` field is compared by pointer (interned `STRING` equality).
- If matched, the entry is selected.
- Otherwise, traversal continues via the `prev` field.
- If `prev` is `nil`, the lookup fails.

Because dictionary entries are immutable after construction, lookup is deterministic and thread-safe under single-VM semantics.

### 4.2 Shadowing and Redefinition

Tacit allows multiple definitions of the same name. Each new definition simply prepends a new entry to the dictionary:

- The most recent entry for a name shadows any previous definitions.
- Lookup always returns the first match by linear traversal.

Older entries are retained and remain accessible through references or introspection, but are not used by current lookups.

### 4.3 Heap Residency and Reference Safety

All dictionary entries are persistent heap values. They:

- Use a uniform list-based layout, compatible with standard list operations.
- Are immutable once constructed.
- Can be safely referenced from capsules, bytecode, and closures.

The dictionary root is a global variable pointing to the most recent entry.

### 4.4 Entry Construction

New entries are constructed by composing the fields in reverse order on the stack, then appending a `LIST:3` header. Fields include:

- Interned `STRING` name (sign bit = `HIDDEN`).
- `payload` (e.g., bytecode address, capsule, reference — sign bit = `IMMEDIATE` for `CODE`/`BUILTIN`).
- Pointer to the `prev` dictionary entry.

This produces a standard list value, fully compatible with slot-based access and list traversal.

### 4.5 Lookup Scope and Entry Kinds

The dictionary stores all named, top-level definitions:

- Builtins (with `BUILTIN` payloads).
- Functions (with `CODE` payloads).
- Global variables (with simple values or `REF` payloads).
- Transient names for locals (used during compilation only).

All share the same entry format and resolution mechanism. Dispatch behavior is governed by the payload tag plus the sign-bit metadata (`IMMEDIATE` or `HIDDEN`) carried by the value itself.

### 4.6 Summary

Tacit’s dictionary is a linear, list-based structure enabling name resolution, shadowing, and safe reference. Each entry links to its predecessor, and lookup inspects `name` fields for identity match. There is no deletion or mutation: shadowing is resolved at traversal time. Hidden entries simply set the name’s sign bit and remain in the chain for tooling that chooses to surface them. All top-level declarations enter this structure, which forms the canonical symbol table for the runtime and compiler alike.

## Chapter 5 — Entry Resolution and Dispatch Semantics

Once a name has been resolved to a dictionary entry, Tacit determines its behavior by inspecting the **payload tag** and any associated **sign-bit metadata**. The dictionary itself is neutral: all logic depends on the resolved entry. This chapter outlines the runtime behavior of each payload tag, and how entries behave during both **compilation** and **execution**.

### 5.1 Payload Tag Determines Behavior

Each dictionary entry contains a `payload` value, which may be any valid Tacit value. Its **tag** determines what happens when the name is used. Typical payload tags include:

- `CODE`: Executable function (defined in Tacit source or precompiled).
- `BUILTIN`: Builtin function implemented in the VM.
- `REF`: Global variable reference.
- Any other value (e.g., `LIST`, `INT`, `STRING`, etc.): a literal.

### 5.2 Execution at Runtime

When a name is invoked at runtime (i.e. not during parsing), the following applies:

- If the payload tag is `CODE` or `BUILTIN`, the function is **called immediately**.
- If the payload tag is `REF`, the reference is **resolved and loaded**, returning the underlying value.
- Otherwise, the payload is **pushed as a literal**.

All cases are resolved by a single runtime lookup. Tacit performs **no dynamic name resolution** during execution: all names are resolved to entries at compile-time or earlier.

### 5.3 Parsing-Time Behavior and Immediate Flag

Tacit allows certain dictionary entries to execute at **parse time** via the `IMMEDIATE` sign bit. These entries:

- Are typically used for **macros**, **control structures**, and **special forms**.
- Are normal `BUILTIN` or `CODE` entries whose sign bit is set.
- Execute immediately during parsing, consuming tokens and emitting bytecode or modifying state.

The parser checks the `IMMEDIATE` flag as soon as a name is resolved. If the bit is present, the associated function is **invoked immediately**, rather than emitted as a runtime call. This supports meta-level control without special treatment in the parser.

Immediate behavior is orthogonal to the payload tag. A `CODE` or `BUILTIN` can be either immediate or not, depending on the flag.

### 5.4 Literal Behavior and Fallback

If the resolved entry has a payload tag that is not executable (`INT`, `LIST`, etc.), the name simply pushes its value at runtime. No call or indirection occurs.

This enables use of named constants, capsule values, embedded structures, and more. There is no restriction on the kind of value that can be stored in the dictionary, provided the consumer knows how to use it.

### 5.5 Summary

- Dictionary entries contain a `payload` whose **tag determines behavior**.
- `CODE` and `BUILTIN` are executable; `REF` is dereferenced; other values are literals.
- The `IMMEDIATE` sign bit modifies **parsing behavior** only, not runtime execution.
- Name resolution is **final**: there is no further lookup after retrieving an entry.
- This design allows for uniform storage and flexible dispatch without runtime ambiguity.

## Chapter 6 — Local Variables and Function Scope

### 6.1 Overview

Local variables in Tacit are declared exclusively during a **function definition**. They are scoped to the defining function and allocated into that function’s stack frame. These variables are not accessible outside the function and are resolved statically at definition time.

### 6.2 Rules for Declaration

Only **local variables** may be introduced during a function definition. This is enforced by the compiler:

- Declaring another **function** inside a function is illegal.
- Declaring a **global variable** inside a function is also illegal.
- Any such attempt results in a compile-time error.

This rule ensures that functions remain self-contained and statically analyzable.

### 6.3 Allocation and Symbol Resolution

When a local variable is declared, its name is registered in the dictionary with a special **transient entry** pointing to its slot index. These names are not global—they are visible only while the function is being defined.

The variable's value is stored in a slot within the function’s return-stack frame. The index of that slot is determined at the point of declaration and remains fixed.

During function definition, any reference to the local variable name is resolved to its corresponding slot.

### 6.4 Cleanup

When the function definition completes (i.e., when the closing `;` is encountered), all transient local variable entries are removed from the dictionary. This prevents any name leakage or interference with subsequent definitions.

### 6.5 Runtime Behavior

At runtime, a function executes with its return stack frame intact. Local variables are accessed directly by slot index. Their symbolic names do not exist at runtime; only the precomputed offsets are used for loading or storing values.

## Chapter 7 — Global Variables

### 7.1 Declaration and Persistence

Global variables in Tacit are declared at the top-level scope using the `global` keyword. Unlike local variables, they are not confined to a function’s scope and instead persist for the entire lifetime of the program.

### 7.2 Memory Model and Dictionary Integration

Global variables are represented in the dictionary as entries that map a symbol name directly to a payload. There’s no concept of slot tables or stack frames for globals. Instead, their payload can be a simple value, like an number or a reference to a compound value stored in the global heap.

### 7.3 Initialization and Population

Global variables are added to the dictionary during the definition phase. However, their actual initialization happens after the compilation is complete. This means that while the dictionary entry for the global variable is created early, the value it holds is only set once the compiled code runs.

### 7.4 Handling Compound Values

When a global variable is initialized with a compound value, such as a list, that compound is copied into the global heap. The dictionary entry then holds a reference to that heap location. This ensures that the global variable’s value is maintained consistently and can be accessed efficiently.

### 7.5 Access and Mutability

Once a global variable is populated, it can be read and written just like any other data. The payload in the dictionary entry points directly to the value in global memory. This allows for straightforward access and updates, and the variable’s value is stable throughout the program’s lifetime.

### 7.6 Summary

Global variables are a persistent, top-level concept in Tacit. They are declared in the dictionary and initialized after compilation, with their values residing either as simple constants or as references to the global heap. This model ensures that global variables are always accessible and maintain their state for the entire program duration.

## Chapter 8 — Compilation and Runtime Behavior of Global Variables

### 8.1 Declaration and Initialization

When a global variable is declared using the `global` keyword, a dictionary entry is created to map the variable’s name to its payload. However, the actual content of the variable is not set at compile time. Instead, the global variable is initialized at runtime when the program executes.

### 8.2 Handling Simple Values

For simple values, such as numbers, the runtime process is straightforward. When the program runs, the data stack holds the simple value, and the global variable’s payload is directly copied from the data stack into the dictionary entry. This means that the value is immediately available and stable.

### 8.3 Handling Compound Values

For compound values, like lists, the process is a bit more involved. At runtime, the compound value is first popped off the data stack and then allocated on the global heap. This ensures that the global variable’s payload references a stable memory location in the global heap rather than just holding a copy of the data.

### 8.4 Reference Management

When a global variable holds a compound value, the dictionary entry stores a reference to the global heap location. This ensures that the global variable always points to the correct, up-to-date data in the global heap.

### 8.5 Summary

In summary, global variables in Tacit are defined at compile time but fully initialized at runtime. Simple values are directly copied, while compound values are allocated in the global heap and referenced accordingly. This approach ensures that global variables remain consistent and accessible throughout the program’s lifetime.

To wrap up this document cleanly, you should end with a **brief concluding chapter** that reinforces the core principles, highlights the consistency and simplicity of the model, and leaves room for future extensions without committing to them. This chapter should **not** introduce new content or features—just consolidate what's already been established.

Here's a suitable final section:

---

## Chapter 9 — Conclusion

Tacit’s global memory model is built on a small set of orthogonal, consistent principles:

- **The heap is linear and monotonic**, enabling persistent global structures without garbage collection.
- **The dictionary is a uniform linked-list-based structure**, where every entry—function, variable, or immediate—is resolved the same way.
- **Name resolution is stateless and deterministic**, relying on interned strings and linear traversal with shadowing.
- **Local variables are transient and lexical**, defined only during function creation and resolved to static slots.
- **Global variables are persistent**, declared into the dictionary and populated at runtime.

This design provides a robust, transparent foundation for symbol resolution, memory safety, and runtime behavior. It prioritizes clarity over cleverness, making the system predictable and introspectable without sacrificing power.

Future extensions—such as hash-based lookup, pruning, or VM isolation—can be layered onto this base without disturbing its core integrity.
