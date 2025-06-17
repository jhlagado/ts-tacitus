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
    - [2.3 The Close Parenthesis `)` — Computing and Pushing the Span Pointer](#23-the-close-parenthesis---computing-and-pushing-the-span-pointer)
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
  - [6. Polymorphism of Tuple Buffers and Scalars in Tacit](#6-polymorphism-of-tuple-buffers-and-scalars-in-tacit)
    - [6.1 Uniform Value Representation](#61-uniform-value-representation)
    - [6.2 Broadcast Semantics in Operations](#62-broadcast-semantics-in-operations)
    - [6.3 Storage and Variable Interactions](#63-storage-and-variable-interactions)
    - [6.4 Runtime Type Identification and Tagging](#64-runtime-type-identification-and-tagging)
    - [6.5 Advantages of Tacit's Polymorphism Model](#65-advantages-of-tacits-polymorphism-model)
  - [7. Conclusion: The Significance of Tuples in Tacit](#7-conclusion-the-significance-of-tuples-in-tacit)

# Tuples

## 1. Introduction

### 1.1 Overview

Tuples are a core abstraction in Tacit, providing a lightweight mechanism for representing composite data such as arrays, lists, and tables. A Tuple consists of one or more contiguous values marked by a special footer called a *span pointer*.

While Tuples are commonly used on Tacit's data stack, they can reside in any contiguous storage medium—including buffers, arrays, or memory regions. This document describes how Tuples are constructed, manipulated, and used within Tacit. It explains the mechanisms by which spans are created and managed, how they are recognized and processed by functions, and how they enable a range of higher-level data abstractions.

Unlike heap-allocated objects in conventional languages, Tuples reside in linear memory and are delimited by local information. A span's end is determined relative to its start, using offsets computed at runtime. This allows dynamic construction of data structures with no external bookkeeping or garbage collection.

Tuples are stack-native but not stack-bound. They can be constructed on the data stack, stored in local buffers, or passed across coroutines using shared memory. Their encoding is minimal: the data itself is untagged, and only the span pointer at the end of a sequence serves as an indicator of its structure. This enables efficient memory layout, simple traversal, and compact representation.

Tacit treats the stack not as a transient space but as a composable data model. Functions operate on Tuples using broadcasting, indexing, and recursion by descent. Operators are polymorphic across scalars and Tuples, with functions inspecting structure at runtime to apply correct behavior. All composite data in Tacit, including arrays and records, builds upon this foundation.

The following sections define how Tuples are constructed with grouping operators, how they are traversed and transformed, and how they serve as the basis for polymorphic operations and multidimensional arrays.

### 1.2 Tuples as TLV-like Structures

Though Tacit was not designed with TLV formats in mind, Tuples share a similar compositional strategy. In traditional Type–Length–Value systems (used in binary protocols like BER, DER, and TLV-based messages), a value is framed by a type identifier and a length, usually prepended. This allows parsers to identify what kind of data follows and how far to read.

Tuples invert this model. Instead of a header, Tacit uses a footer—a tagged word at the end of a sequence that encodes its length and type. This allows forward-construction (push values first, then tag them), efficient stack unwinding, and minimal overhead. Unlike typical TLV encodings, Tuples operate at the word level, not byte level, and serve both execution and representation purposes. The model aligns more closely with runtime stack processing than static serialization but benefits from similar framing semantics.

## 2. Representing Groups on the Stack with Parentheses

Tacit introduces grouping constructs using a pair of delimiters: the open parenthesis `(` and the close parenthesis `)`. These create spans—contiguous groups of values on the data stack that act as composite structures. The resulting Tuples are treated as first-class data and may represent vectors, records, or elements of higher-dimensional arrays. The grouping mechanism is stack-native, efficient, and designed to preserve lexical structure through span pointers rather than heap references.

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

### 2.3 The Close Parenthesis `)` — Computing and Pushing the Span Pointer

When the closing parenthesis `)` is encountered, the runtime:

1. Counts the number of values pushed since the matching opening parenthesis.
2. Creates a tag containing this count—known as a *span pointer*—that indicates how many items to skip backward to find the start of the group.
3. Pushes this span pointer tag onto the stack, marking the end of the grouped values.

This span pointer does not contain an absolute memory address. Instead, it encodes how many items to move backward on the stack to recover the entire span. It functions as a compact footer that delimits the Tuple from the top and enables efficient traversal of the structure.

For example:

```
( 10 20 30 )
```

Yields:

```
10
20
30
SPAN:3
```

The span pointer tag `SPAN:3` allows functions like `sum` to identify the start of the span and operate on the enclosed values without requiring an external data structure.

### 2.4 Example Walkthrough

Let's trace the stack operations for grouping in the expression `(1 2 3)`:

1. `(` — Remember current stack depth for start of group (e.g., depth 0)
2. `1` — Push value 1 onto stack (depth 1)
3. `2` — Push value 2 onto stack (depth 2) 
4. `3` — Push value 3 onto stack (depth 3)
5. `)` — Compute count = current depth - start depth = 3 - 0 = 3
   — Push SPAN:3 onto stack (depth 4)

After execution, the stack contains `[1, 2, 3, SPAN:3]`

### 2.5 Using Tuples in Functions

Functions can recognize and operate on Tuples through their span pointers. For example, a function to sum a Tuple:

```
( 10 20 30 ) sum
```

Is interpreted as:

* `SPAN:3` → consume and interpret as a span of 3 items
* Operate on `10 20 30`
* Compute sum: `60`
* Remove the three values and the span pointer
* Push result: `60`

Final stack:

```
[60]
```

Functions treat Tuples as variadic argument bundles. No array or pointer representation is constructed. The grouping is implicit in stack layout, and the tagged span pointer enables precise recovery of that layout.

### 2.6 Code Snippet (Pseudo Tacit VM Steps)

```
// For the expression (1 2 3)
onOpenParen():  pushMarker(GROUPSTART)  // Internal marker, not visible on data stack
onValue(1):  push(1)
onValue(2):  push(2)
onValue(3):  push(3)
onCloseParen():  itemCount = countSinceMarker(GROUPSTART)  popMarker(GROUPSTART)  push(makeSpanPointer(itemCount))
```

This style of group parsing is deterministic, with all boundaries derived from span pointer tags. No heap or object structure is introduced; everything resides on the native data stack.

### 2.7 Summary

The key mechanisms of the grouping system are:

1. Open parenthesis marks the start of a group (invisible to data stack).
2. Values are pushed directly onto the data stack.
3. Close parenthesis computes a span pointer tag encoding the span length.
4. The span pointer serves as a footer marking the extent of the span.
5. Functions can identify Tuples by recognizing span pointer tags and tracing backward.

This design avoids any special header marking the start of a span. The only structural marker is a span pointer tag at the end—compact, local, and easily traced. The result is a backward-delimited, stack-native structure that enables efficient traversal and value recovery without external metadata.

Conceptually, this mirrors a type–length–value (TLV) pattern, commonly found in serialization formats like ASN.1 or CBOR. In TLV, a type byte and a length field precede the value. In Tacit, the "type" is embedded in the span tag, the "length" is its payload, and the "value" is the preceding sequence. The crucial difference: Tacit places this tag after the data, supporting dynamic, forward construction and backward introspection without needing a precomputed length or reserved prefix space. It is TLV reinterpreted through a stack lens.

## 3. Working with Tuples: One-Dimensional Vectors in Contiguous Memory

In Tacit, Tuples are treated as one-dimensional vectors built in contiguous memory regions. A Tuple consists of a contiguous group of values delimited by a `SPAN` tag (span pointer), which encodes its length. Tuples are not boxed or heap-allocated; instead, they exist in place within their storage medium (whether that's a stack, buffer, or array) and serve as a compact representation of arrays, sequences, and parameter bundles. This section describes how Tuples behave as vectors and how operations over them are defined.

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
SPAN:3
```

The SPAN tag at the end denotes that three values immediately precede it, forming a logical group. This tag is not a pointer in the C sense—it is a footer token encoding span length and structure type. Functions use this tag to identify and process the grouped values, without relying on external headers, descriptors, or memory indirection. This enables Tuples to behave as stack-local TLVs: self-describing segments that are positionally located and structurally delimited.

The representation is position-based and entirely local to the contiguous memory region. No pointer dereferencing, allocation, or header/footer scanning is needed. Tuple boundaries are determined through tagged offsets only.

Unlike traditional arrays, which typically enforce homogeneous element types, Tuples can contain heterogeneous data—including numbers, symbols, strings, and even nested Tuples. Their primary role is to group values structurally rather than impose uniform type constraints. This flexibility makes Tuples ideal for representing diverse data structures while maintaining a consistent memory layout.

### 3.2 Basic Tuple Operations

Tuple-aware words operate on the structure implicitly. For example:

```
(1 2 3) length
```

This computes the span's length by extracting the encoded count from the span pointer tag. The result is:

```
3
```

Operations like `dup`, `drop`, `swap`, and `store` also work on Tuples when the span pointer tag is present. Duplication duplicates the entire Tuple, including the span pointer and all underlying items. Dropping a Tuple removes the entire segment at once.

Assignment is transparent: Tuples can be stored in and loaded from variables just like scalars. The Tuple contents are copied into or out of the variable, retaining the span pointer structure.

### 3.3 Broadcasting Arithmetic with Tuples

Arithmetic operators are defined polymorphically. When applied to two Tuples of equal length, the operator is broadcast element-wise across the pair. For example:

```
(1 2 3) (4 5 6) +
```

This evaluates to:

```
(5 7 9)
```

The Tuple lengths must match. The span pointers are used to identify the range and verify compatibility. Each pair of elements is retrieved from the stack, the operation is applied, and a new Tuple is constructed with the results.

Broadcasted operations preserve structural information. The resulting Tuple has the same length and ordering as the operands, and is terminated with a new span pointer.

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

The zip operator requires equal-length spans. Internally, it descends into each span simultaneously, pairing elements and emitting grouped results as new spans. The resulting span is then terminated with a span pointer of its own, preserving structural information.

Zipped Tuples are useful for operations such as coordinate mapping, key-value pairing, or argument bundling. Because all structure is retained on the stack using span pointers, the resulting Tuples remain lightweight and immediately accessible.

## 4. Nested Tuples and Multidimensional Arrays

Building on the concept of one-dimensional Tuples, Tacit supports *nested Tuples*, enabling representation of multidimensional arrays and more complex hierarchical data structures directly on the stack.

### 4.1 Defining Nested Tuples

Nested Tuples are created by including Tuples within other Tuples. This is done by opening a new span with `(` inside an existing span. For example, a two-dimensional 2x2 array can be represented as:

```
((1 2) (3 4))
```

This creates a Tuple that itself contains two Tuples. The structure is recursive: each inner Tuple has its own span pointer, and the outer Tuple encompasses all inner elements plus span pointers.

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

## 6. Polymorphism of Tuple Buffers and Scalars in Tacit

Tacit supports uniform treatment of scalars, Tuples, and nested Tuples through a polymorphic data model. All values on the stack are interpreted based on tags and structure rather than static types. This model allows scalar values and structured sequences to participate in the same operations, enabling concise and generalized behavior across diverse inputs.

### 6.1 Uniform Value Representation

Scalars and Tuples share a unified representation. A scalar is a single tagged value. A Tuple is a group of values terminated by a span pointer. A Tuple buffer may include multiple dimensions; its shape must be regular to allow for stride-based addressing. The following metadata is preserved when flattening:

{{ ... }}
* A shape vector describing the size of each dimension
* A stride vector for computing offsets during indexed access

The flattening process combines iterations over all dimensions into a single buffer, computing a linear offset for each element based on the stride. This allows arbitrary nested Tuples to be represented using a compact, linear buffer.

### 6.2 Broadcast Semantics in Operations

Arithmetic and logical operations in Tacit follow broadcast rules. If two operands are scalars, the operation applies directly. If one operand is a Tuple, the operation applies to each element of the Tuple, with the scalar operand broadcast across all positions. If both operands are Tuples, the operation is applied pairwise. If either operand is a nested Tuple, the same rules apply recursively.

Broadcasting is structural, not symbolic. It respects span boundaries and proceeds recursively through nested Tuples. This allows deep operations—addition of nested arrays, logical comparisons between structured data—to be expressed without explicit loops or traversal code.

Broadcasting is symmetric: the scalar may appear in any operand position, and the broadcast occurs toward the structured argument. This ensures that all operations maintain their natural ordering and arity, while allowing structure to emerge flexibly.

### 6.3 Storage and Variable Interactions

Variables in Tacit can store scalars or Tuples without distinction. When a value is stored, its entire structure—including any nested Tuples and span pointers—is copied to the destination. When loaded, the entire structure is pushed back onto the stack. This allows Tuples to be passed, reused, and duplicated just like scalar values.

No boxing or wrapping is required. A variable slot can hold any tagged value, and its interpretation is deferred to runtime. Functions accessing variables need not be rewritten to distinguish scalar from Tuple content.

This uniform storage model makes it possible to build pipelines and combinators that operate generically on structured data, without encoding specific assumptions about the shape or type of the input.

### 6.4 Runtime Type Identification and Tagging

Tacit uses a runtime tagging system to distinguish value kinds. Tags identify whether a value is a scalar, a span pointer, a pointer to a vector buffer, or another structure. These tags are compact, typically encoded in the low bits of the value or in adjacent metadata.

Operations check tags at runtime to determine how to proceed. For example, an arithmetic operation checks whether its operands are scalars or Tuples. If Tuples, it reads the associated span to determine structure and recursively applies the operation.

This tag-based dispatch is fast and minimal. It avoids the need for virtual tables or dynamic dispatch mechanisms common in object-oriented systems. The control logic is simple and uniform: read the tag, interpret structure, recurse if necessary.

### 6.5 Advantages of Tacit's Polymorphism Model

Polymorphism in Tacit reduces code duplication and enhances composability. A single function can handle a scalar input, a flat vector, or a multidimensional nested Tuple, with no change in logic. The same mapping or reduction routine applies across structures, guided solely by the shape and span layout of the data.

The stack discipline ensures memory safety and locality. Structured data is allocated and deallocated with ordinary stack operations. There is no need for garbage collection, heap boxing, or explicit type coercion.

This model allows high-level abstractions to be built from low-level primitives. The same arithmetic word used for scalar addition is also the engine for array broadcasting. The same logic for storing a single value also handles vectors or matrices. By collapsing the distinction between scalars and aggregates, Tacit provides a compact, expressive foundation for structured programming.

## 7. Conclusion: The Significance of Tuples in Tacit

Tacit reconceives contiguous memory regions—whether on the stack, in buffers, or in arrays—as coherent substrates for expressing structured, hierarchical data. Through Tuples and span pointers, these memory regions become persistent, inspectable, and traversable layouts for sequences, arrays, and trees—without recourse to heap allocation, external data structures, or runtime indirection.

Tuples give structure to contiguous memory by marking and delineating groups of values. These groups act as first-class values: passed to functions, stored in variables, consumed by polymorphic operators. Nesting Tuples enables a full representation of multidimensional arrays, and with recursive traversal, any operation expressible over vectors extends to arbitrarily deep composite structures. The Tuple thus serves as the foundation for Tacit's data model, not merely an encoding trick or calling convention.

This approach collapses the traditional boundary between data and computation. Where other languages separate different memory regions from structured data—forcing heap allocation, boxing, or special-purpose APIs—Tacit uses the same mechanisms to manipulate simple values, structured tuples, or whole arrays regardless of storage medium. Grouping and ungrouping are part of normal operations, enabling concise expression of transformations, aggregations, and compositions.

By encoding structure directly into layout, Tacit eliminates the need for runtime bookkeeping. Tuples carry their extent implicitly via span pointers, and nested structures preserve hierarchy through contiguity. This design avoids garbage collection, pointer-chasing, or dynamic allocation while retaining expressiveness and polymorphism.

Tacit's Tuple model is not just efficient—it is conceptually elegant. It presents an alternative to object-oriented and heap-based paradigms, demonstrating that structured computation need not rely on complex memory management. Tacit's minimal substrate—grouped values on a stack with tagged span pointers—supports vectorization, recursion, and multidimensional indexing without compromise.

In a broader sense, this reflects Tacit's philosophy: language and runtime should not exceed what can be reasoned about directly. Tuples are not an abstraction layer; they are visible, manipulable structure that can exist in any contiguous memory region—whether on the stack, in buffers, or in arrays. The same principles apply to arrays, closures, and communication—no hidden runtime, no opaque allocator, no virtual dispatch.

The Tuple model serves as a core component of Tacit. Whether representing function arguments in stack operations, managing structured data in buffers, or organizing memory regions for computation, Tuples provide a unified approach to data structure. This cohesion—between structure, memory, and language semantics—gives Tacit both power and simplicity.
