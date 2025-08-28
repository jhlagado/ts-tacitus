# TACIT Capsules Specification

## Table of contents

1. Introduction
2. Basic Structure
3. Definition Syntax
4. Field Access
5. Method Dispatch with `with` Combinator
6. Integration with TACIT
7. Design Rationale
8. Conclusion
9. Related Specifications

## Introduction

Capsules in TACIT are the language’s way of packaging data and the code that operates on it into a single, portable value — all without leaving the safety and predictability of the stack.
If you’ve worked with “objects” in other languages, capsules will feel familiar in some ways, but they’re deliberately simpler: no inheritance tangles, no heap allocations, and no hidden closures. Everything is explicit.

Under the hood, a capsule is a specialized **list** that follows a fixed shape. It uses TACIT’s **maplist** format for method dispatch, so method names and their code references live side by side in the data structure. Because they’re lists, capsules can do all the normal stack tricks:

- Duplicate or swap them like any other value.
- Treat them as opaque units — `dup`, `swap`, and `drop` work on the whole capsule at once.
- Insert them into other lists with `enlist` or `cons`.
- Keep them entirely **stack-resident**: there’s no garbage collector or hidden memory pool to manage.
- Mutate **simple field values** in place when needed, while the overall capsule layout stays fixed.

**Guiding principles:**

- **List-based**: A capsule _is_ a list, just with a fixed, known structure.
- **Copy-based instantiation**: New instances are made by copying a prototype, not by chaining references.
- **Closure-free**: Every piece of state is stored directly; there’s no lexical environment hiding off to the side.
- **Stack-compatible**: All the usual TACIT stack operators work without special cases.

## Basic Structure

### Capsule Layout

Every capsule is a list whose first element is a method table, and the rest are the capsule’s fields. In abstract form:

```
(
  ( `name1 @method1
    `name2 @method2
    ...
    `nameN @methodN )
  field1-value
  field2-value
  ...
  fieldN-value
)
```

Where:

- **Element 0** — the **dispatch maplist**, a compound list whose even-indexed entries are **method name symbols** and whose odd-indexed entries are **code references**.
- **Elements 1..N** — the capsule’s fields. Each field’s value can be a simple one-slot value or a multi-slot compound value, but the number and position of fields never change after construction.

### Maplist Format

The dispatch maplist in element 0 follows TACIT’s standard **maplist** convention:

- **Even positions** (0, 2, 4, …): method name symbols like `` `greet `` or `` `reset ``.
- **Odd positions** (1, 3, 5, …): code references, such as `@greet-code`.

An example capsule in memory might look like this:

```
(
  ( `greet @greet-code
    `reset @reset-code
    `incrementViews @increment-code )
  "John"
  "Doe"
  0
)
  Capsules, like other TACIT data structures, use an abstract concept of a **ref**: a tagged address pointing to a cell in a memory segment. There are three ref types:
    - **STACK_REF**: refers to a cell location in the data stack segment (SEG_STACK)
    - **RSTACK_REF**: refers to a cell location in the return stack segment (SEG_RSTACK)
    - **GLOBAL_REF**: (future) will refer to a cell location in a global segment
  Unless otherwise specified, references in this document refer to STACK_REFs, but the addressing model is designed to be polymorphic and extensible to other ref types.
```

Here:

- The dispatch maplist provides three methods: `greet`, `reset`, and `incrementViews`, each pointing to its corresponding code reference.
- The fields are `"John"`, `"Doe"`, and `0` — for example, first name, last name, and a view counter.

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

| Syntax                   | Meaning                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capsule <name>`         | Begins a capsule definition scope, marking the dictionary position and storing the capsule’s name.                                                               |
| `<value> field <symbol>` | Declares a field with an initial value from the stack. The field is stored at a fixed **element offset** within the capsule (element 0 is the dispatch maplist). |
| `: name ... ;`           | Defines a method as a standard TACIT function, with direct access to fields via precomputed offsets.                                                             |
| `end`                    | Terminates the capsule definition, assembles the prototype, and installs the completed structure into the dictionary.                                            |

### Access Semantics

Capsules use **receiver-relative addressing** with explicit addresses. The receiver is not moved to TOS during execution.

- The receiver is stored in a dedicated register during `with` and method execution as a STACK_REF to the capsule header. The address remains available for list operations.
- Field slot indices are precomputed at **capsule assembly time**, so all field access is **O(1)** at runtime.

## Field Access

### Reading Fields

Inside a method, using a field name pushes its value onto the stack:

```tac
firstName    \ -> "John"
```

### Writing Fields

Use the `->` operator to assign a new value:

```tac
"Jane" -> firstName
```

### Mutability Rules

- **Allowed**: In-place mutation of simple, fixed-size slot values (numbers, booleans, interned symbols).
- **Not allowed**: Structural mutation (changing the list length, or replacing with a compound value).
- Assignments use list `store` semantics:
  - Simple slot → updated in place.
  - Compound slot → assignment silently ignored.

### Compilation Forms (receiver-relative)

Let `R` = receiver’s capsule header address (STACK_REF)
Let `O[field]` = precomputed payload slot index for that field.

```tac
\ Read field
firstName               \ expands to:  R  O[firstName]  slot  fetch

\ Write field (simple-only via store)
"Jane" -> firstName     \ expands to:  "Jane"  R  O[firstName]  slot  store
```

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

- `with` sets the receiver register to `person` for the duration of the block.
- Method calls prefixed with `.` dispatch via the capsule’s **dispatch maplist** (element 0).
- On block exit, the previous receiver is restored.

**Design Principles**

- **`with` is a combinator** — takes a receiver and a block, sets `receiver` context for method calls.
- **No copying** — receiver remains in place, accessed via a dedicated receiver register.
- **Does not consume receiver** — after the block, the receiver is still on the stack; block results are left intact.
- **`.method` sigil** — dispatches method from receiver's maplist.
- **Nested contexts** — `receiver` is saved/restored automatically.
- **Block scoping** — `{` and `}` delimit the method call scope.

---

### Implementation Mechanics

1. **`with` starts** — Saves the current receiver and sets the dedicated receiver register to this capsule’s header address for the scope (receiver is not popped).
2. **`.method` calls** — Do not copy the dispatch maplist. Use element 0 anchored at `R`:

   ```tac
   R 0 slot                   \ STACK_REF address of dispatch maplist header
   `methodName find           \ lookup code-ref cell
   ```

   - If address returned: `fetch eval`
   - If `nil` returned: leave `nil` and skip execution

3. **`with` ends** — Restores the previous receiver context; no additional stack cleanup is performed.

---

### Dispatch Mechanism

```tac
.methodName    \ expands to:  R 0 slot  `methodName find  fetch  eval
```

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

If a method name is not found and there is no `default` entry in the dispatch maplist, the method call yields `nil` and nothing is executed.

## Design Rationale

- **Lock down semantics**: Verify that every concept from the source is retained — especially technical details about slot indexing, anchored operations, `with` combinator internals, and mutability rules.
- **Cross-link**: Make sure every term that appears here and in `lists.md` or `maplists.md` has a consistent definition and identical semantics.
- **No implicit assumptions**: Any behaviour that is “obvious” to us but not stated should be spelled out.

---

### Spec Formatting

- Use **consistent heading hierarchy**: `##` for main sections, `###` for subsections, no “floating” headings.
- All stack effect notation and code snippets in fenced code blocks.
- Keep method expansions in `\ comment` form for clarity.
- Maintain table formatting for syntax summaries.
- Cross-reference other specs inline (`[lists.md](lists.md)`).

---

### Execution Model Notes

- Make sure the capsule layout diagram appears once, and is referenced in:
  - Field access rules
  - Method dispatch
  - `with` mechanics

- Add an explicit **“Runtime Behaviour”** section describing:
  - Receiver register lifecycle (entry/exit of `with`)
  - `.method` expansion to anchored lookups
  - `default` handling path

---

### Example Organization

- Group examples by function:
  - Capsule definition
  - Field read/write
  - Method call inside `with`
  - Nested `with`
  - Default handling

- Keep each example self-contained (includes its capsule definition if needed).
- Label each example with its purpose.

---

### Cross-References

- At the bottom, a “Dependencies” block linking to `lists.md`, `maplists.md`, `capsules-implementation.md`.
- If a concept here is defined elsewhere, summarise in one line and link — don’t restate the full content.

---

### Verification Pass

When editing:

- Check all code expands to valid TACIT bytecode patterns (verify slot/store/find usage with STACK_REF addresses).
- Ensure mutability restrictions match the list spec exactly.
- Confirm `.method` expansion matches the actual maplist search algorithm.

## Conclusion

Capsules unify data and behaviour into a single stack value using TACIT’s list and maplist conventions. They provide predictable, closure-free state handling, fixed-layout mutability rules, and a consistent runtime model for field access and method dispatch. By building on the existing list infrastructure, capsules remain lightweight, fully stack-compatible, and easy to reason about in both code and execution.

## Related Specifications

- [`lists.md`](lists.md) -- foundational list mechanics.
- [`maplists.md`](maplists.md) -- key-value dispatch tables.
- [`capsules-implementation.md`](capsules-implementation.md) -- implementation details.
