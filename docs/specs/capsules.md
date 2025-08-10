# TACIT Capsules Specification

## Introduction
TACIT capsules provide **object-like encapsulation** for structured data and behavior while remaining fully compatible with TACIT's **stack-based architecture**.  
They are built on the **list** infrastructure, using **maplist-based method dispatch**, and are designed to avoid traditional object-oriented complexities such as inheritance chains, heap allocation, or hidden closures.

Capsules unify **data (fields)** and **behavior (methods)** into a single, self-contained value that behaves like any other list on the stack. This means:
- They can be duplicated, swapped, concatenated, and inspected with list operations.
- They remain **stack-resident** -- no garbage collection or heap management is required.
- They are **structurally immutable** -- while field values may be mutated in place if simple, the list's shape does not change after creation.

### Key Principles
- **List-based**: Capsules are specialized lists with a fixed structure.
- **Copy-based instantiation**: No inheritance, no pointer chasing -- capsule instances are built by copying a prototype.
- **Closure-free**: All state is explicitly stored; no lexical environments.
- **Stack-compatible**: Standard TACIT stack operations work on capsules.

## Basic Structure

### Capsule Layout
A capsule is a list with this exact structure:

```
( ( `name1 @method1 `name2 @method2 ... `nameN @methodN ) field1-value field2-value ... fieldN-value )
```

**Element overview:**
- **Element 0**: The **dispatch maplist** (a list compound), containing alternating method name symbols and code references.
- **Elements 1..N**: Field values — each field is an element; values may be simple (1 slot) or compound (multi-slot).

### Maplist Format
The dispatch maplist (element 0) follows the standard **maplist** format:
- Even positions (0, 2, 4, ...): **Method name symbols** (e.g., `greet`, `reset`)
- Odd positions (1, 3, 5, ...): **Code references** (e.g., `@greet-code`)

Example in memory:
```
( ( `greet @greet-code `reset @reset-code `incrementViews @increment-code )
  "John" "Doe" 0 )
```


## Definition Syntax

### Basic Capsule Definition
```tac
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
| Syntax | Meaning |
|--------|---------|
| `capsule <name>` | Begin capsule definition scope; marks dictionary position and stores name. |
| `<value> field <symbol>` | Declare field with initial value from stack. Stored by **element offset** in capsule (element 0 is the dispatch maplist). |
| `: name ... ;` | Define method as a standard TACIT function with field access. |
| `end` | Terminates capsule, triggers prototype assembly, installs final structure in the dictionary. |


### Access Semantics
Capsules reuse list addressing semantics (slots vs elements) from the list specification. Refer to `lists.md` for address-based operations and traversal rules, including low-level `get` and `set` definitions. Access examples that rely on numeric indices are intentionally omitted here; prefer named field access and `->` assignment.

## Field Access

### Reading Fields
Inside a method, field names push their value onto the stack:
```tac
firstName    \ -> "John"
```

### Writing Fields
Use the `->` operator for assignment:
```tac
"Jane" -> firstName
```

### Mutability Rules
- Allowed: In-place mutation of simple fixed-size slot values (e.g., numbers, booleans, interned symbols).
- Not allowed: Structural mutation (changing length or overwriting with a compound value).
- Assignments follow list `set` semantics: simple-only in-place; compound targets are a silent no-op.

## Method Dispatch with `with` Combinator

### Basic Usage
```tac
person with {
    .getName "hello, " swap concat
    .setGreeting
    .greet
}
```

**Design Principles:**
- **`with` is a combinator** -- takes a receiver and a block, sets `receiver` context for method calls.
- **No copying** -- receiver remains in place, accessed via `receiver` register.
- **`.method` sigil** -- dispatches method from receiver's maplist.
- **Nested contexts** -- `receiver` is saved/restored automatically.
- **Block scoping** -- `{` and `}` delimit the method call scope.

### Implementation Mechanics
1. **`with` starts** -- Takes the receiver object from the stack and stores it as the current `receiver`.
2. **`.method` calls** -- Look up the method name in the maplist (element 0) and execute it.
3. **`with` ends** -- Cleans up all values pushed after the receiver and restores the previous receiver.

### With Arguments
```tac
person with {
    "Dr." .setTitle
    .getName "Hello, " swap concat
}
```

### Nested `with` Blocks
```tac
person1 with {
    .greet
    person2 with {
        .greet
    }
    .incrementViews
}
```

### Inter-Method Calls
```tac
capsule calculator
  0 field total

  : add total + -> total ;
  : addTwice .add .add ;
  : addDouble 2 * .add ;
end
```

### Default Method Support
Following maplist conventions:
```tac
capsule example
  42 field value

  : getValue value ;
  : default "Unknown method" ;
end

instance with {
    .getValue
    .unknown  \ Falls back to default
}
```

## Integration with TACIT

### List Compatibility
Capsules are still lists and therefore follow all general list rules and operations. See `lists.md` for slot/element addressing details where needed.

### Stack Operations
Capsules work with normal stack operators:
```tac
capsule dup
capsule swap
```

### Maplist Integration
- `default` key for fallback methods is supported.
- Works with standard maplist search algorithms.
- Compatible with maplist introspection.

## Design Rationale
The `with` combinator solves key problems in stack-based OOP:
1. **Argument separation** -- method arguments don't interfere with the receiver.
2. **Context clarity** -- explicit scope for method dispatch.
3. **Ergonomics** -- natural syntax for multiple method calls without excessive `dup`.
4. **Stack hygiene** -- avoids littering the stack with unused receiver copies.

## Related Specifications
- [`lists.md`](lists.md) -- foundational list mechanics.
- [`maplists.md`](maplists.md) -- key-value dispatch tables.
- [`capsules-implementation.md`](capsules-implementation.md) -- implementation details.

