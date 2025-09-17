# Buffers in Tacit: An Introduction

Buffers in Tacit are a flexible, general-purpose data structure designed to support both stack-like and ring-like operations. They are not a separate primitive but a higher-level construct **built upon Tacit lists**, which are themselves compound, reverse-ordered structures that can store any kind of Tacit value. This document introduces buffers in relation to lists, focusing on their design, behavior, and capabilities.

## 1. Motivation

Many programming problems involve working with sequences of values that must be retained, revisited, or rotated. Tacit already offers lists as a fundamental building block for compound data, and sequences for pull-based pipelines. Buffers are introduced to bridge these two: they offer a way to temporarily retain elements, operate on them, and cycle through them — without committing to full immutability or streaming pull semantics.

A buffer is particularly helpful when you need a **finite, reusable workspace**:

* In a **command shell**, to maintain a rolling log of the most recent commands or messages.
* For **sensor data** or **event streams**, to keep a fixed-size window of the latest measurements.
* In **interactive graphics or games**, to manage a transient set of visible objects that continually updates.

In all these cases, lists can store the data, but buffers add a disciplined way to rotate and reuse memory without constant allocation.

## 2. Built on Lists

At their core, buffers **are lists** — or more precisely, they **wrap lists** with additional structure and behavior. All buffer operations work by reading from or writing to a list in memory.

This has several consequences:

* Buffers **inherit** all list behavior: compound elements, element traversal, slot-based layout, and so on.
* Like lists, buffers are **reverse-ordered**: the newest element is logically at the front (top-of-stack), but physically deeper in memory.
* Every buffer is **fully capable** of storing any Tacit value, including:

  * Numbers, booleans, and native types (simple values)
  * Lists (including nested or empty ones)
  * Buffers themselves
  * Capsules or tagged values

You can initialise a buffer with a fixed number of slots:

```
50 buffer
```

This creates an empty buffer with room for fifty slots. Storing it in a variable is equally direct:

```
50 buffer var x
```

This allocates a buffer of 50 slots and keeps a reference to it in `x`. All subsequent operations (`push`, `pop`, etc.) use the variable’s address in RPN form, e.g. `&x 5 push` to push the value 5 into `x`.

## 3. Stack and Ring Semantics

A buffer is meant to support both:

* **Stack behavior** — using push/pop operations, suitable for transient accumulation, undo stacks, etc.
* **Ring behavior** — allowing values to be read, cycled, and overwritten in bounded space.

Internally, these two modes of access are compatible. A buffer retains its state in a list, but additional metadata (such as cursor position) governs how reads and writes are interpreted.

Practical scenarios:

* A **stack** example: repeatedly pushing results of calculations and popping them as needed, e.g. `&x 42 push  &x pop` to retrieve the last inserted value.
* A **ring** example: maintaining a moving window of the last ten sensor readings: `10 buffer var readings` and then pushing each new value as it arrives. When the buffer is full, new pushes overwrite the oldest elements, maintaining a continuous rolling history.

This dual nature means that the same buffer can move fluidly between stack and queue usage as required.

## 4. Structural Rules

Buffers maintain the same structural rules as lists:

* Buffers store their data in **reverse order**, like all Tacit lists.
* Each buffer has a **header**, which includes the element count and slot length.
* Elements are counted in **compound-aware** terms: a single list, buffer, or capsule counts as one element, even if it spans many slots.

When constructing buffers, you may:

* Push values into them one at a time (stack-style), e.g. `&x 5 push`.
* Pre-build a list and wrap it as a buffer for immediate use.
* Read and mutate buffer contents directly (as with lists), subject to the rules of element size compatibility.

For example, if a buffer is declared as `5 buffer var b`, pushing a nested list such as `(1 2 3)` counts as a single element in `b`, even though it occupies multiple slots internally. When you traverse `b`, the nested list is treated as a single compound item.

## 5. Buffer Capabilities

Because buffers are built on lists, they are:

* **Heterogeneous**: they can mix values of different types.
* **Compound-safe**: nested structures are stored as single elements.
* **Mutable in-place**: simple elements may be updated directly, preserving slot layout.
* **Expandable**: values may be prepended (efficiently) or appended (less efficiently).

Additional usage patterns illustrate their flexibility:

* Mixing **numbers and lists** in a single buffer to track multiple layers of computation.
* Storing **buffers inside buffers** to create multi-level workspaces.
* Using a buffer as a **scratch register** for intermediate values during algorithmic steps.

These features make buffers suitable for encapsulating local state, intermediate storage, and iterative transformation.

## 6. Lifetimes and Ownership

Buffers follow Tacit’s general rules:

* They are **value-based** by default — copying a buffer copies its data.
* References (`&buffer`) create aliases, not clones.
* A buffer’s **lifetime** is tied to the segment in which it is stored.
* Buffers may be returned from functions or passed into capsules.

You may freely push a buffer to the stack, place it into a field, store it in a list, or pass it into a method — as long as the underlying memory discipline is respected.

## 7. Basic API Overview

Buffers expose a small, focused set of operations that align with both stack and ring semantics. While this document avoids deep error handling or multi-VM behavior, it’s helpful to understand the core API surfaces:

* **Push**: Insert a new value at the front (stack-style).
* **Pop**: Remove and return the front element.
* **Shift**: Advance the read/write position forward (ring-style wraparound).
* **Unshift**: Move the read/write position backward (wraps if needed).

Buffers also support **inspection and introspection**:

* **Length**: Returns the number of logical elements in the buffer.
* **Slot Count**: Returns the underlying slot span of the buffer (not always equal to element count).
* **Peek / Index**: Allows you to read (without consuming) an element at a given position, with bounds checked cyclically.
* **Mutate**: You can overwrite simple elements in-place, as long as slot compatibility is preserved.

Example session (RPN):

```
10 buffer var q
&q 1 push                 \ stack up three numbers
&q 2 push
&q 3 push
&q pop                    \ => 3
&q shift                  \ advance cursor in ring mode
&q buf-size               \ => 2 (after pop)
```

This API enables a range of usage styles — from transient stacks to fixed-size queues and lazy intermediate stores — all grounded in Tacit’s stack discipline and list model.

## 8. Error Scenarios and Design Considerations

While buffers aim to be flexible and composable, several **edge cases and error scenarios** must be acknowledged. These are **not fully handled** in this document, but they inform the need for future error-handling policies.

### Underflow

* Attempting to `pop` or `shift` from an empty buffer.
* Can occur in stack-like or ring-like usage.
* Strategies might include returning `nil`, raising an error, or yielding a sentinel.

### Overflow

* Appending or pushing beyond a buffer’s allocated capacity.
* Especially relevant in bounded ring configurations.
* If not carefully managed, wrapping writes can **overwrite still-referenced data**, leading to **corruption**.

### Corruption Risk

* If a buffer contains a list or nested buffer and wraps around, it may start **overwriting slots still in use** by a logically distinct element.
* This is particularly dangerous when the buffer is holding **compound values**, since a partial overwrite can break invariants.

### Open Questions

* Should buffers grow automatically, or remain bounded?
* Should operations return failure signals or rely on external checks?
* Should wrapping be opt-in, or mandatory for ring mode?

None of these questions are settled in this document — but they illustrate why buffer operations must be treated with care, especially in mutable or shared contexts.

## 9. Next Steps

This document provides a foundational understanding of buffers in Tacit — what they are, how they work, and why they exist. It covers their structure, usage patterns, basic API, and potential edge cases.

What it does *not* cover (yet) includes:

* **Error handling semantics** — how underflow, overflow, or corruption are *actually* handled.
* **Concurrency and sharing** — how buffers behave in multi-VM, forked, or pipelined settings.
* **Formal API spec** — opcode-level behavior, type-checking, or guaranteed side effects.
* **Performance characteristics** — bounds on operations, tradeoffs in slot vs element layout.

These topics will be explored in separate documents, especially as Tacit’s **error strategy**, **multi-VM scheduling**, and **capsule protocols** mature.

---

For now, it’s sufficient to understand that a **buffer is a list-backed structure** that can act like a stack or a circular queue, capable of storing anything in Tacit — including itself.

It is designed to offer power without special-casing, and to maintain compatibility with existing list semantics and stack models.
