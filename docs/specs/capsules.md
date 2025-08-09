# TACIT Capsules Specification

## Introduction
TACIT capsules provide **object-like encapsulation** for structured data and behavior while remaining fully compatible with TACITâ€™s **stack-based architecture**.  
They are built on the **list** infrastructure, using **maplist-based method dispatch**, and are designed to avoid traditional object-oriented complexities such as inheritance chains, heap allocation, or hidden closures.

Capsules unify **data (fields)** and **behavior (methods)** into a single, self-contained value that behaves like any other list on the stack. This means:
- They can be duplicated, swapped, concatenated, and inspected with list operations.
- They remain **stack-resident** â€” no garbage collection or heap management is required.
- They are **structurally immutable** â€” while field values may be mutated in place if simple, the listâ€™s shape does not change after creation.

### Key Principles
- **List-based**: Capsules are specialized lists with a fixed structure.
- **Copy-based instantiation**: No inheritance, no pointer chasing â€” capsule instances are built by copying a prototype.
- **Closure-free**: All state is explicitly stored; no lexical environments.
- **Stack-compatible**: Standard TACIT stack operations work on capsules.

---

## Basic Structure

### Capsule Layout
A capsule is a list with this exact structure:

```
( ( `name1 @method1 `name2 @method2 ... `nameN @methodN ) field1-value field2-value ... fieldN-value )
```

**Slot overview:**
- **Slot 0**: The **dispatch maplist**, containing alternating method name symbols and code references.
- **Slots 1..M**: Field values â€” may be simple (1 slot) or compound (multi-slot) values.

### Maplist Format
The dispatch maplist (slot 0) follows the standard **maplist** format:
- Even positions (0, 2, 4, â€¦): **Method name symbols** (e.g., `greet`, `reset`)
- Odd positions (1, 3, 5, â€¦): **Code references** (e.g., `@greet-code`)

Example in memory:
```
( ( `greet @greet-code `reset @reset-code `incrementViews @increment-code )
  "John" "Doe" 0 )
```

---

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

---

### Syntax Elements
| Syntax | Meaning |
|--------|---------|
| `capsule <name>` | Begin capsule definition scope; marks dictionary position and stores name. |
| `<value> field <symbol>` | Declare field with initial value from stack. Stored by **slot offset** in capsule. |
| `: name ... ;` | Define method as a standard TACIT function with field access. |
| `end` | Terminates capsule, triggers prototype assembly, installs final structure in the dictionary. |

---

### Slot vs. Element Access
Capsules (like lists) distinguish between **slots** and **elements**:
- **Slot count** (`slots` command) â€” O(1) retrieval from the list header.
- **Element count** (`elements` command) â€” O(s) traversal, as elements may occupy multiple slots.

#### New Commands
```tac
slot ( num -- addr )
```
Returns the **memory cell address** of a slot by index. O(1) operation.

```tac
element ( num -- addr )
```
Returns the **memory cell address** of an element by index. O(s) operation.

---

## Field Access

### Reading Fields
Inside a method, field names push their value onto the stack:
```tac
firstName    \ â†’ "John"
```

### Writing Fields
Use the `->` operator for assignment:
```tac
"Jane" -> firstName
```

### Mutability Rules
- Allowed: In-place mutation of simple fixed-size slot values (e.g., numbers, booleans, interned symbols).
- Not allowed: Structural mutation (changing length or overwriting with a compound value).

---

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
- **`with` is a combinator** â€” takes a receiver and a block, sets `receiver` context for method calls.
- **No copying** â€” receiver remains in place, accessed via `receiver` register.
- **`.method` sigil** â€” dispatches method from receiverâ€™s maplist.
- **Nested contexts** â€” `receiver` is saved/restored automatically.
- **Block scoping** â€” `{` and `}` delimit the method call scope.

---

### Implementation Mechanics
1. **`with` starts** â€” Takes the receiver object from the stack and stores it as the current `receiver`.
2. **`.method` calls** â€” Look up the method name in the maplist (slot 0) and execute it.
3. **`with` ends** â€” Cleans up all values pushed after the receiver and restores the previous receiver.

âš  **Important:** The `with` block **consumes** the receiver when it completes.

---

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

---

## Integration with TACIT

### List Compatibility
Capsules are still lists:
```tac
capsule 2 get    \ Access a field by index
capsule slots    \ Get slot count
capsule elements \ Get element count
```

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

---

## Design Rationale
The `with` combinator solves key problems in stack-based OOP:
1. **Argument separation** â€” method arguments donâ€™t interfere with the receiver.
2. **Context clarity** â€” explicit scope for method dispatch.
3. **Ergonomics** â€” natural syntax for multiple method calls without excessive `dup`.
4. **Stack hygiene** â€” avoids littering the stack with unused receiver copies.

---

## Related Specifications
- [`lists.md`](lists.md) â€” foundational list mechanics.
- [`maplists.md`](maplists.md) â€” key-value dispatch tables.
- [`capsules-implementation.md`](capsules-implementation.md) â€” implementation details.

---
