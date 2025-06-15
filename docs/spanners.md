# Spanners

## Table of Contents

- [Spanners](#spanners)
  - [Table of Contents](#table-of-contents)
- [Spanners](#spanners-1)
  - [1. Introduction](#1-introduction)
    - [1.1 Overview](#11-overview)
    - [1.2 Spanners as TLV-like Structures](#12-spanners-as-tlv-like-structures)
  - [2. Representing Groups on the Stack with Parentheses](#2-representing-groups-on-the-stack-with-parentheses)
    - [2.1 The Open Parenthesis `(` — Marking the Group Start](#21-the-open-parenthesis---marking-the-group-start)
    - [2.2 Pushing Values Inside the Group](#22-pushing-values-inside-the-group)
    - [2.3 The Close Parenthesis `)` — Computing and Pushing the Span Pointer](#23-the-close-parenthesis---computing-and-pushing-the-span-pointer)
    - [2.4 Example Walkthrough](#24-example-walkthrough)
    - [2.5 Using Spanners in Functions](#25-using-spanners-in-functions)
    - [2.6 Code Snippet (Pseudo Tacit VM Steps)](#26-code-snippet-pseudo-tacit-vm-steps)
    - [2.7 Summary](#27-summary)
  - [3. Working with Spanners: One-Dimensional Vectors in Contiguous Memory](#3-working-with-spanners-one-dimensional-vectors-in-contiguous-memory)
    - [3.1 Representing Spanners in Memory](#31-representing-spanners-in-memory)
    - [3.2 Basic Spanner Operations](#32-basic-spanner-operations)
    - [3.3 Broadcasting Arithmetic with Spanners](#33-broadcasting-arithmetic-with-spanners)
    - [3.4 Scalar Broadcasting](#34-scalar-broadcasting)
    - [3.5 Generalized Broadcasting](#35-generalized-broadcasting)
    - [3.6 Combining Spanners: The Zip Operation](#36-combining-spanners-the-zip-operation)
  - [4. Nested Spanners and Multidimensional Arrays](#4-nested-spanners-and-multidimensional-arrays)
    - [4.1 Defining Nested Spanners](#41-defining-nested-spanners)
    - [4.2 Multidimensional Array Representation](#42-multidimensional-array-representation)
    - [4.3 Recursive Descent Traversal](#43-recursive-descent-traversal)
    - [4.4 Traversal Use Cases](#44-traversal-use-cases)
    - [4.5 Efficient Traversal and Stack Management](#45-efficient-traversal-and-stack-management)
  - [5. Efficient Representation and Conversion of Spanner Buffers in Tacit](#5-efficient-representation-and-conversion-of-spanner-buffers-in-tacit)
    - [5.1 Recursive Traversal of Spanner Buffers](#51-recursive-traversal-of-spanner-buffers)
    - [5.2 Flattening Nested Spanners](#52-flattening-nested-spanners)
    - [5.3 Building Shape and Stride Metadata](#53-building-shape-and-stride-metadata)
    - [5.4 Conversion Algorithm Overview](#54-conversion-algorithm-overview)
    - [5.5 Trade-offs Between Nested and Flat Representations](#55-trade-offs-between-nested-and-flat-representations)
  - [6. Polymorphism of Spanner Buffers and Scalars in Tacit](#6-polymorphism-of-spanner-buffers-and-scalars-in-tacit)
    - [6.1 Uniform Value Representation](#61-uniform-value-representation)
    - [6.2 Broadcast Semantics in Operations](#62-broadcast-semantics-in-operations)
    - [6.3 Storage and Variable Interactions](#63-storage-and-variable-interactions)
    - [6.4 Runtime Type Identification and Tagging](#64-runtime-type-identification-and-tagging)
    - [6.5 Advantages of Tacit's Polymorphism Model](#65-advantages-of-tacits-polymorphism-model)
  - [7. Conclusion: The Significance of Spanners in Tacit](#7-conclusion-the-significance-of-spanners-in-tacit)

# Spanners

## 1. Introduction

### 1.1 Overview

Spanners are a core abstraction in Tacit, providing a lightweight mechanism for representing composite data such as arrays, lists, and tables. A Spanner consists of one or more contiguous values marked by a special footer called a *span pointer*.

While Spanners are commonly used on Tacit's data stack, they can reside in any contiguous storage medium—including buffers, arrays, or memory regions. This document describes how Spanners are constructed, manipulated, and used within Tacit. It explains the mechanisms by which spans are created and managed, how they are recognized and processed by functions, and how they enable a range of higher-level data abstractions.

Unlike heap-allocated objects in conventional languages, Spanners reside in linear memory and are delimited by local information. A span's end is determined relative to its start, using offsets computed at runtime. This allows dynamic construction of data structures with no external bookkeeping or garbage collection.

Spanners are stack-native but not stack-bound. They can be constructed on the data stack, stored in local buffers, or passed across coroutines using shared memory. Their encoding is minimal: the data itself is untagged, and only the span pointer at the end of a sequence serves as an indicator of its structure. This enables efficient memory layout, simple traversal, and compact representation.

Tacit treats the stack not as a transient space but as a composable data model. Functions operate on Spanners using broadcasting, indexing, and recursion by descent. Operators are polymorphic across scalars and Spanners, with functions inspecting structure at runtime to apply correct behavior. All composite data in Tacit, including arrays and records, builds upon this foundation.

The following sections define how Spanners are constructed with grouping operators, how they are traversed and transformed, and how they serve as the basis for polymorphic operations and multidimensional arrays.

### 1.2 Spanners as TLV-like Structures

Though Tacit was not designed with TLV formats in mind, Spanners share a similar compositional strategy. In traditional Type–Length–Value systems (used in binary protocols like BER, DER, and TLV-based messages), a value is framed by a type identifier and a length, usually prepended. This allows parsers to identify what kind of data follows and how far to read.

Spanners invert this model. Instead of a header, Tacit uses a footer—a tagged word at the end of a sequence that encodes its length and type. This allows forward-construction (push values first, then tag them), efficient stack unwinding, and minimal overhead. Unlike typical TLV encodings, Spanners operate at the word level, not byte level, and serve both execution and representation purposes. The model aligns more closely with runtime stack processing than static serialization but benefits from similar framing semantics.

## 2. Representing Groups on the Stack with Parentheses

Tacit introduces grouping constructs using a pair of delimiters: the open parenthesis `(` and the close parenthesis `)`. These create spans—contiguous groups of values on the data stack that act as composite structures. The resulting Spanners are treated as first-class data and may represent vectors, records, or elements of higher-dimensional arrays. The grouping mechanism is stack-native, efficient, and designed to preserve lexical structure through span pointers rather than heap references.

### 2.1 The Open Parenthesis `(` — Marking the Group Start

When the open parenthesis `(` is executed, Tacit saves the current data stack pointer (DSP) by pushing it onto the return stack. This saved pointer acts as a marker: it denotes the position of the stack before any group elements were added. The system does not perform any additional allocation or tagging at this point—only the start address is recorded.

This operation is cheap, requiring only a return stack push, and does not modify the data stack or inject any metadata into the sequence. It simply bookmarks the start of a pending group.

### 2.2 Pushing Values Inside the Group

Once the group has been opened, any values pushed onto the data stack become part of the group. These may include scalars, other spans, or even compound structures. All items pushed after the open parenthesis are considered logically contiguous. For example:

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

This span pointer does not contain an absolute memory address. Instead, it encodes how many items to move backward on the stack to recover the entire span. It functions as a compact footer that delimits the Spanner from the top and enables efficient traversal of the structure.

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

### 2.5 Using Spanners in Functions

Functions can recognize and operate on Spanners through their span pointers. For example, a function to sum a Spanner:

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

Functions treat Spanners as variadic argument bundles. No array or pointer representation is constructed. The grouping is implicit in stack layout, and the tagged span pointer enables precise recovery of that layout.

### 2.6 Code Snippet (Pseudo Tacit VM Steps)

```
// For the expression (1 2 3)

onOpenParen():
  pushMarker(GROUPSTART)  // Internal marker, not visible on data stack
  
onValue(1):
  push(1)
  
onValue(2):
  push(2)
  
onValue(3):
  push(3)
  
onCloseParen():
  itemCount = countSinceMarker(GROUPSTART)
  popMarker(GROUPSTART)
  push(makeSpanPointer(itemCount))  // Span pointer tag with count=3
```

This style of group parsing is deterministic, with all boundaries derived from span pointer tags. No heap or object structure is introduced; everything resides on the native data stack.

### 2.7 Summary

The key mechanisms of the grouping system are:

1. Open parenthesis marks the start of a group (invisible to data stack).
2. Values are pushed directly onto the data stack.
3. Close parenthesis computes a span pointer tag encoding the span length.
4. The span pointer serves as a footer marking the extent of the span.
5. Functions can identify Spanners by recognizing span pointer tags and tracing backward.

This design avoids any special header marking the start of a span. The only structural marker is a span pointer tag at the end—compact, local, and easily traced. The result is a backward-delimited, stack-native structure that enables efficient traversal and value recovery without external metadata.

Conceptually, this mirrors a type–length–value (TLV) pattern, commonly found in serialization formats like ASN.1 or CBOR. In TLV, a type byte and a length field precede the value. In Tacit, the "type" is embedded in the span tag, the "length" is its payload, and the "value" is the preceding sequence. The crucial difference: Tacit places this tag after the data, supporting dynamic, forward construction and backward introspection without needing a precomputed length or reserved prefix space. It is TLV reinterpreted through a stack lens.

## 3. Working with Spanners: One-Dimensional Vectors in Contiguous Memory

In Tacit, Spanners are treated as one-dimensional vectors built in contiguous memory regions. A Spanner consists of a contiguous group of values delimited by a `SPAN` tag (span pointer), which encodes its length. Spanners are not boxed or heap-allocated; instead, they exist in place within their storage medium (whether that's a stack, buffer, or array) and serve as a compact representation of arrays, sequences, and parameter bundles. This section describes how Spanners behave as vectors and how operations over them are defined.

### 3.1 Representing Spanners in Memory

A Spanner is constructed using the grouping syntax (shown here in stack notation, though the resulting structure can reside in any contiguous memory):

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

The SPAN tag at the end denotes that three values immediately precede it, forming a logical group. This tag is not a pointer in the C sense—it is a footer token encoding span length and structure type. Functions use this tag to identify and process the grouped values, without relying on external headers, descriptors, or memory indirection. This enables Spanners to behave as stack-local TLVs: self-describing segments that are positionally located and structurally delimited.

The representation is position-based and entirely local to the contiguous memory region. No pointer dereferencing, allocation, or header/footer scanning is needed. Spanner boundaries are determined through tagged offsets only.

Unlike traditional arrays, which typically enforce homogeneous element types, Spanners can contain heterogeneous data—including numbers, symbols, strings, and even nested Spanners. Their primary role is to group values structurally rather than impose uniform type constraints. This flexibility makes Spanners ideal for representing diverse data structures while maintaining a consistent memory layout.

### 3.2 Basic Spanner Operations

Spanner-aware words operate on the structure implicitly. For example:

```
(1 2 3) length
```

This computes the Spanner's length by extracting the encoded count from the span pointer tag. The result is:

```
3
```

Operations like `dup`, `drop`, `swap`, and `store` also work on Spanners when the span pointer tag is present. Duplication duplicates the entire Spanner, including the span pointer and all underlying items. Dropping a Spanner removes the entire segment at once.

Assignment is transparent: Spanners can be stored in and loaded from variables just like scalars. The Spanner contents are copied into or out of the variable, retaining the span pointer structure.

### 3.3 Broadcasting Arithmetic with Spanners

Arithmetic operators are defined polymorphically. When applied to two Spanners of equal length, the operator is broadcast element-wise across the pair. For example:

```
(1 2 3) (4 5 6) +
```

This evaluates to:

```
(5 7 9)
```

The Spanner lengths must match. The span pointers are used to identify the range and verify compatibility. Each pair of elements is retrieved from the stack, the operation is applied, and a new Spanner is constructed with the results.

Broadcasted operations preserve structural information. The resulting Spanner has the same length and ordering as the operands, and is terminated with a new span pointer.

### 3.4 Scalar Broadcasting

When one operand is a scalar and the other a Spanner, the scalar is broadcast across the Spanner:

```
(1 2 3) 10 +
```

Produces:

```
(11 12 13)
```

The scalar `10` is treated as if repeated for each element in the Spanner. The system performs one traversal over the Spanner, applying the operator between each item and the scalar.

Broadcasting is symmetric. The same result would occur if the scalar were on the left and the Spanner on the right.

### 3.5 Generalized Broadcasting

Broadcasting applies recursively. A scalar can be broadcast across a Spanner of scalars, a Spanner of Spanners, or even irregular nested structures. The operator is applied at each compatible element pair.

Broadcasting is defined structurally, not through type coercion or promotion rules. The Spanner and scalar are treated as operands of a common recursive traversal, and operations are applied at matching levels of structure.

In cases where broadcasting would violate length compatibility or type expectations, the operation fails early or propagates a tagged sentinel indicating error.

### 3.6 Combining Spanners: The Zip Operation

Tacit includes a `zip` operation to combine multiple Spanners into a single Spanner of grouped tuples. Given two Spanners:

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

The zip operator requires equal-length spans. Internally, it descends into each span simultaneously, pairing elements and emitting grouped results as new spans. The resulting span is then terminated with a skip of its own, preserving structural information.

Zipped Spanners are useful for operations such as coordinate mapping, key-value pairing, or argument bundling. Because all structure is retained on the stack using span pointers, the resulting Spanners remain lightweight and immediately accessible.

## 4. Nested Spanners and Multidimensional Arrays

Building on the concept of one-dimensional Spanners, Tacit supports *nested Spanners*, enabling representation of multidimensional arrays and more complex hierarchical data structures directly on the stack.

### 4.1 Defining Nested Spanners

Nested Spanners are created by including Spanners within other Spanners. This is done by opening a new span with `(` inside an existing span. For example, a two-dimensional 2x2 array can be represented as:

```
((1 2) (3 4))
```

This creates a Spanner that itself contains two Spanners. The structure is recursive: each inner Spanner has its own span pointer, and the outer Spanner encompasses all inner elements plus span pointers.

### 4.2 Multidimensional Array Representation

Nested Spanners allow Tacit to model multidimensional arrays without flattening them immediately. Each level of nesting corresponds to one dimension in the array.

This approach provides a flexible structure where each dimension can vary independently, supporting ragged or irregular arrays as well as regular ones.

### 4.3 Recursive Descent Traversal

To operate on nested Spanners, Tacit employs *recursive descent traversal*. This traversal method processes Spanners by recursively visiting each child Spanner or element, applying operations at the appropriate depth.

The traversal algorithm works as follows:

* When encountering a Spanner, descend into its elements recursively.
* For scalar values (non-Spanner), apply the operation directly.
* At each recursion level, manage boundaries using the Spanner's span pointer, ensuring correct segmentation of data.

This recursive approach supports vectorized operations on multidimensional data and facilitates broadcasting across dimensions.

### 4.4 Traversal Use Cases

Recursive traversal enables Tacit to:

* Sum or multiply all elements in a nested Spanner regardless of dimension.
* Apply unary or binary operators element-wise at any depth.
* Flatten nested Spanners into one-dimensional vectors when necessary.
* Implement higher-level operations like matrix multiplication, transpose, or slicing.

### 4.5 Efficient Traversal and Stack Management

Because Spanners are stored contiguously with span pointers, traversal can be implemented efficiently by leveraging these pointers to jump over subtrees without visiting every element explicitly, where appropriate.

This structure also maintains excellent cache locality, reducing memory access overhead typical in pointer-heavy recursive data structures.

This nested Spanner model provides Tacit with a powerful, flexible foundation for multidimensional and hierarchical data manipulation directly on the stack, combining the simplicity of RPN with the expressive power of array programming.

## 5. Efficient Representation and Conversion of Spanner Buffers in Tacit

Tacit supports both nested and flat representations of data through its Spanner-based structure model. While Spanners are naturally suited to stack-based grouping, many applications require a contiguous, linear representation in memory—particularly for numerical computation, device I/O, or interoperability with C-style APIs. Tacit provides a recursive conversion model to flatten nested Spanners and derive shape and stride metadata, enabling efficient indexing and structure-preserving transformations.

### 5.1 Recursive Traversal of Spanner Buffers

When nested Spanners are presented as a contiguous sequence in memory, each element must be visited in a traversal order that reflects the original structure. The conversion process begins with a recursive scan of the nested Spanner, recording dimensions, extracting scalar values, and generating intermediary metadata.

Traversal is depth-first and left-to-right. Each recursive call maintains a record of the depth level and position within its parent span, enabling correct reconstruction of the shape hierarchy. This ensures that nested lists such as `((1 2) (3 4))` yield shape information `[2 2]` and content `[1 2 3 4]`.

### 5.2 Flattening Nested Spanners

Flattening is the process of converting a nested Spanner to a one-dimensional, contiguous buffer in memory, along with associated metadata to preserve logical structure. This is accomplished by recursively traversing the Spanner and extracting elements in a deterministic order (typically row-major).

Flattening discards structural identity in favor of content. This means that irregular or ragged arrays must be regularized or explicitly handled. Any span with inconsistent sub-span lengths is rejected or truncated depending on policy.

The resulting linear buffer is stack-allocated or pre-allocated depending on context. If the total size is known statically or bounded by an enclosing span, the destination can be reused or promoted to higher scope.

### 5.3 Building Shape and Stride Metadata

Shape is recorded as a vector of integers, one per dimension, in outermost-to-innermost order. The shape vector indicates how many sub-elements are found at each depth. During recursive descent, the length of each nested Spanner is recorded and accumulated upward.

Stride is computed from shape, assuming row-major layout by default. The stride at dimension *d* is the product of all shape entries for dimensions greater than *d*. This enables constant-time offset computation during indexed access or slicing.

For example, a Spanner like `((1 2 3) (4 5 6))` has shape `[2 3]` and stride `[3 1]`, meaning two rows of three columns, with adjacent elements in the innermost dimension laid out contiguously.

These metadata vectors are typically constructed alongside the flattened buffer, allowing the view structure to be rebuilt immediately or passed to array-oriented functions that consume external buffers.

### 5.4 Conversion Algorithm Overview

The conversion process unfolds in five main stages:

1. Begin with a top-level span buffer and initialize empty shape and data vectors.
2. Traverse the span recursively. At each level, accumulate length to shape vector.
3. On encountering scalar values, append to data vector.
4. On returning from a nested span, verify length consistency.
5. Compute stride vector from shape vector.

The result is a buffer-view pair: the flat array and its associated shape/stride metadata. This structure is suitable for indexing, reshaping, slicing, or external consumption.

This model supports zero-copy conversion if the original span buffer is already flat and matches the requested shape. In such cases, the shape/stride vectors can be generated in place and paired with the source buffer directly.

### 5.5 Trade-offs Between Nested and Flat Representations

Both nested Spanners and flat buffers have distinct advantages:

**Nested Spanners**:
* Directly represent hierarchical relationships
* Support irregular shapes easily
* Map cleanly to Tacit's stack-oriented approach
* Enable natural recursive traversal
* Allow for on-the-fly construction and modification

**Flat buffers**:
* Enable constant-time indexed access
* Map efficiently to contiguous memory
* Support hardware-accelerated operations
* Provide minimal overhead for bulk operations
* Align with C-compatible data interface requirements

Tacit provides both models and allows seamless transition between them. Flattening is explicit but lightweight. Structure can be discarded and later reconstructed from shape/stride vectors if needed. The programmer can choose based on use case—favoring nested Spanners for compositional logic, or flattening when speed and hardware compatibility are paramount.

While Spanners resemble TLV formats in structure, they extend beyond simple framing. Spanners are active computation units—suitable not only for serialization but also for vectorized evaluation, polymorphic traversal, and compositional recombination. Unlike traditional TLV-encoded messages, which are meant for passive decoding, Spanners are designed for live use: passed between functions, restructured, and manipulated directly in-place.

## 6. Polymorphism of Spanner Buffers and Scalars in Tacit

Tacit supports uniform treatment of scalars, Spanners, and nested Spanners through a polymorphic data model. All values on the stack are interpreted based on tags and structure rather than static types. This model allows scalar values and structured sequences to participate in the same operations, enabling concise and generalized behavior across diverse inputs.

### 6.1 Uniform Value Representation

Scalars and Spanners share a unified representation. A scalar is a single tagged value. A Spanner is a group of values terminated by a span pointer. A Spanner buffer may include multiple dimensions; its shape must be regular to allow for stride-based addressing. The following metadata is preserved when flattening:

* A contiguous data buffer containing all scalar values in row-major order
* A shape vector describing the size of each dimension
* A stride vector for computing offsets during indexed access

The flattening process combines iterations over all dimensions into a single buffer, computing a linear offset for each element based on the stride. This allows arbitrary nested Spanners to be represented using a compact, linear buffer.

### 6.2 Broadcast Semantics in Operations

Arithmetic and logical operations in Tacit follow broadcast rules. If two operands are scalars, the operation applies directly. If one operand is a Spanner, the operation applies to each element of the Spanner, with the scalar operand broadcast across all positions. If both operands are Spanners, the operation is applied pairwise. If either operand is a nested Spanner, the same rules apply recursively.

Broadcasting is structural, not symbolic. It respects span boundaries and proceeds recursively through nested Spanners. This allows deep operations—addition of nested arrays, logical comparisons between structured data—to be expressed without explicit loops or traversal code.

Broadcasting is symmetric: the scalar may appear in any operand position, and the broadcast occurs toward the structured argument. This ensures that all operations maintain their natural ordering and arity, while allowing structure to emerge flexibly.

### 6.3 Storage and Variable Interactions

Variables in Tacit can store scalars or Spanners without distinction. When a value is stored, its entire structure—including any nested Spanners and span pointers—is copied to the destination. When loaded, the entire structure is pushed back onto the stack. This allows Spanners to be passed, reused, and duplicated just like scalar values.

No boxing or wrapping is required. A variable slot can hold any tagged value, and its interpretation is deferred to runtime. Functions accessing variables need not be rewritten to distinguish scalar from Spanner content.

This uniform storage model makes it possible to build pipelines and combinators that operate generically on structured data, without encoding specific assumptions about the shape or type of the input.

### 6.4 Runtime Type Identification and Tagging

Tacit uses a runtime tagging system to distinguish value kinds. Tags identify whether a value is a scalar, a span pointer, a pointer to a vector buffer, or another structure. These tags are compact, typically encoded in the low bits of the value or in adjacent metadata.

Operations check tags at runtime to determine how to proceed. For example, an arithmetic operation checks whether its operands are scalars or Spanners. If Spanners, it reads the associated span to determine structure and recursively applies the operation.

This tag-based dispatch is fast and minimal. It avoids the need for virtual tables or dynamic dispatch mechanisms common in object-oriented systems. The control logic is simple and uniform: read the tag, interpret structure, recurse if necessary.

### 6.5 Advantages of Tacit's Polymorphism Model

Polymorphism in Tacit reduces code duplication and enhances composability. A single function can handle a scalar input, a flat vector, or a multidimensional nested Spanner, with no change in logic. The same mapping or reduction routine applies across structures, guided solely by the shape and span layout of the data.

The stack discipline ensures memory safety and locality. Structured data is allocated and deallocated with ordinary stack operations. There is no need for garbage collection, heap boxing, or explicit type coercion.

This model allows high-level abstractions to be built from low-level primitives. The same arithmetic word used for scalar addition is also the engine for array broadcasting. The same logic for storing a single value also handles vectors or matrices. By collapsing the distinction between scalars and aggregates, Tacit provides a compact, expressive foundation for structured programming.

## 7. Conclusion: The Significance of Spanners in Tacit

Tacit reconceives contiguous memory regions—whether on the stack, in buffers, or in arrays—as coherent substrates for expressing structured, hierarchical data. Through Spanners and span pointers, these memory regions become persistent, inspectable, and traversable layouts for sequences, arrays, and trees—without recourse to heap allocation, external data structures, or runtime indirection.

Spanners give structure to contiguous memory by marking and delineating groups of values. These groups act as first-class values: passed to functions, stored in variables, consumed by polymorphic operators. Nesting Spanners enables a full representation of multidimensional arrays, and with recursive traversal, any operation expressible over vectors extends to arbitrarily deep composite structures. The Spanner thus serves as the foundation for Tacit's data model, not merely an encoding trick or calling convention.

This approach collapses the traditional boundary between data and computation. Where other languages separate different memory regions from structured data—forcing heap allocation, boxing, or special-purpose APIs—Tacit uses the same mechanisms to manipulate simple values, structured tuples, or whole arrays regardless of storage medium. Grouping and ungrouping are part of normal operations, enabling concise expression of transformations, aggregations, and compositions.

By encoding structure directly into layout, Tacit eliminates the need for runtime bookkeeping. Spanners carry their extent implicitly via span pointers, and nested structures preserve hierarchy through contiguity. This design avoids garbage collection, pointer-chasing, or dynamic allocation while retaining expressiveness and polymorphism.

Tacit's Spanner model is not just efficient—it is conceptually elegant. It presents an alternative to object-oriented and heap-based paradigms, demonstrating that structured computation need not rely on complex memory management. Tacit's minimal substrate—grouped values on a stack with tagged span pointers—supports vectorization, recursion, and multidimensional indexing without compromise.

In a broader sense, this reflects Tacit's philosophy: language and runtime should not exceed what can be reasoned about directly. Spanners are not an abstraction layer; they are visible, manipulable structure that can exist in any contiguous memory region—whether on the stack, in buffers, or in arrays. The same principles apply to arrays, closures, and communication—no hidden runtime, no opaque allocator, no virtual dispatch.

The Spanner model serves as a core component of Tacit. Whether representing function arguments in stack operations, managing structured data in buffers, or organizing memory regions for computation, Spanners provide a unified approach to data structure. This cohesion—between structure, memory, and language semantics—gives Tacit both power and simplicity.
