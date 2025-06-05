# Arrays and Vectors

- [Arrays and Vectors](#arrays-and-vectors)
  - [1. Arrays as First-Class Functions in Tacit](#1-arrays-as-first-class-functions-in-tacit)
  - [2. Vectors: Primitives and Building Blocks](#2-vectors-primitives-and-building-blocks)
  - [3. Views: Structured Interpretation of Vectors](#3-views-structured-interpretation-of-vectors)
  - [4. Array Access and Mutation](#4-array-access-and-mutation)
    - [Reading (Get)](#reading-get)
    - [Writing (Put)](#writing-put)
    - [Integration as Sinks](#integration-as-sinks)
    - [Emphasis on Reading](#emphasis-on-reading)
  - [5. Sequences and Arrays as Composable Functions](#5-sequences-and-arrays-as-composable-functions)
    - [5.1 Arrays as Sequence Sources](#51-arrays-as-sequence-sources)
    - [5.2 Scalars as Sequences](#52-scalars-as-sequences)
    - [5.3 Mapping and Function Composition](#53-mapping-and-function-composition)
    - [5.4 Views and Functionality](#54-views-and-functionality)
    - [5.5 Lazy Evaluation and Stream Processing](#55-lazy-evaluation-and-stream-processing)
    - [5.6 Summary](#56-summary)
  - [6. Memory Management and Stack Discipline](#6-memory-management-and-stack-discipline)
    - [6.1 Stack-Based Array Allocation](#61-stack-based-array-allocation)
    - [6.2 Array Promotion and Transfer](#62-array-promotion-and-transfer)
    - [6.3 Explicit Ownership and Lifetimes](#63-explicit-ownership-and-lifetimes)
    - [6.4 Dynamic Array Promotion via Stack Locals](#64-dynamic-array-promotion-via-stack-locals)
    - [6.5 Heap Allocation as Secondary](#65-heap-allocation-as-secondary)
    - [6.6 Summary](#66-summary)
  - [7. Performance, Optimization, and Advanced Transformations](#7-performance-optimization-and-advanced-transformations)
    - [7.1 Cache-Friendly Design](#71-cache-friendly-design)
    - [7.2 SIMD and Parallelization Opportunities](#72-simd-and-parallelization-opportunities)
    - [7.3 Lazy Evaluation and Pipeline Efficiency](#73-lazy-evaluation-and-pipeline-efficiency)
    - [7.4 Advanced Transformations: Reshaping and Slicing](#74-advanced-transformations-reshaping-and-slicing)
    - [7.5 Minimal Overhead Metadata](#75-minimal-overhead-metadata)
    - [7.6 Summary](#76-summary)
  - [8. Conclusion and Future Directions](#8-conclusion-and-future-directions)

## 1. Arrays as First-Class Functions in Tacit

Tacit is an array-first programming language, meaning arrays are fundamental, integrated deeply into both its semantic model and runtime design. Arrays are treated not merely as storage containers but as functions mapping indices to values. This functional perspective unifies scalar, vector, and multidimensional arrays under a single, elegant abstraction.

A scalar in Tacit is viewed as a degenerate array of rank zero—effectively a constant function. A vector, being one-dimensional, directly maps integer indices within its range to values. Higher-dimensional arrays are represented by views, which overlay structure onto linear memory. A view is a pure function, computing memory addresses from index tuples using shape and derived stride metadata.

This design provides significant advantages in composability and clarity. It allows arrays to naturally participate in Tacit's pipeline-driven, stack-oriented data model, and integrates seamlessly with sequences, lazy evaluation, and efficient stream transformations.

Tacit’s array-first principle ensures arrays have minimal overhead: metadata is compact and computation is predictable. This makes arrays especially suited to embedded and low-resource environments, where predictable memory usage and cache locality provide substantial performance benefits.

In summary, Tacit's foundational concept—that arrays are first-class functions—simplifies memory management, supports powerful functional operations, and aligns closely with its stack-based, sequence-driven execution model, creating a highly expressive, efficient, and composable language foundation.

## 2. Vectors: Primitives and Building Blocks

In Tacit, vectors serve as the foundational primitive from which more complex array structures are built. A vector is a fixed-length, contiguous block of memory containing uniformly-typed elements, typically numbers, characters, or tagged values. Unlike traditional high-level arrays, vectors are minimal, lightweight entities designed for direct integration with Tacit's stack-oriented execution model.

A vector consists primarily of two essential properties:

- **Length**: the number of elements it contains.
- **Element Width**: the size (in bytes) of each element, facilitating flexible interpretation (e.g., floats, integers, or bytes).

Vectors are allocated primarily on the return stack, making them exceptionally efficient and cache-friendly. Because their size and data layout are known at compile-time, vectors integrate naturally into Tacit's function-local storage, ensuring predictable performance without heap allocations.

Although vectors are typically immutable and read-oriented, Tacit does support explicit mutation via controlled operations like `put`. Mutation is performed carefully, explicitly, and within clearly defined scopes, preserving Tacit's functional composability and stack discipline.

Vectors provide the raw storage backing for more structured data. Views overlay vectors with multidimensional shapes, strides, and offsets, enabling advanced indexing and reshaping without memory copying. Thus, while vectors are the fundamental memory blocks in Tacit, they gain their full expressive power through the structured interpretations provided by views.

In summary, vectors in Tacit represent efficient, primitive, fixed-length memory blocks. They form the building blocks for higher-dimensional arrays, maintain excellent cache locality, and uphold Tacit's principle of predictable memory usage and minimal overhead.

## 3. Views: Structured Interpretation of Vectors

In Tacit, arrays with dimensionality beyond simple vectors are represented by **views**. A view is a lightweight metadata overlay that provides structured access to a flat vector without copying or reallocating memory. Views transform raw memory into multidimensional arrays through a functional interpretation defined by shape, derived strides, and an optional offset.

A view is composed of:

- **Shape**: A vector defining the size of each dimension. The length of this shape vector indicates the array's rank.
- **Offset**: An optional starting index within the underlying vector, enabling efficient slicing or subarray views.

Strides—used to calculate memory offsets for multidimensional indexing—are not stored explicitly. Instead, Tacit computes strides on-demand, potentially caching them by shape for repeated use. This minimalistic approach ensures that views remain compact and efficient.

Each view functions as a pure mapping from index tuples to memory addresses. Given indices, it calculates the corresponding location in the backing vector and returns the stored value. Thus, views integrate smoothly into Tacit's functional and compositional semantics, acting as index-driven functions in pipelines and sequences.

Because views are non-owning references, multiple views may share the same underlying vector memory. The lifetime of a view is therefore limited by the lifetime of its vector, typically managed through Tacit's disciplined stack-based allocation strategy.

In summary, views provide the critical link between linear vectors and structured, multidimensional array semantics. They enable expressive operations such as slicing, reshaping, and broadcasting, all achieved through composable, efficient, and purely functional interpretation of memory.

## 4. Array Access and Mutation

Tacit arrays support explicit, functional, and composable element access and mutation, emphasizing clear and predictable semantics. Rather than relying on pointer arithmetic or address-based notation, Tacit employs straightforward operations that fit seamlessly within its pipeline-driven execution model.

### Reading (Get)

Reading from an array uses the `get` operation, a functional, composable approach:

```
A get { 3 }
```

This expression retrieves the value at index `3` from array `A`. The index is computed using a block, which allows both constant and dynamic indexing. This block-based indexing ensures clarity, flexibility, and integration into pipeline workflows.

### Writing (Put)

Mutation is explicit, controlled, and uses the complementary `put` operation:

```
42 A put { 3 }
```

This explicitly writes the value `42` into the array `A` at index `3`. Like `get`, the index is block-evaluated, allowing dynamic and computed indexing. The syntax emphasizes that mutation is an intentional, scoped operation, occurring at clearly defined points within a pipeline.

### Integration as Sinks

Both `get` and `put` operations behave like pipeline sinks: they terminate a sequence pipeline, consuming an array and index to either retrieve or store a value. This integration maintains compositional purity, allowing arrays to seamlessly participate in sequence transformations.

### Emphasis on Reading

Tacit's design favors read-heavy, functional programming patterns. Mutation (`put`) is available but secondary, provided explicitly to support scenarios where imperative updates or efficient data reuse are necessary. Read-oriented operations (`get`) dominate common usage patterns, reinforcing composability and predictability.

In summary, Tacit’s array access and mutation model maintains a careful balance between functional purity and imperative efficiency. Operations are explicit, composable, and integrated naturally with the language’s pipeline-oriented semantics, ensuring clarity, efficiency, and disciplined memory handling.

## 5. Sequences and Arrays as Composable Functions

In Tacit, sequences and arrays are seamlessly integrated, with arrays treated as functional, composable components within the sequence system. This design allows arrays to participate in lazy evaluation pipelines, acting as sources, functions, or sinks, depending on their context.

### 5.1 Arrays as Sequence Sources

Arrays, whether scalar, vector, or multidimensional view, can be used as sources in sequence pipelines. When an array is used as a sequence source, it emits its elements one-by-one to the next stage in the pipeline. This behavior is consistent for all array types, whether they are local, heap-allocated, or defined through a view.

For instance, a vector can act as a source of data in a `map` operation:

```
(0 1 2 3) { my-vector } map
```

Here, `my-vector` serves as a function, applied to the indices from the sequence `(0 1 2 3)`, resulting in a new sequence of values from the vector.

### 5.2 Scalars as Sequences

A scalar, being a rank-zero array, is treated as a sequence of one element. This enables uniform treatment across arrays and scalars in pipelines, where operations designed for sequences can be applied consistently to both single values and arrays.

For example, mapping a scalar over a sequence yields a repeated value:

```
(1 2 3) { 5 } map  // yields 5, 5, 5
```

This model ensures that even the simplest data types—scalars—can participate in the same compositional workflows as complex multidimensional arrays.

### 5.3 Mapping and Function Composition

Arrays in Tacit are treated as functions from indices to values. This allows arrays to participate naturally in `map`, `filter`, and other functional operators. When presented with an index, an array returns the value at that position, making it an ideal candidate for functional transformations.

For instance, applying a map operation to an array is equivalent to applying a function over the array’s indices:

```
indices: [0 1 2 3]
data: [10 20 30 40]
indices map data => [10 20 30 40]
```

Here, `data` is treated as a function of its indices. This makes arrays first-class citizens in sequence processing, easily integrated into mapping and other functional paradigms.

### 5.4 Views and Functionality

Views extend the concept of arrays as functions. A view interprets a vector as a multidimensional array, but the underlying function remains the same: an index is mapped to a value in the base vector. Views behave as curried functions, taking index tuples and producing scalar values.

For example, a 2x2 matrix can be viewed as a function mapping 2D indices to values in a 1D vector:

```
matrix view: [2 2]  // shape
base vector: [1 2 3 4]  // backing vector
index tuple: (1, 1)  // returns value 4
```

Thus, views maintain the array-as-function paradigm, extending it to multidimensional data structures without altering the underlying memory model.

### 5.5 Lazy Evaluation and Stream Processing

One of the most powerful aspects of sequences is their lazy nature. Tacit sequences are evaluated on demand, which means arrays are not materialized until needed. This enables efficient data processing pipelines where transformations are computed lazily, conserving memory and processing power.

Arrays act as lazy sources in these pipelines, feeding elements into the sequence only when required. This lazy evaluation model allows complex transformations without the need to store intermediate results in memory, making Tacit ideal for both memory-constrained and large-scale data processing.

### 5.6 Summary

Arrays in Tacit are integral to the sequence model, acting as sources, functions, and sinks. They are treated as first-class functions, mapped over indices, and composable within sequence pipelines. Whether working with scalars, vectors, or views, Tacit’s model ensures that arrays integrate smoothly into the lazy, composable, and highly efficient sequence processing paradigm.

## 6. Memory Management and Stack Discipline

Tacit adopts a disciplined, stack-centric approach to memory management, designed for efficiency, safety, and predictability. Rather than relying heavily on heap allocation or garbage collection, Tacit emphasizes managing memory explicitly through return-stack-based allocation, promotion, and ownership principles.

### 6.1 Stack-Based Array Allocation

Tacit allocates arrays primarily on the return stack. Local arrays are declared within the current stack frame, using space reserved at function entry. This ensures fast, predictable allocation with excellent cache locality. Because their lifetimes match exactly the function's scope, stack-based arrays eliminate the complexity and overhead associated with heap management.

### 6.2 Array Promotion and Transfer

When arrays created within a function must persist beyond their local scope—such as when returned or yielded—they are promoted to the calling function's stack frame. Promotion involves copying the array downward, covering existing locals in the parent frame, and adjusting the stack pointer to include the newly promoted array. This explicit transfer avoids heap allocation entirely and maintains predictable memory usage patterns.

### 6.3 Explicit Ownership and Lifetimes

Tacit's approach to ownership is explicit and compiler-enforced. Arrays are never implicitly shared or referenced across scopes unless explicitly promoted. This discipline ensures arrays never outlive their allocated stack frames, eliminating dangling pointers or unintended sharing of mutable state. The model provides simplicity, performance, and safety, aligning closely with Tacit's compositional and functional design philosophy.

### 6.4 Dynamic Array Promotion via Stack Locals

Tacit supports dynamic-sized arrays that are initially constructed at the top of the return stack. Such arrays can be promoted safely to the parent scope by using a copy-down operation, which relocates the array downward, replacing the parent's local variables on the return stack.

When a function constructs a dynamic array intended to be returned, the following occurs:

1. The array is assembled dynamically at the top of the return stack, immediately above local variables.
2. Upon return, the completed array is copied downward, effectively overwriting the parent's local storage region.
3. The parent's return stack pointer is adjusted to include the newly promoted array.

This mechanism avoids heap allocation entirely, maintains perfect cache locality, and preserves stack discipline. It also integrates seamlessly with Tacit's explicit ownership rules, ensuring that arrays maintain predictable lifetimes without requiring complex memory management.

This explicit stack-local promotion strategy ensures arrays can be dynamically created, safely returned, and integrated within the caller’s scope, reinforcing Tacit's principles of efficiency, simplicity, and compositional clarity.

### 6.5 Heap Allocation as Secondary

While the return stack is Tacit's primary memory management model, heap allocation exists as a secondary, carefully controlled mechanism. Heap allocation is primarily reserved for longer-lived data structures or special cases not naturally managed by the return stack. Tacit's heap management is minimalistic, arena-based, or bump-allocated, ensuring predictable performance and low overhead without relying on garbage collection.

### 6.6 Summary

Tacit's memory management strategy emphasizes explicit, predictable, stack-oriented discipline. Arrays and data structures live primarily on the return stack, managed by clear promotion rules and explicit ownership. Heap allocation plays only a minimal, secondary role. This approach provides Tacit with a highly efficient, predictable, and safe memory management model, well-suited to embedded systems, performance-critical applications, and environments where resources are constrained.

## 7. Performance, Optimization, and Advanced Transformations

Tacit's array-first design is explicitly crafted for efficiency and performance, emphasizing predictable memory layouts, cache locality, and opportunities for advanced optimization. This section discusses key performance considerations and introduces advanced array transformations that extend Tacit's expressive power without sacrificing efficiency.

### 7.1 Cache-Friendly Design

Arrays and vectors in Tacit are stored contiguously, making them naturally suited to modern CPU cache architectures. This spatial locality reduces cache misses and improves memory throughput significantly. Compared to tree- or list-based structures, Tacit's arrays provide predictable access patterns that maximize hardware efficiency.

### 7.2 SIMD and Parallelization Opportunities

The uniform, contiguous memory layout of Tacit arrays naturally supports SIMD (Single Instruction, Multiple Data) optimizations. Operations on arrays can be efficiently vectorized, leveraging SIMD instructions available on modern processors. Additionally, Tacit's compositional, functional approach allows straightforward parallelization across multiple processing cores or accelerators, enhancing throughput and computational efficiency.

### 7.3 Lazy Evaluation and Pipeline Efficiency

Tacit's lazy, sequence-based evaluation model ensures that arrays and sequences are processed only when necessary, minimizing intermediate memory usage and computational overhead. This approach reduces memory footprint and enhances performance, especially in data-intensive tasks or pipeline-driven computations, by avoiding unnecessary array expansions or data copies.

### 7.4 Advanced Transformations: Reshaping and Slicing

Tacit's view mechanism enables powerful transformations, such as reshaping, slicing, and broadcasting, without additional memory overhead. These transformations reinterpret existing vectors as new multidimensional structures, providing flexible array manipulation while preserving efficient memory usage:

- **Reshaping:** Interprets a vector as an array of different dimensionality without copying data.
- **Slicing:** Creates subarray views by adjusting shape and offsets, avoiding memory duplication.
- **Broadcasting:** Extends arrays to compatible shapes dynamically during computation, facilitating element-wise operations across differing dimensions.

These advanced operations integrate seamlessly with Tacit's functional semantics and compositional pipeline model, offering powerful, expressive capabilities without compromising performance.

### 7.5 Minimal Overhead Metadata

Tacit arrays carry minimal metadata—typically just length, data width, and offset information. Views derive stride information dynamically, caching it only when beneficial. This lean metadata strategy keeps memory overhead minimal, preserving cache efficiency and ensuring rapid computation.

### 7.6 Summary

Tacit's array model is purposefully optimized for high-performance computing, aligning closely with hardware-friendly practices such as cache efficiency, SIMD compatibility, and parallel execution. Advanced transformations like reshaping and slicing extend the language's expressive power without introducing memory overhead, reinforcing Tacit's foundational principles of efficiency, minimalism, and compositional clarity.

## 8. Conclusion and Future Directions

Tacit’s array system offers a highly efficient, compositional, and expressive foundation for computation. By integrating arrays as first-class, functional components within its stack-oriented, sequence-driven model, Tacit achieves simplicity, performance, and clarity simultaneously.

Key strengths include:

- **Unified model**: Scalars, vectors, and multidimensional arrays share a common functional interpretation.
- **Efficient stack-based allocation**: Local and dynamically sized arrays are managed predictably and safely without complex heap management.
- **Views and advanced transformations**: Efficient reshaping, slicing, and broadcasting via views without extra memory overhead.
- **Performance and optimization**: Cache-friendly structures, opportunities for SIMD, and straightforward parallelization.

Future directions will focus on refining these mechanisms further, exploring enhanced compiler-driven optimizations, extending array functionality with richer reshaping and slicing operations, and more closely aligning Tacit's model with hardware-specific optimizations and real-world numerical computing scenarios.

Tacit's array-first approach thus positions it uniquely as a powerful tool for embedded systems, functional programming, and high-performance computing, balancing minimalism with maximal compositional flexibility.
