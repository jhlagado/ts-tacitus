# TACIT Programming Language

**TACIT** is a stack-based, function-context-aware programming language inspired by Forth, APL, Lisp, and Joy. It is named for its core design philosophy: *tacit* (point-free) composition, where programs are constructed without naming arguments explicitly.

TACIT offers a uniform, introspectable model for data and behavior built on simple, composable parts: tagged values, lists, capsules, and shaped arrays.

---

## Core Concepts

### Stack-Based Execution

TACIT is built around a pair of stacks: the **data stack** and the **return stack**. All execution proceeds by manipulating these stacks using postfix (RPN) notation. The language avoids control flow primitives in favor of composable, point-free abstractions.

### Tagged Values

Every value in TACIT carries a tag identifying its type—such as scalar number, list, function, or capsule. This allows dynamic typing, polymorphic behavior, and a unified treatment of data and functions.

---

## Lists and Capsules

### Lists

A **list** is a flat stack-allocated sequence of tagged values. Lists are mostly immutable, though in-place mutation of fixed-width values (e.g. updating numeric elements) is permitted. Structural changes (like appending) require rewriting backlinks and length metadata.

* Lists may contain nested structures (e.g., other lists), but such nesting does not imply dimensionality.
* A list that does **not** end in a function is treated as **inert data**.

### Capsules

A **capsule** is a list whose final element is a function or another capsule. It represents an executable or interpretable structure. The final position is called the **capsule function**.

Capsules are first-class, composable, and introspectable. They can include:

* Parameters
* Metadata
* Internal state (e.g. a pointer for stack or queue structures)
* Shape descriptors (for arrays)

Functions and capsules are interchangeable in TACIT—they are both callable.

---

## Arrays and Shapes

Arrays in TACIT are modeled as **lists with shape capsules**. The shape capsule lives in the function position (final element) of the list. It defines how to map multi-dimensional indices into flat linear offsets.

* A scalar is treated as a rank-zero array.
* A list is treated as a rank-one array.
* A shaped array must be flat and must not contain nested structures.

Shapes may be functions or structured descriptors. Shape capsules provide richer metadata (e.g., dimensions, strides) and can be inspected programmatically.

Arrays can be reinterpreted as unshaped lists by removing the shape capsule. This enables transformation back to Lisp-style or per-value manipulation.

---

## Smart Capsules

TACIT supports **stateful capsules**—capsules that embed internal state such as stack pointers, counters, or buffer offsets.

This allows implementation of:

* Stacks
* Queues
* Iterators
* Lazy sequences

State is stored inside the capsule itself, enabling smart behaviors through encapsulated logic and introspectable structure.

---

## Broadcasting and Rank Semantics

Broadcasting in TACIT supports flexible polymorphism:

* Broadcasting between mismatched lengths uses **modulo-based repetition** of the shorter input.
* Scalars automatically broadcast as rank-zero arrays.
* Nested elements do **not** affect array rank—they are treated opaquely.
* Shaped arrays **must** be flat; nested items violate layout assumptions and yield undefined but non-fatal results.

A strict mode may be introduced for validation and debugging, but modulo broadcasting is the default.

---

## Data Representation

All values are stored as **32-bit tagged cells**, allowing:

* Packed byte arrays (e.g. UTF-8 strings, binary records)
* `float32` values (IEEE-754)
* Uniform stack operations across all data types

Capsules may include a **data width descriptor**, such as `uint8`, `float32`, or SIMD specifiers. This allows consistent interpretation of opaque lists as typed structures.

---

## Implementation Philosophy

TACIT aims to minimize the number of primitive concepts while maximizing compositional power. It avoids:

* Heap allocation and reference counting (deprecated)
* Special-case control flow
* Fixed arity function signatures

Instead, it builds everything from small, reusable pieces—capsules, sequences, lists, and polymorphic operators.

The language is designed to be small, introspectable, and expressive enough to host itself.

---

## Future Directions

* Full unification of sequences with capsules (e.g. iterator-like stateful capsules)
* Expansion of polymorphic operators over structured data
* Support for symbolic manipulation and program verification
* Self-hosted compiler and introspective runtime

---

## Getting Started

This repository contains the TACIT runtime, standard combinators, and documentation for the core language.

To explore:

* `src/` — VM implementation and combinators

