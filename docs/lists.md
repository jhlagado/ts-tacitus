# TACIT Data Type Specification: LISTS

TACIT is a stack-based, RPN programming language that supports structured data directly on the stack. The primary compound data structure in TACIT is the `LIST`, a flat, length-prefixed, word-aligned sequence of values. Lists in TACIT are stack- and memory-compatible, introspectable, and support compositional programming without relying on heap-based structures.

## Contents

+ - [Simple Values](#simple-values)
+ - [List Construction and Semantics](#list-construction-and-semantics)
+ - [Stack Representation and the Need for LINK](#stack-representation-and-the-need-for-link)
+ - [The Role and Semantics of LINK](#the-role-and-semantics-of-link)
+ - [Nested Lists](#nested-lists)
+   - [Example: `( 1 ( 2 3 ) 4 )`](#example--1--2-3--4-)
+   - [Summary](#summary)
+ - [Zero-Length Lists](#zero-length-lists)
+   - [Link Emission Context](#link-emission-context)
+ - [Mutability Semantics](#mutability-semantics)
+ - [Summary Rules and Properties](#summary-rules-and-properties)
+ - [Formal Grammar](#formal-grammar)
+ - [Additional Considerations](#additional-considerations)
+ - [Tag Reference Table](#tag-reference-table)
+ - [Visual Recap: Stack Layout](#visual-recap-stack-layout)
+ - [Closing Notes](#closing-notes)
+ - [Frequently Asked Questions](#frequently-asked-questions)

---

## 1. Simple Values

TACIT operates on uniform stack cells, each storing a **simple value**. These are NaN-boxed 32-bit values tagged with type metadata.

Supported simple values include:

* **Numbers**: Represented as `float32` (NaN-boxed for tagging).
* **Booleans**: Encoded as 0 and 1 (no special type).
* **Symbols**: Interned strings used in logic, dispatch, and naming.
* **`nil`**: A special constant for null, end-of-sequence, or sentinel cases.
* **Pointers**: References to code blocks, static lists, or buffers.
* **Tagged constants**: Including `CODE`, `LIST`, `LINK`, and `STRING`.

Simple values are opaque, fixed-size, and form the building blocks of all compound types like lists and capsules.

---

## 2. List Construction and Semantics

A **list** in TACIT is a serialized structure beginning with a length-prefixed `LIST` header and followed by `N` simple values.

Constructed left-to-right:

```
LIST: N      ; Header, encodes length and tag
v₁           ; First value
v₂           ; Second value
...
vₙ           ; N-th value
```

This layout:

* Guarantees that list length is known without traversal.
* Supports contiguous, compact serialization.
* Enables random access and bounded traversal.
* Allows introspection and reuse across memory and stack.

Lists may contain scalars, symbols, code references, or other nested lists.

---

## 3. Stack Representation and the Need for LINK

In memory, lists are stored in forward order:

```
[ LIST ][ v₁ ][ v₂ ]...[ vₙ ]
```

But on a stack that grows **toward higher addresses**, the layout appears in reverse:

```
...             ← deeper in stack
LIST: N         ← list header
v₁
...
vₙ
LINK: N+1       ← TOS (top of stack)
```

Because the list header is now **buried**, the TOS alone doesn’t identify the list bounds. To solve this, TACIT introduces a **`LINK` tag** — a relative back-pointer used **only in stack representations** of variable-length data.

---

## 4. The Role and Semantics of LINK

The `LINK` tag is **not part of the list** — it is **stack metadata** required to recover the list's header from TOS.

```
... (stack grows up)
LIST: 3
10
20
30
LINK: 4       ; Back-pointer from TOS to LIST
```

* `LINK: 4` means "go 4 cells back from here to find the list header."
* The value `4` corresponds to `3` values plus the `LIST` header.
* The LINK allows VM operations to locate the list start and interpret the list from TOS.

**Key Rules:**

* LINK is only emitted when a list is pushed to the stack.
* It is **not required** in memory representations.
* It is valid to use LINK with any variable-length object on the stack (e.g., capsules, buffers).

---

## 5. Nested Lists

Lists can contain other lists. These **nested lists** follow the same `LIST` format but **do not include LINKs** because they are not placed on the stack directly — they are embedded inline as values.

### Example: `( 1 ( 2 3 ) 4 )`

This produces:

```
LIST: 5
1

  LIST: 2     ; inline nested list
  2
  3

4
LINK: 6
```

* The inner list has no LINK — it's embedded as a value.
* The outer list has 5 elements: 1, (2 3), 4 — including the header of the nested list.

### Summary:

* Nested lists are inline values, not stack-pushed items.
* LINK applies **only to top-level stack objects**.
* Parent list length must account for the full length of the nested list.

---

## 6. Zero-Length Lists

TACIT fully supports empty lists:

```
LIST: 0        ; zero-length header
LINK: 1        ; back pointer (to LIST)
```

* `LIST: 0` is a valid constant.
* `LINK: 1` correctly indicates 1 cell back to the header when a zero-length list is pushed (the 1 refers to the header only).
* `LINK: 0` is technically valid as a 0-length back-pointer, indicating that the stack entry itself is the header with no items—but is rarely emitted in practice.

### 6.1 Link Emission Context

LINK tags are only emitted at runtime on stack-based, LIFO structures where the start of variable-length data cannot be determined directly by pointer arithmetic. They do **not** appear in static code segments or memory-based list representations. Whenever a list is serialized into a contiguous memory block or loaded as a static resource, no LINK is needed because the header is immediately accessible.

---

## 7. Mutability Semantics

TACIT treats lists as:

* **Structurally immutable** — their length and layout do not change.
* **Value-mutable** — individual simple values within the list may be updated in place.

This model supports:

* Efficient caching and reuse.
* In-place mutation for counters, cursors, etc.
* Simple runtime guarantees: no memory reallocation required for modification.

**Mutating structure requires reallocation** — typically done by copying to a new list and appending.

*For details on the capsule abstraction and how it builds on lists, see [Capsules](capsules.md).*  

---

## 8. Summary Rules and Properties

| Property                 | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| Read direction           | Left to right                                             |
| Header                   | `LIST: N` tag with element count                          |
| TOS recovery             | `LINK: N+1` allows backtracking from TOS                  |
| LINK relevance           | Stack metadata only; not stored in nested lists or memory |
| Nesting                  | Allowed; nested lists are inline values                   |
| Rank                     | Flat by default; nesting does not imply dimensionality    |
| Evaluation               | Lists are inert unless explicitly interpreted             |
| Copy-on-structure-change | Required for appends or length-altering transforms        |

---

## 9. Formal Grammar

The list literal syntax is:

```
list-literal ::= '(' value* ')'
value        ::= simple-value | list-literal
```

Where:

* `simple-value` includes numbers, symbols, `nil`, code pointers, etc.
* Nested lists are parsed recursively and emitted as embedded values.
* LINK tags are **not part of literal syntax** — they are emitted by the compiler during stack construction.

---

## 10. Additional Considerations

* **First-Class Objects**: Lists can be stored, passed, returned, and nested.
* **Opaque by Default**: Lists are values; they require explicit traversal.
* **Used by Capsules**: Capsules are special lists with dispatch in slot 0.
* **Used by Arrays**: Arrays reuse the list format, but shaped via external capsules.
* **Used by Buffers**: Byte-packed formats can be built from list serialization (see separate buffer spec).

---

## 11. Tag Reference Table

| Tag      | Description                            |
| -------- | -------------------------------------- |
| `LIST`   | Header marking a list, includes length |
| `LINK`   | Stack metadata pointing back to header |
| `CODE`   | Reference to a code block              |
| `STRING` | Interned symbol or identifier          |
| `NIL`    | Null or unit constant                  |

---

## 12. Visual Recap: Stack Layout

For `( 10 20 30 )`, the stack looks like:

```
TOS →
LINK: 4
30
20
10
LIST: 3
... (deeper)
```

From TOS, `LINK` allows us to recover the list’s head at depth `4`.

---

## 13. Closing Notes

* **LINK is essential for traversing variable-length objects on the stack.**
* **It is not part of the list** — it is **a convention for stack layout**.
* **In memory**, lists require no LINK; they begin at `LIST`.
* **Capsules, sequences, buffers** — all follow or extend this model.
* **Parsing, copying, and dispatch** rely on the uniformity and simplicity of this layout.

TACIT’s list format enables efficient structured programming, introspection, and composability on a pure stack-based machine without reliance on dynamic memory.

---

## 14. Frequently Asked Questions

**Q: When do LINKs appear vs. static representations?**  
A: As above, LINKs are only included at runtime on stack-based data structures. Static list literals in memory or code segments never include a LINK tag because the header is directly addressable.

**Q: What is a valid use for `LINK: 0`?**  
A: `LINK: 0` formally denotes a back-pointer to the same cell (the header) with zero items. It is a valid encoding for an empty list but seldom emitted because `LINK: 1` (pointing one cell back to the header) is more common when a list is pushed.

**Q: Where are capsules defined?**  
A: Capsules are documented in [capsules.md](capsules.md) alongside this specification.
