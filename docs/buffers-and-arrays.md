- [Buffers and Arrays](#buffers-and-arrays)
  - [Introduction](#introduction)
  - [**1. Buffers – Raw Memory as a First-Class Value**](#1-buffers--raw-memory-as-a-first-class-value)
    - [**1.1 Element Width and Usage**](#11-element-width-and-usage)
    - [**1.2 Buffers as First-Class Values**](#12-buffers-as-first-class-values)
    - [**1.3 Buffers and Sequences**](#13-buffers-and-sequences)
    - [**1.4 Buffers as Low-Level Infrastructure**](#14-buffers-as-low-level-infrastructure)
    - [**1.5 Storage, Aliasing, and Ownership**](#15-storage-aliasing-and-ownership)
    - [**1.6 Summary**](#16-summary)
  - [**2. Do-Pointers – Executable Interpretation for Buffers**](#2-do-pointers--executable-interpretation-for-buffers)
    - [**2.1 What is a Do-Pointer?**](#21-what-is-a-do-pointer)
    - [**2.2 Buffers with and without Do-Pointers**](#22-buffers-with-and-without-do-pointers)
    - [**2.3 Installing a Do-Pointer**](#23-installing-a-do-pointer)
    - [**2.4 Executing Do-Pointer Buffers**](#24-executing-do-pointer-buffers)
    - [**2.5 Use Cases: Structs, Arrays, Views**](#25-use-cases-structs-arrays-views)
    - [**2.6 Reusability and Global Functions**](#26-reusability-and-global-functions)
    - [**2.7 Summary**](#27-summary)
  - [**3. Views – Translating Indices to Offsets**](#3-views--translating-indices-to-offsets)
    - [**3.1 The View as Function**](#31-the-view-as-function)
    - [**3.2 View + Buffer = Array**](#32-view--buffer--array)
    - [**3.3 Shape Vectors as Views**](#33-shape-vectors-as-views)
    - [**3.4 Arity and Stack Interaction**](#34-arity-and-stack-interaction)
    - [**3.5 Views from Functions or Data**](#35-views-from-functions-or-data)
    - [**3.6 Summary**](#36-summary)
    - [**3.7 Bounds Checking and Index Policies**](#37-bounds-checking-and-index-policies)
    - [**4. Arrays: Composed Views Over Buffers**](#4-arrays-composed-views-over-buffers)
    - [**4.1 Arrays as First-Class Functions**](#41-arrays-as-first-class-functions)
    - [**4.2 Views as Address Generators**](#42-views-as-address-generators)
    - [**4.3 Arrays as Smart Data**](#43-arrays-as-smart-data)
    - [**4.4 Composability and Stack Discipline**](#44-composability-and-stack-discipline)
    - [**4.5 Array Access and Mutation**](#45-array-access-and-mutation)
    - [**4.6 Summary**](#46-summary)
  - [5. Shape Vectors – Metadata-Enriched Views](#5-shape-vectors--metadata-enriched-views)
    - [5.1 What a Shape Vector Is](#51-what-a-shape-vector-is)
    - [5.2 Rank, Size, and Total Elements](#52-rank-size-and-total-elements)
    - [5.3 Stride Derivation and Layout](#53-stride-derivation-and-layout)
    - [5.4 Degenerate Dimensions and Broadcast Semantics](#54-degenerate-dimensions-and-broadcast-semantics)
    - [5.5 Empty and Scalar Shapes](#55-empty-and-scalar-shapes)
    - [5.6 Shape Vector Operations](#56-shape-vector-operations)
    - [5.7 Performance and Caching](#57-performance-and-caching)
    - [5.8 Summary](#58-summary)
  - [6 Reshaping Arrays – Changing Shape Without Moving Data](#6-reshaping-arrays--changing-shape-without-moving-data)
    - [6.1 Conceptual Model](#61-conceptual-model)
    - [6.2 Size Compatibility](#62-size-compatibility)
    - [6.3 Rank Modification](#63-rank-modification)
    - [6.4 Static vs Dynamic Reshape](#64-static-vs-dynamic-reshape)
    - [6.5 Partial / Inferred Dimensions](#65-partial--inferred-dimensions)
    - [6.6 Implementation Mechanics](#66-implementation-mechanics)
    - [6.7 Compositional Reshaping](#67-compositional-reshaping)
    - [6.8 Performance Notes](#68-performance-notes)
    - [6.9 Summary](#69-summary)
  - [7 Slicing and Subarrays – Extracting Views Without Copies](#7-slicing-and-subarrays--extracting-views-without-copies)
    - [7.1 Slice Specification](#71-slice-specification)
    - [7.2 Contiguous vs Strided Slices](#72-contiguous-vs-strided-slices)
    - [7.3 Degenerate Slices](#73-degenerate-slices)
    - [7.4 Index-Set and Mask Slicing](#74-index-set-and-mask-slicing)
    - [7.5 Nested Slicing and View Chaining](#75-nested-slicing-and-view-chaining)
    - [7.6 Mutation Through Slices](#76-mutation-through-slices)
    - [7.7 Bounds Policies](#77-bounds-policies)
    - [7.8 Memory Aliasing and Lifetime](#78-memory-aliasing-and-lifetime)
    - [7.9 Performance Notes](#79-performance-notes)
    - [7.10 Summary](#710-summary)
  - [8 Conclusion](#8-conclusion)
    - [What’s Next for Buffers and Arrays (Tightly Scoped)](#whats-next-for-buffers-and-arrays-tightly-scoped)
    - [Closing Thought](#closing-thought)


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

## 5. Shape Vectors – Metadata-Enriched Views

Shape vectors are Tacit’s most versatile form of view.  They not only translate index tuples into linear offsets, but also carry structural information that higher-level code can query and transform.  By combining offset logic with inspectable metadata, they give Tacit arrays the same expressive power found in packages like NumPy—yet remain compatible with the language’s stack-centric, minimal runtime.

### 5.1 What a Shape Vector Is

A shape vector is a one-dimensional buffer whose elements are the extents of each axis of an array.

```
[ d0 d1 … dn ]   ; length = rank (n + 1)
```

Installing the standard *shape-view* function as the buffer’s do-pointer turns that list into an executable view.  When invoked with `n + 1` indices, the view:

1. Derives a stride vector on demand (row-major by default).
2. Computes `offset = Σ indexᵢ × strideᵢ`.
3. Returns the offset to upstream code (`get`, `put`, etc.).

Because the shape list is data, not code, it can be copied, sliced, stored in locals, or returned from functions exactly like any other buffer.

### 5.2 Rank, Size, and Total Elements

* **Rank** = length of the shape list.
* **Axis length** = value at a given position.
* **Total elements** = product of all axis lengths.

These numbers are available at runtime through tiny helper words such as `rank`, `axis-length`, and `size`.  They enable generic algorithms (e.g. reductions) to adapt to arrays of arbitrary dimensionality without reflection or RTTI.

### 5.3 Stride Derivation and Layout

For a shape `[d₀ d₁ … dₙ]`, row-major strides are:

```
sₙ = 1
sᵢ = dᵢ₊₁ × sᵢ₊₁
```

Tacit recomputes strides on the fly the first time a view is used and can cache them in a small side table keyed by the shape pointer.  This keeps the shape vector itself compact—no duplicate stride data—and lets different arrays share the same stride cache entry.

### 5.4 Degenerate Dimensions and Broadcast Semantics

Any axis of length `1` is **degenerate**.  Degeneracy means the same physical element can satisfy many logical positions, enabling implicit expansion during element-wise operations:

* `[4 1]` + `[1 5]` → broadcast to `[4 5]`.
* `reshape` preserves degeneracy, so `[4 1]` reshaped to `[4]` is a no-copy view.

Broadcasting itself is *not* automatic; it is provided by an explicit library word (`broadcast`) so that shape alignment is always intentional.

### 5.5 Empty and Scalar Shapes

* **Empty axis**: shape `[0 d₁]`—valid but contains zero elements.
* **Rank-zero shape (`[]`)**: represents a scalar; the associated view has arity 0 and always returns offset 0.

These edge cases unify arrays and scalars under one mechanism and simplify generic code.

### 5.6 Shape Vector Operations

Because a shape is ordinary data, Tacit supplies ordinary words to manipulate it:

* `rank`      — push the number of axes
* `axis-length ( shape i -- dᵢ )`
* `set-axis    ( new-len shape i -- )`
* `flatten     ( shape -- [N] )`         — rank → 1
* `append-axis ( len shape -- shape' )`  — rank + 1

Higher-level combinators (`reshape`, `transpose`, `slice-shape`) build on these primitives.

### 5.7 Performance and Caching

* **Stride cache**: eliminates per-lookup multiplication for common shapes.
* **Shape hash**: a lightweight fingerprint lets views share cached strides.
* **Stack locality**: shape vectors stored in locals avoid heap churn; temporary reshapes allocate no new data, only new locals.

These tactics keep multidimensional access nearly as cheap as direct pointer arithmetic.

### 5.8 Summary

Shape vectors fuse two roles:

1. A view that **executes**: converting index tuples to linear offsets.
2. A compact, inspectable record of an array’s **structure**.

This dual nature lets Tacit support introspection, slicing, reshaping, and broadcasting with no extra runtime machinery.  Most real-world arrays will adopt shape vectors for their do-pointers; specialised functions remain an option for exotic layouts, but the default path is fast, simple, and highly composable—perfectly aligned with Tacit’s minimalist design.

## 6 Reshaping Arrays – Changing Shape Without Moving Data

Reshaping lets a buffer appear under a new dimensionality and rank while leaving its bytes untouched.  Because Tacit arrays are nothing more than *buffer + view*, reshaping is merely the act of pairing the same buffer with a freshly-constructed view (usually a new shape vector).  It is therefore O (1) in time and O (1) in memory.

### 6.1 Conceptual Model

```
buffer      +  view₀              →  array₀   (original)
same buffer +  view₁ (reshape)    →  array₁   (new shape)
```

`array₀` and `array₁` share storage.  Only the mapping from index tuples to offsets differs.

### 6.2 Size Compatibility

The sole invariant is **element conservation**:

```
product(original-shape)  ==  product(new-shape)
```

If this equality fails, reshape is illegal. Tacit enforces it at compile-time for static shapes and at run-time (via one multiplication) for dynamic shapes.

### 6.3 Rank Modification

Reshape freely changes rank:

| Original           | New Shape | Result             |
| ------------------ | --------- | ------------------ |
| Scalar `[]`        | `[1]`     | One-element vector |
| Vector `[9]`       | `[3 3]`   | Square matrix      |
| Matrix `[2 3]`     | `[6]`     | Flattened vector   |
| 3-tensor `[2 2 3]` | `[4 3]`   | Folded matrix      |

All rely on the same buffer; only the view logic shifts.

### 6.4 Static vs Dynamic Reshape

* **Static reshape** – shape literal known at compile time; size mismatch is a compile error.
* **Dynamic reshape** – shape vector computed at run-time; size mismatch raises a run-time fault.

Both paths use the same `reshape` word; the checker simply runs earlier or later.

### 6.5 Partial / Inferred Dimensions

Tacit supports an *inferred dimension* marker (`-1`).  Exactly one axis may be `-1`; its length is computed so the total element count matches.

```
[ -1 3 ] reshape      ; auto-fills first axis
```

If the computed size is non-integral or negative, reshape fails.

### 6.6 Implementation Mechanics

`reshape` word sequence (dynamic case):

1. **Pop** `shape′` (buffer) and `array` (buffer + view).
2. **Check** element counts: `size(array) == product(shape′)`.
3. **Install** the standard shape-view do-pointer into `shape′` (if not already).
4. **Return** a new array handle:

   * buffer = `array.buffer`
   * view   = `shape′.do`

No bytes are copied; only a pair of pointers is produced.

### 6.7 Compositional Reshaping

Because reshape is just view replacement, it composes freely:

```
vector       reshape→ matrix
matrix slice→ submatrix
submatrix     reshape→ column-vector
```

Each operation is O (1) and can be undone or re-ordered; the buffer remains untouched throughout.

### 6.8 Performance Notes

* **Stride cache reuse**: if the new shape has appeared before, strides may already be cached.
* **Zero cost in streams**: reshaping a sequence output merely creates a new local view before further mapping.
* **No aliasing surprises**: writes through any reshaped view modify the single underlying buffer.

### 6.9 Summary

Reshaping in Tacit is a lightweight, purely-logical transformation:

* No data movement, no heap work.
* Works for static or dynamic shapes.
* Supports rank changes, inferred dimensions, and free composition.

Because it relies only on swapping views, reshape inherits all the safety and performance properties of the core buffer-and-view model while giving high-level code immense structural flexibility.

## 7 Slicing and Subarrays – Extracting Views Without Copies

Slicing produces a new view that exposes only a subset of an existing array.
Because Tacit arrays are *buffer + view*, a slice is created by **wrapping** the
original view in an outer transformer that:

1. Shifts the incoming indices by a base offset.
2. Scales them by a stride or step.
3. Restricts each axis to a smaller shape.

No bytes move; only the mapping function changes.  Thus slicing is *O (1)* in
time and memory, yet it can expose contiguous or strided regions, single rows,
columns, diagonals, or arbitrary index sets.

### 7.1 Slice Specification

A slice is described per axis by a triple **⟨start stop step⟩**.

* **start** – first logical index (default 0)
* **stop**  – one-past-end (default axis length)
* **step**  – stride increment (default 1)

For convenience Tacit supplies words that accept:

* Two-part **⟨start length⟩** spec (*common in DSP*)
* Single-value “take” / “drop” words for head/tail trimming
* The placeholder `:` meaning “use default”

### 7.2 Contiguous vs Strided Slices

* **Contiguous slice** – `step = 1`; resulting view has unit strides and can
  reuse cached stride tables.
* **Strided slice** – `step ≠ 1`; the transformer multiplies incoming indices
  by *step*, yielding a non-unit stride in the composite view.  This enables:

  * Every-k-th sample: `step = k`
  * Reversal: `start = len-1`, `stop = -1`, `step = -1`
  * 2-D down-sampling: strides on multiple axes

### 7.3 Degenerate Slices

Selecting a single coordinate (`length = 1` or explicit axis collapse) produces
a **degenerate dimension**.  The slice view returns rank-1 (or rank-0) results
while still aliasing the same buffer cell.  Degenerate axes are vital for:

* Row/column extraction
* Broadcasting smaller arrays into larger ones
* Reducing rank after filtering

### 7.4 Index-Set and Mask Slicing

Besides range triples, Tacit supports **index-set slicing**:

* A one-dimensional index array (or sequence) is passed to the slice word.
* The resulting view’s arity increases by one—they become nested:
  `index₀  index₁ …  view`

Boolean masks work similarly: the mask array generates an index array of the
`true` positions, which feeds the slice view.  This generalises NumPy-style
fancy indexing without changing core semantics.

### 7.5 Nested Slicing and View Chaining

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

### 7.6 Mutation Through Slices

`put` accepts slice views exactly like full arrays:

```
value  indices  slice-view  put
```

Because the slice aliases the original buffer, all writers see one copy of
data.  Overlapping writes are allowed but not ordered; deterministic update
must be handled by the program logic.

### 7.7 Bounds Policies

Slice views honour the same bound-checking policy flags as base views
(§ 3.7):

* **Error** – raise fault on out-of-range
* **Clamp** – snap to valid edge
* **Modulo** – wrap cyclically
* **Unchecked** – skip tests

The composite view’s policy is the stricter of the parent and slice policy,
guaranteeing no hidden relaxation when chaining transformers.

### 7.8 Memory Aliasing and Lifetime

Because slices never allocate, their lifetime must not exceed the buffer they
reference.  When a slice is returned to a caller, Tacit’s promotion rules copy
the *buffer* downward if necessary, then re-wrap with the same slice view, so
aliasing remains safe even across resumables.

### 7.9 Performance Notes

* **Stride hoisting** – contiguous slices share stride caches with parents.
* **Vectorised steppers** – strided views precompute `gcd(step,stride)` to
  minimise per-element arithmetic.
* **Zero-copy pipelines** – chaining 32 slices costs the same as one.

In practice, slice overhead is dominated by cache effects when the step is not
unit; contiguous subarrays run at essentially full memory bandwidth.

### 7.10 Summary

Slicing in Tacit is a first-class, zero-copy view transformation:

* Expressed via range triples or index arrays.
* Produces aliasing subarrays suitable for reads or writes.
* Chains freely with reshape, transpose, broadcasting, and further slicing.

This keeps advanced data-window operations orthogonal to the core language—
no new container type, no hidden allocation—just functional composition of
views over buffers.

## 8 Conclusion

Tacit’s array story rests on three carefully delimited ideas:

1. **Buffers** are raw, fixed-width memory blocks that can live safely on the stack, move up the call chain by copy-down promotion, or reside on the heap when necessary.
2. **Views** are plain Tacit words—functions whose only task is to translate an index tuple into a linear offset.  Installing a view as a buffer’s do-pointer lets the buffer interpret itself.
3. **Arrays** emerge when a buffer and a view are paired.  Everything else—scalars, vectors, tensors, slices, and reshapes—is a lightweight variation on that single pairing.

Because interpretation is functional and storage is raw, arrays gain the flexibility of high-level languages without sacrificing the predictability of a stack-oriented runtime.  Shape vectors enrich this core by adding self-describing metadata, yet remain ordinary buffers and views under the hood.

### What’s Next for Buffers and Arrays (Tightly Scoped)

Tacit’s current design already covers:

* Raw allocation and copy-down promotion
* Multidimensional access via shape vectors
* O(1) slicing and reshaping

The immediate buffer-and-array work now centres on:

* **Stride caching and reuse** – avoiding per-lookup multiplication for hot shapes.
* **Compile-time shape checks** – catching size mismatches in static reshape and slice literals.
* **Policy flags** – finishing a compact, per-array way to choose between error, clamp, modulo, or unchecked bounds.
* **Standard slice helpers** – “take,” “drop,” and simple range words that map directly to view transformers.

These are incremental, not architectural, and they keep the model small.

### Closing Thought

The design goal was never maximal cleverness; it was **minimum machinery for maximum leverage**.  By refusing extra layers—no hidden copies, no mandatory heap, no exotic type system—Tacit makes arrays transparent enough to trust and composable enough to build on.  Future refinements will deepen performance and ergonomics, but the core contract stays the same: memory is raw, interpretation is functional, and the two meet only where the programmer decides.
