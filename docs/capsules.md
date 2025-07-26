## 📘 Capsule Definition System – Detailed Outline

## 📘 Capsule Definition System – Section 1: **Overview (Expanded)**

### 1.1 Purpose

In TACIT, a *capsule* is the primary abstraction for structured data with associated behavior. It is conceptually similar to an object in object-oriented programming, but implemented in a closure-free, stack-oriented, function-context-aware system. Capsules unify data and behavior using a lightweight representation that fits the RPN and list-based semantics of the language.

The core idea is that:

* A capsule is a **list** (a `LIST`-tagged, fixed-length structure).
* Slot 0 contains a **dispatch function** or reference to a dispatch map (a list of symbol-function pairs).
* Slots 1..N contain **field values**, which can be scalars or lists.
* The capsule can be **executed**, i.e. called as a function, using its dispatch function.
* The capsule's **self-pointer** is set during invocation, allowing access to its fields and methods.

---

### 1.2 Capsule as a Prototype

Capsules are not allocated on the heap. Instead, capsule *definitions* produce **prototypes**: static list structures created at compile time and stored in the dictionary. These prototypes are **copied** to produce new instances.

This makes capsule instantiation efficient and deterministic:

* There is no constructor code that allocates and initializes individual fields at runtime.
* Instead, `new` or similar operations copy the prototype list to a new memory location (often on the data stack).
* The result is a new capsule instance, functionally identical to the prototype except for mutable field content.

This **copy-based instantiation model** draws inspiration from JavaScript’s prototypical inheritance model, but without actual inheritance or prototype chains. The prototype is just a fixed structure used as a template.

---

### 1.3 Dispatch Function and Method Binding

A capsule’s **dispatch mechanism** is central to its behavior:

* All capsules must have a function in slot 0. This function will be **called** when the capsule is dispatched with a symbol.
* The convention is that method dispatch occurs by pushing a symbol and the capsule onto the stack, then evaluating the capsule.
* The dispatch function uses the symbol to determine which method to call, often by scanning a `maplist` in slot 0 or using internal branching logic.
* This approach allows late-bound method dispatch without needing class metadata or inheritance hierarchies.

All method calls are relative to the capsule’s fields. This is enforced by setting the `self` register on entry to any capsule invocation. Any code compiled during method definition that refers to field symbols will resolve those symbols to **relative offsets into the capsule**, based on field declarations made during capsule construction.

---

### 1.4 No Closures, No Environments

TACIT does not use closures. All state in a capsule is **explicitly stored** as list elements in the capsule structure. The dispatch model does not depend on lexical environments or variable capture. Instead:

* Fields are resolved by **relative addressing** using the `self` pointer.
* Field offsets are computed at compile time when `field` declarations are processed.
* Method code is compiled with fixed offsets into `self`, enabling direct access at runtime.

This design eliminates the complexity and overhead of closures while still allowing behavior to be tightly coupled with state.

---

### 1.5 Summary of Advantages

* **Lightweight**: Capsules are simple fixed-size lists with symbolic dispatch.
* **Compositional**: Capsules are valid data structures and can be manipulated like any other list.
* **Efficient**: Field access uses precomputed offsets; dispatch is data-driven.
* **Portable**: Prototypes are built using only stack operations and fixed data structures—easy to implement in C or assembly.
* **Closure-free**: Capsules avoid lexical environments entirely; all data access is via self-relative addressing.

## 📘 Capsule Definition System – Section 2: **Syntax and Declaration Model (Expanded)**

### 2.1 Declaration Lifecycle

A capsule is defined using a `capsule <name>` … `end` block. This block is interpreted by the compiler as a *declaration scope*, during which it:

1. Marks the current head of the dictionary.
2. Collects all `field` and method definitions that follow.
3. Compiles those definitions in the usual forward style (as in Forth).
4. At `end`, walks the dictionary backwards from most recent to the earlier marker.
5. Builds a prototype list on the stack by aggregating methods and field values.
6. Replaces the intermediate definitions in the dictionary with a single capsule definition entry under `<name>`.

This process models object composition as **first-class dictionary construction**, not a runtime operation.

---

### 2.2 Example Syntax

```tacit
capsule person
  "John" field firstName
  "Doe"  field lastName

  { $firstName . " " . $lastName . } :fullName
  { 0 to age } :reset
end
```

#### Explanation:

* `capsule person` marks the start of a capsule declaration.
* `"John" field firstName` defines a field with default value `"John"`; it is immediately added to the prototype list.
* `{ ... } :fullName` defines a method; this is compiled and placed into a method map under the symbol `fullName`.
* `end` triggers the compilation of the prototype and installs it in the dictionary as `person`.

---

### 2.3 Syntax Primitives

| Syntax           | Meaning                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `capsule <name>` | Begin a capsule definition scope. Marks dictionary position and stores name.       |
| `field <symbol>` | Declare a field with value from stack. Stored in capsule, resolved by offset.      |
| `{ ... } :name`  | Define a method. Compiled immediately, name bound to code reference.               |
| `end`            | Terminates the capsule. Triggers collection, prototype assembly, and installation. |

---

### 2.4 Rules and Ordering

* **Field declarations must precede method declarations** if those methods refer to the fields. This allows the compiler to resolve field names to offsets.
* Field names are treated as **relative to `self`** and are valid only within the scope of a capsule.
* Field declarations shadow global names using standard Forth dictionary behavior.
* Methods may access fields directly (via symbolic name) or indirectly (via dispatch).
* All methods are compiled with visibility into the current capsule’s fields at the time of compilation.

---

### 2.5 Field Semantics

The `field` keyword does not allocate a global variable. Instead, it:

* Pops a value (scalar or list) from the stack.
* Writes it into the capsule under construction.
* Associates the name with an **offset**, which is stored in the compiler environment.
* Allows symbolic references like `$firstName` or `firstName` to be resolved during method compilation.

Each field becomes a **slot** in the prototype list, with an offset starting at 1 (since offset 0 is reserved for the dispatch function or map list).

---

### 2.6 Method Semantics

Methods are defined as **named functions**, using `{ ... } :name`. Each:

* Is compiled at the point of declaration.
* May refer to field names (resolved to offsets).
* May invoke other methods via `dispatch` or direct call if available.

When `end` is reached:

* Each method name and its code reference are paired into a **map list**: `( `name <@code> )\`.
* These pairs are collected into a list and placed in **slot 0** of the capsule prototype.

---

### 2.7 Dictionary Hygiene and Forgetting

After `end`, intermediate field and method names are no longer needed:

* The compiler may optionally `FORGET` these dictionary entries.
* The final result is a single word: `person`, which evaluates to a prototype capsule.

This avoids namespace pollution and emulates class-like encapsulation.

## 📘 Capsule Definition System – Section 3: **Prototype Construction Process (Expanded)**

### 3.1 Overview

The prototype is constructed on the **data stack** as a tagged `LIST` object during the execution of the `end` keyword. This prototype represents the *blueprint* for all future instances created by `create`, `new`, or similar allocation words.

The process comprises two main passes over the dictionary:

1. **Collect methods into a dispatch map** (slot 0 of the prototype).
2. **Collect field initial values** (slots 1 to N, one per field).

No heap allocation is used—only stack operations and the code segment.

---

### 3.2 Dictionary Walking

When `capsule <name>` is first encountered:

* The compiler stores the current dictionary head pointer as a marker.
* It records the capsule name in the compiler instance.
* All subsequent entries (fields and methods) are interpreted as part of this capsule.

At `end`, the compiler:

* Walks **backward** through the dictionary from the current head to the marker.
* Identifies `field` entries and method definitions via tags or metadata.
* Differentiates field vs. method via stored flags in the dictionary entries.
* Assembles the prototype in two passes.

This separation ensures that:

* **Field offsets** can be assigned at definition time (in declaration order).
* **Methods** can be compiled with correct visibility and symbol binding.

---

### 3.3 Pass 1: Building the Dispatch Map

For each method found in reverse:

* Extract the method name (as a symbol).
* Extract the compiled code pointer (or code block reference).
* Push both onto the stack: `` `name <@method> ``.
* Repeat until all methods are discovered.
* Wrap them in a list: `( `method1 <@code1> `method2 <@code2> ... )`.

This method map is placed at **slot 0** of the prototype. It serves as the capsule’s **dispatch function**, and will be invoked at runtime to resolve method calls.

The dispatch function may itself be a generic interpreter (e.g. a `@dispatch` function that receives a symbol), or a full map capsule of its own.

---

### 3.4 Pass 2: Assembling Field Data

After the dispatch map is complete:

* The dictionary is walked again (backwards or forwards).
* Each `field` entry provides:

  * A known offset (1-based).
  * A stored value (copied during declaration).
* The values are placed on the stack in order of their assigned offsets.

At this point, the stack contains:

```
<@dispatch-map> <field1-value> <field2-value> ... <fieldN-value>
```

* The compiler pushes the total length (N+1).
* A `LIST` tag is emitted with a backlink or similar metadata.
* This final structure is the **prototype capsule**.

---

### 3.5 Finalization and Dictionary Update

At the end of this process:

* The intermediate dictionary entries (fields and methods) may be removed using `FORGET`, or left intact.
* The compiler adds a new dictionary entry under `<name>` (e.g., `person`) that references the prototype capsule on the data stack.
* This prototype can now be used to create new instances via copying.

The entire process avoids dynamic memory allocation, closures, or runtime binding. The capsule is fully defined by the code segment and static list structure.

---

### 3.6 Summary of Prototype Layout

The prototype capsule is a list with the following layout:

```tacit
( <@dispatch-map> <field1-value> <field2-value> ... <fieldN-value> )
```

* Slot 0: function or capsule handling dispatch (map list or executable block).
* Slots 1..N: field values (scalars or flat LISTs).
* Offset 1 maps to the first field, offset 2 to the second, etc.

At runtime, this structure is duplicated to form new instances.

## 4. Field Definition and Offset Resolution

### 4.1 Purpose

Field declarations inside a capsule define instance variables. These fields are not variables in the traditional sense; they are positional slots within the capsule list. The compiler must resolve their positions during forward compilation so that method definitions can refer to them unambiguously.

### 4.2 Syntax

```tacit
<value> field <name>
```

This compiles a field named `<name>` with an initial value `<value>`. The value can be a scalar or a flat list. Nested lists are allowed but do not contribute to rank.

### 4.3 Stack Semantics

* The field initializer is already on the stack.
* The `field` word records the symbol `<name>` and assigns it a slot offset (starting at 1).
* The value is stored temporarily in the dictionary entry (not in the capsule yet).
* Field names may shadow earlier bindings using standard Forth rules.

### 4.4 Offset Assignment

* Offsets start at 1 (slot 0 is reserved for the dispatch function).
* Each `field` encountered increments the internal field counter.
* The offset is stored in the dictionary entry under the name.
* This offset is used during method compilation to resolve symbol references.

### 4.5 Resolution in Methods

* During method compilation, field references (e.g. `x`) are resolved to fixed offsets.
* The compiler must be able to determine whether a symbol is a field (relative to `self`) or global (absolute).
* Field symbols are marked with a flag in the dictionary to indicate relative addressing.

### 4.6 Value Storage

* Field values are stored during `end` processing by reading the dictionary.
* The compiler walks the dictionary to collect all `field` entries and emit the stored values to the data stack in offset order.
* Only simple types and lists are allowed as storage values. Each list must be a tagged `LIST` object with an inline length and backlink.
* The compiler does not require a LINK tag during intermediate storage; it is applied during prototype finalization.

### 4.7 Visibility Rules

* Methods can only see fields declared before them.
* Methods compiled before a field is declared will not have access to it.
* This enforces a one-pass, forward-declaration rule consistent with Forth tradition.

### 4.8 Notes

* Field declarations do not emit any code.
* They are recipes for initialization, not runtime definitions.
* Field values are effectively *constants* during capsule construction, but mutable at runtime via `set-key`.

### 4.9 Example

```tacit
42 field x
( 1 2 3 ) field y
```

This defines `x` at offset 1 and `y` at offset 2 in the prototype capsule.

## 5. Method Compilation and Symbolic Dispatch

### 5.1 Purpose

Methods define capsule behavior. Each method is compiled as a standalone function and referenced by symbol in the capsule’s dispatch table. These methods operate relative to the `self` capsule instance and may access fields through resolved offsets.

### 5.2 Syntax

```tacit
<symbol> { <code> }
```

This defines a method named `<symbol>` with the body `<code>`. The symbol becomes a key in the capsule’s dispatch map. The code block is compiled immediately as a standalone function.

### 5.3 Compilation Context

* When `capsule <name>` is active, each `{ ... }` block associated with a method symbol is compiled in the current context.
* `self` is defined as the current capsule instance.
* Field symbols (e.g. `x`, `y`) are resolved to fixed numeric offsets using the dictionary entry created by `field`.
* Method bodies are compiled into the code segment and generate function references.

### 5.4 Storage

* Method entries are stored in the dictionary as name–function pairs.
* Each method symbol is associated with its compiled code address.
* These are collected during `end` into a map list of the form:

  ```tacit
  ( `name1 <@func1> `name2 <@func2> ... )
  ```
* This map list becomes the capsule’s dispatch function, either directly or via reference.

### 5.5 Dispatch Function

* The map list is bound to slot 0 of the capsule, acting as a dispatch function.
* Dispatch occurs at runtime by placing the capsule and a symbol on the stack, then invoking the zeroth element (i.e., the dispatch function).
* The dispatch function receives the symbol and selects the corresponding method by name.
* A fallback method (e.g. `default`) may be used when no match is found.

### 5.6 Field Access in Methods

* Methods may reference fields using symbolic names resolved at compile time.
* Access is relative to `self`, and compiled as fixed-slot lookups.
* Field symbols must be declared before the method; forward references are not allowed.

### 5.7 Inter-Method Calls

* Methods may call other methods in the same capsule using symbolic dispatch (i.e., pushing a symbol and re-dispatching).
* Alternatively, direct calls may be compiled if the target method is already defined and visible during compilation.

### 5.8 Example

```tacit
init {
  `x get 1 + `x set
}

next {
  `x get
}
```

These define two methods: `init` and `next`. Each is compiled into a standalone function and bound to its symbol. They will be accessible via dispatch after the capsule is instantiated.

## 6. Finalization with `end`

### 6.1 Purpose

The `end` word finalizes a capsule definition. It completes construction of the prototype object by collecting all relevant fields and methods declared since the last `capsule <name>` marker and builds the prototype as a list. This list is stored in the dictionary under the capsule’s name and is used by `new` to instantiate fresh copies.

### 6.2 Dictionary Walking

* `capsule <name>` records the current dictionary head and the capsule name.
* `end` walks backward from the latest dictionary entry to this mark.
* Entries are scanned in reverse order and categorized as:

  * **Field declarations** (from `field`)
  * **Method definitions** (symbol + code block)

### 6.3 Dispatch Map Collection

* All method definitions are collected into a **map list**:

  ```
  ( `name1 <@func1> `name2 <@func2> ... )
  ```
* This list is constructed on the data stack.
* It is placed in slot `0` of the prototype to act as the **dispatch function**.

  * If methods are missing (e.g., `init`), `noop` may be substituted.

### 6.4 Field Collection

* After building the dispatch table, `end` collects each field’s value in declaration order.
* Each field entry stores:

  * The symbol name (for offset tracking)
  * The initialized value (a stack object, possibly a list)
  * The field’s offset within the capsule (starting from 1)
* These values are placed in subsequent slots of the prototype:

  ```
  ( <@dispatch-map> <field1> <field2> ... )
  ```

### 6.5 Prototype List Construction

* All collected values are pushed to the data stack during walking.
* Once complete:

  * A `LIST` tag is emitted
  * Length is calculated and patched (total slots including dispatch)
  * A `LINK` tag is written

### 6.6 Dictionary Cleanup

* Optionally, all intermediate entries can be `FORGET`-ten.

  * Fields and method definitions are removed
  * Only the final capsule prototype remains
* The final prototype is added under the capsule name in the dictionary:

  ```
  person → ( <@dispatch-map> <$field1> <$field2> ... )
  ```

### 6.7 Behavior Summary

* The prototype capsule is immutable and copyable.
* When `new` is called on it, the entire list is copied to create an instance.
* The dispatch function is reused across instances.
* Field values are duplicated as-is into the instance capsule.

## 7. Field Declarations (`field`)

### 7.1 Purpose

A `field` declaration introduces a named storage location in a capsule. Each field has:

* A symbolic name (e.g. `x`, `name`, `id`)
* An initial value (read from the stack at declaration time)
* An offset (relative to the `self` capsule when accessed inside methods)

Fields are not global variables. They are storage locations **relative to the capsule instance** and do not exist independently outside of it.

### 7.2 Syntax

```forth
42 field age
"John" field name
( 1 2 3 ) field scores
```

The value precedes the declaration, similar to `value` in Forth, and is consumed from the stack.

### 7.3 Semantics

At declaration time:

* The value is popped from the stack.
* The field name and value are recorded in the dictionary.
* The field is assigned a **capsule-relative offset**, starting from 1 (slot 0 is reserved for the dispatch table).
* The field’s dictionary entry includes:

  * The name
  * The offset
  * The initial value (which may be multi-slot, e.g. lists)

This allows the compiler to resolve all `$field` references statically during method compilation.

### 7.4 Field Access

During dispatch-based method execution:

* `self` is bound to the current capsule instance.
* Accessing a field like `age` or `name` will resolve to `self[offset]` using the precomputed offset.
* The `$` prefix is not needed at runtime. It is a **compile-time signal** that a symbol refers to a capsule-relative field.

### 7.5 Offset Handling

* The compiler must assign offsets at the moment `field` is compiled.
* These offsets are then:

  * Used immediately to compile field references in methods
  * Used later by `end` to extract the field values into the prototype

Fields declared after a method will **not** be visible inside that method. This enables one-pass forward-compilation without special dependency tracking.

### 7.6 Storage Model

* Only **simple values** (e.g. numbers, symbols) and **lists** are allowed as initial values.
* Lists must follow the standard `LIST` tag format:

  * Tagged with `LIST`
  * Include a slot count
  * Data elements in contiguous stack order
* Nested structures are allowed only to the extent that they follow this layout.
* No pointers, closures, or heap-allocated temporaries are permitted.

This allows the entire prototype to be built without dynamic allocation and copied as a single contiguous unit at runtime.

## 8. Method Definitions

### 8.1 Purpose

Methods define behavior associated with a capsule. A method is a named function that operates on the capsule’s internal state by accessing its fields via the `self` pointer. Methods are not special constructs; they are ordinary functions compiled during the capsule definition, but they become *methods* by inclusion in the capsule's dispatch map.

### 8.2 Syntax

```forth
: greet
  name . ." is greeting you!" ;
```

This defines a method named `greet` which accesses the field `name` (resolved via `self`) and prints a message.

### 8.3 Binding Rules

* Methods must be declared **after** the `field` declarations they intend to access.
* Methods declared **before** a field will not see that field’s offset; any references will fail to compile.
* Method names are symbols (e.g., `greet`, `reset`, `next`) and are later used in the dispatch map.

### 8.4 Compilation Semantics

* When a method is compiled:

  * Any unqualified symbols like `name` are resolved via the dictionary.
  * If a `field` named `name` exists and is marked as relative, it is compiled as an offset access via `self`.
  * Global symbols (non-relative) remain unchanged and are resolved at runtime.
* The method’s code address is stored in the dictionary under its symbol.

### 8.5 Dictionary Role

* Methods are ordinary dictionary entries during capsule compilation.
* The `end` macro walks the dictionary backward, extracting:

  * The method name
  * The compiled code reference
* These are assembled into a dispatch map list as `( `greet <@code> `next <@code> ... )`.

### 8.6 Method Accessibility

Inside a method:

* Access to other methods must occur through dispatch unless they are already visible (i.e., declared earlier).
* This encourages early binding for helper methods and late binding (symbol-based dispatch) for capsule interface methods.

### 8.7 Runtime Behavior

At runtime, method dispatch is performed by:

1. Pushing the method name (symbol) to the stack.
2. Calling the capsule (i.e., executing it).
3. The capsule looks up the symbol in the map list in slot 0.
4. The corresponding function is executed with `self` set to the capsule.

If the symbol is not found, a `default` method is called if available. Otherwise, an error is raised.

This model supports dynamic dispatch without heap allocation or complex metadata, using only code references and symbols.

## 9. Dispatch Function

### 9.1 Role and Placement

The dispatch function is always placed at slot `0` of the capsule. It governs how method symbols are resolved to function references at runtime. Every capsule must have a dispatch function, even if trivial. This is what makes a list executable as a capsule.

### 9.2 Format

There are two principal forms the dispatch function may take:

#### 9.2.1 Static Map Form

The dispatch function is a capsule or function with the structure:

```forth
( @dispatch `symbol1 <@method1> `symbol2 <@method2> ... )
```

This is a *map list*:

* Alternating symbols and function references.
* Can include a `default` handler for unmatched keys.

The function @dispatch implements lookup and branching based on a symbol placed on the stack just before the capsule is executed.

#### 9.2.2 Code-Based Dispatch

Alternatively, the dispatch function may be a custom function that does:

* `case` or `if`-based dispatching using control structures.
* Inline decision logic using comparisons or computed indices.

This allows dispatching without constructing a formal map list if only a few methods are needed.

### 9.3 Invocation Semantics

Calling a capsule involves:

```forth
symbol capsule
```

This places the method name and the capsule on the stack. Execution:

1. Evaluates the capsule: sets `self`, pushes return info.
2. Evaluates the dispatch function in slot 0.
3. Dispatch function reads the symbol, matches it, calls method.
4. Upon return, stack state is restored.

If the dispatch function is a map list, the system performs a linear or binary search to match the symbol. If found, the associated method is called.

### 9.4 Method Resolution Protocol

* The top-of-stack symbol is consumed by the dispatch function.
* A matched method is called with `self` still referring to the current capsule.
* Nested method calls inside methods must use dispatch or inline access to visible functions.

### 9.5 Efficiency Notes

* Dispatch functions can be shared between instances.
* Can be optimized later with hashing, compiled jump tables, or indexed vectors.
* Being stored by reference allows dispatch to act as a *type identity* as well.

This model supports runtime polymorphism while remaining compatible with static linking and stack-only operation.

## 10. Capsule Construction Process

### 10.1 Overview

Capsule construction proceeds in two distinct phases:

1. **Forward Compilation Phase**
   Fields and methods are compiled in source order, with field offsets assigned immediately and used by method compilers for address resolution.

2. **Final Assembly Phase (`end`)**
   Walks the dictionary backward to collect compiled entries, assemble the prototype structure on the data stack, and replace the dictionary contents with a single capsule definition.

---

### 10.2 Phase 1: Forward Compilation

#### 10.2.1 Field Declarations

* Each `field` declaration emits the value from the stack and:

  * Records the field name in the dictionary.
  * Assigns a fixed offset (starting at 1, since slot 0 is reserved for dispatch).
  * Marks the field as `relative`, meaning access is via the current `self`.

* The value is not immediately stored in memory—it becomes part of the prototype capsule being constructed.

* Fields may contain any primitive value or list, including recursively nested lists. Structures are emitted as literal objects and stored in-place in the prototype.

#### 10.2.2 Method Definitions

* Methods are defined using `: name ... ;` or equivalent, after fields.

* Each method is compiled in the presence of the current field definitions, allowing resolution of field symbols to capsule-relative offsets.

* The resulting code reference is stored in the dictionary with the method name and a method flag.

* Methods may reference fields via `$name`, or, if shadowing is used, via local symbols already known to be relative.

* Methods compiled before a field will not see that field unless dispatch-based access is used (symbolic lookup at runtime). This provides intentional control over visibility and allows forward references only via symbolic dispatch.

---

### 10.3 Phase 2: Assembly at `end`

When `end` is encountered:

1. The compiler retrieves the marker set by `capsule <name>`:

   * This defines the dictionary region to scan for fields and methods.
   * The capsule name is saved in the compiler state.

2. The dictionary is walked **in reverse**, collecting:

   * Method definitions: these are added to a **map list** (symbol, code reference pairs).
   * Field declarations: these are collected in forward order after method collection, to preserve declaration order.

3. The map list is placed in **slot 0** of the prototype.

4. The initial field values are pushed onto the stack in declaration order.

5. A `LIST` is constructed with:

   * Total length: number of fields + 1.
   * First slot: dispatch map list or reference to dispatch function.
   * Remaining slots: field initial values.

6. A `LINK` tag is applied to the constructed object on the stack.

7. The dictionary entries between `capsule` and `end` are **FORGET-ten**:

   * They are removed, except optionally the methods if reuse is desired.
   * A single capsule entry with the name `<name>` is added to the dictionary, pointing to the constructed prototype.

---

### 10.4 Result

At the end of this process, the dictionary contains:

```forth
<name> --> prototype (LIST tagged, with dispatch in slot 0)
```

The prototype is ready for use with `new`, copying, and dispatching. All method lookups and field accesses now refer to this compact, immutable structure.

### 11. Runtime Behavior and Access Patterns

#### 11.1. Field Access

All fields defined via `field` within a capsule are accessed **relative to `self`** at runtime. That is:

* When a capsule is dispatched, `self` is bound to the capsule instance.
* Field names compile into offset references, calculated at **capsule definition time**, using a static slot index into the list that comprises the capsule.
* These offsets are used by generated instructions for load (`get`) or store (`set`) relative to `self`.

Fields are immutable in position and structure once instantiated, though their values may be mutable (e.g. mutable lists or other data structures).

#### 11.2. Method Invocation

A method is invoked by:

```
<instance> <`symbol> dispatch
```

Where:

* `<instance>` is a capsule
* `<`symbol>\` is a method name (symbol)
* `dispatch` is the function stored at slot 0 of the capsule.

The dispatch function is responsible for:

* Looking up the method in its internal map list.
* Executing the method code block with `self` pointing to the capsule.

The default pattern is that the method:

* May produce side effects (e.g. mutating fields)
* Leaves the original capsule on the stack (for chaining).

This enables:

```
capsule `reset dispatch `next dispatch
```

Or with syntactic sugar (e.g. →):

```
capsule →reset →next
```

#### 11.3. Chaining and Return Conventions

Methods typically follow a chainable convention:

* Return `self` if no special output is needed.
* Return a computed result (e.g. value of a field, computed function) otherwise.

The dispatch model permits mix of both patterns.

#### 11.4. Encapsulation and Visibility

While all methods and fields are technically addressable, visibility is managed by:

* Convention (e.g. prefixing private methods with `_`)
* Absence of direct references to internal fields unless through method calls.

There is no enforced privacy; encapsulation is behavioral and idiomatic.

#### 11.5. Method-to-Method Calls

Within a method body:

* You may call other methods using a dispatch (symbol + dispatch)
* You may also reference other methods directly **if declared earlier** in the same capsule and visible during compilation.

Thus, methods compiled earlier than the current one may be called directly as code pointers.

If a method needs to call another declared later, it must dispatch by name. This enforces forward visibility limits similar to Forth.

#### 11.6. Instance Data Model

At runtime, a capsule is a list:

```
( <dispatch-func> <field1> <field2> ... )
```

The structure is opaque to the caller; access is mediated via dispatch, except in system-level inspection or debugging contexts.

Slots beyond index 0 are positional data. Slot 0 defines behavior. All interpretation of structure is delegated to the dispatch function or methods it invokes.

### 12. Dispatch Function Specification

#### 12.1. Role of the Dispatch Function

The dispatch function is stored at index 0 of every capsule. It defines the capsule’s runtime behavior for symbolic method calls. Its responsibilities:

* Accept a method name (symbol) from the data stack.
* Lookup the symbol in an internal method map.
* Invoke the associated method code block or function reference.
* Bind `self` to the current capsule instance during invocation.

The dispatch function is always called as:

```
<instance> <`symbol> dispatch
```

Where `dispatch` is the function stored at slot 0 of `<instance>`.

#### 12.2. Dispatch Map Format

The dispatch function typically contains or references a map list:

```
( @dispatch `reset <@reset-code> `next <@next-code> `default <@default-code> )
```

This list may be:

* Embedded directly in the function body
* Stored in a referenced capsule or global constant
* Constructed statically by the compiler during `capsule ... end`

The map alternates between symbols and function pointers.

#### 12.3. Lookup and Execution

The dispatch function performs a linear or optimized search:

1. Pop a symbol `s` from the stack.
2. Search the dispatch map for `s`.
3. If found, execute the associated function, with `self` bound to the capsule.
4. If not found, dispatch to the `default` entry if it exists.
5. If no match and no `default`, raise an error.

Example:

```
capsule `next dispatch
```

If `capsule` is:

```
( <@dispatch> ... )
```

Then:

* Symbol `next` is looked up
* Corresponding function is invoked with `self` set

#### 12.4. Reusability

Dispatch functions may be reused across multiple capsule instances:

* The function itself is immutable and stateless.
* The behavior depends on the capsule passed as `self`.

This enables prototypes to share a dispatch definition, reducing duplication.

#### 12.5. Comparison and Typing

The dispatch function may also serve as a capsule type identifier:

* Comparing dispatch function pointers can determine structural equivalence.
* This replaces JavaScript-style `prototype` or `constructor` tagging.

Capsules with the same dispatch are considered type-compatible in most runtime models.

#### 12.6. Default Behavior

If a capsule lacks a method:

* The dispatch should call `default` if defined.
* If no `default`, behavior is implementation-defined (e.g. error, noop).

A common convention is to provide an `init` method which is optionally called by `new`.

### 13. Capsule Instantiation with `new`

#### 13.1. Purpose

The `new` operator creates a new capsule instance by copying an existing prototype. This operation is shallow and deterministic. It is not a macro—it is executed at runtime.

#### 13.2. Invocation

The usage pattern is:

```
<prototype> new
```

Where `<prototype>` is a capsule prototype previously constructed by `capsule ... end`.

#### 13.3. Copy Semantics

The `new` operation:

1. Reads the prototype capsule from the stack.
2. Allocates a new capsule of the same size and structure.
3. Copies every slot from the prototype into the new capsule:

   * Slot 0: dispatch reference
   * Slot 1..n: field values (including LIST structures)

This operation does **not** reallocate or deep-copy nested lists or capsules inside the fields unless explicitly programmed to do so by the `init` method.

#### 13.4. Post-Creation Initialization

If the new capsule has a `init` method in its dispatch map, `new` calls it automatically:

```
<new-instance> `init dispatch
```

This allows the instance to:

* Read additional arguments from the stack
* Initialize or mutate field values
* Perform setup logic (e.g. resetting counters)

If `init` is not present, `new` performs no post-copy action beyond returning the new capsule.

#### 13.5. Type Introspection

The original dispatch reference (slot 0) is preserved, so:

* Instances created via `new` can be type-checked by comparing the dispatch pointer.
* The prototype itself can be used to manufacture identical objects.

#### 13.6. Alternative Constructors

While `new` is conventional, users may define custom constructor functions that:

* Compose `new`
* Push arguments
* Invoke `init`
* Apply validation or defaulting behavior

Example:

```
: create-person ( `first `last -- capsule )
  person new `init dispatch ;
```

This wraps `new` and provides a clearer interface.

#### 13.7. Immutability Assumption

The prototype is assumed immutable:

* Modifying a prototype after registration is undefined behavior.
* Fields in the prototype are copied by value, ensuring instance independence.

Instances are mutable, but prototype safety is critical for consistent behavior.

