# Tuples

## Table of Contents

- [Tuples](#tuples)
  - [Table of Contents](#table-of-contents)
- [Tuples](#tuples-1)
  - [1. Introduction](#1-introduction)
    - [1.1 Overview](#11-overview)
    - [1.2 Tuples as TLV-like Structures](#12-tuples-as-tlv-like-structures)
  - [2. Representing Groups on the Stack with Parentheses](#2-representing-groups-on-the-stack-with-parentheses)
    - [2.1 The Open Parenthesis `(` — Marking the Group Start](#21-the-open-parenthesis---marking-the-group-start)
    - [2.2 Pushing Values Inside the Group](#22-pushing-values-inside-the-group)
    - [2.3 The Close Parenthesis `)` — Computing and Pushing the Tuple Tag](#23-the-close-parenthesis---computing-and-pushing-the-tuple-tag)
    - [2.4 Example Walkthrough](#24-example-walkthrough)
    - [2.5 Using Tuples in Functions](#25-using-tuples-in-functions)
    - [2.6 Code Snippet (Pseudo Tacit VM Steps)](#26-code-snippet-pseudo-tacit-vm-steps)
    - [2.7 Summary](#27-summary)
  - [3. Working with Tuples: One-Dimensional Vectors in Contiguous Memory](#3-working-with-tuples-one-dimensional-vectors-in-contiguous-memory)
    - [3.1 Representing Tuples in Memory](#31-representing-tuples-in-memory)
    - [3.2 Basic Tuple Operations](#32-basic-tuple-operations)
    - [3.3 Broadcasting Arithmetic with Tuples](#33-broadcasting-arithmetic-with-tuples)
    - [3.4 Scalar Broadcasting](#34-scalar-broadcasting)
    - [3.5 Generalized Broadcasting](#35-generalized-broadcasting)
    - [3.6 Combining Tuples: The Zip Operation](#36-combining-tuples-the-zip-operation)
  - [4. Nested Tuples and Multidimensional Arrays](#4-nested-tuples-and-multidimensional-arrays)
    - [4.1 Defining Nested Tuples](#41-defining-nested-tuples)
    - [4.2 Multidimensional Array Representation](#42-multidimensional-array-representation)
    - [4.3 Recursive Descent Traversal](#43-recursive-descent-traversal)
  - [5. Polymorphism of Tuple Buffers and Scalars in Tacit](#5-polymorphism-of-tuple-buffers-and-scalars-in-tacit)
      - [5.1 Uniform Value Representation](#51-uniform-value-representation)
    - [5.2 Broadcast Semantics in Operations](#52-broadcast-semantics-in-operations)
    - [5.3 Storage and Variable Interactions](#53-storage-and-variable-interactions)
    - [5.4 Runtime Type Identification and Tagging](#54-runtime-type-identification-and-tagging)
    - [5.5 Advantages of Tacit's Polymorphism Model](#55-advantages-of-tacits-polymorphism-model)
    - [5.6 Callable Tuples (Capsules)](#56-callable-tuples-capsules)
    - [5.7 Self-Modifying Capsules](#57-self-modifying-capsules)
      - [Execution Protocol](#execution-protocol)
      - [Creation Protocol](#creation-protocol)
      - [Safety and Reuse](#safety-and-reuse)
      - [Implications](#implications)
  - [6. Conclusion: The Significance of Tuples in Tacit](#6-conclusion-the-significance-of-tuples-in-tacit)

# Tuples

## 1. Introduction

### 1.1 Overview

Tuples are a core abstraction in Tacit, providing a lightweight mechanism for representing composite data such as arrays, lists, and tables. A Tuple consists of one or more contiguous values marked by a special footer called a *tuple tag*.

While Tuples are commonly used on Tacit's data stack, they can reside in any contiguous storage medium—including buffers, arrays, or memory regions. This document describes how Tuples are constructed, manipulated, and used within Tacit. It explains the mechanisms by which tuples are created and managed, how they are recognized and processed by functions, and how they enable a range of higher-level data abstractions.

Unlike heap-allocated objects in conventional languages, Tuples reside in linear memory and are delimited by local information. A tuple's end is determined relative to its start, using offsets computed at runtime. This allows dynamic construction of data structures with no external bookkeeping or garbage collection.

Tuples are stack-native but not stack-bound. They can be constructed on the data stack, stored in local buffers, or passed across coroutines using shared memory. Their encoding is minimal: the data itself is untagged, and only the tuple tag at the end of a sequence serves as an indicator of its structure. This enables efficient memory layout, simple traversal, and compact representation.

Tacit treats the stack not as a transient space but as a composable data model. Functions operate on Tuples using broadcasting, indexing, and recursion by descent. Operators are polymorphic across scalars and Tuples, with functions inspecting structure at runtime to apply correct behavior. All composite data in Tacit, including arrays and records, builds upon this foundation.

The following sections define how Tuples are constructed with grouping operators, how they are traversed and transformed, and how they serve as the basis for polymorphic operations and multidimensional arrays.

### 1.2 Tuples as TLV-like Structures

Though Tacit was not designed with TLV formats in mind, Tuples share a similar compositional strategy. In traditional Type–Length–Value systems (used in binary protocols like BER, DER, and TLV-based messages), a value is framed by a type identifier and a length, usually prepended. This allows parsers to identify what kind of data follows and how far to read.

Tuples invert this model. Instead of a header, Tacit uses a footer—a tagged word at the end of a sequence that encodes its length and type. This allows forward-construction (push values first, then tag them), efficient stack unwinding, and minimal overhead. Unlike typical TLV encodings, Tuples operate at the word level, not byte level, and serve both execution and representation purposes. The model aligns more closely with runtime stack processing than static serialization but benefits from similar framing semantics.

## 2. Representing Groups on the Stack with Parentheses

Tacit introduces grouping constructs using a pair of delimiters: the open parenthesis `(` and the close parenthesis `)`. These create spans—contiguous groups of values on the data stack that act as composite structures. The resulting Tuples are treated as first-class data and may represent vectors, records, or elements of higher-dimensional arrays. The grouping mechanism is stack-native, efficient, and designed to preserve lexical structure through tuple tags rather than heap references.

### 2.1 The Open Parenthesis `(` — Marking the Group Start

When the open parenthesis `(` is executed, Tacit saves the current data stack pointer (DSP) by pushing it onto the return stack. This saved pointer acts as a marker: it denotes the position of the stack before any group elements were added. The system does not perform any additional allocation or tagging at this point—only the start address is recorded.

This operation is cheap, requiring only a return stack push, and does not modify the data stack or inject any metadata into the sequence. It simply bookmarks the start of a pending group.

### 2.2 Pushing Values Inside the Group

Once the group has been opened, any values pushed onto the data stack become part of the group. These may include scalars, other Tuples, or even compound structures. All items pushed after the open parenthesis are considered logically contiguous. For example:

```
( 10 20 30
```

This sequence begins a group and places three integer values on the data stack. The saved stack pointer remains below these items, pointing to the boundary before the group started.

At this point, the state of the stack resembles:

```
... [saved DSP]
10
20
30
```

The grouping is not yet complete. The return stack holds the bookmark, and the data stack simply accumulates values.

### 2.3 The Close Parenthesis `)` — Computing and Pushing the Tuple Tag

When the closing parenthesis `)` is encountered, the runtime:

1. Counts the number of values pushed since the matching opening parenthesis.
2. Creates a tag containing this count—known as a *tuple tag*—that indicates how many items to skip backward to find the start of the group.
3. Pushes this tuple tag tag onto the stack, marking the end of the grouped values.

This tuple tag does not contain an absolute memory address. Instead, it encodes how many items to move backward on the stack to recover the entire span. It functions as a compact footer that delimits the Tuple from the top and enables efficient traversal of the structure.

For example:

```
( 10 20 30 )
```

Yields:

```
10
20
30
TUPLE:3
```

The tuple tag `TUPLE:3` allows functions like `sum` to identify the start of the group and operate on the enclosed values without requiring an external data structure.

### 2.4 Example Walkthrough

Let's trace the stack operations for grouping in the expression `(1 2 3)`:

1. `(` — Remember current stack depth for start of group (e.g., depth 0)
2. `1` — Push value 1 onto stack (depth 1)
3. `2` — Push value 2 onto stack (depth 2) 
4. `3` — Push value 3 onto stack (depth 3)
5. `)` — Compute count = current depth - start depth = 3 - 0 = 3
   — Push TUPLE:3 onto stack (depth 4)

After execution, the stack contains `[1, 2, 3, TUPLE:3]`

### 2.5 Using Tuples in Functions

Functions can recognize and operate on Tuples through their tuple tags. For example, a function to sum a Tuple:

```
( 10 20 30 ) sum
```

Is interpreted as:

* `TUPLE:3` → consume and interpret as a tuple of 3 items
* Operate on `10 20 30`
* Compute sum: `60`
* Remove the three values and the tuple tag
* Push result: `60`

Final stack:

```
[60]
```

Functions treat Tuples as variadic argument bundles. No array or pointer representation is constructed. The grouping is implicit in stack layout, and the tagged tuple tag enables precise recovery of that layout.

### 2.6 Code Snippet (Pseudo Tacit VM Steps)

```
// For the expression (1 2 3)
onOpenParen():  pushMarker(GROUPSTART)  // Internal marker, not visible on data stack
onValue(1):  push(1)
onValue(2):  push(2)
onValue(3):  push(3)
onCloseParen():  itemCount = countSinceMarker(GROUPSTART)  popMarker(GROUPSTART)  push(makeSpanPointer(itemCount))
```

This style of group parsing is deterministic, with all boundaries derived from tuple tags. No heap or object structure is introduced; everything resides on the native data stack.

### 2.7 Summary

The key mechanisms of the grouping system are:

1. Open parenthesis marks the start of a group (invisible to data stack).
2. Values are pushed directly onto the data stack.
3. Close parenthesis computes a tuple tag encoding the tuple length.
4. The tuple tag serves as a footer marking the extent of the tuple.
5. Functions can identify Tuples by recognizing tuple tags and tracing backward.

This design avoids any special header marking the start of a tuple. The only structural marker is a tuple tag at the end—compact, local, and easily traced. The result is a backward-delimited, stack-native structure that enables efficient traversal and value recovery without external metadata.

Conceptually, this mirrors a type–length–value (TLV) pattern, commonly found in serialization formats like ASN.1 or CBOR. In TLV, a type byte and a length field precede the value. In Tacit, the "type" is embedded in the tuple tag, the "length" is its payload, and the "value" is the preceding sequence. The crucial difference: Tacit places this tag after the data, supporting dynamic, forward construction and backward introspection without needing a precomputed length or reserved prefix space. It is TLV reinterpreted through a stack lens.

## 3. Working with Tuples: One-Dimensional Vectors in Contiguous Memory

In Tacit, Tuples are treated as one-dimensional vectors built in contiguous memory regions. A Tuple consists of a contiguous group of values delimited by a `TUPLE` tag, which encodes its length. Tuples are not boxed or heap-allocated; instead, they exist in place within their storage medium (whether that's a stack, buffer, or array) and serve as a compact representation of arrays, sequences, and parameter bundles. This section describes how Tuples behave as vectors and how operations over them are defined.

### 3.1 Representing Tuples in Memory

A Tuple is constructed using the grouping syntax (shown here in stack notation, though the resulting structure can reside in any contiguous memory):

```
(1 2 3)
```

This expands to:

```
1
2
3
TUPLE:3
```

The TUPLE tag at the end denotes that three values immediately precede it, forming a logical group. This tag is not a pointer in the C sense—it is a footer token encoding tuple length and structure type. Functions use this tag to identify and process the grouped values, without relying on external headers, descriptors, or memory indirection. This enables Tuples to behave as stack-local TLVs: self-describing segments that are positionally located and structurally delimited.

The representation is position-based and entirely local to the contiguous memory region. No pointer dereferencing, allocation, or header/footer scanning is needed. Tuple boundaries are determined through tagged offsets only.

Unlike traditional arrays, which typically enforce homogeneous element types, Tuples can contain heterogeneous data—including numbers, symbols, strings, and even nested Tuples. Their primary role is to group values structurally rather than impose uniform type constraints. This flexibility makes Tuples ideal for representing diverse data structures while maintaining a consistent memory layout.

### 3.2 Basic Tuple Operations

Tuple-aware words operate on the structure implicitly. For example:

```
(1 2 3) length
```

This computes the tuple's length by extracting the encoded count from the tuple tag tag. The result is:

```
3
```

Operations like `dup`, `drop`, `swap`, and `store` also work on Tuples when the tuple tag is present. Duplication duplicates the entire Tuple, including the tuple tag and all underlying items. Dropping a Tuple removes the entire segment at once.

Assignment is transparent: Tuples can be stored in and loaded from variables just like scalars. The Tuple contents are copied into or out of the variable, retaining the tuple tag structure.

### 3.3 Broadcasting Arithmetic with Tuples

Arithmetic operators are defined polymorphically. When applied to two Tuples of equal length, the operator is broadcast element-wise across the pair. For example:

```
(1 2 3) (4 5 6) +
```

This evaluates to:

```
(5 7 9)
```

The Tuple lengths must match. The tuple tags are used to identify the range and verify compatibility. Each pair of elements is retrieved from the stack, the operation is applied, and a new Tuple is constructed with the results.

Broadcasted operations preserve structural information. The resulting Tuple has the same length and ordering as the operands, and is terminated with a new tuple tag.

### 3.4 Scalar Broadcasting

When one operand is a scalar and the other a Tuple, the scalar is broadcast across the Tuple:

```
(1 2 3) 10 +
```

Produces:

```
(11 12 13)
```

The scalar `10` is treated as if repeated for each element in the Tuple. The system performs one traversal over the Tuple, applying the operator between each item and the scalar.

Broadcasting is symmetric. The same result would occur if the scalar were on the left and the Tuple on the right.

### 3.5 Generalized Broadcasting

Broadcasting applies recursively. A scalar can be broadcast across a Tuple of scalars, a Tuple of Tuples, or even irregular nested structures. The operator is applied at each compatible element pair.

Broadcasting is defined structurally, not through type coercion or promotion rules. The Tuple and scalar are treated as operands of a common recursive traversal, and operations are applied at matching levels of structure.

In cases where broadcasting would violate length compatibility or type expectations, the operation fails early or propagates a tagged sentinel indicating error.

### 3.6 Combining Tuples: The Zip Operation

Tacit includes a `zip` operation to combine multiple Tuples into a single Tuple of grouped tuples. Given two Tuples:

```
(1 2 3) (4 5 6)
```

Executing:

```
zip
```

Results in:

```
((1 4) (2 5) (3 6))
```

Each pair of corresponding elements is grouped into a new span, and those grouped pairs are themselves collected into an enclosing span. This creates a shallow two-dimensional structure.

The zip operator requires equal-length spans. Internally, it descends into each span simultaneously, pairing elements and emitting grouped results as new spans. The resulting span is then terminated with a tuple tag of its own, preserving structural information.

Zipped Tuples are useful for operations such as coordinate mapping, key-value pairing, or argument bundling. Because all structure is retained on the stack using tuple tags, the resulting Tuples remain lightweight and immediately accessible.

## 4. Nested Tuples and Multidimensional Arrays

Building on the concept of one-dimensional Tuples, Tacit supports *nested Tuples*, enabling representation of multidimensional arrays and more complex hierarchical data structures directly on the stack.

### 4.1 Defining Nested Tuples

Nested Tuples are created by including Tuples within other Tuples. This is done by opening a new span with `(` inside an existing span. For example, a two-dimensional 2x2 array can be represented as:

```
((1 2) (3 4))
```

This creates a Tuple that itself contains two Tuples. The structure is recursive: each inner Tuple has its own tuple tag, and the outer Tuple encompasses all inner elements plus tuple tags.

### 4.2 Multidimensional Array Representation

Nested Tuples allow Tacit to model multidimensional arrays without flattening them immediately. Each level of nesting corresponds to one dimension in the array.

This approach provides a flexible structure where each dimension can vary independently, supporting ragged or irregular arrays as well as regular ones.

### 4.3 Recursive Descent Traversal

To operate on nested Tuples, Tacit employs *recursive descent traversal*. This traversal method processes Tuples by recursively visiting each child Tuple or element, applying operations at the appropriate depth.

The traversal algorithm works as follows:

* When encountering a Tuple, descend into its elements recursively.
* For scalar values (non-Tuple), apply the operation directly.
{{ ... }}

While Tuples resemble TLV formats in structure, they extend beyond simple framing. Tuples are active computation units—suitable not only for serialization but also for vectorized evaluation, polymorphic traversal, and compositional recombination. Unlike traditional TLV-encoded messages, which are meant for passive decoding, Tuples are designed for live use: passed between functions, restructured, and manipulated directly in-place.

## 5. Polymorphism of Tuple Buffers and Scalars in Tacit

Tacit supports uniform treatment of scalars, Tuples, and nested Tuples through a polymorphic data model. All values on the stack are interpreted based on tags and structure rather than static types. This model allows scalar values and structured sequences to participate in the same operations, enabling concise and generalized behavior across diverse inputs.

#### 5.1 Uniform Value Representation

Scalars and Tuples share a unified representation. A scalar is a single tagged value. A Tuple is a group of values terminated by a tuple tag. A Tuple buffer may include multiple dimensions; its shape must be regular to allow for stride-based addressing. The following metadata is preserved when flattening:

{{ ... }}
* A shape vector describing the size of each dimension
* A stride vector for computing offsets during indexed access

The flattening process combines iterations over all dimensions into a single buffer, computing a linear offset for each element based on the stride. This allows arbitrary nested Tuples to be represented using a compact, linear buffer.

### 5.2 Broadcast Semantics in Operations

Arithmetic and logical operations in Tacit follow broadcast rules. If two operands are scalars, the operation applies directly. If one operand is a Tuple, the operation applies to each element of the Tuple, with the scalar operand broadcast across all positions. If both operands are Tuples, the operation is applied pairwise. If either operand is a nested Tuple, the same rules apply recursively.

Broadcasting is structural, not symbolic. It respects span boundaries and proceeds recursively through nested Tuples. This allows deep operations—addition of nested arrays, logical comparisons between structured data—to be expressed without explicit loops or traversal code.

Broadcasting is symmetric: the scalar may appear in any operand position, and the broadcast occurs toward the structured argument. This ensures that all operations maintain their natural ordering and arity, while allowing structure to emerge flexibly.

### 5.3 Storage and Variable Interactions

Variables in Tacit can store scalars or Tuples without distinction. When a value is stored, its entire structure—including any nested Tuples and tuple tags—is copied to the destination. When loaded, the entire structure is pushed back onto the stack. This allows Tuples to be passed, reused, and duplicated just like scalar values.

No boxing or wrapping is required. A variable slot can hold any tagged value, and its interpretation is deferred to runtime. Functions accessing variables need not be rewritten to distinguish scalar from Tuple content.

This uniform storage model makes it possible to build pipelines and combinators that operate generically on structured data, without encoding specific assumptions about the shape or type of the input.

### 5.4 Runtime Type Identification and Tagging

Tacit uses a runtime tagging system to distinguish value kinds. Tags identify whether a value is a scalar, a tuple tag, a pointer to a vector buffer, or another structure. These tags are compact, typically encoded in the low bits of the value or in adjacent metadata.

Operations check tags at runtime to determine how to proceed. For example, an arithmetic operation checks whether its operands are scalars or Tuples. If Tuples, it reads the associated tuple tag to determine structure and recursively applies the operation.

This tag-based dispatch is fast and minimal. It avoids the need for virtual tables or dynamic dispatch mechanisms common in object-oriented systems. The control logic is simple and uniform: read the tag, interpret structure, recurse if necessary.

### 5.5 Advantages of Tacit's Polymorphism Model

Polymorphism in Tacit reduces code duplication and enhances composability. A single function can handle a scalar input, a flat vector, or a multidimensional nested Tuple, with no change in logic. The same mapping or reduction routine applies across structures, guided solely by the shape and tuple layout of the data.

The stack discipline ensures memory safety and locality. Structured data is allocated and deallocated with ordinary stack operations. There is no need for garbage collection, heap boxing, or explicit type coercion.

This model allows high-level abstractions to be built from low-level primitives. The same arithmetic word used for scalar addition is also the engine for array broadcasting. The same logic for storing a single value also handles vectors or matrices. By collapsing the distinction between scalars and aggregates, Tacit provides a compact, expressive foundation for structured programming.

### 5.6 Callable Tuples (Capsules)

A capsule is a tuple whose final slot is a function reference. This structure is treated as callable: applying `eval` to the capsule invokes the function, passing the tuple itself as input. The function may treat earlier values as arguments, bindings, or state, depending on context.

Capsules behave like value-based closures. They follow tuple semantics—copy by value, store in locals, pass on stack—but gain the ability to act as partially applied functions or dynamic objects. The function is not quoted when stored; it must be a proper function reference (e.g., `@add`, not `add`).

The most common capsule form uses the final slot as `apply`, a function expecting the capsule as input:

```
(2 3 @add) eval    → 5
```

Here `@add` consumes `2 3` and produces `5`. The capsule is interpreted as a self-contained thunk.

Capsules also support mutable state: if the function in the final slot mutates earlier fields, the capsule can act like a stateful iterator or cursor. These are covered in the sequence and coroutine models.

Capsules are ordinary tuples with functional intent. They require no new representation or type, only a convention: final slot is a function, and `eval` invokes it.

### 5.7 Self-Modifying Capsules

When a capsule is evaluated via `eval`, its structure is interpreted as a parameter frame for the function it references. The function must be a proper function reference (e.g., `@next`) occupying the final slot of the tuple; all preceding slots are interpreted as local variable values.

#### Execution Protocol

* The capsule is passed to `eval`.
* The evaluator extracts the function reference from the final slot.
* Metadata associated with the function (stored in the function dictionary) provides the expected number of local variables (`n`).
* The first `n` elements of the capsule are copied into the current function’s local variable table, indexed via the base pointer (BP).
* The function is invoked with access to these locals. It may mutate them directly.
* On return, the first `n` local variable slots are copied **back** into the capsule, mutating it **in-place**.

This round-trip allows the capsule to serve as both an input environment and a persistent state container. The tuple itself is not copied or recreated; it is updated directly in memory—on the stack or in a buffer—depending on where it resides.

#### Creation Protocol

* The tuple must be sized correctly to match the function's declared local variable count (`n`) plus one slot for the function reference.
* Construction macros or combinators may query the function dictionary for the arity to construct a valid capsule shape.
* Capsules may be constructed on the stack, in buffers, or as part of a larger data structure. If used in-place, they should not escape the scope of their validity (e.g., returned from a function with stack-based storage).

#### Safety and Reuse

* Capsules are self-modifying only if they are **passed by reference** (e.g., held in a local variable, buffer, or memory segment). Stack-passed capsules mutate transiently and are not reusable.
* Mutability is an implementation detail of the function itself. Stateless capsules will ignore or overwrite input fields.

#### Implications

* Capsules form a lightweight closure-like construct without true closure semantics: all state is explicitly stored.
* Capsules support resumable, stateful control flow (e.g., coroutines, generators) without heap allocation or garbage collection.
* This model enforces purity at the call site (no ambient scope access) while enabling mutation inside the tuple context.

## 6. Conclusion: The Significance of Tuples in Tacit

Tacit reconceives contiguous memory regions—whether on the stack, in buffers, or in arrays—as coherent substrates for expressing structured, hierarchical data. Through tuples and tagged references, these regions become persistent, inspectable, and traversable layouts for sequences, arrays, and trees—without recourse to heap allocation, external data structures, or runtime indirection.

Tuples give structure to contiguous memory by marking and delineating groups of values. These groups act as first-class values: passed to functions, stored in variables, consumed by polymorphic operators. Nesting tuples enables a full representation of multidimensional arrays, and with recursive traversal, any operation expressible over vectors extends to arbitrarily deep composite structures. The tuple thus serves as the foundation for Tacit's data model, not merely an encoding trick or calling convention.

This model now extends further: **capsules**, or callable tuples with embedded function references, enable stateful and partially applied computations. When evaluated, a capsule copies its internal values into the function’s stack frame, executes the function with those values as locals, and then writes any changes back—mutating the capsule in-place. This allows a capsule to behave like a resumable coroutine or iterator, retaining its state across invocations while avoiding heap allocation or closure semantics. Capsules inherit the tuple’s simplicity and locality, while adding behavior and persistence.

Tacit’s call protocol relies on metadata associated with each function to determine how many locals are expected, enabling evaluation without external scaffolding. Combined with segment-aware reference pointers and self-identifying structures—like buffers with tagged headers and tuples with embedded arity—Tacit achieves mutation, polymorphism, and structure-awareness across segments and storage media without losing transparency or predictability.

This collapses the traditional boundary between data and computation. Where other languages separate memory regions from structured behavior—forcing boxing, garbage collection, or hidden runtime models—Tacit uses the same substrate for values, structures, and stateful processes. Tuples become not just data containers but programmable environments.

By encoding structure directly into layout, Tacit eliminates the need for runtime bookkeeping. Tuples carry their extent implicitly via tuple tags; nested structures preserve hierarchy through contiguity. The result is a language model that avoids dynamic allocation and runtime indirection while preserving expressiveness and flexibility.

In this way, Tacit demonstrates that structured computation need not rely on object orientation, heap allocation, or virtual dispatch. Its minimal substrate—grouped values with typed tags and tuple-aware references—supports computation, composition, and control flow without hidden cost.

The tuple model is a core component of this vision. Whether representing function arguments, managing buffers, defining capsules, or composing sequences, tuples unify Tacit’s approach to structure and execution. Their simplicity, combined with the new capability of in-place evaluation and mutation, gives Tacit both expressive power and a concrete, inspectable model of computation.
