# TACIT Capsules Specification

## Overview

TACIT capsules are structured data objects with associated behavior, built on top of the list infrastructure. They provide object-like encapsulation while remaining compatible with TACI### Maplist Integration

Dispatch tables use maplist conventions:
- Support `default` key for fallback methods
- Can use optimized search algorithms
- Compatible with maplist introspection tools

## Related Specifications

- `docs/specs/lists.md` - Foundational list mecha### Dispatch Function

* Dispatch occurs at runtime by placing the capsule and a symbol on the stack, then calling `dispatch`.
* The dispatch operation accesses the maplist in slot 0 directly and searches for the symbol.
* A fallback method (e.g. `default`) may be used when no match is found.- `docs/specs/maplists.md` - Key-value dispatch tables
- `docs/specs/stack-operations.md` - Stack manipulation rulesd, closure-free design.

## Core Concepts

### Capsule Structure

A capsule is a **list** with a specific layout:
- **Slot 0**: Dispatch maplist (method name → code reference pairs)
- **Slots 1..N**: Field values (scalars or compound values)

```tacit
\ Capsule layout in memory
( ( `method1 @method1 `method2 @method2 `method3 @method3 ) field1-value field2-value ... fieldN-value )
```

### Prototype-Based Instantiation

Capsules use a **copy-based instantiation model**:
- Capsule definitions create immutable prototypes at compile time
- Instances are created by copying the entire prototype structure
- No inheritance chains or dynamic allocation required

### Field Access Semantics

Fields behave like Forth's VALUE variables:
- **Reading**: Field name alone returns the field's value
- **Writing**: Use `->` operator to assign new values
- **Compile-time resolution**: Field names resolve to fixed offsets during method compilation

## Basic Syntax

### Capsule Definition

```tacit
capsule <name>
  <field-declarations>
  <method-definitions>
end
```

### Field Declaration

```tacit
<initial-value> field <field-name>
```

### Method Definition

```tacit
: <method-name> <method-body> ;
```

### Field Access

```tacit
field-name         \ Read field value
value -> field-name    \ Write field value
```

## Complete Example

```tacit
capsule person
  "John" field firstName
  "Doe"  field lastName
  0      field viewCount

  : fullName firstName " " lastName concat concat ;
  : greet fullName "Hello, " swap concat ;
  : incrementViews viewCount 1 + -> viewCount ;
  : reset 0 -> viewCount ;
end
```

## Instantiation and Usage

```tacit
\ Create new instance
person new

\ Method calls using 'with' context
person new with
  $greet                  \ Returns "Hello, John Doe"
  $incrementViews
  $viewCount              \ Returns 1
end

\ Alternative: explicit dispatch calls within 'with' block
person new with
  `greet dispatch         \ Returns "Hello, John Doe"
  `incrementViews dispatch
  `viewCount dispatch     \ Returns 1
end

\ Methods with arguments
person new with
  "Dr." $setTitle         \ Pass argument to setTitle method
  $greet                  \ Returns "Hello, Dr. John Doe"
end
```

## Compilation Process

### Phase 1: Declaration Collection

When `capsule <name>` is encountered:
1. Mark current dictionary position
2. Enter capsule compilation mode
3. Collect field and method definitions

### Phase 2: Field Processing

Each `field` declaration:
1. Assigns sequential slot offset (starting at 1)
2. Records field name and offset in compilation context
3. Stores initial value for prototype construction

### Phase 3: Method Compilation

Each method definition:
1. Compiles as standard TACIT function
2. Resolves field references to fixed offsets
3. Creates code reference for dispatch table

### Phase 4: Prototype Assembly

At `end`:
1. Build dispatch maplist from collected methods
2. Construct prototype list: `( ( `method1 @method1 `method2 @method2 ) field1 field2 ... )`
3. Replace dictionary entries with single capsule definition
4. Clean up intermediate definitions

## Field Access Implementation

### Compilation-Time Resolution

During method compilation:
```tacit
firstName    \ Compiles to: self 1 get
lastName     \ Compiles to: self 2 get
viewCount    \ Compiles to: self 3 get
```

### Assignment Resolution

```tacit
100 -> viewCount    \ Compiles to: 100 self 3 set
```

## Method Dispatch

### Traditional Dispatch Protocol (Problematic)

```tacit
instance `method-name dispatch
```

This approach has several issues:
- Requires `dup` for multiple method calls
- Method arguments interfere with receiver object
- Verbose and error-prone for method chaining

### Improved: `with` Context Protocol

```tacit
instance with
  $method-name
  arg1 arg2 $method-with-args
  $another-method
end
```

The `with` block establishes the receiver context, allowing:
- **Clean method chaining**: No `dup` required
- **Argument separation**: Arguments don't interfere with receiver
- **Concise syntax**: `$` prefix for method calls
- **Explicit scope**: Clear begin/end boundaries

### `with` Block Implementation

1. `with` saves the receiver object in a context register
2. Within the block, `$method-name` resolves to `context `method-name dispatch`
3. Method arguments are consumed normally from the stack
4. `end` clears the context register
5. The receiver remains on the stack after the block

### Alternative: Explicit Dispatch in `with` Block

```tacit
instance with
  `method-name dispatch
  arg1 arg2 `method-with-args dispatch
  `another-method dispatch
end
```

This provides the same context benefits while using explicit `dispatch` calls.

### Default Method Convention

Following maplist conventions, capsules can include a `default` method:

```tacit
capsule example
  42 field value
  
  : getValue value ;
  : default "Unknown method" ;
end

\ Usage with 'with' block
instance with
  $getValue     \ Returns 42
  $unknown      \ Returns "Unknown method"
end
```

## Advanced Features

### Inter-Method Calls

Methods can call other methods using the same dispatch mechanism:
```tacit
capsule calculator
  0 field total
  
  : add total + -> total ;
  : addTwice dup self swap $add self swap $add ;    \ Calls add twice using $method syntax
  : addDouble 2 * self swap $add ;                   \ Double then add
end

\ Usage
calc with
  5 $add        \ total = 5
  3 $addTwice   \ total = 11 (5 + 3 + 3)
  2 $addDouble  \ total = 15 (11 + 4)
end
```

### Method Chaining with Arguments

The `with` block enables clean method chaining with arguments:

```tacit
person with
  "Dr." $setTitle
  "Smith" $setLastName  
  $incrementViews
  $greet                \ Returns "Hello, Dr. Smith"
end
```

### Nested `with` Blocks

`with` blocks can be nested for working with multiple objects:

```tacit
person1 with
  $greet
  person2 with
    $greet
  end
  $incrementViews
end
```

## Syntax Design Considerations

### `$` Prefix vs Explicit Dispatch

Two syntax options are available within `with` blocks:

**Option 1: `$` Prefix (Recommended)**
```tacit
instance with
  $method1
  arg1 arg2 $method2
  $method3
end
```

**Option 2: Explicit Dispatch**
```tacit
instance with
  `method1 dispatch
  arg1 arg2 `method2 dispatch
  `method3 dispatch  
end
```

### Advantages of `$` Prefix

1. **Concise**: Shorter syntax reduces visual noise
2. **Clear intent**: `$` clearly indicates method dispatch within context
3. **Argument clarity**: Arguments precede method name naturally
4. **Familiar**: Similar to shell variable expansion or template languages

### Implementation Notes

- `$methodName` is syntactic sugar for `` context `methodName dispatch``
- The context register holds the receiver object during the `with` block
- `with` and `end` are compile-time constructs that manage context scope
- Error handling: Unknown methods can fall back to `default` method

### Context Register Behavior

- **Scope**: Context is local to the `with` block
- **Nesting**: Nested `with` blocks maintain separate contexts
- **Cleanup**: Context is cleared automatically at `end`
- **Access**: Methods can access the context receiver via `self`

### Field Visibility Rules

- Fields must be declared before methods that reference them
- Methods can only access fields declared earlier
- Forward references require symbolic dispatch

### Structural vs Element Mutability

Following list mutability semantics:
- **Fields can be mutated** using `->` (efficient)
- **Structure is immutable** (adding/removing fields requires new capsule)
- **Compound field values** follow their own mutability rules

## Performance Characteristics

### Field Access
- **Read**: O(1) with compile-time offset resolution
- **Write**: O(1) direct slot assignment

### Method Dispatch
- **Linear search**: O(n/2) through dispatch maplist
- **Can be optimized** with sorted maplists or hash-based dispatch

### Instantiation
- **Copy operation**: O(n) where n is number of fields
- **No allocation overhead**: Direct stack copying

## Integration with TACIT Systems

### List Compatibility

Capsules are lists and support all list operations:
```tacit
capsule 2 get        \ Access field by index
capsule length       \ Get total slots (fields + 1)
```

### Stack Operations

Capsules work with standard stack operations:
```tacit
capsule dup          \ Duplicate capsule
capsule swap         \ Standard stack manipulation
```

### Maplist Integration

Dispatch tables use maplist conventions:
- Support `default` key for fallback methods
- Can use optimized search algorithms
- Compatible with maplist introspection tools

## Implementation Strategy

### Phase 1: Basic Dispatch (Current)

Implement traditional dispatch first:
```tacit
instance `method dispatch
```

### Phase 2: `with` Block Foundation  

Add `with` block syntax with explicit dispatch:
```tacit
instance with
  `method1 dispatch
  arg1 arg2 `method2 dispatch
end
```

### Phase 3: `$` Prefix Syntax

Add syntactic sugar for method calls:
```tacit
instance with
  $method1
  arg1 arg2 $method2
end
```

### Design Rationale

The `with` mechanism solves fundamental problems with stack-based OOP:

1. **Argument Separation**: Method arguments don't interfere with receiver
2. **Context Clarity**: Explicit scope for method dispatch
3. **Ergonomics**: Multiple method calls become natural
4. **Stack Hygiene**: No proliferation of `dup` operations

This approach maintains TACIT's stack-based nature while providing object-oriented convenience.

## Related Specifications

- `docs/specs/lists.md` - Foundational list mechanics
- `docs/specs/maplists.md` - Key-value dispatch tables
- `docs/specs/stack-operations.md` - Stack manipulation rules

---

## Appendix: Detailed Implementation Notes

This **copy-based instantiation model** draws inspiration from JavaScript’s prototypical inheritance model, but without actual inheritance or prototype chains. The prototype is just a fixed structure used as a template.

### 1.3 Dispatch Function and Method Binding

A capsule’s **dispatch mechanism** is central to its behavior:

* All capsules must have a **dispatch maplist** in slot 0. This enables method dispatch by symbol lookup.
* The convention is that method dispatch occurs by placing a symbol and the capsule on the stack, then calling `dispatch`.
* The dispatch function uses the symbol to determine which method to call by searching the maplist in slot 0.
* This approach enables late-bound method dispatch without requiring class metadata or inheritance hierarchies.

All method calls are relative to the capsule’s fields. This is enforced by setting the `self` register on entry to any capsule invocation. Any code compiled during method definition that refers to field symbols will resolve those symbols to **relative offsets into the capsule**, based on field declarations made during capsule construction.

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

  : fullName ( -- str ) firstName " " lastName concat concat ;
  : reset ( -- ) 0 age set ;
end
```

#### Explanation:

* `capsule person` marks the start of a capsule declaration.
* `"John" field firstName` defines a field with default value `"John"`; it is stored in slot 1 of the prototype.
* `"Doe" field lastName` defines a field with default value `"Doe"`; it is stored in slot 2 of the prototype.
* `: fullName ...` defines a method; this is compiled and placed into a method map under the symbol `fullName`.
* `: reset ...` defines a method that sets the age field to 0.
* `end` triggers the compilation of the prototype and installs it in the dictionary as `person`.

---

### 2.3 Syntax Primitives

| Syntax                   | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `capsule <name>`         | Begin a capsule definition scope. Marks dictionary position and stores name.       |
| `<value> field <symbol>` | Declare a field with initial value from stack. Stored by offset in capsule.      |
| `: name ... ;`           | Define a method as a conventional TACIT function with field access.               |
| `end`                    | Terminates the capsule. Triggers collection, prototype assembly, and installation. |

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
* Allows symbolic references like `firstName` to be resolved during method compilation.

Each field becomes a **slot** in the prototype list, with an offset starting at 1 (since offset 0 is reserved for the dispatch function or map list).

---

### 2.6 Method Semantics

Methods are defined as **named functions**, using `: name ... ;`. Each:

* Is compiled at the point of declaration.
* May refer to field names (resolved to offsets).
* May invoke other methods via `dispatch` or direct call if available.

When `end` is reached:

* Each method name and its code reference are paired into a **maplist**: `( `method1 @method1 `method2 @method2 ... )`.
* This maplist is placed directly in **slot 0** of the capsule prototype.

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

1. **Collect methods into a maplist** (placed directly in slot 0 of the prototype).
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

### 3.6 Summary of Prototype Layout

The prototype capsule is a list with the following layout:

```tacit
( ( `method1 @method1 `method2 @method2 `method3 @method3 ) field1-value field2-value ... fieldN-value )
```

* Slot 0: maplist containing method symbols and code references
* Slots 1..N: field values (scalars or flat LISTs)
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

## 5. Method Compilation and Symbolic Dispatch

### 5.1 Purpose

Methods define capsule behavior. Each method is compiled as a standalone function and referenced by symbol in the capsule’s dispatch table. These methods operate relative to the `self` capsule instance and may access fields through resolved offsets.

### 5.2 Syntax

```tacit
<symbol> { <code> }
```

This defines a method named `<symbol>` with the body `<code>`. The symbol becomes a key in the capsule’s dispatch map. The code block is compiled immediately as a standalone function.

### 5.3 Compilation Context

* When `capsule <name>` is active, each `: name ... ;` method definition is compiled in the current capsule context.
* `self` is bound to the current capsule instance during method execution.
* Field symbols (e.g. `firstName`, `lastName`) are resolved to fixed numeric offsets using the dictionary entry created by `field`.
* Methods are compiled into the code segment and generate function references.

### 5.5 Dispatch Function

* Dispatch occurs at runtime by placing the capsule and a symbol on the stack, then invoking the zeroth element (i.e., the dispatch function).
* The dispatch function receives the symbol and selects the corresponding method by name.
* A fallback method (e.g. `default`) may be used when no match is found.

### 5.6 Field Access in Methods

* Methods may reference fields using symbolic names resolved at compile time.
* Access is relative to `self`, and compiled as fixed-slot lookups.
* Field symbols must be declared before the method; forward references are not allowed.
