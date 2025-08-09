editing plan

Here’s a detailed edit plan for modernising capsules.md so it matches your current list model and retains all original detail while expanding coverage.
This is structured as section-by-section changes, with exact content additions and rationale.


---

1. Introduction

Current issues:

Too short and assumes reader already knows about TACIT lists.

No reference to slot vs element semantics, structural immutability, or in-place mutation rules from the updated lists spec.


Edits:

Expand the introduction to explicitly define capsules as specialised TACIT lists, inheriting all list properties.

Add cross-reference to lists.md and explain how capsules fit into the list/slot model.

Mention that capsules are flat, contiguous, length-prefixed structures with slot-based addressing for fields.

Include explicit note that all structure is stack-resident; no heap allocation.

Add sub-paragraph clarifying structural immutability:

Slot layout fixed at creation.

Simple slot values may be mutated in-place.

Structural mutation discouraged and only allowed via rebuild.




---

2. Key Principles

Current issues:

Bullets omit some rules introduced in updated list spec (e.g., slot addressing, immutable structure).


Edits:

Add bullet: "Slot-based field access – all field offsets are resolved at compile time using slot indexes for O(1) access."

Add bullet: "Immutable structure with mutable simple slots – capsules preserve field order and size; only simple slots can be changed in place."

Add bullet: "Compound element awareness – fields can hold lists or capsules as compound elements; element traversal rules from lists spec apply."

Clarify “list-based” bullet to reference both slot count and element count semantics.



---

3. Basic Structure

Current issues:

No mention of slots vs elements in layout description.

Doesn’t explain that slot 0 is a compound value (maplist) and affects slot indexing of fields.


Edits:

After layout example, add paragraph:

Slot 0 contains a variable-length maplist (compound element).

Field slot indexes must account for maplist’s slot length at compile time.

This is analogous to FORTH variable compilation but offset by maplist size.


Add table mapping slot index to logical element for clarity.

Add explicit slot/element counts for sample capsule:

Example: capsule with 3 fields, where maplist has 6 slots → total slot count = 1 (list header) + 6 (maplist payload) + 3 (fields) + 1 (LINK if on stack).


Mention that slots and elements commands work on capsules like any list.



---

4. Definition Syntax

Current issues:

Functional but terse; doesn’t explain compile-time offset resolution or why fields must be declared before methods that use them.


Edits:

Add note: field offsets are assigned at compile time in declaration order; method compilation immediately resolves symbolic field names to slot offsets.

Add warning: reordering field declarations after methods that use them is invalid.

Update syntax table to include:

field resolves to slot index + fetch/store opcodes, no need for @ or !.

-> fieldName compiles as store to precomputed slot address.


Expand example to show how create function builds a capsule instance from a prototype.



---

5. Field Access

Current issues:

Doesn’t integrate new slot and element commands.


Edits:

Add subheading Slot and Element Addressing:

slot ( num -- addr ) – O(1) access to specific slot in capsule.

element ( num -- addr ) – Sequential traversal to locate Nth element.


Explain why fields always use slot addressing, not element.

Add note on compound fields: slot returns address of list header, not inner elements.



---

6. Method Dispatch with with Combinator

Current issues:

Missing note that with only changes receiver context; structure immutability applies.


Edits:

Add note: methods must not structurally mutate the receiver; only simple field updates are allowed.

Add clarification: with saves/restores receiver register for nested scopes, allowing nested capsules.

Expand on .method sigil: method lookup uses slot 0 maplist, searching from start to end, falling back to default if present.



---

7. Integration with TACIT

Current issues:

Does not clearly link capsule behaviour to list semantics.


Edits:

Add explicit reference to:

slots and elements return lengths for capsule as list.

Stack operations like dup, swap, over work on entire capsule structure.


Add subheading: Capsules as Values – capsules behave identically to lists in stack manipulation; only dispatch requires special handling.



---

8. Design Rationale

Current issues:

Needs reference to avoiding heap allocation and supporting immutable-but-mutable-simple-field model.


Edits:

Add section on Why not heap? – avoids GC, aligns with TACIT’s stack discipline.

Add note: slot-based addressing ensures constant-time field access regardless of maplist size.

Add note: separation of data (fields) and behaviour (maplist) simplifies introspection and code generation.



---

9. Related Specifications

Current issues:

Should explicitly link to updated lists.md for slot/element semantics and maplists.md for dispatch.


Edits:

Add “See also” bullet for slots and elements command documentation.

Link to capsules-implementation.md with note: “Contains detailed compile-time offset resolution and prototype assembly process.”



---

10. Additional Content to Add Throughout

Inline diagrams showing capsule memory layout (slots vs elements).

At least one expanded example showing a capsule with a compound field.

Stack diagrams for method calls inside with blocks.

Table summarising legal vs illegal mutations in capsule fields.



---

If you want, I can now apply this plan to the current capsules.md in a new canvas, keeping everything but adding the expanded content without shortening.
Do you want me to move straight to that?







# TACIT Capsules Overview

## Introduction

TACIT capsules provide object-like encapsulation for structured data and behavior while remaining fully compatible with TACIT's stack-based architecture. They are built on the list infrastructure and use maplist-based method dispatch.

### Key Principles
- **List-based**: Capsules are lists with a specific structure
- **Copy-based instantiation**: No inheritance chains or dynamic allocation
- **Closure-free**: All state explicitly stored, no lexical environments
- **Stack-compatible**: Work with standard TACIT stack operations

## Basic Structure

### Capsule Layout
A capsule is a list with this exact structure:
```tacit
( ( `name1 @method1 `name2 @method2 ... `nameN @methodN ) field1-value field2-value ... fieldN-value )
```

- **Element 0**: Maplist containing alternating method names and code references
- **Elements 1..N**: Field values (simple or compound values)

The dispatch maplist in element 0 follows standard maplist format:
- Even positions (0, 2, 4...): Method name symbols (e.g., `greet`, `reset`)  
- Odd positions (1, 3, 5...): Code references to method implementations (e.g., @greet-code)

Example in memory:
```tacit
( ( `greet @greet-code `reset @reset-code `incrementViews @increment-code ) "John" "Doe" 0 )
```

## Definition Syntax

### Basic Capsule Definition
```tacit
capsule person
  "John" field firstName
  "Doe"  field lastName  
  0      field viewCount

  : greet firstName " " lastName concat concat "Hello, " swap concat ;
  : incrementViews viewCount 1 + -> viewCount ;
  : reset 0 -> viewCount ;
end
```

### Syntax Elements
- `capsule <name>` - Begin capsule definition
- `<value> field <name>` - Declare field with initial value
- `: <name> <body> ;` - Define method
- `end` - Complete capsule definition

### Syntax Primitives Table

| Syntax                   | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `capsule <name>`         | Begin capsule definition scope. Marks dictionary position and stores name.       |
| `<value> field <symbol>` | Declare field with initial value from stack. Stored by offset in capsule.      |
| `: name ... ;`           | Define method as conventional TACIT function with field access.               |
| `end`                    | Terminates capsule. Triggers collection, prototype assembly, and installation. |

## Field Access

### Reading Fields
Within methods, field names directly return values:
```tacit
firstName    \ Returns field value
```

### Writing Fields  
Use the `->` operator for assignment:
```tacit
"Jane" -> firstName    \ Updates field value
```

### Future Variable Integration
The current field access mechanism is a temporary solution. TACIT will likely develop a more comprehensive variable system:

- **Global variables**: Following Forth VALUE style, stored on global heap
- **Local variables**: Function-scoped, stored on return stack
- **Field variables**: May integrate with the broader variable system for consistency

This evolution would provide more natural variable semantics while maintaining stack-based performance characteristics.

## Method Dispatch with `with` Combinator

### Basic Usage
```tacit
person with {
    .getName "hello, " swap concat    \ Returns "hello, John Doe"
    .setGreeting                      \ Set internal greeting state
    .greet                           \ Print greeting
}
```

**Key Design Principles:**
- **`with` is a combinator** - takes receiver and block, manages receiver context
- **No copying** - receiver remains on stack, accessed via receiver register
- **`.method` is a prefix sigil** - reads method name, dispatches via receiver
- **Nested contexts** - receiver saved/restored for nesting
- **Block scoping** - explicit `{` `}` boundaries

### Implementation Mechanics

1. **`with` starts**: Takes the receiver object and makes it available for method calls
2. **`.method` calls**: Find the method in the receiver's method table and run it
3. **`with` ends**: Remove the receiver object from the stack

**Important**: The `with` block consumes the receiver object from the stack when it completes. This means the receiver is no longer available after the `with` block ends.

```tacit
person                    \ Receiver on stack
person with {             \ Receiver still available inside block
    .greet                \ Can call methods
}                         \ Receiver consumed here - no longer on stack
\ receiver is gone from stack at this point
```

### With Arguments
```tacit
person with {
    "Dr." .setTitle               \ Pass argument to method
    .getName "Hello, " swap concat \ Use updated title
}
```

### Nested `with` Blocks
```tacit
person1 with {
    .greet
    person2 with {
        .greet
    }
    .incrementViews
}
```

### Inter-Method Calls
Methods can call other methods on the same receiver:
```tacit
capsule calculator
  0 field total
  
  : add total + -> total ;
  : addTwice .add .add ;           \ Calls add twice on same receiver  
  : addDouble 2 * .add ;           \ Double then add
end
```

### Default Method Support
Following maplist conventions:
```tacit
capsule example
  42 field value
  
  : getValue value ;
  : default "Unknown method" ;
end

\ Usage
instance with {
    .getValue     \ Returns 42
    .unknown      \ Returns "Unknown method" (fallback)
}
```

## Integration with TACIT

### List Compatibility
Capsules support all list operations:
```tacit
capsule 2 get        \ Access field by index
capsule length       \ Get total elements
```

### Stack Operations  
Standard stack manipulation works:
```tacit
capsule dup          \ Duplicate capsule
capsule swap         \ Standard stack ops
```

### Maplist Integration
- Support `default` key for fallback methods
- Compatible with maplist search algorithms
- Can use maplist introspection tools

## Design Rationale

The `with` mechanism solves fundamental stack-based OOP problems:

1. **Argument Separation** - Method args don't interfere with receiver
2. **Context Clarity** - Explicit scope for method dispatch  
3. **Ergonomics** - Natural multiple method calls
4. **Stack Hygiene** - No `dup` proliferation

This maintains TACIT's stack-based nature while providing object-oriented convenience.

## Related Specifications

- `docs/specs/lists.md` - Foundational list mechanics
- `docs/specs/maplists.md` - Key-value dispatch tables  
- `docs/specs/capsules-implementation.md` - Detailed implementation guide
