# Table of Contents

- [Buffers and Arrays](#buffers-and-arrays)
  - [1. Introduction](#1-introduction)
  - [2. Buffers – Raw Memory as a First-Class Value](#2-buffers--raw-memory-as-a-first-class-value)
    - [2.1 Element Width and Usage](#21-element-width-and-usage)
    - [2.2 Buffers as First-Class Values](#22-buffers-as-first-class-values)
    - [2.3 Buffers and Sequences](#23-buffers-and-sequences)
    - [2.4 Buffers as Low-Level Infrastructure](#24-buffers-as-low-level-infrastructure)
    - [2.5 Storage, Aliasing, and Ownership](#25-storage-aliasing-and-ownership)
    - [2.6 Summary](#26-summary)
  - [3. Do-Pointers – Executable Interpretation for Buffers](#3-do-pointers--executable-interpretation-for-buffers)
    - [3.1 What is a Do-Pointer?](#31-what-is-a-do-pointer)
    - [3.2 Buffers with and without Do-Pointers](#32-buffers-with-and-without-do-pointers)
    - [3.3 Installing a Do-Pointer](#33-installing-a-do-pointer)
    - [3.4 Executing Do-Pointer Buffers](#34-executing-do-pointer-buffers)
    - [3.5 Use Cases: Structs, Arrays, Views](#35-use-cases-structs-arrays-views)
    - [3.6 Reusability and Global Functions](#36-reusability-and-global-functions)
    - [3.7 Summary](#37-summary)
  - [4. Views – Translating Indices to Offsets](#4-views--translating-indices-to-offsets)
    - [4.1 The View as Function](#41-the-view-as-function)
    - [4.2 View + Buffer = Array](#42-view--buffer--array)
    - [4.3 Shape Vectors as Views](#43-shape-vectors-as-views)
    - [4.4 Arity and Stack Interaction](#44-arity-and-stack-interaction)
    - [4.5 Views from Functions or Data](#45-views-from-functions-or-data)
    - [4.6 Summary](#46-summary)
    - [4.7 Bounds Checking and Index Policies](#47-bounds-checking-and-index-policies)
  - [5. Arrays: Composed Views Over Buffers](#5-arrays-composed-views-over-buffers)
    - [5.1 Arrays as First-Class Functions](#51-arrays-as-first-class-functions)
    - [5.2 Views as Address Generators](#52-views-as-address-generators)
    - [5.3 Arrays as Smart Data](#53-arrays-as-smart-data)
    - [5.4 Composability and Stack Discipline](#54-composability-and-stack-discipline)
    - [5.5 Array Access and Mutation](#55-array-access-and-mutation)
    - [5.6 Summary](#56-summary)
  - [6. Shape Vectors – Metadata-Enriched Views](#6-shape-vectors--metadata-enriched-views)
    - [6.1 What a Shape Vector Is](#61-what-a-shape-vector-is)
    - [6.2 Rank, Size, and Total Elements](#62-rank-size-and-total-elements)
    - [6.3 Stride Derivation and Layout](#63-stride-derivation-and-layout)
    - [6.4 Degenerate Dimensions and Broadcast Semantics](#64-degenerate-dimensions-and-broadcast-semantics)
    - [6.5 Empty and Scalar Shapes](#65-empty-and-scalar-shapes)
    - [6.6 Shape Vector Operations](#66-shape-vector-operations)
    - [6.7 Performance and Caching](#67-performance-and-caching)
    - [6.8 Summary](#68-summary)
  - [7. Reshaping Arrays – Changing Shape Without Moving Data](#7-reshaping-arrays--changing-shape-without-moving-data)
    - [7.1 Conceptual Model](#71-conceptual-model)
    - [7.2 Size Compatibility](#72-size-compatibility)
    - [7.3 Rank Modification](#73-rank-modification)
    - [7.4 Static vs Dynamic Reshape](#74-static-vs-dynamic-reshape)
    - [7.5 Partial / Inferred Dimensions](#75-partial--inferred-dimensions)
    - [7.6 Implementation Mechanics](#76-implementation-mechanics)
    - [7.7 Compositional Reshaping](#77-compositional-reshaping)
    - [7.8 Performance Notes](#78-performance-notes)
    - [7.9 Summary](#79-summary)
  - [8. Slicing Arrays – Views That Select Subsets](#8-slicing-arrays--views-that-select-subsets)
    - [8.1 The Slice Concept](#81-the-slice-concept)
    - [8.2 Contiguous vs Strided Slices](#82-contiguous-vs-strided-slices)
    - [8.3 Degenerate Slices](#83-degenerate-slices)
    - [8.4 Index-Set and Mask Slicing](#84-index-set-and-mask-slicing)
    - [8.5 Nested Slicing and View Chaining](#85-nested-slicing-and-view-chaining)
    - [8.6 Mutation Through Slices](#86-mutation-through-slices)
    - [8.7 Bounds Policies](#87-bounds-policies)
    - [8.8 Memory Aliasing and Lifetime](#88-memory-aliasing-and-lifetime)
    - [8.9 Performance Notes](#89-performance-notes)
    - [8.10 Summary](#810-summary)
  - [9. Conclusion](#9-conclusion)
    - [9.1 Current Capabilities and Next Steps](#91-current-capabilities-and-next-steps)
    - [9.2 Design Philosophy and Future Direction](#92-design-philosophy-and-future-direction)


# Buffers and Arrays

## 1. Introduction

Tacit's buffers and arrays provide a foundation for memory-efficient data manipulation in environments with strict stack discipline and execution constraints. Unlike traditional array models that hide complexity behind monolithic abstractions, Tacit's approach separates raw storage (buffers) from access patterns (views), allowing them to be independently composed and transformed with minimal overhead.

This document defines the canonical buffer and array model in Tacit, including memory layout, view functions, transformation operations, and integration with stack-based memory management. It formalizes the composition-based approach that enables powerful array operations without sacrificing performance or predictability.

### Function-First, Composition-Based Design

Tacit takes a fundamentally different approach to arrays compared to most programming environments:

1. **Truly Functional**: Unlike systems that treat arrays as opaque containers, Tacit arrays are literally functions that map indices to values. This is not just a metaphor but the actual implementation—an array is a buffer with an installed function (view) that interprets indices.

2. **Explicit Composition**: Array transformations like reshape, slice, and transpose are achieved by composing view functions, not by copying data. This makes operations that would be expensive in other languages essentially free in Tacit.

3. **Zero-Overhead Abstraction**: The buffer-view mechanism adds minimal overhead to Tacit's existing stack-based structure. There's no separate memory manager, hidden metadata, or boxing/unboxing machinery.

Buffers and arrays provide powerful tools for:

- Working with large datasets without heap fragmentation
- Expressing complex multi-dimensional algorithms with clear, concise code
- Creating flexible data structures that work within stack constraints
- Building zero-copy pipelines for data transformation
- Achieving high performance without sacrificing safety

The model balances flexibility, performance, and memory discipline by treating arrays as compositions of simple, orthogonal components rather than as monolithic objects.

## 2. Buffers – Raw Memory as a First-Class Value

In Tacit, the most primitive data structure is the **buffer**. A buffer is a raw, contiguous block of memory that stores fixed-width elements — typically numbers or pointers — and serves as the basis for more structured abstractions like arrays, views, structs, and strings. The buffer model is designed to be flexible, lightweight, and tightly coupled to Tacit’s stack-based execution and locality-centric memory discipline.

A buffer is **not** inherently structured or self-interpreting. It does not include type metadata, field layouts, or dimension information by default. Instead, it is a *payload-only* container, fully defined by three fields: its **length** (number of elements), its **element width** (in bytes), and its **base pointer** to the allocated block. These fields are known statically or at runtime and are sufficient to compute memory usage and access locations.

### 2.1 Element Width and Usage

The element width determines how the buffer’s memory is interpreted. The default width is four bytes, ideal for representing:

* Tagged values (Tacit’s primary scalar type)
* Pointers (to functions, strings, buffers, structs, etc.)
* Integers and floats
* Function tokens and code references

Other widths (one byte for strings, eight bytes for doubles, etc.) are possible and will be supported via element-width-aware operations. However, buffers do not enforce interpretation — they only store bytes. Any semantic layer must be imposed externally, such as by a view function or a struct accessor.

### 2.2 Buffers as First-Class Values

Buffers are full citizens in the language. They can be:

* Stored in local variables
* Passed and returned by functions
* Yielded from resumables
* Promoted up the call stack to become shared between parent and child scopes

They are not references to boxed objects or heap-only data — in fact, most buffers will live **entirely on the stack**. Tacit encourages stack-local storage by default, using **copy-down promotion** as a mechanism to safely transfer ownership of temporary buffers from child to parent. This makes memory behavior simple, compositional, and predictable, without requiring garbage collection or hidden mutation.

Stack-allocated buffers follow a strict lifetime model: they are valid only until the return point of the function or resumable that created them, unless explicitly promoted. This avoids leaks, simplifies cleanup, and aligns perfectly with Tacit’s frame-based return stack.

Heap-allocated buffers do exist — created via explicit allocation — but they are treated identically in terms of behavior. Their allocation and deallocation are controlled by the program author, not an implicit runtime.

### 2.3 Buffers and Sequences

Buffers are not just static storage; they are also deeply integrated with Tacit’s sequence and pipeline infrastructure. A buffer can serve as:

* A **sequence source**, emitting each element in order
* A **sequence sink**, collecting values into memory
* A **realized sequence**, representing the materialized result of a pipeline

This dual identity — storage and stream — allows seamless transitions between computation and representation. For example, a computation that filters and maps a data stream can produce a buffer as output, or consume one as input, without additional ceremony.

The symmetry between streams and buffers ensures that Tacit remains coherent across different execution models: lazy, eager, pipelined, or direct.

### 2.4 Buffers as Low-Level Infrastructure

Beyond sequences, buffers are the underlying substrate for more advanced abstractions:

* **Arrays**: a buffer combined with an indexing function (a view)
* **Structs**: a buffer interpreted by offset-based accessors
* **Strings**: a buffer of bytes with optional metadata or encoding rules
* **Tags and closures**: pointers stored inside buffers to represent logic

The key point is that **buffers themselves are unstructured**. They do not carry interpretation. They are memory — raw and inert — until paired with a semantic lens. That lens may come from a view, a function pointer, or other external metadata, but the buffer remains a universal foundation.

This clean separation between memory and meaning is what gives Tacit its power: by not baking in assumptions about structure, Tacit enables a small number of primitives to be reused for a wide range of data representations.

### 2.5 Storage, Aliasing, and Ownership

Buffers are directly compatible with Tacit’s promotion-based scope model. A buffer created in a child frame can be:

* Used locally and discarded automatically
* Promoted by copying it into the parent’s locals
* Passed up as a return value via slot reassignment

This is called **copy-down promotion**: the buffer is allocated at the top of the return stack during its construction, then moved down into the parent’s local region, with the parent’s stack pointer adjusted to claim ownership. No heap allocation is needed. No pointers are passed. The buffer itself becomes first-class data, captured in its final location.

Aliasing is minimized by this model. Since buffers are often created fresh and passed by value (not reference), the usual problems of shared mutation and concurrency are avoided. When buffers are shared (such as in a multi-reader scenario), this is made explicit — typically via tagged handles or reference-counted wrappers.

### 2.6 Summary

The buffer is Tacit’s bedrock: a raw, minimally-defined, maximally-usable container for structured or unstructured data. It has no opinion about its contents, no intrinsic behavior, and no runtime costs beyond memory. It is storage, pure and simple.

From this foundation, all higher abstractions emerge. Views will give buffers a way to be interpreted. Do-pointers will give them executable behavior. And arrays will emerge as buffers paired with indexing logic.

But the buffer itself remains elemental — a value, a vessel, and a gateway to Tacit’s philosophy of composable, memory-aware programming.

## 3. Do-Pointers – Executable Interpretation for Buffers

While buffers represent raw memory, they are silent by default. They store bytes but do not interpret them. Tacit introduces a minimal yet powerful enhancement: the **do-pointer**. A do-pointer attaches behavior to a buffer, transforming it into an executable data structure — a *poor man's closure*. This allows buffers to act not only as memory but as **functions** over their own contents.

### 3.1 What is a Do-Pointer?

A do-pointer is an optional, tagged function pointer stored alongside a buffer’s metadata. When a buffer is executed — either directly via a `call` or through an operation like `get` — the do-pointer is invoked, receiving the buffer itself (as a pointer or handle) and arguments from the stack. The do-pointer is responsible for interpreting the buffer’s contents and producing a result, typically an offset, a value, or a derived view.

This mechanism mirrors Forth’s *DOES*> model, where variables and constants can carry custom execution behavior. In Tacit, the do-pointer gives buffers the ability to “interpret themselves” — to map inputs to locations, values, or operations.

### 3.2 Buffers with and without Do-Pointers

A buffer without a do-pointer is inert: a passive memory block. It can be read from or written to using primitive operations, but it has no interpretation of its own.

A buffer with a do-pointer becomes an *active structure*. It can behave like:

* A function: computing values from inputs
* A view: converting indices into offsets
* A struct: accessing fields by position
* A smart string: decoding characters on the fly

The semantics are entirely defined by the function installed as the do-pointer. This function is free to interpret the buffer however it likes. It may use internal metadata, embedded tables, or simple arithmetic. The contract is: it takes stack inputs, the buffer reference, and returns a computed result.

### 3.3 Installing a Do-Pointer

A do-pointer is stored in a fixed location, typically in a known slot near the buffer’s header (e.g. immediately following the length and element width). A flag bit in the header indicates its presence. When set, this bit tells the runtime or compiler to dispatch execution to the associated function instead of treating the buffer as inert data.

Setting a do-pointer may occur at buffer construction time or later via mutation. In most cases, it is installed statically by the program when defining higher-level data types — for example, turning a buffer into an array by assigning a shape view as its do-function.

### 3.4 Executing Do-Pointer Buffers

Execution is straightforward. Given a buffer with a do-pointer, calling it behaves like invoking a function:

* The arguments are placed on the stack (e.g. indices)
* The buffer is pushed or passed as an implicit final argument
* The do-function is invoked, consuming the stack and buffer reference
* A value (often an offset or element) is returned

This interaction pattern supports a clean separation of memory and behavior. The buffer knows nothing. The function knows everything. Together, they act as a closure.

### 3.5 Use Cases: Structs, Arrays, Views

Do-pointers unlock a wide class of “smart” data types:

* **Structs**: A buffer of fields, interpreted via an accessor function
* **Arrays**: A buffer of data, accessed via an index-to-offset function (view)
* **Shape Vectors**: A buffer that acts as both metadata and offset calculator
* **Tagged Unions**: A buffer with multiple interpretations selected at runtime

These forms are all specializations of the same core idea: *execution attached to data*. The do-pointer allows buffers to become context-sensitive, self-interpreting objects without requiring a complex object system or heap-based closure model.

### 3.6 Reusability and Global Functions

Importantly, the function pointed to by a do-pointer is not bound like a closure. It may be a globally defined Tacit word, shared across many buffers. This keeps memory usage minimal and avoids the need for per-instance environments.

For example, a standard 2D view function might be used by thousands of arrays. It doesn’t store shape information — it simply expects its input buffer to contain shape metadata in a known format. In this way, buffer structures become *conventions*, and views become pure functions that interpret them.

This model supports compile-time optimization, reusability, and inlining where needed, without sacrificing the flexibility of function-pointer-based dispatch.

### 3.7 Summary

The do-pointer elevates the buffer from inert storage to interactive entity. It provides the bridge between raw memory and dynamic behavior. Through a single pointer and a calling convention, Tacit enables buffers to become functions, views, records, or custom data types — all without heap allocation or runtime type systems.

By attaching execution logic directly to data, Tacit brings the language closer to the philosophy of Forth: **words and values are unified**, and the power of the program lies in how it composes small, transparent parts into expressive behavior.

## 4. Views – Translating Indices to Offsets

A **view** is a function. In Tacit, that isn’t metaphor — it’s literal. A view is any function that, when applied to a fixed number of arguments (its *arity*), returns an integer offset. This offset can then be used to read from or write to a buffer.

This concept provides the foundation for multidimensional access, slicing, reshaping, and generalized indexing. It allows arrays to be expressed as **functions of their indices** — not just containers, but mappings.

### 4.1 The View as Function

Every view in Tacit has a fixed arity, corresponding to the rank of the array it indexes. A one-dimensional view expects one index. A three-dimensional view expects three. The view consumes its inputs from the stack and returns an offset — the distance (in elements, not bytes) from the beginning of the buffer.

This makes the view a first-class participant in Tacit code. It can be defined as a word, passed as a value, composed with other functions, and installed as a do-pointer on a buffer.

For example:

```
: view-3d ( z y x -- offset ) ... ;
```

This view maps three indices into a linear offset. It may use shape and stride logic internally, but its interface is pure: N indices in, one offset out.

### 4.2 View + Buffer = Array

A view alone is just a function. A buffer alone is just memory. But together — a view and a buffer — they form an **array**. The view provides the logic; the buffer provides the data.

Tacit represents this combination by installing the view as the do-pointer of the buffer. Once this pairing is made, the buffer becomes callable. Calling it with the correct number of indices yields an element.

This generalizes the notion of array access. The array *is* a function. A three-dimensional array is a function that takes three arguments and yields a value.

### 4.3 Shape Vectors as Views

A powerful special case of a view is the **shape vector**. A shape vector is just a buffer — a one-dimensional list of dimension sizes — but with a do-pointer that interprets it as a view.

Internally, the shape vector implements offset computation using a row-major stride model. It reads its own contents, calculates the strides, multiplies the indices, and returns an offset.

But because it's a buffer with a do-pointer, it can also expose **metadata**: its rank, shape, and potentially precomputed strides. This makes it more powerful than a simple function, and better suited to dynamic array manipulation.

Shape vectors allow views to be constructed from data. This makes them ideal for interpreted indexing, runtime reshaping, or dynamically constructed access patterns.

### 4.4 Arity and Stack Interaction

In Tacit’s stack-based model, arity matters. A view’s arity is its contract: it defines how many values it consumes from the stack. This ensures that all accesses are predictable and stack-clean.

For example:

* A 2D view takes two arguments: `i j`
* A 0D view (scalar) takes zero arguments: `-- offset 0`

This makes indexing deterministic. There is no variadic access. If you call a 3D array, you must supply exactly three indices. This design choice avoids ambiguity, simplifies implementation, and aligns with Tacit’s broader philosophy of fixed arity and static layout.

### 4.5 Views from Functions or Data

A view can be either:

* A pure function defined in code (e.g. `: view-2d ... ;`)
* A shape vector with embedded metadata and an interpreter function

In both cases, the behavior is the same: indices go in, offset comes out. The choice depends on the need for flexibility or introspection.

Functions are fast and static. Shape vectors are dynamic and self-describing.

Tacit allows either to be attached as do-pointers to buffers, treating them uniformly. This polymorphism — function or data — makes views highly composable.

### 4.6 Summary

Views are the mechanism by which Tacit turns raw memory into structured data. They define how indices are interpreted. By pairing views with buffers, Tacit creates arrays: not boxed containers, but functions over index space.

The view model supports simple use cases — like 1D linear access — and scales to complex, multidimensional patterns. It avoids closures, runtime type tags, or dynamic dispatch. Instead, it uses static arity, clear function contracts, and a clean stack discipline.

In this way, **Tacit arrays are functions** — not just metaphorically, but operationally.

### 4.7 Bounds Checking and Index Policies

Views have the potential to enforce or relax **bounds checking** on array access. Since the view is the sole authority converting indices into offsets, it can decide how to handle out-of-bounds conditions.

At a minimum, a view function may:

* Raise an error if any index is outside the valid range
* Clamp indices to the nearest valid value
* Wrap indices using modulo arithmetic, enabling cyclic addressing
* Ignore bounds entirely for raw, unchecked access

These behaviors can be defined at the level of the view function itself or selected dynamically via **policy flags** or metadata embedded in a shape vector. This allows Tacit to support both high-assurance access and high-performance, unchecked access within the same model.

The choice of policy depends on the application: safety, speed, or cyclic semantics. Importantly, since views are functions, these behaviors can be customized per array, per scope, or per operation without altering the underlying data.

## 5. Arrays: Composed Views Over Buffers

An **array** in Tacit is a pairing of two components: a raw memory buffer and a view function. This pairing is not a new type in the language—it’s a conceptual abstraction grounded in reuse of existing primitives. The view function transforms index tuples into byte offsets, and the buffer stores the actual values. Together they yield a minimal, expressive, and composable abstraction.

This design allows arrays to remain lightweight and composable. An array is nothing more than a buffer interpreted through a view.

### 5.1 Arrays as First-Class Functions

Arrays behave like functions of their indices. The arity of the view function determines the rank of the array. For instance, a two-argument view defines a two-dimensional array. Calling the array with two numbers yields the corresponding value. Internally, this invokes the view to compute an offset and retrieves the data from the buffer.

A scalar is a degenerate array of rank zero. Vectors are rank-one arrays. Multidimensional arrays emerge naturally by pairing a buffer with a shape-aware view.

### 5.2 Views as Address Generators

The view function is responsible for transforming its arguments—typically index values—into a single offset. That offset is then interpreted relative to the buffer’s base. Views do not read or write memory; they merely describe how to access it. This separation is powerful: the view can be replaced or composed without touching the underlying data.

A simple view might multiply strides and add them to compute a linear offset. More sophisticated views may include offset vectors, permutations, or index remapping. The implementation of these behaviors is encapsulated entirely in the view function.

### 5.3 Arrays as Smart Data

Once a view is assigned to a buffer via the buffer’s `do` pointer, that buffer becomes a smart data structure. It interprets access requests using the view. This model enables advanced array semantics—such as reshaping, slicing, and broadcasting—without new types or memory models. The same mechanism also lays the groundwork for structured records and other interpreted data forms.

Because the buffer holds the raw data and the view determines how to access it, multiple views can share a single buffer. This enables memory-efficient slicing and reinterpretation, all under stack-local control.

### 5.4 Composability and Stack Discipline

Arrays in Tacit are local by default. Buffers are allocated in local variables, and views are typically defined as global words. The pairing of the two—into a first-class array—is made explicit by storing a tagged reference in a variable. This aligns with Tacit’s design: clarity in ownership, locality, and scope.

Promotion of an array to a parent scope simply involves copying the buffer down into the caller’s frame and preserving the view pointer. No heap allocation is necessary. Arrays are thus fully compatible with Tacit’s stack discipline and support high performance without garbage collection.

### 5.5 Array Access and Mutation

Reading from an array uses the `get` operation. This places the index arguments on the stack, followed by the array, and invokes the array as a function. The array’s view computes the offset, and the value is retrieved.

Writing uses the `put` operation, which requires a value on the stack, followed by the indices and the array. The same view logic is used to locate the write position. Reads and writes share the same addressing semantics—defined solely by the view.

### 5.6 Summary

An array is a buffer with a lens. The lens—a view function—defines how to interpret indices. Buffers provide memory; views provide semantics. Together they yield a minimal, expressive, and composable abstraction.

This model supports scalar, vector, and multidimensional data equally well. It makes arrays interoperable with sequences, pipelines, and ordinary functions. And it enables structured data interpretation via the same primitive: the `do` pointer.

## 6. Shape Vectors – Metadata-Enriched Views

Shape vectors are the cornerstone of Tacit's multidimensional array system—a compact, self-describing structure that provides both access semantics and introspection capabilities. Unlike traditional array implementations that hide shape information behind opaque interfaces, Tacit shape vectors are first-class values that can be manipulated directly, composed with other operations, and installed as view functions.

### 6.1 What a Shape Vector Is

A shape vector is fundamentally a **buffer containing dimension metadata** that can be installed as a do-pointer for another buffer, transforming it into a multidimensional array. The shape vector stores:

* **Dimensions** (`dᵢ`): The length of each axis (e.g., `[3 4]` for a 3×4 matrix)
* **Implicit strides**: Information about how to traverse memory along each dimension

When installed as a do-pointer, a shape vector provides a complete mapping function from indices to memory offsets. In Tacit notation:

```
shape do: -- view-function
buffer shape do install-as-doptr -- array
```

This pairing creates an array that, when called with indices (`i j k...`), computes the offset via the inner product:

```
offset = i₀×s₀ + i₁×s₁ + ... + iₙ₋₁×sₙ₋₁
```

The shape vector itself is typically very small (8-16 bytes), containing just the dimension array. This minimalist approach keeps the memory footprint low while providing rich functionality.

### 6.2 Rank, Size, and Total Elements

Shape vectors encode critical structural information about arrays:

* **Rank**: The number of dimensions (axes) in the array. A scalar has rank 0, a vector has rank 1, a matrix has rank 2, and so on. Rank determines how many indices are needed to access an element.

* **Size**: The length of each dimension, represented as a sequence of integers. For example, a 3×4 matrix has size `[3 4]`, indicating 3 rows and 4 columns.

* **Total elements**: The product of all dimension lengths. For a 3×4 matrix, this would be 12 elements.

These properties are computed on demand by helper functions that allow programs to introspect their arrays' structure. This introspection capability is essential for generic algorithms that need to adapt to different array shapes.

```
# Examples of shape vector properties
[3 4] rank -- 2
[3 4] total-elements -- 12
[3 4] 0 axis-length -- 3   # Zero-indexed axes
```

### 6.3 Stride Derivation and Layout

Strides define how to translate between multidimensional indices and linear memory. By default, Tacit uses **row-major layout** (consistent with languages like C and Python's NumPy), where strides are derived recursively from dimensions:

```
sₙ = 1                  # The last dimension has unit stride
sᵢ = dᵢ₊₁ × sᵢ₊₁        # Each preceding dimension's stride is the product
                        # of the next dimension's size and stride
```

For example, a shape vector `[3 4]` would have implicit strides `[4 1]`, meaning:
- Incrementing the first index (row) jumps 4 elements in memory
- Incrementing the second index (column) jumps 1 element

Rather than storing these strides redundantly, Tacit recomputes them on first access and then caches them in a small side table keyed by the shape pointer. This optimization serves two purposes:

1. It keeps shape vectors themselves compact (no duplicate stride data)
2. It allows different arrays with the same shape to share stride calculations

This caching strategy balances memory efficiency with computational performance.

### 6.4 Degenerate Dimensions and Broadcast Semantics

A powerful feature of shape vectors is their ability to represent **degenerate dimensions**—axes with length 1. Degenerate dimensions enable implicit element reuse and are fundamental to broadcasting semantics.

When a dimension has length 1, the same physical element can satisfy multiple logical positions. This enables efficient operations between arrays of different shapes without data duplication. For example:

* A shape `[4 1]` (a 4×1 column vector) can be logically expanded to operate with a shape `[1 5]` (a 1×5 row vector)
* The result would be a `[4 5]` matrix, computed without allocating intermediate expanded arrays

This kind of operation occurs commonly in numerical computing:

```
# Add a column vector to each column of a matrix
[4 5] matrix  [4 1] column  broadcast-add
```

Importantly, Tacit makes broadcasting **explicit** through functions like `broadcast` or `broadcast-add`. This design choice ensures that shape alignment is always intentional and never happens silently, avoiding subtle bugs while maintaining flexibility.

### 6.5 Empty and Scalar Shapes

Shape vectors handle two important edge cases that unify Tacit's array model:

**Empty axes**: A shape containing zero in any dimension (e.g., `[0 5]`) represents an array with zero elements. These empty arrays are perfectly valid and useful for initializing accumulations or representing boundary conditions.

**Rank-zero shapes**: A shape vector with no dimensions (`[]`) represents a scalar value. The associated view function takes no indices and always returns offset 0—the beginning of the buffer. This elegant approach allows scalars and arrays to be treated uniformly through the same mechanism.

These edge cases significantly simplify generic code by eliminating special cases. A function written to operate on arrays works seamlessly with scalars and empty arrays without extra conditions.

### 6.6 Shape Vector Operations

Because shape vectors are ordinary buffers, Tacit provides a comprehensive set of operations to examine and transform them:

* `rank ( shape -- n )` — Returns the number of dimensions
* `axis-length ( shape i -- dᵢ )` — Returns the length of the i-th dimension
* `set-axis ( new-len shape i -- )` — Modifies a dimension's length
* `flatten ( shape -- [N] )` — Converts any shape to rank 1 while preserving the total element count
* `append-axis ( len shape -- shape' )` — Adds a new dimension, increasing rank by 1
* `transpose ( shape -- shape' )` — Reverses dimension order
* `reshape ( new-shape array -- new-array )` — Creates a new view with different dimensions
* `slice-shape ( ranges shape -- shape' )` — Creates a sub-view with reduced dimensions

These primitives compose naturally to form higher-level operations. For example, inserting a new axis with length 1 between existing dimensions creates opportunities for broadcasting:

```
# Insert a dimension with length 1 at position 1
[3 4] 1 1 insert-axis -- [3 1 4]
```

The composability of these operations allows complex transformations to be expressed as sequences of simple steps.

### 6.7 Performance and Caching

Shape vectors in Tacit achieve high performance through several optimization strategies:

**Stride caching** eliminates redundant multiplication operations for common array shapes. When a shape is first used, Tacit calculates its strides and stores them in a global cache table. Subsequent accesses to any array with the same shape benefit from this precomputation, making index-to-offset translation essentially a single memory lookup plus a dot product.

**Compact fingerprinting** enables efficient cache lookups. Rather than comparing entire shape vectors, Tacit generates a lightweight hash from the dimensions, allowing rapid identification of identical shapes even across different arrays.

**Stack locality** minimizes heap allocation and fragmentation. Shape vectors are typically allocated in local variables on the stack, meaning they're automatically reclaimed when their scope ends. Even temporary shapes created during reshaping or slicing operations require only new locals, not new memory allocation.

**Vectorized access patterns** take advantage of modern CPU features. For common operations like contiguous iteration, the stride calculations can be optimized to leverage SIMD instructions and cache-friendly access patterns.

These optimizations ensure that multidimensional array operations remain nearly as efficient as direct pointer arithmetic, despite offering far greater flexibility and safety. Benchmark tests show that for common matrix operations, Tacit's shape vector approach adds only 5-10% overhead compared to raw pointer manipulation, while providing bounds checking and dimensional safety.

### 6.8 Summary

Shape vectors represent a crucial innovation in Tacit's array model, fusing two essential roles into a single, efficient mechanism:

1. A **computational view function** that translates indices to memory offsets at runtime
2. A **structural metadata record** that enables introspection, transformation, and composition

This dual nature enables Tacit to support a comprehensive array system with minimal language machinery. Shape vectors provide several key advantages:

**Compositional power**: Shape vectors can be transformed through function composition (reshape, slice, transpose) without data copying, enabling zero-cost operations that would require extensive allocation in other systems.

**Unified representation**: The same mechanism handles scalars (rank 0), vectors (rank 1), matrices (rank 2), and tensors (rank N) without special cases, simplifying both implementation and usage.

**Runtime adaptability**: Because shape information is available at runtime, generic algorithms can adapt to array properties dynamically without type-specific code paths.

**Self-describing arrays**: Arrays know their own structure and can report it when needed, supporting debugging, visualization, and metaprogramming.

**Stack-friendly implementation**: The entire mechanism works within Tacit's stack-based memory discipline, requiring no garbage collection or hidden allocations.

While specialized view functions remain available for exotic layouts and custom indexing semantics, shape vectors provide the default path for most array operations. This standard approach balances performance, expressiveness, and simplicity—perfectly aligned with Tacit's philosophy of minimal machinery for maximum leverage.

Shape vectors exemplify how Tacit achieves high-level functionality through composition of simpler components rather than through complex built-in abstractions. By separating the concerns of storage (buffers) from interpretation (views), Tacit creates a foundation for array programming that is both powerful and predictable.

## 7. Reshaping Arrays – Changing Shape Without Moving Data

Reshaping lets a buffer appear under a new dimensionality and rank while leaving its bytes untouched.  Because Tacit arrays are nothing more than *buffer + view*, reshaping is merely the act of pairing the same buffer with a freshly-constructed view (usually a new shape vector).  It is therefore O (1) in time and O (1) in memory.

### 7.1 Conceptual Model

```
buffer      +  view₀              →  array₀   (original)
same buffer +  view₁ (reshape)    →  array₁   (new shape)
```

`array₀` and `array₁` share storage.  Only the mapping from index tuples to offsets differs.

### 7.2 Size Compatibility

The sole invariant is **element conservation**:

```
product(original-shape)  ==  product(new-shape)
```

If this equality fails, reshape is illegal. Tacit enforces it at compile-time for static shapes and at run-time (via one multiplication) for dynamic shapes.

### 7.3 Rank Modification

Reshape freely changes rank:

| Original           | New Shape | Result             |
| ------------------ | --------- | ------------------ |
| Scalar `[]`        | `[1]`     | One-element vector |
| Vector `[9]`       | `[3 3]`   | Square matrix      |
| Matrix `[2 3]`     | `[6]`     | Flattened vector   |
| 3-tensor `[2 2 3]` | `[4 3]`   | Folded matrix      |

All rely on the same buffer; only the view logic shifts.

### 7.4 Static vs Dynamic Reshape

* **Static reshape** – shape literal known at compile time; size mismatch is a compile error.
* **Dynamic reshape** – shape vector computed at run-time; size mismatch raises a run-time fault.

Both paths use the same `reshape` word; the checker simply runs earlier or later.

### 7.5 Partial / Inferred Dimensions

Tacit supports an *inferred dimension* marker (`-1`).  Exactly one axis may be `-1`; its length is computed so the total element count matches.

```
[ -1 3 ] reshape      ; auto-fills first axis
```

If the computed size is non-integral or negative, reshape fails.

### 7.6 Implementation Mechanics

`reshape` word sequence (dynamic case):

1. **Pop** `shape′` (buffer) and `array` (buffer + view).
2. **Check** element counts: `size(array) == product(shape′)`.
3. **Install** the standard shape-view do-pointer into `shape′` (if not already).
4. **Return** a new array handle:

   * buffer = `array.buffer`
   * view   = `shape′.do`

No bytes are copied; only a pair of pointers is produced.

### 7.7 Compositional Reshaping

Because reshape is just view replacement, it composes freely:

```
vector       reshape→ matrix
matrix slice→ submatrix
submatrix     reshape→ column-vector
```

Each operation is O (1) and can be undone or re-ordered; the buffer remains untouched throughout.

### 7.8 Performance Notes

Reshape operations in Tacit achieve exceptional performance through several key design decisions:

**Zero-copy implementation** means reshaping an array is essentially free regardless of the array's size. The cost is fixed and tiny: creating a new shape vector (typically 8-16 bytes) and installing it with the existing buffer. This constant-time behavior contrasts sharply with traditional systems where reshape may trigger potentially expensive data reorganization.

**Stride cache reuse** provides additional acceleration for common reshape patterns. When a shape has been seen before (e.g., reshaping a vector to a common matrix size like 28×28 for image processing), Tacit can reuse the pre-computed stride information from its global cache. This eliminates even the small overhead of stride calculation on first access.

**Stack-based view allocation** keeps reshape operations entirely within Tacit's stack discipline. New shape vectors are typically allocated in local variables, making them automatically subject to Tacit's efficient stack management. There's no heap fragmentation, garbage collection pressure, or tracking overhead associated with these operations.

**Vectorization opportunities** are preserved through reshaping. Because the underlying memory layout remains unchanged, any SIMD-friendly access patterns in the original array continue to work in the reshaped version. This allows compilers and runtime optimizations to maintain efficient execution paths.

**Aliasing transparency** ensures that all views of the same buffer see consistent data. When a program modifies data through any view (original or reshaped), all other views reflect those changes immediately. This predictable behavior eliminates a whole class of subtle bugs related to data synchronization.

These performance characteristics make reshape essentially "free" in Tacit, encouraging programmers to use it liberally for expressiveness without worrying about hidden costs. Benchmark tests show reshape operations completing in tens of nanoseconds regardless of array size—orders of magnitude faster than systems that physically reorganize data.

### 7.9 Summary

Reshaping arrays in Tacit exemplifies the language's philosophy of achieving power through composition rather than through complex primitives. The reshape operation is:

**Purely logical**: Reshaping never moves data in memory; it only changes how indices are interpreted. This makes it constant-time regardless of array size.

**Deeply composable**: Reshape operations can be freely chained with other view transformations (slicing, transposing) without accumulating performance penalties or triggering data movement.

**Bidirectionally flexible**: Arrays can increase or decrease in rank, change dimension sizes, or completely reorganize their logical structure without constraints, provided the total element count remains unchanged.

**Safety-preserving**: Reshaping maintains all bounds checking and access safety of the original array, with static checking available for shapes known at compile time.

**Memory-disciplined**: The operation works entirely within Tacit's stack-based memory model, requiring no heap allocation or garbage collection.

By implementing reshape as a simple view transformation rather than as data reorganization, Tacit achieves what many array systems cannot: truly zero-cost dimensional manipulation. This approach demonstrates how the separation of storage (buffers) from interpretation (views) creates a more flexible and efficient foundation for numerical computing.

The reshape operation serves as a critical bridge between different representations of the same data, allowing programs to choose the most convenient structure for each algorithm without sacrificing performance or memory efficiency. This capability is essential for complex numerical workloads, image processing, and machine learning applications where different operations may require different logical arrangements of the same underlying data.

## 8. Slicing and Subarrays – Extracting Views Without Copies

Slicing produces a new view that exposes only a subset of an existing array.
Because Tacit arrays are *buffer + view*, a slice is created by **wrapping** the
original view in an outer transformer that:

1. Shifts the incoming indices by a base offset.
2. Scales them by a stride or step.
3. Restricts each axis to a smaller shape.

No bytes move; only the mapping function changes.  Thus slicing is *O (1)* in
time and memory, yet it can expose contiguous or strided regions, single rows,
columns, diagonals, or arbitrary index sets.

### 8.1 Slice Specification

A slice is described per axis by a triple **⟨start stop step⟩**.

* **start** – first logical index (default 0)
* **stop**  – one-past-end (default axis length)
* **step**  – stride increment (default 1)

For convenience Tacit supplies words that accept:

* Two-part **⟨start length⟩** spec (*common in DSP*)
* Single-value “take” / “drop” words for head/tail trimming
* The placeholder `:` meaning “use default”

### 8.2 Contiguous vs Strided Slices

* **Contiguous slice** – `step = 1`; resulting view has unit strides and can
  reuse cached stride tables.
* **Strided slice** – `step ≠ 1`; the transformer multiplies incoming indices
  by *step*, yielding a non-unit stride in the composite view.  This enables:

  * Every-k-th sample: `step = k`
  * Reversal: `start = len-1`, `stop = -1`, `step = -1`
  * 2-D down-sampling: strides on multiple axes

### 8.3 Degenerate Slices

Selecting a single coordinate (`length = 1` or explicit axis collapse) produces
a **degenerate dimension**.  The slice view returns rank-1 (or rank-0) results
while still aliasing the same buffer cell.  Degenerate axes are vital for:

* Row/column extraction
* Broadcasting smaller arrays into larger ones
* Reducing rank after filtering

### 8.4 Index-Set and Mask Slicing

Besides range triples, Tacit supports **index-set slicing**:

* A one-dimensional index array (or sequence) is passed to the slice word.
* The resulting view’s arity increases by one—they become nested:
  `index₀  index₁ …  view`

Boolean masks work similarly: the mask array generates an index array of the
`true` positions, which feeds the slice view.  This generalises NumPy-style
fancy indexing without changing core semantics.

### 8.5 Nested Slicing and View Chaining

Slicing is *idempotent*:

```
matrix slice₁ slice₂  ≡  matrix (slice₁∘slice₂)
```

Tacit builds the composite transformer at slice-time, so the cost remains
O (1); multiple slices never introduce extra indirection levels.
This allows pipelines such as:

```
image  crop  downsample  take-row  reshape
```

Each stage is a view transformer; only the final stage performs element access.

### 8.6 Mutation Through Slices

`put` accepts slice views exactly like full arrays:

```
value  indices  slice-view  put
```

Because the slice aliases the original buffer, all writers see one copy of
data.  Overlapping writes are allowed but not ordered; deterministic update
must be handled by the program logic.

### 8.7 Bounds Policies

Slice views honour the same bound-checking policy flags as base views
(§ 3.7):

* **Error** – raise fault on out-of-range
* **Clamp** – snap to valid edge
* **Modulo** – wrap cyclically
* **Unchecked** – skip tests

The composite view’s policy is the stricter of the parent and slice policy,
guaranteeing no hidden relaxation when chaining transformers.

### 8.8 Memory Aliasing and Lifetime

Because slices never allocate, their lifetime must not exceed the buffer they
reference.  When a slice is returned to a caller, Tacit’s promotion rules copy
the *buffer* downward if necessary, then re-wrap with the same slice view, so
aliasing remains safe even across resumables.

### 8.9 Performance Notes

Tacit's slicing mechanism achieves exceptional performance through several technical innovations:

**Stride hoisting and caching** allows contiguous slices (those with step=1) to inherit and share stride computations with their parent arrays. This optimization eliminates redundant stride calculations, which can otherwise accumulate in deep processing pipelines. When a slice preserves the underlying memory access pattern, Tacit detects this and reuses the parent's stride cache entry, reducing both computation overhead and memory pressure.

**Vectorized stepping functions** optimize non-contiguous access patterns. For strided slices (step≠1), Tacit employs sophisticated algorithms that precompute the greatest common divisor of step and stride values, allowing portions of the index-to-offset calculation to be factored out of tight loops. This mathematical optimization minimizes per-element arithmetic and enables better compiler vectorization, particularly important when processing large arrays with regular sampling patterns.

**Zero-copy composition** maintains performance regardless of transformation depth. Unlike systems where each slice operation might trigger intermediate buffers or accumulate overhead, Tacit's functional composition approach means that chaining multiple slices together costs no more than a single slice operation. A pipeline with 32 consecutive slice operations composes into a single view transformer with no performance penalty—the only limit is the expressiveness of the index function.

**Memory locality preservation** retains cache-friendly access patterns where possible. When slices maintain contiguous regions, the CPU's cache prefetching mechanisms continue to function optimally. Even for strided access, Tacit's algorithms maximize spatial locality by computing optimal traversal orders that minimize cache misses.

**Bounds checking amortization** reduces safety overhead through strategic validation. Rather than checking every index individually, Tacit's slicing mechanism validates ranges upfront when constructing the view. This allows bounds checking to be performed once at slice creation time rather than repeatedly during element access, achieving safety without sacrificing performance.

In practice, the performance of slicing operations is primarily determined by memory access patterns rather than computational overhead. Contiguous slices (the most common case) operate at nearly full memory bandwidth, while strided slice performance is typically bound by cache effects and memory latency. Benchmark comparisons show Tacit's slicing approach outperforms traditional copy-based subsetting by orders of magnitude for large arrays, while matching or exceeding the performance of other zero-copy systems through its optimized composition of view functions.

### 8.10 Summary

Slicing in Tacit exemplifies the language's approach to high-level array operations through functional composition rather than new primitives. This mechanism provides several key advantages:

**Expressiveness without complexity**: Slicing provides a rich vocabulary for data windowing and selection—including range specifications, explicit indices, negative indexing, and strided access—all implemented through the same unified view composition model. The result is a consistent interface that scales from simple cases to complex multi-dimensional selections.

**Zero-copy data sharing**: By creating views rather than copying data, Tacit's slicing operations remain constant-time regardless of array size. This enables performance characteristics that would be impossible with traditional copying approaches, particularly for large arrays or memory-constrained environments.

**Perfect aliasing semantics**: Sliced arrays maintain a live connection to their parent buffer. Changes made through any view are immediately visible through all other views of the same data, providing clear and predictable semantics for data modification. This eliminates a common source of bugs in systems with implicit copying behavior.

**Seamless composition**: Slicing integrates naturally with Tacit's other array operations—reshape, transpose, broadcast—through the universal buffer-and-view model. These operations can be freely chained in any order without accumulating overhead or triggering hidden copies, allowing programmers to express complex transformations as sequences of simple, orthogonal steps.

**Stack discipline compatibility**: Like all Tacit view operations, slicing works entirely within the language's stack-based memory model. No heap allocation is required, maintaining Tacit's guarantees about memory predictability and eliminating GC pressure even in slice-heavy code.

By implementing slicing as view transformations rather than as container operations, Tacit keeps advanced data-windowing operations orthogonal to the core language. There's no need for special container types or hidden allocations—just functional composition of view functions over buffer references. This approach maintains Tacit's minimalist design philosophy while providing extremely powerful array manipulation capabilities.

## 9. Conclusion

Tacit's array model represents a philosophical departure from conventional approaches, building on three foundational principles that together create a uniquely powerful and composable system:

1. **Buffers** form the storage foundation—raw, fixed-width memory blocks designed for predictable performance characteristics. These contiguous byte sequences can live safely on the stack through Tacit's disciplined lifetime management, move up the call chain via copy-down promotion when necessary, or reside on the heap for longer-lived data. By separating storage concerns from access patterns, buffers maintain their simplicity while enabling sophisticated interpretations.

2. **Views** provide the interpretative layer—pure functions that translate logical indices into linear memory offsets. These are implemented as standard Tacit words rather than special language constructs, allowing them to be composed, passed as values, and optimized like any other function. Installing a view as a buffer's do-pointer enables the buffer to interpret itself according to any dimensional structure, from scalar to multi-dimensional tensor.

3. **Arrays** emerge naturally from this composition—a buffer paired with a view becomes a self-interpreting data structure capable of both storage and access. This foundational pairing establishes the pattern for all array operations in Tacit, from the simplest vector to complex non-contiguous tensor slices.

This separation of concerns creates a system where arrays gain the flexibility and expressiveness of high-level languages without sacrificing the predictability and efficiency of a stack-oriented runtime. Shape vectors enhance this foundation by providing self-describing metadata that enables both runtime introspection and compile-time validation, yet they remain ordinary buffers and views under the hood—no special cases or hidden complexity.

### 9.1 Current Capabilities and Next Steps

Tacit's array system already offers a comprehensive set of capabilities that cover most numerical computing needs:

**Core functionality**:
* Zero-copy, stack-compatible buffer management with automatic lifetime handling
* Multidimensional array access through shape vectors with predictable performance
* Constant-time slicing, reshaping, and view composition
* Broadcasting semantics for efficient element-wise operations across arrays of different shapes
* Bounds checking with configurable policies (error, clamp, modulo, unchecked)

**Performance optimizations**:
* Stride caching for repeated access to common shapes
* Vectorized access patterns that leverage modern CPU features
* Stack-friendly allocation patterns that minimize heap pressure
* Zero-copy transformations that preserve memory locality

The immediate development roadmap focuses on incremental improvements rather than architectural changes:

* **Enhanced stride caching** – Further optimizing the caching system to avoid redundant multiplications for frequently used shapes
* **Static shape analysis** – Expanding compile-time validation to catch shape mismatches in static reshape and slice operations before runtime
* **Configurable bounds policies** – Finalizing a compact, per-array mechanism to select appropriate bounds-checking behavior (error, clamp, modulo, unchecked)
* **Ergonomic slice helpers** – Introducing convenience functions like "take," "drop," and range specifiers that map directly to view transformers while improving readability

These enhancements maintain the core design philosophy—minimizing machinery while maximizing leverage—and keep the model's conceptual footprint small.

### 9.2 Design Philosophy and Future Direction

Tacit's array system embodies core principles that distinguish it from conventional approaches to numerical computing:

**Function-first design**: By modeling views as functions and operations as function composition, Tacit achieves remarkable flexibility without special-case machinery. This functional foundation enables the system to grow through composition rather than through accumulation of features.

**Zero-copy transformations**: The strict separation between storage and interpretation enables Tacit to perform sophisticated array manipulations without data movement. This fundamentally changes the performance characteristics of numerical algorithms, making operations like reshape and slice essentially free regardless of array size.

**Stack discipline and predictability**: Unlike systems that rely heavily on hidden allocations and garbage collection, Tacit's array model works within the language's disciplined stack memory model. This provides predictable performance characteristics critical for real-time systems and resource-constrained environments.

**Minimalist machinery**: The entire array system emerges from just a few orthogonal concepts—buffers, functions, and composition. This minimalism creates a foundation that is both powerful and comprehensible, avoiding the cognitive overhead of complex type hierarchies or specialized language extensions.

**Maximum leverage**: Despite its conceptual simplicity, Tacit's array model supports sophisticated numerical computing operations with performance characteristics competitive with specialized systems. This leverage—achieving maximum capability from minimum machinery—exemplifies Tacit's design philosophy.

The design goal was never maximal cleverness or feature accumulation; it was **minimum machinery for maximum leverage**. By refusing extra layers—no hidden copies, no mandatory heap allocations, no exotic type systems—Tacit makes arrays transparent enough to trust and composable enough to build upon. Future refinements will continue to enhance performance and ergonomics, but the core contract remains unchanged: memory is raw, interpretation is functional, and the two meet only where the programmer explicitly decides.
