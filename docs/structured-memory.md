# Structured Memory

## 1. Overview and Purpose

Tacit's `struct-def` system introduces a lightweight, compiler-level abstraction for symbolic memory layout. Its goal is to allow programmers to define reusable record-like structures composed of named fields, where each field corresponds to a numeric offset within a memory region (typically stack-allocated). These structures are used to define compound local variables without requiring heap allocation, garbage collection, or pointer arithmetic.

A `struct-def` expands into a set of constants:

* The total size in slots, named `<struct-name>$length`.
* One constant per field, named `<struct-name>-<field-name>`, indicating the field's offset within the struct.

Example:

```tacit
struct-def person { name age } 
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
"John Smith" 23 struct person bob
```

This compiles as:

* A local variable named `bob` holding the base address of the memory region.
* A memory region of size `person$length` (2 slots) allocated on the return stack at compile time.
* The values `"John Smith"` and `23` are assigned to `bob + person-name` and `bob + person-age`.

Access to fields happens through a `with` expression:

```tacit
bob with person 
  …
```

While inside the `with` scope, any reference to `name` or `age` resolves to offsets from `bob`, using `person-name` and `person-age`. These offsets are emitted directly in code generation, and all access is via the receiver pointer.

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
struct-def struct-name { field1 field2 … fieldN }
```

The `struct-name` is any valid global symbol. Each field inside the braces is a plain symbol without prefixes or decorators.

### 2.2 Compilation Behavior

As established in the Overview (Section 1), compiling a `struct-def` generates global constants for the struct's total size (e.g., `person$length`) and for each field's numeric offset (e.g., `person-name`, `person-age`), starting from zero. These constants persist for the program's lifetime.

### 2.3 Dictionary State

After the definition, the symbol table includes:

* `person$length` → 2
* `person-name` → 0
* `person-age` → 1

### 2.4 Rationale

This approach avoids the need for runtime type metadata. All field access is resolved through fixed offsets known at compile time. This matches the low-level memory model of Tacit and supports highly efficient code generation.

## 3. Stack Allocation of Struct Instances

Struct instances are allocated on the return stack using the `struct` keyword. This behaves like a specialized local variable declaration and reserves a contiguous block of slots determined by the size of the struct definition.

### 3.1 Syntax

```tacit
<field-values…> struct <struct-name> <var-name>
```

This is a compile-time directive. It reserves a number of stack slots equal to the value of `<struct-name>$length`. The fields are initialized with the values provided on the data stack in left-to-right order.

#### 3.1.1 Example

```tacit
"John Smith" 23 struct person bob
```

This emits the following steps at compile time:

1. Reserves `2` stack slots (based on `person$length`).
2. Initializes them with `"John Smith"` and `23`.
3. Adds a dictionary entry: `bob` → pointer to base of allocated slots.
4. Sets a flag on `bob` marking it as a struct reference.

## 4. Field Assignment and Access

Struct fields in Tacit are accessed and manipulated using the same notation as local variables. The difference is that field symbols are defined as numeric offsets, and the context of access is governed by a `with` block, which provides the current receiver.

Within a `with` block, field symbols resolve to memory operations relative to the receiver pointer. The `with` construct specifies which struct instance (i.e. pointer) is currently being referenced, and all symbols marked as struct fields will be accessed relative to that base pointer.

### 4.1 Example Usage

```tacit
bob with person 
  "Johnny" -> name
  24       -> age
```

This example allocates a `person` struct called `bob` with the initial values "John Smith" and `23`. Inside the `with person` block, `bob` is the receiver, and `name` and `age` are treated as offsets from the receiver pointer.

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
struct-def person { name age }
```

expands at compile-time into a set of global constants:

```
2 constant person$length
0 constant person-name
1 constant person-age
```

Here, `person` is the current struct type in scope, and `$length` is a reserved suffix for the total number of fields. The `$` prefix (or whatever convention is chosen) marks metadata not intended as a normal field.

Each field name is translated into a numeric offset constant, relative to the base pointer of a struct instance.

No runtime code is emitted—`struct-def` is purely a compile-time macro.

### 5.2 Struct Instantiation (`struct`)

The instantiation syntax:

```
"John Smith" 23 struct person bob
```

is compiled into code that performs three things:

1. Reserves `person$length` consecutive local slots in the return stack.
2. Assigns the base address of these slots to the symbol `bob`.
3. Consumes the top `person$length` values from the data stack (in reverse order), and stores them into the fields of `bob`, using the previously defined field offsets.

The compiler rewrites the above into something roughly equivalent to:

```
local-alloc person$length -> bob
bob with person 
"John Smith" -> name
23 -> age
```

but this form is internal—users don’t see or write it.

### 5.3 Field Access (`with`)

The keyword `with` expects a struct pointer on top of the data stack, and a struct type symbol just after it:

```
bob with person 
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

To declare a method for a given struct type (e.g. `person`), you simply write a function that expects a pointer to a `person` instance on top of the data stack and uses `with` to operate on the fields:

```
: increment-age
  with person 
    age 1 + -> age
;
```

The `with` is resolved at compile-time; it maps the unqualified field names (`age`) to their proper offsets. The receiver is never stored in a global variable—it is passed explicitly on the data stack.

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
  with person 
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
"John Smith" 23 struct person bob
"Alice Jones" 31 struct person alice
```

This creates two local variables, `bob` and `alice`, each of which is a pointer to the start of a person-typed memory region on the return stack.

### 7.2 Accessing Struct Fields Separately

Use `with` to explicitly set which struct instance is the receiver for subsequent field accesses:

```
bob with person 
  name print age print

alice with person 
  name print age print
```

Each `with` applies to the block of code that follows, up to the next `with` or the end of the function. There is no nesting or scoping keyword required—`with` is a flat directive that instructs the compiler to resolve field names using the given pointer and struct type.

### 7.3 Field Resolution Behavior

When `with` is active, unqualified symbols like `name` or `age` are resolved at compile time using the struct type (e.g. `person`) and looked up as `person-name`, `person-age`, etc. These resolve to numeric offsets. The compiler then emits code to compute `receiver + offset`, replacing symbolic field access with address calculations.

### 7.4 Avoiding Collisions

Because field names are resolved using the struct type name as a prefix, you can safely reuse field names across different structs. For example:

```
struct-def book { name year }
```

Defines `book-name` and `book-year`. These won't conflict with `person-name`, even though both use `name`-like fields.

## 8. Initialization Patterns and Field Assignment

Tacit supports simple and direct struct initialization using a positional value approach, followed by field-specific assignment using symbolic references.

### 8.1 Positional Initialization During Declaration

When a struct is declared using the `struct` keyword, values can be pushed onto the data stack in declaration order. These are assigned to fields by position:

```
"John Smith" 23 struct person bob
```

This allocates `person$length` slots on the return stack and populates the first slot with `"John Smith"` (for `name`) and the second with `23` (for `age`).

The ordering is fixed and must match the order of field declarations in the `struct-def`.

### 8.2 Manual Assignment with `with` and `->`

Fields can be manually assigned or updated after initial declaration using the `with` directive and `->` operator (as detailed in Section 4):

```
bob with person 
  "Jane Doe" -> name
  42 -> age
```

Each `->` compiles to an address calculation using the current receiver and the named field’s offset, followed by a store operation. This syntax is uniform across structs and avoids pointer arithmetic.

### 8.3 Partial Assignment

Partial assignment is allowed at any time:

```
bob with person 
  1 + -> age
```

Only the specified field is modified. There’s no need to reinitialize the entire struct. Fields can be updated in any order and as many times as needed within the receiver context.

### 8.4 Locals as Input

Both literals and named locals can be used in struct initialization and assignment:

```
john struct person manager
manager with person 
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
  with person
    name print
    age print
;
```

Assuming `with` uses the top of stack as the receiver, this method expects a pointer (like `bob`) on the data stack, and then prints the `name` and `age` fields using field offsets defined by the struct.

### 9.2 Field Access Is Relative

Field references like `name` and `age` compile to a load from the receiver’s memory using a known offset:

* `name` → offset `person-name`
* `age` → offset `person-age`

At compile time, these names resolve to numeric offsets, and the compiled code adds the receiver pointer to the offset to access memory.

### 9.3 Writing a Method to Mutate State

To define a method that mutates a field:

```
: birthday
  with person
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

### Appendix: Dictionary Entry Prefix Field (for Struct Field Scoping)

To support symbolic field access under `with` scopes, all dictionary entries now include an optional `prefix` field. This is a compile-time aid used to resolve two-part names like `person-name` from simple references like `name` inside a `with person` block.

* **Default behavior:** For all symbols, `prefix` is `null` unless explicitly set.
* **Struct field symbols:** When `struct-def` is processed, each field entry (e.g. `person-name`) is assigned a `prefix` equal to the struct type name (`person`). These entries remain globally visible in the dictionary.
* **Field lookup strategy:** When an unqualified symbol is encountered inside a `with`, the compiler first attempts to resolve it normally (as a local or global symbol). If that fails, and a receiver context exists, the compiler tries again using the receiver name as a `prefix`.

This avoids concatenation or string mangling during field access, and allows the dictionary to support multiple forms of scoped resolution efficiently. It also leaves the door open for future features like module-level scoping or pseudo-namespaces, all using the same `prefix` mechanism.

