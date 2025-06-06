- [Buffers and Arrays](#buffers-and-arrays)
- [Introduction](#introduction)
- [1. Buffers – Raw Memory as a First-Class Value](#1-buffers--raw-memory-as-a-first-class-value)
  - [1.1 Element Width and Usage](#11-element-width-and-usage)
  - [1.2 Buffers as First-Class Values](#12-buffers-as-first-class-values)
  - [1.3 Buffers and Sequences](#13-buffers-and-sequences)
  - [1.4 Buffers as Low-Level Infrastructure](#14-buffers-as-low-level-infrastructure)
  - [1.5 Storage, Aliasing, and Ownership](#15-storage-aliasing-and-ownership)
  - [1.6 Summary](#16-summary)
- [2. Do-Pointers – Executable Interpretation for Buffers](#2-do-pointers--executable-interpretation-for-buffers)
  - [2.1 What is a Do-Pointer?](#21-what-is-a-do-pointer)
  - [2.2 Buffers with and without Do-Pointers](#22-buffers-with-and-without-do-pointers)
  - [2.3 Installing a Do-Pointer](#23-installing-a-do-pointer)
  - [2.4 Executing Do-Pointer Buffers](#24-executing-do-pointer-buffers)
  - [2.5 Use Cases: Structs, Arrays, Views](#25-use-cases-structs-arrays-views)
  - [2.6 Reusability and Global Functions](#26-reusability-and-global-functions)
  - [2.7 Summary](#27-summary)
- [3. Views – Translating Indices to Offsets](#3-views--translating-indices-to-offsets)
  - [3.1 The View as Function](#31-the-view-as-function)
  - [3.2 View + Buffer = Array](#32-view--buffer--array)
  - [3.3 Shape Vectors as Views](#33-shape-vectors-as-views)
  - [3.4 Arity and Stack Interaction](#34-arity-and-stack-interaction)
  - [3.5 Views from Functions or Data](#35-views-from-functions-or-data)
  - [3.6 Summary](#36-summary)
  - [3.7 Bounds Checking and Index Policies](#37-bounds-checking-and-index-policies)
- [4. Arrays: Composed Views Over Buffers](#4-arrays-composed-views-over-buffers)
  - [4.1 Arrays as First-Class Functions](#41-arrays-as-first-class-functions)
  - [4.2 Views as Address Generators](#42-views-as-address-generators)
  - [4.3 Arrays as Smart Data](#43-arrays-as-smart-data)
  - [4.4 Composability and Stack Discipline](#44-composability-and-stack-discipline)
  - [4.5 Array Access and Mutation](#45-array-access-and-mutation)
  - [4.6 Summary](#46-summary)
- [5. Shape Vectors as Metadata-Enriched Views](#section-5-shape-vectors-as-metadata-enriched-views)
- [6. Reshaping Arrays](#6-reshaping-arrays)
  - [6.1 Logical and Physical Invariance](#61-logical-and-physical-invariance)
  - [6.2 Shape Compatibility and Rank Change](#62-shape-compatibility-and-rank-change)
  - [6.3 Dynamic and Static Reshape](#63-dynamic-and-static-reshape)
  - [6.4 Reshape as Function Composition](#64-reshape-as-function-composition)
- [7. Slicing and Subarrays](#7-slicing-and-subarrays)
  - [7.1 Slice as View Transformation](#71-slice-as-view-transformation)
  - [7.2 Stride Modification](#72-stride-modification)
  - [7.3 Slicing by Index Sets](#73-slicing-by-index-sets)


# Buffers and Arrays

## Introduction

Tacit’s approach to arrays begins with a simple question: what if arrays were not just containers, but active, functional elements of a program? In most languages, arrays are passive memory—indexed and manipulated from the outside. Tacit turns that model inside out. Here, arrays are built from functions. They interpret their own indices, participate directly in pipelines, and define their own behavior through compact stack-based programs.

At the heart of this model is the idea that arrays can be described and controlled through views—functions that map multi-dimensional indices to offsets in memory. These views, when paired with raw buffers of data, form fully-fledged arrays. But unlike in traditional systems, the view itself is just a Tacit word: it can be composed, reused, or replaced. This gives the programmer full control over the semantics of access, bounds checking, shape transformations, and more, all without requiring new language constructs.

This functional take on arrays has deep implications. It enables arrays to be locally scoped, stack-allocated, and passed between functions without copying. It unifies scalars, vectors, and multi-dimensional arrays into a single abstraction. And it lays the groundwork for powerful patterns like slicing, reshaping, or even smart data structures—all using the same small set of primitives.

What follows is not just an implementation manual, but a philosophy of how data can be structured and interpreted in a language where code and data are stack-oriented, interchangeable, and minimal. The goal is to show how a disciplined, functional approach to arrays can replace bulky, heap-driven models with something leaner, clearer, and more expressive.

## **1. Buffers – Raw Memory as a First-Class Value**

In Tacit, the most primitive data structure is the **buffer**. A buffer is a raw, contiguous block of memory that stores fixed-width elements — typically numbers or pointers — and serves as the basis for more structured abstractions like arrays, views, structs, and strings. The buffer model is designed to be flexible, lightweight, and tightly coupled to Tacit’s stack-based execution and locality-centric memory discipline.

A buffer is **not** inherently structured or self-interpreting. It does not include type metadata, field layouts, or dimension information by default. Instead, it is a *payload-only* container, fully defined by three fields: its **length** (number of elements), its **element width** (in bytes), and its **base pointer** to the allocated block. These fields are known statically or at runtime and are sufficient to compute memory usage and access locations.

### **1.1 Element Width and Usage**

The element width determines how the buffer’s memory is interpreted. The default width is four bytes, ideal for representing:

* Tagged values (Tacit’s primary scalar type)
* Pointers (to functions, strings, buffers, structs, etc.)
* Integers and floats
* Function tokens and code references

Other widths (one byte for strings, eight bytes for doubles, etc.) are possible and will be supported via element-width-aware operations. However, buffers do not enforce interpretation — they only store bytes. Any semantic layer must be imposed externally, such as by a view function or a struct accessor.

### **1.2 Buffers as First-Class Values**

Buffers are full citizens in the language. They can be:

* Stored in local variables
* Passed and returned by functions
* Yielded from resumables
* Promoted up the call stack to become shared between parent and child scopes

They are not references to boxed objects or heap-only data — in fact, most buffers will live **entirely on the stack**. Tacit encourages stack-local storage by default, using **copy-down promotion** as a mechanism to safely transfer ownership of temporary buffers from child to parent. This makes memory behavior simple, compositional, and predictable, without requiring garbage collection or hidden mutation.

Stack-allocated buffers follow a strict lifetime model: they are valid only until the return point of the function or resumable that created them, unless explicitly promoted. This avoids leaks, simplifies cleanup, and aligns perfectly with Tacit’s frame-based return stack.

Heap-allocated buffers do exist — created via explicit allocation — but they are treated identically in terms of behavior. Their allocation and deallocation are controlled by the program author, not an implicit runtime.

### **1.3 Buffers and Sequences**

Buffers are not just static storage; they are also deeply integrated with Tacit’s sequence and pipeline infrastructure. A buffer can serve as:

* A **sequence source**, emitting each element in order
* A **sequence sink**, collecting values into memory
* A **realized sequence**, representing the materialized result of a pipeline

This dual identity — storage and stream — allows seamless transitions between computation and representation. For example, a computation that filters and maps a data stream can produce a buffer as output, or consume one as input, without additional ceremony.

The symmetry between streams and buffers ensures that Tacit remains coherent across different execution models: lazy, eager, pipelined, or direct.

### **1.4 Buffers as Low-Level Infrastructure**

Beyond sequences, buffers are the underlying substrate for more advanced abstractions:

* **Arrays**: a buffer combined with an indexing function (a view)
* **Structs**: a buffer interpreted by offset-based accessors
* **Strings**: a buffer of bytes with optional metadata or encoding rules
* **Tags and closures**: pointers stored inside buffers to represent logic

The key point is that **buffers themselves are unstructured**. They do not carry interpretation. They are memory — raw and inert — until paired with a semantic lens. That lens may come from a view, a function pointer, or other external metadata, but the buffer remains a universal foundation.

This clean separation between memory and meaning is what gives Tacit its power: by not baking in assumptions about structure, Tacit enables a small number of primitives to be reused for a wide range of data representations.

### **1.5 Storage, Aliasing, and Ownership**

Buffers are directly compatible with Tacit’s promotion-based scope model. A buffer created in a child frame can be:

* Used locally and discarded automatically
* Promoted by copying it into the parent’s locals
* Passed up as a return value via slot reassignment

This is called **copy-down promotion**: the buffer is allocated at the top of the return stack during its construction, then moved down into the parent’s local region, with the parent’s stack pointer adjusted to claim ownership. No heap allocation is needed. No pointers are passed. The buffer itself becomes first-class data, captured in its final location.

Aliasing is minimized by this model. Since buffers are often created fresh and passed by value (not reference), the usual problems of shared mutation and concurrency are avoided. When buffers are shared (such as in a multi-reader scenario), this is made explicit — typically via tagged handles or reference-counted wrappers.

### **1.6 Summary**

The buffer is Tacit’s bedrock: a raw, minimally-defined, maximally-usable container for structured or unstructured data. It has no opinion about its contents, no intrinsic behavior, and no runtime costs beyond memory. It is storage, pure and simple.

From this foundation, all higher abstractions emerge. Views will give buffers a way to be interpreted. Do-pointers will give them executable behavior. And arrays will emerge as buffers paired with indexing logic.

But the buffer itself remains elemental — a value, a vessel, and a gateway to Tacit’s philosophy of composable, memory-aware programming.

## **2. Do-Pointers – Executable Interpretation for Buffers**

While buffers represent raw memory, they are silent by default. They store bytes but do not interpret them. Tacit introduces a minimal yet powerful enhancement: the **do-pointer**. A do-pointer attaches behavior to a buffer, transforming it into an executable data structure — a *poor man's closure*. This allows buffers to act not only as memory but as **functions** over their own contents.

### **2.1 What is a Do-Pointer?**

A do-pointer is an optional, tagged function pointer stored alongside a buffer’s metadata. When a buffer is executed — either directly via a `call` or through an operation like `get` — the do-pointer is invoked, receiving the buffer itself (as a pointer or handle) and arguments from the stack. The do-pointer is responsible for interpreting the buffer’s contents and producing a result, typically an offset, a value, or a derived view.

This mechanism mirrors Forth’s *DOES*> model, where variables and constants can carry custom execution behavior. In Tacit, the do-pointer gives buffers the ability to “interpret themselves” — to map inputs to locations, values, or operations.

### **2.2 Buffers with and without Do-Pointers**

A buffer without a do-pointer is inert: a passive memory block. It can be read from or written to using primitive operations, but it has no interpretation of its own.

A buffer with a do-pointer becomes an *active structure*. It can behave like:

* A function: computing values from inputs
* A view: converting indices into offsets
* A struct: accessing fields by position
* A smart string: decoding characters on the fly

The semantics are entirely defined by the function installed as the do-pointer. This function is free to interpret the buffer however it likes. It may use internal metadata, embedded tables, or simple arithmetic. The contract is: it takes stack inputs, the buffer reference, and returns a computed result.

### **2.3 Installing a Do-Pointer**

A do-pointer is stored in a fixed location, typically in a known slot near the buffer’s header (e.g. immediately following the length and element width). A flag bit in the header indicates its presence. When set, this bit tells the runtime or compiler to dispatch execution to the associated function instead of treating the buffer as inert data.

Setting a do-pointer may occur at buffer construction time or later via mutation. In most cases, it is installed statically by the program when defining higher-level data types — for example, turning a buffer into an array by assigning a shape view as its do-function.

### **2.4 Executing Do-Pointer Buffers**

Execution is straightforward. Given a buffer with a do-pointer, calling it behaves like invoking a function:

* The arguments are placed on the stack (e.g. indices)
* The buffer is pushed or passed as an implicit final argument
* The do-function is invoked, consuming the stack and buffer reference
* A value (often an offset or element) is returned

This interaction pattern supports a clean separation of memory and behavior. The buffer knows nothing. The function knows everything. Together, they act as a closure.

### **2.5 Use Cases: Structs, Arrays, Views**

Do-pointers unlock a wide class of “smart” data types:

* **Structs**: A buffer of fields, interpreted via an accessor function
* **Arrays**: A buffer of data, accessed via an index-to-offset function (view)
* **Shape Vectors**: A buffer that acts as both metadata and offset calculator
* **Tagged Unions**: A buffer with multiple interpretations selected at runtime

These forms are all specializations of the same core idea: *execution attached to data*. The do-pointer allows buffers to become context-sensitive, self-interpreting objects without requiring a complex object system or heap-based closure model.

### **2.6 Reusability and Global Functions**

Importantly, the function pointed to by a do-pointer is not bound like a closure. It may be a globally defined Tacit word, shared across many buffers. This keeps memory usage minimal and avoids the need for per-instance environments.

For example, a standard 2D view function might be used by thousands of arrays. It doesn’t store shape information — it simply expects its input buffer to contain shape metadata in a known format. In this way, buffer structures become *conventions*, and views become pure functions that interpret them.

This model supports compile-time optimization, reusability, and inlining where needed, without sacrificing the flexibility of function-pointer-based dispatch.

### **2.7 Summary**

The do-pointer elevates the buffer from inert storage to interactive entity. It provides the bridge between raw memory and dynamic behavior. Through a single pointer and a calling convention, Tacit enables buffers to become functions, views, records, or custom data types — all without heap allocation or runtime type systems.

By attaching execution logic directly to data, Tacit brings the language closer to the philosophy of Forth: **words and values are unified**, and the power of the program lies in how it composes small, transparent parts into expressive behavior.

## **3. Views – Translating Indices to Offsets**

A **view** is a function. In Tacit, that isn’t metaphor — it’s literal. A view is any function that, when applied to a fixed number of arguments (its *arity*), returns an integer offset. This offset can then be used to read from or write to a buffer.

This concept provides the foundation for multidimensional access, slicing, reshaping, and generalized indexing. It allows arrays to be expressed as **functions of their indices** — not just containers, but mappings.

### **3.1 The View as Function**

Every view in Tacit has a fixed arity, corresponding to the rank of the array it indexes. A one-dimensional view expects one index. A three-dimensional view expects three. The view consumes its inputs from the stack and returns an offset — the distance (in elements, not bytes) from the beginning of the buffer.

This makes the view a first-class participant in Tacit code. It can be defined as a word, passed as a value, composed with other functions, and installed as a do-pointer on a buffer.

For example:

```
: view-3d ( z y x -- offset ) ... ;
```

This view maps three indices into a linear offset. It may use shape and stride logic internally, but its interface is pure: N indices in, one offset out.

### **3.2 View + Buffer = Array**

A view alone is just a function. A buffer alone is just memory. But together — a view and a buffer — they form an **array**. The view provides the logic; the buffer provides the data.

Tacit represents this combination by installing the view as the do-pointer of the buffer. Once this pairing is made, the buffer becomes callable. Calling it with the correct number of indices yields an element.

This generalizes the notion of array access. The array *is* a function. A three-dimensional array is a function that takes three arguments and yields a value.

### **3.3 Shape Vectors as Views**

A powerful special case of a view is the **shape vector**. A shape vector is just a buffer — a one-dimensional list of dimension sizes — but with a do-pointer that interprets it as a view.

Internally, the shape vector implements offset computation using a row-major stride model. It reads its own contents, calculates the strides, multiplies the indices, and returns an offset.

But because it's a buffer with a do-pointer, it can also expose **metadata**: its rank, shape, and potentially precomputed strides. This makes it more powerful than a simple function, and better suited to dynamic array manipulation.

Shape vectors allow views to be constructed from data. This makes them ideal for interpreted indexing, runtime reshaping, or dynamically constructed access patterns.

### **3.4 Arity and Stack Interaction**

In Tacit’s stack-based model, arity matters. A view’s arity is its contract: it defines how many values it consumes from the stack. This ensures that all accesses are predictable and stack-clean.

For example:

* A 2D view takes two arguments: `i j`
* A 0D view (scalar) takes zero arguments: `-- offset 0`

This makes indexing deterministic. There is no variadic access. If you call a 3D array, you must supply exactly three indices. This design choice avoids ambiguity, simplifies implementation, and aligns with Tacit’s broader philosophy of fixed arity and static layout.

### **3.5 Views from Functions or Data**

A view can be either:

* A pure function defined in code (e.g. `: view-2d ... ;`)
* A shape vector with embedded metadata and an interpreter function

In both cases, the behavior is the same: indices go in, offset comes out. The choice depends on the need for flexibility or introspection.

Functions are fast and static. Shape vectors are dynamic and self-describing.

Tacit allows either to be attached as do-pointers to buffers, treating them uniformly. This polymorphism — function or data — makes views highly composable.

### **3.6 Summary**

Views are the mechanism by which Tacit turns raw memory into structured data. They define how indices are interpreted. By pairing views with buffers, Tacit creates arrays: not boxed containers, but functions over index space.

The view model supports simple use cases — like 1D linear access — and scales to complex, multidimensional patterns. It avoids closures, runtime type tags, or dynamic dispatch. Instead, it uses static arity, clear function contracts, and a clean stack discipline.

In this way, **Tacit arrays are functions** — not just metaphorically, but operationally.

### **3.7 Bounds Checking and Index Policies**

Views have the potential to enforce or relax **bounds checking** on array access. Since the view is the sole authority converting indices into offsets, it can decide how to handle out-of-bounds conditions.

At a minimum, a view function may:

* Raise an error if any index is outside the valid range
* Clamp indices to the nearest valid value
* Wrap indices using modulo arithmetic, enabling cyclic addressing
* Ignore bounds entirely for raw, unchecked access

These behaviors can be defined at the level of the view function itself or selected dynamically via **policy flags** or metadata embedded in a shape vector. This allows Tacit to support both high-assurance access and high-performance, unchecked access within the same model.

The choice of policy depends on the application: safety, speed, or cyclic semantics. Importantly, since views are functions, these behaviors can be customized per array, per scope, or per operation without altering the underlying data.

### **4. Arrays: Composed Views Over Buffers**

An **array** in Tacit is a pairing of two components: a raw memory buffer and a view function. This pairing is not a new type in the language—it’s a conceptual abstraction grounded in reuse of existing primitives. The view function transforms index tuples into byte offsets, and the buffer stores the actual values. Together, they form a structure that behaves like a multidimensional array.

This design allows arrays to remain lightweight and composable. An array is nothing more than a buffer interpreted through a view.

---

### **4.1 Arrays as First-Class Functions**

Arrays behave like functions of their indices. The arity of the view function determines the rank of the array. For instance, a two-argument view defines a two-dimensional array. Calling the array with two numbers yields the corresponding value. Internally, this invokes the view to compute an offset and retrieves the data from the buffer.

A scalar is a degenerate array of rank zero. Vectors are rank-one arrays. Multidimensional arrays emerge naturally by pairing a buffer with a shape-aware view.

---

### **4.2 Views as Address Generators**

The view function is responsible for transforming its arguments—typically index values—into a single offset. That offset is then interpreted relative to the buffer’s base. Views do not read or write memory; they merely describe how to access it. This separation is powerful: the view can be replaced or composed without touching the underlying data.

A simple view might multiply strides and add them to compute a linear offset. More sophisticated views may include offset vectors, permutations, or index remapping. The implementation of these behaviors is encapsulated entirely in the view function.

### **4.3 Arrays as Smart Data**

Once a view is assigned to a buffer via the buffer’s `do` pointer, that buffer becomes a smart data structure. It interprets access requests using the view. This model enables advanced array semantics—such as reshaping, slicing, and broadcasting—without new types or memory models. The same mechanism also lays the groundwork for structured records and other interpreted data forms.

Because the buffer holds the raw data and the view determines how to access it, multiple views can share a single buffer. This enables memory-efficient slicing and reinterpretation, all under stack-local control.

### **4.4 Composability and Stack Discipline**

Arrays in Tacit are local by default. Buffers are allocated in local variables, and views are typically defined as global words. The pairing of the two—into a first-class array—is made explicit by storing a tagged reference in a variable. This aligns with Tacit’s design: clarity in ownership, locality, and scope.

Promotion of an array to a parent scope simply involves copying the buffer down into the caller’s frame and preserving the view pointer. No heap allocation is necessary. Arrays are thus fully compatible with Tacit’s stack discipline and support high performance without garbage collection.

### **4.5 Array Access and Mutation**

Reading from an array uses the `get` operation. This places the index arguments on the stack, followed by the array, and invokes the array as a function. The array’s view computes the offset, and the value is retrieved.

Writing uses the `put` operation, which requires a value on the stack, followed by the indices and the array. The same view logic is used to locate the write position. Reads and writes share the same addressing semantics—defined solely by the view.

### **4.6 Summary**

An array is a buffer with a lens. The lens—a view function—defines how to interpret indices. Buffers provide memory; views provide semantics. Together they yield a minimal, expressive, and composable abstraction.

This model supports scalar, vector, and multidimensional data equally well. It makes arrays interoperable with sequences, pipelines, and ordinary functions. And it enables structured data interpretation via the same primitive: the `do` pointer.

### Section 5: Shape Vectors as Metadata-Enriched Views

Shape vectors are the most powerful and flexible form of view in Tacit. While any function from indices to offsets can serve as a view, shape vectors provide not only that mapping but also the ability to carry structural metadata alongside the index transform logic. They enable both efficient access and higher-level manipulations, making them the preferred representation for multi-dimensional arrays in general-purpose code.

A shape vector is a flat, one-dimensional buffer whose elements describe the extent of each axis of a multidimensional array. The length of the shape vector determines the rank (or arity) of the array—how many indices are needed to access a single element. For example, a shape vector containing `[3, 4, 5]` implies a three-dimensional array of size three by four by five.

This shape vector can act directly as a function: when used in an indexing context, it transforms a tuple of indices into a linear offset. Internally, this involves computing the offset using strides, but those strides can be derived on demand. The default behavior is row-major order, though alternative layouts could be supported by changing the transform logic or caching a separate stride vector.

What distinguishes the shape vector from a simple function is its reusability and inspectability. A shape vector can answer questions like:
— What is the total number of elements?
— What is the length of axis two?
— Can this shape be broadcast or reshaped?

This metadata allows higher-level operations like slicing, tiling, reshaping, flattening, and broadcasting to be implemented generically. It also opens the door to policies such as bounds checking, wrapping, or clamping. For instance, accessing out-of-bounds indices might raise an error, return zero, or wrap around modulo the axis length, depending on policy—either dynamic or encoded as flags within the shape vector or array header.

Shape vectors also serve well in intermediate computations. For example, reshaping an array simply involves swapping in a new shape vector, without moving any data. This functional decoupling between data and structure is central to the model: the buffer remains raw and unchanged, but the view reshapes how it's interpreted.

In practice, most arrays will use shape vectors for their do-pointer closures, because they strike a balance between minimalism and expressive power. However, nothing prevents the use of handcrafted functions or even simple constant views for specialized layouts. The shape vector is simply a highly portable, inspectable convention for defining default multi-dimensional behavior.

Next, we’ll build on this with concrete examples of slicing, reshaping, and constructing arrays dynamically from within Tacit functions. These operations leverage shape vectors not just for access, but for structure-driven transformation.

Beyond its role in defining arity and total size, the structure of the shape vector directly determines how a multi-dimensional array behaves in memory and access. In a row-major layout—the default in Tacit—the last axis varies fastest. For instance, a shape of `[2, 3]` means there are two rows, each containing three columns. The linear offset for an index pair `[i, j]` is computed as `i * 3 + j`.

This layout generalizes: a shape `[d₀, d₁, ..., dₙ]` implies a stride vector `[s₀, s₁, ..., sₙ]`, where `sₙ = 1`, and each `sᵢ = dᵢ₊₁ × sᵢ₊₁`. These strides don’t need to be stored; they can be computed on the fly or cached if needed. A view function derived from the shape simply multiplies and sums to convert index tuples into flat offsets.

Different shape configurations yield different array semantics:

— A shape like `[4]` defines a simple one-dimensional vector.
— A shape like `[1, 5]` is a degenerate 2D array with one row.
— `[5, 1]` is one column across five rows.
— `[3, 3]` gives a square 2D matrix.
— Higher-rank shapes like `[2, 3, 4]` give rise to tensors—three-dimensional structures where each slice can itself be a matrix.

Degenerate dimensions (i.e. size one) are especially useful for broadcasting. They allow an array to conceptually expand in dimensions without increasing its storage size, a trick essential for efficient elementwise operations across arrays of differing shapes.

Finally, shape vectors naturally encode empty arrays too. A shape like `[0, 4]` implies zero rows of four columns—valid but empty. Similarly, a shape of rank zero (`[]`) corresponds to a scalar, aligning with the principle that all values can be seen as arrays.

By formalizing the shape as a functional entity—one that both defines access and carries structural metadata—Tacit arrays become extremely composable. This structure opens a path for optimization, introspection, and dynamic construction without compromising the core language principles of clarity, scope-boundedness, and stack discipline.

## 6. Reshaping Arrays

Reshaping is the process of reinterpreting the contents of a buffer under a new shape, without copying or altering the underlying data. It allows the programmer to impose a new structure—such as rank, dimensionality, or size per axis—onto an existing buffer, effectively treating it as a different array. This is achieved by pairing the buffer with a new view function, typically generated from a new shape vector.

In Tacit, reshaping is a purely logical operation: it changes the way indices are interpreted, not the data itself. Since arrays are modeled as functions from index tuples to values, reshaping simply swaps in a new function that interprets the index tuple differently.

### 6.1 Logical and Physical Invariance

Because reshaping doesn't modify the buffer, multiple views may coexist over the same data. A one-dimensional buffer of twelve elements might be reshaped into a `[3, 4]` matrix, or into a `[2, 2, 3]` tensor. So long as the product of the shape matches the buffer's element count, reshaping is valid.

This principle enables memory-efficient data manipulation. For example, a flat sequence produced by a generator can be reshaped into a matrix view without allocating additional memory. Likewise, reshaping can be used to reinterpret incoming binary data into structured forms suitable for further processing.

### 6.2 Shape Compatibility and Rank Change

The primary requirement for reshaping is size compatibility. A buffer of length `N` can only be reshaped into a shape whose product equals `N`. If the target shape’s product does not match the buffer’s size, reshaping is invalid and should result in a runtime error or be caught at compile time.

Reshaping naturally supports rank changes. A scalar (rank-zero array) can be reshaped into a vector, matrix, or higher-rank tensor, and vice versa. For example:

— A scalar can be reshaped into `[1]` to form a one-element vector.
— A matrix `[2, 3]` can be reshaped into `[6]` to flatten it.
— A vector `[9]` can be reshaped into `[3, 3]` to form a square matrix.

These transformations preserve the total number of elements but redefine how they’re addressed and traversed.

### 6.3 Dynamic and Static Reshape

In Tacit, reshape operations may be static (declared explicitly using shape literals) or dynamic (driven by runtime-calculated shape vectors). Dynamic reshape allows reshaping based on input data, configuration, or external parameters, while static reshape enables compile-time validation and optimization.

For example, a sequence might accumulate values and reshape them at the end:

```
{ collect }  → vector
[3, 4]       → shape
reshape      → array
```

Here, the vector is interpreted as a flat buffer, and the shape `[3, 4]` defines the new view.

### 6.4 Reshape as Function Composition

At a conceptual level, reshaping is function composition: a new view is composed with the existing buffer to produce a new array function. The buffer remains the same; only the mapping from indices to offsets changes. This composition is lightweight and highly expressive, letting reshaping be chained or reversed as needed.

Future extensions may allow partial reshaping, reshaping with inferred dimensions (e.g., using `-1` as a placeholder), or broadcasting-friendly reshaping for alignment between arrays of different ranks.

## 7. Slicing and Subarrays

Slicing refers to selecting a contiguous or non-contiguous subset of an array’s elements, producing a new view over a region of the original buffer. Like reshaping, slicing is non-destructive—it generates a new view function that adjusts the base offset and shape, without copying data.

### 7.1 Slice as View Transformation

In Tacit, a slice is defined by narrowing the domain of the original view. This is typically done by providing start, stop, and step parameters along one or more dimensions. The new view computes its offset relative to a base index and stride, effectively narrowing the visible region of the buffer.

For example, slicing a matrix `[4, 4]` to select the top-left `2×2` block yields a view that offsets into the original buffer and limits valid indices to `[2, 2]`.

```
original: shape = [4, 4]
slice:    base offset = [0, 0], shape = [2, 2]
```

Internally, the slicing view applies an offset shift and domain constraint to the input indices, computing new strides if needed.

### 7.2 Stride Modification

Slicing can involve changes in stride. For example, a step of `2` selects every second element, which results in a non-unit stride. This allows slicing to implement strided access patterns such as:

— Every second row
— Diagonal access (with custom view logic)
— Reversed dimensions (using negative strides)

These transformations alter the view’s internal stride vector while keeping the same buffer.

### 7.3 Slicing by Index Sets

Tacit may support advanced slicing via index arrays: a secondary array or block produces a sequence of index tuples, which the main array is accessed through. This provides support for:

— Boolean masks
— Arbitrary index lists
— Indirect access through computed keys

In this case, the slice becomes a higher-order function: a generator of indices is passed to the array as input, and values are fetched accordingly.

### 7.4 Bounds and Region Policies

As with basic views, sliced views can implement different bounds policies. Slicing outside the original array’s bounds may raise an error, wrap modulo, or clamp silently—depending on the view’s configuration. This behavior can be encoded either in the view function or through metadata flags.

Slices may also be configured to inherit the parent array’s bounds or apply stricter constraints. This allows nested slicing and complex composition of views without data duplication or deep copying.

### 7.5 Subarrays and Mutation

A sliced view can be used as a target for mutation. Since it still refers to the original buffer, writing into a subarray affects the underlying data. This allows Tacit to support in-place updates through subviews, enabling idioms like:

```
subarray put { value }
```

This behaves identically to a direct array write, but with coordinate remapping handled by the slice.

## 8. Outlook and Advanced Topics

The combination of buffers, views, and the `do` mechanism forms a compact but powerful foundation for array processing in Tacit. By treating views as first-class functions and buffers as versatile memory containers, Tacit enables efficient, stack-centric handling of complex data structures without reliance on garbage collection or heap-heavy abstractions.

While this document focuses on the core principles, several advanced capabilities follow naturally from this model:

— **Composite Indexing**: Using sequences or nested blocks to generate index tuples dynamically.
— **Masked and Indirect Access**: Selecting elements based on computed patterns or boolean masks.
— **Broadcasting and Alignment**: Applying functions element-wise across arrays of compatible shape.
— **View Chaining**: Building complex transformations by composing multiple view functions.
— **Array Fusion and Optimization**: Eliminating intermediate allocations via pipeline inlining.

Each of these can be implemented using existing Tacit primitives: blocks, function composition, and local stack management. The model scales from low-level byte access to high-level numerical computing without changing its structural foundation.

This document serves as a conceptual reference for implementing and extending Tacit’s array system. Future work may formalize more precise semantics for reshaping, slicing, memory layout, and metadata propagation—but the central idea remains: arrays are functional, composable, and stack-native.
