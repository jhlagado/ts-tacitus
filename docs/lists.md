# TACIT Data Type Specification: LISTS

TACIT is a stack-based, RPN language that supports structured, introspectable values directly on the stack. Unlike FORTH, TACIT treats lists and higher-order structures as first-class values. These values are flat, typed, and stored in contiguous blocks of stack memory. The most fundamental compound type in TACIT is the `LIST`.

This document serves as a precise reference for how lists are represented, interpreted, and manipulated in TACIT, especially with respect to stack semantics and runtime behavior.

---

## 1. Simple Values

Before introducing compound structures, TACIT defines several simple (scalar) value types. These occupy a single word in stack memory:

* **Numbers**: integer and floating-point, encoded as tagged NaN-boxed `float32`.
* **Symbols**: interned identifiers, used in program logic and dispatch.
* **Booleans**: `true`, `false`, encoded as tagged constants.
* **Null / Unit Values**: `nil`, for missing or end-of-sequence indicators.
* **Code / Block Pointers**: references to executable code segments.
* **List Pointers**: tagged values pointing to list headers in memory.

All simple values occupy exactly one cell on the stack or in memory. TACIT’s word size is fixed (typically 32 bits), and all values conform to this layout. Although actual alignment may vary by platform, the implementation is designed to assume word-aligned slots.

---

## 2. Lists as Flat, Structured Values

A `LIST` is a length-prefixed sequence of values. It can hold any combination of simple or compound values (including other lists). The serialized layout of a list is always flat and left-to-right:

```
LIST: N        ; Tag + element count
v₁             ; Element 1
v₂             ; Element 2
...
vₙ             ; Element N
```

* The **`LIST` tag** acts as a header, storing both the type and the element count.
* Elements are laid out in declaration order: left to right.
* No nesting or pointer chasing is required to traverse a list.

This structure enables introspection, iteration, and random access based on offsets from the header.

---

## 3. Lists in Memory vs Lists on Stack

Lists may appear in:

* **Static memory** (e.g., constants, embedded data).
* **Heap / code space** (e.g., compiled literals).
* **The data stack** (runtime evaluation and composition).

In memory, lists are stored in contiguous low-to-high address order:

```
[ LIST: 3 ][ v₁ ][ v₂ ][ v₃ ]
```

However, **on the stack**, values grow from deep to shallow. This results in the list header (`LIST`) being buried under its elements:

```
... deeper stack ...
LIST: 3
v₁
v₂
v₃
TOS
```

Because the top of stack now points to `v₃`, **we lose direct access to the list header**. This presents challenges when we want to interpret or manipulate the list as a structured value.

---

## 4. The LINK Tag: Stack-Aware Back-Pointer

To solve the visibility problem of list headers on the stack, TACIT introduces the `LINK` tag:

```
LIST: N
v₁
v₂
...
vₙ
LINK: N+1      ; Offset from LINK back to LIST
```

This `LINK` tag is not part of the list itself. It is **stack metadata** used by the interpreter to locate the beginning of the list structure starting from the top of the stack (TOS).

### Key Characteristics:

* **LINK is a runtime-only construct.** It is appended when the list is pushed to the stack.
* **LINK is not stored inside the list.** Nested or static lists omit it.
* **The value of LINK is relative to its own position.** It tells how far back to jump to reach the corresponding `LIST` header.

### Example

A list literal `( 10 20 30 )` produces:

```
LIST: 3        ; buried header
10
20
30
LINK: 4        ; TOS, points 4 cells back to LIST
```

From the TOS, the VM reads `LINK: 4`, subtracts 4, and lands on the `LIST` header to recover structure.

This enables generic traversal and access for any list, regardless of its length.

---

## 5. Nested Lists

Lists may contain other lists as values. These **nested lists** are stored inline, using the same serialization format as any other list. However:

> **Nested lists never include a LINK tag.**

### Rationale:

* LINK is required only when lists are pushed onto the **stack**, not when they’re embedded inside other structures.
* Nested lists are values **inside** another list and are not visible at TOS.
* Their size and location are already known via the enclosing list’s layout.

### Example: Nested List `( 1 ( 2 3 ) 4 )`

The serialized structure:

```
LIST: 2        ; inner list
2
3

LIST: 3        ; outer list
1
(inner list)
4
LINK: 4
```

* The inner list has no LINK tag.
* The outer list has a LINK on top because it was pushed onto the stack.

This ensures compact representation and stack-friendly traversal without redundancy.

---

## 6. LINK Tag as General-Purpose Stack Aid

Although most commonly used for lists, the `LINK` tag can be applied to **any variable-length structure** that needs to be stored on the stack and recovered from TOS.

Examples:

* Lists
* Capsules (object-like structures)
* Byte buffers (with size headers)
* Shaped arrays

The design generalizes to any structure where a **header precedes variable-length data** and the entire structure is pushed to the stack.

LINK enables bottom-up discovery of top-level structured values, facilitating uniform introspection and stack manipulation.

---

## 7. Zero-Length Lists

TACIT supports valid lists of zero elements:

```
LIST: 0
LINK: 1
```

These are frequently useful in higher-order constructs such as reductions, conditionals, or lazy sequences.

The LINK offset of 1 ensures that traversal still works, even when no values are present.

---

## 8. Summary Rules and Properties

| Rule                                | Explanation                                                  |
| ----------------------------------- | ------------------------------------------------------------ |
| Lists are constructed left to right | Source order matches memory layout                           |
| LIST is a header                    | Length prefix; identifies structure start                    |
| LINK is a trailer                   | Back-pointer to header when list is on the stack             |
| LINK is not stored in nested lists  | Nested structures are opaque and embedded                    |
| LINK is relative to its position    | Offset from TOS to LIST                                      |
| Lists are flat by default           | No implicit shape or dimensions                              |
| Nesting is allowed                  | Lists may contain other lists, capsules, or values           |
| Structure is immutable by default   | Lists are copied to modify layout, but values may be mutated |

---

## 9. Mutability and Structural Semantics

TACIT lists are **structurally immutable** by convention:

* Once constructed, the layout of a list is fixed.
* To change structure (e.g. append, remove elements), a new list must be constructed.

However, **in-place mutation of values within the list is allowed and idiomatic**:

* Lists are often used to carry counters, flags, or temporary state.
* Simple values inside a list may be updated directly via field access or mutation instructions.
* This allows efficient state management without structural copying.

Advanced routines may manipulate list layout in place, but these are considered low-level and require understanding of the list format.

---

## 10. Grammar for List Literals

TACIT parsers interpret list literals using a recursive, parenthesis-based syntax:

```
list-literal ::= '(' value* ')'
value        ::= scalar | symbol | list-literal
```

* Lists can contain other lists or scalars.
* LINK tags are not written in source and are inserted by the compiler at runtime.

Example:

```
( 1 ( 2 3 ) 4 )
```

Compiles into two serialized list blocks, one nested inside the other.

---

## 11. Additional Considerations

* **Lists are first-class**: They can be passed, returned, duplicated, and composed.
* **Symbolic access**: Lists may be interpreted as capsules or structures via conventions.
* **Byte-packed structures**: Strings and buffers may reuse the list format (separate spec).
* **Flat vs shaped**: Lists are flat; interpretation as arrays is opt-in via shape capsules.
* **No implicit evaluation**: Lists are inert unless explicitly executed or traversed.

---

## 12. Tag Reference Table

| Tag        | Description                                |
| ---------- | ------------------------------------------ |
| LIST       | Marks the start of a list; includes length |
| LINK       | Stack-level pointer back to LIST tag       |
| SYMBOL     | Tagged symbol value (used in lists, maps)  |
| NIL        | Special constant value                     |
| TRUE/FALSE | Boolean tagged constants                   |
| REF        | Code block or pointer                      |

---

## 13. Visual Recap: Stack View

```
TOS →
LINK: 4        ; back pointer
30
20
10
LIST: 3        ; header
... deeper
```

From TOS, subtract LINK to reach `LIST`. Now the interpreter can process the list.

---

## 14. Concluding Notes

The `LIST` format underpins nearly all structured data in TACIT, including user-defined objects, buffers, arrays, and closures. Its design is deliberately minimal:

* Linear layout
* Explicit header
* Optional LINK
* Stack compatibility

This makes it easy to construct, inspect, copy, and dispatch structured data — even in minimal implementations or direct machine code.
