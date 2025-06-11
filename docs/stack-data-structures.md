# Span-based structures

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Representing Groups on the Stack with Parentheses](#2-representing-groups-on-the-stack-with-parentheses)
  - [2.1 The Open Parenthesis `(` — Marking the Group Start](#21-the-open-parenthesis---marking-the-group-start)
  - [2.2 Pushing Values Inside the Group](#22-pushing-values-inside-the-group)
  - [2.3 The Close Parenthesis `)` — Computing and Pushing the Skip](#23-the-close-parenthesis---computing-and-pushing-the-skip)
  - [2.4 Example Walkthrough](#24-example-walkthrough)
  - [2.5 Using Spans in Functions](#25-using-spans-in-functions)
  - [2.6 Code Snippet (Pseudo Tacit VM Steps)](#26-code-snippet-pseudo-tacit-vm-steps)
  - [2.7 Summary](#27-summary)
- [3. Working with Spans: One-Dimensional Vectors on the Stack](#3-working-with-spans-one-dimensional-vectors-on-the-stack)
  - [3.1 Representing Spans on the Stack](#31-representing-spans-on-the-stack)
  - [3.2 Basic Span Operations](#32-basic-span-operations)
  - [3.3 Broadcasting Arithmetic with Spans](#33-broadcasting-arithmetic-with-spans)
  - [3.4 Scalar Broadcasting](#34-scalar-broadcasting)
  - [3.5 Generalized Broadcasting](#35-generalized-broadcasting)
  - [3.6 Combining Spans: The Zip Operation](#36-combining-spans-the-zip-operation)
- [4. Nested Spans and Multidimensional Arrays](#4-nested-spans-and-multidimensional-arrays)
  - [4.1 Defining Nested Spans](#41-defining-nested-spans)
  - [4.2 Multidimensional Array Representation](#42-multidimensional-array-representation)
  - [4.3 Recursive Descent Traversal](#43-recursive-descent-traversal)
  - [4.4 Traversal Use Cases](#44-traversal-use-cases)
  - [4.5 Efficient Traversal and Stack Management](#45-efficient-traversal-and-stack-management)
- [5. Efficient Representation and Conversion of Span Buffers in Tacit](#5-efficient-representation-and-conversion-of-span-buffers-in-tacit)
  - [5.1 Recursive Traversal of Span Buffers](#51-recursive-traversal-of-span-buffers)
  - [5.2 Flattening Nested Spans](#52-flattening-nested-spans)
  - [5.3 Building Shape and Stride Metadata](#53-building-shape-and-stride-metadata)
  - [5.4 Conversion Algorithm Overview](#54-conversion-algorithm-overview)
  - [5.5 Trade-offs Between Nested and Flat Representations](#55-trade-offs-between-nested-and-flat-representations)
- [6. Polymorphism of Span Buffers and Scalars in Tacit](#6-polymorphism-of-span-buffers-and-scalars-in-tacit)
  - [6.1 Uniform Value Representation](#61-uniform-value-representation)
  - [6.2 Broadcast Semantics in Operations](#62-broadcast-semantics-in-operations)
  - [6.3 Storage and Variable Interactions](#63-storage-and-variable-interactions)
  - [6.4 Runtime Type Identification and Tagging](#64-runtime-type-identification-and-tagging)
  - [6.5 Advantages of Tacit's Polymorphism Model](#65-advantages-of-tacits-polymorphism-model)
- [7. Conclusion: The Significance of Span-Based Composite Data in Tacit](#7-conclusion-the-significance-of-span-based-composite-data-in-tacit)

# Span-based structures

## 1. Introduction

Tacit uses spans to represent structured data directly in stack or buffer memory. A span is a bounded, contiguous region marked by implicit metadata encoded as skip values. These spans may represent sequences, arrays, tuples, or tree-like forms, and can be nested to encode arbitrarily deep structure.

Unlike heap-allocated objects in conventional languages, Tacit spans reside in linear memory and are delimited by local information. A span's end is determined relative to its start, using offsets computed at runtime. This allows dynamic construction of data structures with no external bookkeeping or garbage collection.

Span-based structures are stack-native but not stack-bound. They can be constructed on the data stack, stored in local buffers, or passed across coroutines using shared memory. Their encoding is minimal: the data itself is untagged, and only the skip value at the end of a span serves as an indicator of its structure. This enables efficient memory layout, simple traversal, and compact representation.

Tacit treats the stack not as a transient space but as a composable data model. Functions operate on spans using broadcasting, indexing, and recursion by descent. Operators are polymorphic across scalars and spans, with functions inspecting structure at runtime to apply correct behavior. All composite data in Tacit, including arrays and records, builds upon this foundation.

The following sections define how spans are constructed with grouping operators, how they are traversed and transformed, and how they serve as the basis for polymorphic operations and multidimensional arrays.


## 2. Representing Groups on the Stack with Parentheses

Tacit introduces grouping constructs using a pair of delimiters: the open parenthesis `(` and the close parenthesis `)`. These define spans—contiguous groups of values on the data stack that act as composite structures. Spans are treated as first-class data and may represent vectors, records, or elements of higher-dimensional arrays. The grouping mechanism is stack-native, efficient, and designed to preserve lexical structure through skip encoding rather than heap pointers.

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

### 2.3 The Close Parenthesis `)` — Computing and Pushing the Skip

When the closing parenthesis `)` is executed, Tacit completes the group. This is done by:

1. Popping the saved DSP from the return stack.
2. Computing the number of items pushed since the group began—this is the difference between the current DSP and the saved DSP.
3. Tagging this count with a skip marker, which distinguishes it from normal integers and marks it as the end of a span.
4. Pushing the tagged skip value onto the data stack.

This tagged skip does not contain a memory pointer. Instead, it encodes how many items to scan backward on the stack to recover the group. It functions as a compact footer, delimiting the span from the top.

For example:

```
( 10 20 30 )
```

Yields:

```
10
20
30
SKIP:3
```

The skip tag `SKIP:3` allows functions like `sum` to identify the start of the span and operate on the enclosed values without requiring an external data structure.

### 2.4 Example Walkthrough

To clarify the semantics, consider this execution trace:

```
Initial data stack: []
Return stack: []
```

Execute `(`:

* Save DSP (0) on return stack
* Return stack becomes: `[0]`

Push values:

* `10` → data stack: `[10]`
* `20` → data stack: `[10 20]`
* `30` → data stack: `[10 20 30]`

Execute `)`:

* Pop saved DSP (0)
* Current DSP is 3
* Compute span length: `3 - 0 = 3`
* Push `SKIP:3` onto stack
* Final data stack: `[10 20 30 SKIP:3]`

The skip represents a span of three values directly below it. It is treated as a tagged literal and not dereferenced or indexed by address.

### 2.5 Using Spans in Functions

Functions that consume spans—such as `sum`, `map`, or `zip`—recognize the skip tag and use it to locate the span's boundary. A span-aware function begins by popping the skip, computes the extent of the group by subtracting the encoded length from the current DSP, and then performs the intended operation on that range.

For example:

```
( 10 20 30 ) sum
```

Is interpreted as:

* `SKIP:3` → consume and interpret as a span of 3 items
* Operate on `10 20 30`
* Compute sum: `60`
* Remove the three values and the skip
* Push result: `60`

Final stack:

```
[60]
```

Functions treat spans as variadic argument bundles. No array or pointer representation is constructed. The grouping is implicit in stack layout, and the tagged skip enables precise recovery of that layout.

### 2.6 Code Snippet (Pseudo Tacit VM Steps)

A simplified summary of the mechanics:

```
(           // Save DSP to return stack
10          // Push 10
20          // Push 20
30          // Push 30
)           // Compute skip and push it
sum         // Pop skip, sum the previous N items, push result

// sum pseudocode:
//   n ← pop_skip()
//   values ← pop n items
//   result ← sum(values)
//   push result
```

This style of group parsing is deterministic, with all boundaries derived from skip tags. No heap or object structure is introduced; everything resides on the native data stack.

### 2.7 Summary

* The open parenthesis `(` saves the current stack pointer as a group marker.
* Values pushed afterward are part of the group.
* The close parenthesis `)` pops the saved pointer, computes the span length, and pushes a tagged skip value.
* The skip acts as a footer identifying the group.
* Functions detect skip values and use them to operate on the associated spans.
* No heap is used; spans are embedded into the stack using positional metadata.
* The structure is recursive, allowing nested spans and higher-order grouping.

This model gives Tacit a lightweight and composable mechanism for variadic data, well-aligned with its stack-based design and suitable for both runtime execution and serial representation.

## 3. Working with Spans: One-Dimensional Vectors on the Stack

In Tacit, spans are treated as one-dimensional vectors built directly on the data stack. A span is a contiguous group of values delimited by a `SKIP` tag, which encodes its length. Spans are not boxed or heap-allocated; instead, they exist in place on the stack and serve as a compact representation of arrays, sequences, and parameter bundles. This section describes how spans behave as vectors and how operations over them are defined.

### 3.1 Representing Spans on the Stack

A span is constructed using the grouping syntax:

```
(1 2 3)
```

This expands to:

```
1
2
3
SKIP:3
```

The `SKIP` tag at the top of the stack denotes a span of three values directly beneath it. The span itself consists of those values and the skip. Functions that operate on spans treat the skip as a pointer to the group, without requiring additional metadata or descriptors.

The representation is position-based and entirely local to the stack. No pointer dereferencing, allocation, or header/footer scanning is needed. Span boundaries are determined through tagged offsets only.

### 3.2 Basic Span Operations

Span-aware words operate on the structure implicitly. For example:

```
(1 2 3) length
```

This computes the span length by extracting the encoded count from the skip tag. The result is:

```
3
```

Operations like `dup`, `drop`, `swap`, and `store` also work on spans when the skip tag is present. Duplication duplicates the entire span, including the skip and all underlying items. Dropping a span removes the entire segment at once.

Assignment is transparent: spans can be stored in and loaded from variables just like scalars. The span contents are copied into or out of the variable, retaining skip-based structure.

### 3.3 Broadcasting Arithmetic with Spans

Arithmetic operators are defined polymorphically. When applied to two spans of equal length, the operator is broadcast element-wise across the pair. For example:

```
(1 2 3) (4 5 6) +
```

This evaluates to:

```
(5 7 9)
```

The span lengths must match. The skip tags are used to identify the range and verify compatibility. Each pair of elements is retrieved from the stack, the operation is applied, and a new span is constructed with the results.

Broadcasted operations preserve structural information. The resulting span has the same length and ordering as the operands, and is terminated with a new skip tag.

### 3.4 Scalar Broadcasting

When one operand is a scalar and the other a span, the scalar is broadcast across the span:

```
(1 2 3) 10 +
```

Produces:

```
(11 12 13)
```

The scalar `10` is treated as if repeated for each element in the span. The system performs one traversal over the span, applying the operator between each item and the scalar.

Broadcasting is symmetric. The same result would occur if the scalar were on the left and the span on the right.

### 3.5 Generalized Broadcasting

Broadcasting applies recursively. A scalar can be broadcast across a span of scalars, a span of spans, or even irregular nested structures. The operator is applied at each compatible element pair.

Broadcasting is defined structurally, not through type coercion or promotion rules. The span and scalar are treated as operands of a common recursive traversal, and operations are applied at matching levels of structure.

In cases where broadcasting would violate length compatibility or type expectations, the operation fails early or propagates a tagged sentinel indicating error.

### 3.6 Combining Spans: The Zip Operation

Tacit includes a `zip` operation to combine multiple spans into a single span of grouped tuples. Given two spans:

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

Zipped spans are useful for operations such as coordinate mapping, key-value pairing, or argument bundling. Because all structure is retained on the stack using skip tags, the resulting spans remain lightweight and immediately accessible.

## 4. Nested Spans and Multidimensional Arrays

Building on the concept of one-dimensional spans, Tacit supports *nested spans*, enabling representation of multidimensional arrays and more complex hierarchical data structures directly on the stack.

### 4.1 Defining Nested Spans

Nested spans are spans that contain other spans as elements. For example, a two-dimensional 2x2 array can be represented as:

```
((1 2) (3 4))
```

Here, the outer span contains two inner spans, each representing a row of the array.

### 4.2 Multidimensional Array Representation

Nested spans allow Tacit to model multidimensional arrays without flattening them immediately. Each level of nesting corresponds to one dimension in the array.

This approach provides a flexible structure where each dimension can vary independently, supporting ragged or irregular arrays as well as regular ones.

### 4.3 Recursive Descent Traversal

To operate on nested spans, Tacit employs *recursive descent traversal*. This traversal method processes spans by recursively visiting each child span or element, applying operations at the appropriate depth.

The traversal algorithm works as follows:

* When encountering a span, descend into its elements recursively.
* For scalar values (non-span), apply the operation directly.
* At each recursion level, manage boundaries using the span’s skip pointer, ensuring correct segmentation of data.

This recursive approach supports vectorized operations on multidimensional data and facilitates broadcasting across dimensions.

### 4.4 Traversal Use Cases

Recursive traversal enables Tacit to:

* Sum or multiply all elements in a nested span regardless of dimension.
* Apply unary or binary operators element-wise at any depth.
* Flatten nested spans into one-dimensional vectors when necessary.
* Implement higher-level operations like matrix multiplication, transpose, or slicing.

### 4.5 Efficient Traversal and Stack Management

Because spans are stored contiguously with skip pointers, traversal can be implemented efficiently by leveraging these pointers to jump over subtrees without visiting every element explicitly, where appropriate.

This structure also maintains excellent cache locality, reducing memory access overhead typical in pointer-heavy recursive data structures.

This nested span model provides Tacit with a powerful, flexible foundation for multidimensional and hierarchical data manipulation directly on the stack, combining the simplicity of RPN with the expressive power of array programming.

## 5. Efficient Representation and Conversion of Span Buffers in Tacit

Tacit supports both nested and flat representations of data through its span-based structure model. While spans are naturally suited to stack-based grouping, many applications require a contiguous, linear representation in memory—particularly for numerical computation, device I/O, or interoperability with C-style APIs. Tacit provides a recursive conversion model to flatten nested spans and derive shape and stride metadata, enabling efficient indexing and structure-preserving transformations.

### 5.1 Recursive Traversal of Span Buffers

The span buffer is traversed recursively. Starting from a top-level skip, the system walks backward through the stack, decoding each element in turn. When it encounters another skip, it recognizes a nested span and invokes a recursive descent to process its contents. Scalars are collected directly. This traversal constructs both the flat data vector and the shape information.

Traversal is depth-first and left-to-right. Each recursive call maintains a record of the depth level and position within its parent span, enabling correct reconstruction of the shape hierarchy. This ensures that nested lists such as `((1 2) (3 4))` yield shape information `[2 2]` and content `[1 2 3 4]`.

### 5.2 Flattening Nested Spans

Flattening produces a linear buffer by removing all structural markers and recursively extracting scalars. Skip tags are consumed during the descent and do not appear in the final buffer. The resulting output is a packed, type-homogeneous array suitable for vector operations or memory-mapped transfer.

Flattening discards structural identity in favor of content. This means that irregular or ragged arrays must be regularized or explicitly handled. Any span with inconsistent sub-span lengths is rejected or truncated depending on policy.

The resulting linear buffer is stack-allocated or pre-allocated depending on context. If the total size is known statically or bounded by an enclosing span, the destination can be reused or promoted to higher scope.

### 5.3 Building Shape and Stride Metadata

Shape is recorded as a vector of integers, one per dimension, in outermost-to-innermost order. The shape vector indicates how many sub-elements are found at each depth. During recursive descent, the length of each nested span is recorded and accumulated upward.

Stride is computed from shape, assuming row-major layout by default. The stride at dimension *d* is the product of all shape entries for dimensions greater than *d*. This enables constant-time offset computation during indexed access or slicing.

For example, a span like `((1 2 3) (4 5 6))` has shape `[2 3]` and stride `[3 1]`, meaning two rows of three columns, with adjacent elements in the innermost dimension laid out contiguously.

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

Nested spans support arbitrary structure and maximal composability. They can be constructed dynamically on the stack, support variable-length subgroups, and require no auxiliary metadata for interpretation. They are ideal for structural transformations, grouping operations, or recursive algorithms that consume and emit span trees.

Flat representations offer better performance for arithmetic, bulk processing, and memory locality. They are necessary for most low-level APIs and make direct indexing fast and predictable. However, they require conversion and may lose structural fidelity in the process.

Tacit provides both models and allows seamless transition between them. Flattening is explicit but lightweight. Structure can be discarded and later reconstructed from shape/stride vectors if needed. The programmer can choose based on use case—favoring nested spans for compositional logic, or flattening when speed and hardware compatibility are paramount.

## 6. Polymorphism of Span Buffers and Scalars in Tacit

Tacit supports uniform treatment of scalars, spans, and nested spans through a polymorphic data model. All values on the stack are interpreted based on tags and structure rather than static types. This model allows scalar values and structured sequences to participate in the same operations, enabling concise and generalized behavior across diverse inputs.

### 6.1 Uniform Value Representation

Scalars and spans share a unified representation. A scalar is a single tagged value. A span is a group of values terminated by a skip tag. Nested spans consist of spans within spans, each with their own skip tag. The VM treats all values on the stack as tagged entities, and operations distinguish between scalars and compound structures by inspecting these tags at runtime.

There is no explicit type declaration. Every value is interpreted according to its tag and surrounding context. This allows polymorphism to emerge from structure: a function can accept a scalar, a span, or a nested span without modification. The same operation applies recursively based on the tag of the input.

### 6.2 Broadcast Semantics in Operations

Arithmetic and logical operations in Tacit follow broadcast rules. If two operands are scalars, the operation applies directly. If one operand is a span, the operation applies to each element of the span, with the scalar operand broadcast across all positions. If both operands are spans, the operation is applied pairwise. If either operand is a nested span, the same rules apply recursively.

Broadcasting is structural, not symbolic. It respects skip boundaries and proceeds recursively through nested spans. This allows deep operations—addition of nested arrays, logical comparisons between structured data—to be expressed without explicit loops or traversal code.

Broadcasting is symmetric: the scalar may appear in any operand position, and the broadcast occurs toward the structured argument. This ensures that all operations maintain their natural ordering and arity, while allowing structure to emerge flexibly.

### 6.3 Storage and Variable Interactions

Variables in Tacit can store scalars or spans without distinction. When a value is stored, its entire structure—including any nested spans and skip tags—is copied to the destination. When loaded, the entire structure is pushed back onto the stack. This allows spans to be passed, reused, and duplicated just like scalar values.

No boxing or wrapping is required. A variable slot can hold any tagged value, and its interpretation is deferred to runtime. Functions accessing variables need not be rewritten to distinguish scalar from span content.

This uniform storage model makes it possible to build pipelines and combinators that operate generically on structured data, without encoding specific assumptions about the shape or type of the input.

### 6.4 Runtime Type Identification and Tagging

Tacit uses a runtime tagging system to distinguish value kinds. Tags identify whether a value is a scalar, a skip tag, a pointer to a vector buffer, or another structure. These tags are compact, typically encoded in the low bits of the value or in adjacent metadata.

Operations check tags at runtime to determine how to proceed. For example, an arithmetic operation checks whether its operands are scalars or spans. If spans, it reads the associated skip to determine structure and recursively applies the operation.

This tag-based dispatch is fast and minimal. It avoids the need for virtual tables or dynamic dispatch mechanisms common in object-oriented systems. The control logic is simple and uniform: read the tag, interpret structure, recurse if necessary.

### 6.5 Advantages of Tacit’s Polymorphism Model

Polymorphism in Tacit reduces code duplication and enhances composability. A single function can handle a scalar input, a flat vector, or a multidimensional nested array, with no change in logic. The same mapping or reduction routine applies across structures, guided solely by the shape and skip layout of the data.

The stack discipline ensures memory safety and locality. Structured data is allocated and deallocated with ordinary stack operations. There is no need for garbage collection, heap boxing, or explicit type coercion.

This model allows high-level abstractions to be built from low-level primitives. The same arithmetic word used for scalar addition is also the engine for array broadcasting. The same logic for storing a single value also handles vectors or matrices. By collapsing the distinction between scalars and aggregates, Tacit provides a compact, expressive foundation for structured programming.

## 7. Conclusion: The Significance of Span-Based Composite Data in Tacit

Tacit reconceives the stack not as transient state, but as a coherent substrate for expressing structured, hierarchical data. Through spans and skips, the data stack becomes a persistent, inspectable, and traversable memory layout for sequences, arrays, and trees—without recourse to heap allocation, external data structures, or runtime indirection.

Spans give structure to the stack by marking and delineating groups of values. These groups act as first-class values: passed to functions, stored in variables, consumed by polymorphic operators. Nesting spans enables a full representation of multidimensional arrays, and with recursive traversal, any operation expressible over vectors extends to arbitrarily deep composite structures. The span thus serves as the foundation for Tacit’s data model, not merely an encoding trick or calling convention.

This approach collapses the traditional boundary between data and computation. Where other languages separate stack use from structured data—forcing heap allocation, boxing, or special-purpose APIs—Tacit uses the same stack instructions to manipulate simple values, structured tuples, or whole arrays. Grouping and ungrouping are part of normal execution, enabling concise expression of transformations, aggregations, and compositions.

By encoding structure directly into layout, Tacit eliminates the need for runtime bookkeeping. Spans carry their extent implicitly via skip tags, and nested structures preserve hierarchy through contiguity. This design avoids garbage collection, pointer-chasing, or dynamic allocation while retaining expressiveness and polymorphism.

Tacit’s span model is not just efficient—it is conceptually elegant. It presents an alternative to object-oriented and heap-based paradigms, demonstrating that structured computation need not rely on complex memory management. Tacit’s minimal substrate—grouped values on a stack with tagged skips—supports vectorization, recursion, and multidimensional indexing without compromise.

In a broader sense, this reflects Tacit’s philosophy: language and runtime should not exceed what can be reasoned about directly. Spans are not an abstraction layer; they are visible, manipulable structure. The same principles apply to arrays, closures, and communication—no hidden runtime, no opaque allocator, no virtual dispatch.

As Tacit evolves, the span-based model will continue to serve as its core. Whether representing function arguments, intermediate results, or buffers for computation, spans will unify execution and data. This cohesion—between structure, memory, and language semantics—is what distinguishes Tacit from its predecessors and gives it both power and simplicity.

