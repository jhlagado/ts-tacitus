# Structured Memory

## 1. Overview and Purpose

Tacit's `struct-def` system introduces a lightweight, compiler-level abstraction for symbolic memory layout. Its goal is to allow programmers to define reusable record-like structures composed of named fields, where each field corresponds to a numeric offset within a memory region (typically stack-allocated). These structures are used to define compound local variables without requiring heap allocation, garbage collection, or pointer arithmetic.

The philosophy follows the FORTH tradition: simple, explicit memory access, no closures, no type inference, no runtime reflection. Structs in Tacit are not runtime types; they are *symbolic layout definitions* used only at compile time to support efficient, pointer-relative field access.

A `struct-def` expands into a set of constants:

* The total size in slots, named `<struct-name>`.
* One constant per field, named `<struct-name>-<field-name>`, indicating the field's offset within the struct.

Example:

```tacit
struct-def { name age } person
```

Expands to:

```tacit
2 constant person$length
0 constant person-name
1 constant person-age
```

These symbols remain in the global dictionary for the entire program.

The struct instance itself is declared inside a function scope using the `struct` keyword:

```tacit
"John Smith" 23 `person struct bob
```

This compiles as:

* A local variable named `bob` holding the base address of the memory region.
* A memory region of size `person` (2 slots) allocated on the stack at compile time.
* The values `"John Smith"` and `23` are assigned to `bob + person-name` and `bob + person-age`.

Access to fields happens through a `with` expression:

```tacit
bob \`person with
  …
```

While inside the `with` scope, any reference to `name` or `age` resolves to offsets from `bob`, using `person-name` and `person-age`. These offsets are emitted directly in code generation, and all access is via `self`, the implicit receiver pointer.

This model supports:

* Reuse of struct layouts across multiple variables.
* Precise memory layout with no hidden metadata.
* Struct field access at zero runtime cost—resolved at compile time.

## 2. Struct Definition and Global Expansion

The `struct-def` word introduces a symbolic layout into the global dictionary. This layout is purely declarative and consists of two parts:

1. The total number of fields (used to determine memory size).
2. The name and position of each field (used to generate symbolic offsets).

### 2.1 Syntax

```tacit
struct-def { field1 field2 … fieldN } struct-name
```

The `struct-name` is any valid global symbol. Each field inside the braces is a plain symbol without prefixes or decorators.

### 2.2 Compilation Behavior

When the `struct-def` word is compiled, it emits a series of constant definitions into the global dictionary. These are not scoped and persist for the lifetime of the program.

Given:

```tacit
struct-def { name age } person
```

The compiler expands this into:

```tacit
2 constant person$length
0 constant person-name
1 constant person-age
```

Each field is assigned a numeric offset starting from zero. The struct name itself is bound to its size in slots.

### 2.3 Dictionary State

After the definition, the symbol table includes:

* `person` → "person"
* `person$length` → 2
* `person-name` → 0
* `person-age` → 1

These entries are marked with flags indicating they are part of a struct layout. The compiler uses these flags to distinguish struct symbols from ordinary constants or variables.

### 2.4 Rationale

This approach avoids the need for runtime type metadata. All field access is resolved through fixed offsets known at compile time. This matches the low-level memory model of Tacit and supports highly efficient code generation.

## 3. Stack Allocation of Struct Instances

Struct instances are allocated on the return stack using the `struct` keyword. This behaves like a specialized local variable declaration and reserves a contiguous block of slots determined by the size of the struct definition.

### 3.1 Syntax

```tacit
<field-values…> struct <struct-name> <var-name>
```

This is a compile-time directive. It declares a new local variable named `<var-name>` and reserves a number of stack slots equal to the value of `<struct-name>`. The fields are initialized with the values provided on the data stack in left-to-right order.

#### 3.1.1 Example

```tacit
"John Smith" 23 `person struct bob
```

This emits the following steps at compile time:

1. Reserves `2` stack slots (based on `person`).
2. Initializes them with `"John Smith"` and `23`.
3. Adds a dictionary entry: `bob` → pointer to base of allocated slots.
4. Sets a flag on `bob` marking it as a struct reference.

## 4. Field Assignment and Access

Struct fields in Tacit are accessed and manipulated using the same notation as local variables. The difference is that field symbols are defined as numeric offsets, and the context of access is governed by a `with` block, which provides the current receiver.

Within a `with` block, field symbols resolve to memory operations relative to the receiver pointer. The `with` construct specifies which struct instance (i.e. pointer) is currently being referenced, and all symbols marked as struct fields will be accessed relative to that base pointer.

### 4.1 Example Usage

```tacit
bob \`person with
  "Johnny" -> person-name
  24       -> person-age
```

This example allocates a `person` struct called `bob` with the initial values "John Smith" and `23`. Inside the `with` block, `bob` is the receiver, and `person-name` and `person-age` are treated as offsets from the receiver pointer.

Assignment syntax is identical to that used for local variables:

```tacit
value -> field-name
```

This compiles to code that stores `value` at the offset defined by `field-name`, relative to the current receiver.

Access syntax is also the same as for locals:

```tacit
field-name
```

This compiles to code that loads a value from the receiver at the offset specified by `field-name`.

## 5. Code Generation Semantics

### 5.1 Struct Definitions (`struct-def`)

The `struct-def` form introduces a symbolic layout into the global dictionary. The syntax:

```
struct-def { name age }
```

expands at compile-time into a set of global constants:

```
2 constant person$length
0 constant person-name
1 constant person-age
```

Here, `person` is the current struct type in scope (usually derived from the source filename or a wrapping construct), and `$length` is a reserved suffix for the total number of fields. The `$` prefix (or whatever convention is chosen) marks metadata not intended as a normal field.

Each field name is translated into a numeric offset constant, relative to the base pointer of a struct instance.

No runtime code is emitted—`struct-def` is purely a compile-time macro.

### 5.2 Struct Instantiation (`struct`)

The instantiation syntax:

```
"John Smith" 23 `person struct bob
```

is compiled into code that performs three things:

1. Reserves `person$length` consecutive local slots in the return stack.
2. Assigns the base address of these slots to the symbol `bob`.
3. Consumes the top `n` values from the stack (in reverse order), and stores them into the fields of `bob`, using the previously defined field offsets.

The compiler rewrites the above into something roughly equivalent to:

```
local-alloc person$length -> bob
bob \`person with
"John Smith" -> name
23 -> age
```

but this form is internal—users don’t see or write it.

### 5.3 Field Access (`with`)

The keyword `with` expects a struct pointer on top of the stack, and a struct type symbol just before it:

```
bob \`person with
```

This sets a compiler-local “receiver context,” associating the symbol `person` with the pointer `bob`. Within this context, any unqualified field access like `age` will be rewritten as:

```
bob person-age +
```

And assignment will be:

```
23 -> age
```

All field references are resolved at compile-time to numeric offsets and rewritten as pointer arithmetic.

## 6. Calling Methods on Structs

Methods in Tacit are ordinary functions that operate on a receiver pointer. A method does not belong to a struct type in the object-oriented sense—it is a separate word that expects a pointer to an instance as its first argument. The struct type itself supplies the field offsets, but does not manage dispatch.

### 6.1 Declaring a Method

To declare a method for a given struct type (e.g. `person`), you simply write a function that expects a pointer to a `person` instance on top of the stack and uses `with` to operate on the fields:

```
: increment-age
  \`person with
    age 1 + -> age
;
```

The `with` is resolved at compile-time; it maps the unqualified field names (`age`) to their proper offsets. The receiver is never stored in a global variable—it is passed explicitly on the stack.

### 6.2 Calling a Method

You call a method by pushing a pointer to a struct instance, and then invoking the method:

```
bob increment-age
```

Since `bob` is a pointer to the base of the struct in the return stack, this satisfies the method’s expectation for a receiver.

### 6.3 Field Access Inside Methods

The method has no special privileges. It simply expects a pointer and uses `with` to enable symbolic access to offsets. For example, a method to print the fields:

```
: print-person
  \`person with
    name print
    age print
;
```

### 6.4 Returning Structs from Methods

To return a struct, the method should return a pointer to it. Since all struct instances are addressable by their base, this just means returning the pointer. You may return an existing pointer, or allocate a new one if needed (on stack or elsewhere).

## 7. Nesting and Multiple Structs in Scope

Tacit permits multiple struct instances to coexist in the same function scope. These can be of the same or different types. The symbol table uses lexical scoping and temporary bindings to ensure correct resolution of fields during compilation.

### 7.1 Declaring Multiple Structs

You can declare multiple structs in the same function body:

```
"John Smith" 23 `person struct bob
"Alice Jones" 31 `person struct alice
```

This creates two local variables, `bob` and `alice`, each of which is a pointer to the start of a person-typed memory region on the return stack.

### 7.2 Accessing Struct Fields Separately

Use `with` to explicitly set which struct instance is the receiver for subsequent field accesses:

```
bob \`person with
  name print age print

alice \`person with
  name print age print
```

Each `with` applies to the block of code that follows, up to the next `with` or the end of the function. There is no nesting or scoping keyword required—`with` is a flat directive that instructs the compiler to resolve field names using the given pointer and struct type.

### 7.3 Field Resolution Behavior

When `with` is active, unqualified symbols like `name` or `age` are resolved at compile time using the struct type (e.g. `person`) and looked up as `person_name`, `person_age`, etc. These resolve to numeric offsets. The compiler then emits code to compute `receiver + offset`, replacing symbolic field access with address calculations.

### 7.4 Avoiding Collisions

Because field names are resolved using the struct type name as a prefix, you can safely reuse field names across different structs. For example:

```
struct-def { title year } book
```

Defines `book_title` and `book_year`. These won't conflict with `person_name`, even though both use `name`-like fields.

## 8. Initialization Patterns and Field Assignment

Tacit supports simple and direct struct initialization using a positional value approach, followed by field-specific assignment using symbolic references.

### 8.1 Positional Initialization During Declaration

When a struct is declared using the `struct` keyword, values can be pushed onto the stack in declaration order. These are assigned to fields by position:

```
"John Smith" 23 `person struct bob
```

This allocates `person-$length` slots on the return stack and populates the first slot with `"John Smith"` (for `name`) and the second with `23` (for `age`).

The ordering is fixed and must match the order of field declarations in the `struct-def`.

### 8.2 Manual Assignment with `with` and `->`

Fields can be manually assigned or updated after initial declaration using the `with` directive and `->` operator (as detailed in Section 4):

```
bob \`person with
  "Jane Doe" -> name
  42 -> age
```

Each `->` compiles to an address calculation using the current receiver and the named field’s offset, followed by a store operation. This syntax is uniform across structs and avoids pointer arithmetic.

### 8.3 Partial Assignment

Partial assignment is allowed at any time:

```
bob \`person with
  1 + -> age
```

Only the specified field is modified. There’s no need to reinitialize the entire struct. Fields can be updated in any order and as many times as needed within the receiver context.

### 8.4 Constants and Locals as Input

Both literals and named locals/constants can be used in struct initialization and assignment:

```
john `person struct manager
manager \`person with
  some_name -> name
  some_age  -> age
```

This supports reusable values and helps decouple field assignment from hardcoded data.

## 9. Methods and Field Access

Structs in Tacit support field access and method invocation using symbolic references relative to a receiver. This allows writing clean, compact methods without pointer arithmetic or closure environments.

### 9.1 Accessing Fields Inside Methods

A method expecting a struct pointer can access fields relative to the receiver by invoking `with` before any field operations:

```
: print-person
  with
    name print
    age print
;
```

Assuming `with` uses the top of stack as the receiver, this method expects a pointer (like `bob`) on the stack, and then prints the `name` and `age` fields using field offsets defined by the struct.

### 9.2 Field Access Is Relative

Field references like `name` and `age` compile to a load from the receiver’s memory using a known offset:

* `name` → offset `person-name`
* `age` → offset `person-age`

At compile time, these names resolve to numeric offsets, and the compiled code adds the receiver pointer to the offset to access memory.

### 9.3 Writing a Method to Mutate State

To define a method that mutates a field:

```
: birthday
  with
    age 1 + -> age
;
```

This method increments the `age` field of the receiver. It requires the receiver on the data stack. It does not return a new struct—it mutates in place.

### 9.4 Receiver-Agnostic Composition

Struct methods can be written generically and reused across multiple struct instances:

```
bob birthday
alice birthday
```

As long as the receiver is of type `person`, the same code operates on either instance. This relies on consistent field offset definitions from `struct-def`.

### 9.5 No Hidden Self or Context

Tacit does not introduce implicit `self`. The receiver is passed explicitly using `with`. This ensures code clarity and avoids surprises during method dispatch or field access. Field references always depend on the active receiver context.

## 10. Constraints and Limitations

This section documents the current design boundaries of Tacit’s struct system, with particular attention to what it does **not** support, and why.

### 10.1 No Runtime Type Introspection

Tacit does not carry runtime type tags with struct instances. All knowledge of structure layout is derived from the compile-time `struct-def`. This keeps execution fast and avoids metadata bloat, but also means:

* You cannot inspect a struct’s type or fields at runtime.
* You must use the correct `struct-def` symbol when working with `with`.

### 10.2 No Inheritance or Field Overriding

Tacit’s structs are flat. There is no concept of subtyping, extension, or method overriding. Each `struct-def` creates a sealed field layout. Code reuse is achieved through shared methods and macros, not via object hierarchy.

### 10.3 Static Layout Required

Because all struct field access is compiled to fixed offsets, the layout must be fully determined at compile time. Tacit does not allow dynamic field insertion or deletion.

### 10.4 Structs Must Be Used as Pointers

Struct local variables store compound memory blocks. Accessing them (e.g., `bob`) yields a pointer, not the value at the first field. This avoids accidental dereferencing and enables field access through offsets. All struct-aware methods assume the receiver is a pointer.

### 10.5 No Automatic Copy or Clone

Copying a struct means copying raw memory. Tacit provides no special logic for field-wise copying or deep cloning. If you want to duplicate a struct, you must do so manually, field by field, using known offsets and values.

### 10.6 No Padding or Alignment

Field offsets are tightly packed, one slot per field, with no padding for alignment. This keeps structs compact but may need adjustment if interop with foreign systems (e.g., C structs) is required.

### 10.7 Symbol Lifetime and Cleanup

Field names (like `person-name`) and the struct metadata (`person`) are stored in the global dictionary and persist for the duration of the program. Struct *instances*, on the other hand, are allocated as locals and cleaned up with the function scope. Symbol pollution can be avoided using disciplined naming or future scoping mechanisms.

## 11. Future Extensions and Enhancements

While Tacit’s current struct model is deliberately minimal, several extensions could improve flexibility, safety, and performance in the future.

### 11.1 Optional Field Types and Documentation

Tacit structs are currently untyped at the field level, using positional slot layout only. A possible extension is to allow symbolic type hints during `struct-def`, not for enforcement but for documentation and tool support. For example:

```
struct-def { name:string age:int }
```

These would be discarded by the compiler but preserved in the symbol dictionary for tooling, error reporting, and pretty-printing.

### 11.2 Struct Scoping and Cleanup

To prevent symbol leaks from struct definitions, Tacit could support temporary dictionary scopes or namespaces, allowing field offsets to be defined and discarded in a more hygienic way. This could use bracketed scoping or explicit namespaces:

```
namespace person
  struct-def { name age }
end-namespace
```

This way, `name` and `age` are only visible via `person-name`, preserving clarity in large programs.

### 11.3 Heap-Based Structs

While current struct instances are always stack-allocated via the `struct` keyword, a future `heap-struct` keyword could allow creating long-lived, heap-allocated versions:

```
"John" 32 person heap-struct p
```

Heap-allocated structs would require explicit memory management—possibly `free` or region-based deallocation—but would allow more persistent data structures like trees, graphs, and closures.

### 11.4 Field Grouping and Nested Layouts

A more advanced feature would allow nested struct fields:

```
struct-def { name address:{ street city } }
```

This would generate flattened field paths like `person-address-street` with compound offsets, and enable structured access through nested `with` scopes. While useful, this increases code complexity and may not align with Tacit’s minimal flat-memory model.

### 11.5 Method Binding and Dispatch Tables

Though Tacit supports methods acting on struct pointers, future enhancements might include method tables associated with struct types. This would allow a pseudo-OOP pattern:

```
person-methods:
  print: …
  increment-age: …
```

Such tables could be compiled statically and reused across instances, allowing fast dispatch by field index or name.

### 11.6 Struct Composition

Tacit might eventually support field reuse across structs, akin to Golang’s embedding. For instance:

```
struct-def address { street city }
struct-def person  { name age address }
```

This would inline the `address` fields into `person`, allowing shared layouts without manual duplication.
