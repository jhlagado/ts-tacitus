- [Stack Data Structures](#stack-data-structures)
  - [1. Introduction to Stack-Based Data Structures in Tacit](#1-introduction-to-stack-based-data-structures-in-tacit)
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
    - [6.1. Uniform Value Representation](#61-uniform-value-representation)
    - [6.2. Broadcast Semantics in Operations](#62-broadcast-semantics-in-operations)
    - [6.3. Storage and Variable Interactions](#63-storage-and-variable-interactions)
    - [6.4. Runtime Type Identification and Tagging](#64-runtime-type-identification-and-tagging)
    - [6.5. Advantages of Tacit’s Polymorphism Model](#65-advantages-of-tacits-polymorphism-model)
  - [7. Conclusion: The Significance of Stack-Based Composite Data in Tacit](#7-conclusion-the-significance-of-stack-based-composite-data-in-tacit)
    - [7.1 A New Paradigm in Data Representation](#71-a-new-paradigm-in-data-representation)
    - [7.2 Efficiency Through Minimalism](#72-efficiency-through-minimalism)
    - [7.3 Expressive Power and Composability](#73-expressive-power-and-composability)
    - [7.4 Philosophical Shift: Embracing the Stack as a Data Model](#74-philosophical-shift-embracing-the-stack-as-a-data-model)
    - [7.5 Future Directions and Potential Impact](#75-future-directions-and-potential-impact)

# Stack Data Structures

## 1. Introduction to Stack-Based Data Structures in Tacit

Tacit is a stack-oriented, concatenative programming language designed around simplicity and efficiency. At its core, Tacit treats the **data stack** as the fundamental workspace for all computations and data storage. Unlike many conventional languages that separate data storage from execution flow, Tacit leverages the stack itself as a powerful, flexible container for both simple values and complex data structures.

This approach aligns with the heritage of stack-based languages but extends it by enabling the stack to represent not only atomic values—like integers and floats—but also structured, composite data. By building data structures directly on the stack, Tacit avoids the need for heap allocation or garbage collection, which are common sources of runtime complexity and performance overhead in many other languages.

The stack’s LIFO (Last-In, First-Out) discipline naturally supports recursive and nested data representations. With Tacit’s grouping primitives, it becomes possible to compose **spans**—contiguous segments of the stack—that represent variable-length sequences, arrays, or even tree-like structures. This makes the stack not just a temporary container for passing parameters or holding intermediate values, but a fully-fledged first-class data structure.

Because the stack grows dynamically and is managed explicitly, Tacit enables precise control over memory layout and lifetimes. This opens the door to highly efficient implementations of array processing, multi-dimensional data, and variadic functions, all within a uniform framework.

Furthermore, the stack-centric design encourages a uniform programming model where operations, data, and control flow are intertwined. The language’s syntax and semantics revolve around pushing, grouping, and consuming stack items, providing a powerful yet minimalist foundation for expressing complex computations.

This document explores how Tacit represents and manipulates these stack-based data structures. It begins with the fundamental concept of grouping items on the stack using parentheses, introduces spans as flexible collections of data, and progressively builds toward handling nested, multi-dimensional structures. Throughout, the emphasis is on achieving expressive power and runtime efficiency without sacrificing the simplicity of the stack-based paradigm.

## 2. Representing Groups on the Stack with Parentheses

In Tacit, grouping values on the data stack uses a special pair of operators: the open parenthesis `(` and the close parenthesis `)`. These operators allow for the creation of **spans** — contiguous subranges of the data stack that represent variable-length groups of items.

### 2.1 The Open Parenthesis `(` — Marking the Group Start

When the open parenthesis is executed, Tacit performs the following:

* It pushes the **current data stack pointer** (DSP) onto the return stack.
* This pointer acts as a bookmark indicating the start position of the group on the data stack.

This saved pointer is essential for later computing the group's size when the closing parenthesis is reached.

### 2.2 Pushing Values Inside the Group

After the open parenthesis, any values pushed onto the data stack become part of the group. For example, consider this Tacit-style input (in RPN syntax):

```
( 10 20 30
```

* `(` saves the current DSP on the return stack.
* Then the values `10`, `20`, and `30` are pushed onto the data stack, above that saved pointer.

At this point, the stack might look like this (addresses grow upwards):

| Address | Value |
| ------- | ----- |
| ...     | ...   |
| DSP - 3 | 10    |
| DSP - 2 | 20    |
| DSP - 1 | 30    |

The saved start pointer on the return stack points to `DSP - 3`.

### 2.3 The Close Parenthesis `)` — Computing and Pushing the Skip

When the closing parenthesis `)` is encountered, Tacit:

* Pops the saved start pointer from the return stack.
* Calculates the difference between the **current DSP** and the saved start pointer. This difference is the size of the span — the number of items pushed since the open parenthesis.
* Constructs a **skip value** — a tagged representation of this difference, not just a raw number. The skip points to the end of this span on the stack.
* Pushes the skip value onto the data stack as a special marker.

This skip acts as a descriptor for the group, allowing downstream functions to treat the span as a single entity without losing track of its length or position.

### 2.4 Example Walkthrough

Let's step through an example with explicit stack states and instructions:

```
Initial data stack: empty
Return stack: empty

Execute: (
- Push current DSP (0) to return stack
Return stack: [0]

Execute: 10
Data stack: [10]

Execute: 20
Data stack: [10, 20]

Execute: 30
Data stack: [10, 20, 30]

Execute: )
- Pop start pointer from return stack: 0
- Current DSP is 3 (3 items on stack)
- Compute difference: 3 - 0 = 3
- Create skip tag for 3 (e.g., "SKIP:3")
- Push skip onto data stack
Data stack: [10, 20, 30, SKIP:3]
Return stack: empty
```

### 2.5 Using Spans in Functions

Functions in Tacit can recognize skip values and operate on the corresponding span of data items. For example, a `sum` function can consume a skip and sum the items beneath it on the stack:

```
( 10 20 30 ) sum →
```

Internally:

* The function reads the skip (`SKIP:3`), determines there are 3 items to sum.
* It accesses the 3 items below the skip: `10`, `20`, and `30`.
* Computes their sum: `60`.
* Pops all 4 items (`10`, `20`, `30`, `SKIP:3`).
* Pushes the result `60` onto the data stack.

Resulting stack:

```
[60]
```

### 2.6 Code Snippet (Pseudo Tacit VM Steps)

```
(              // Open parenthesis: push DSP to return stack
10             // Push value 10
20             // Push value 20
30             // Push value 30
)              // Close parenthesis: calculate skip and push it

sum            // Consume skip and sum the group

// sum implementation (simplified):
// 1. pop skip_value (n)
// 2. sum last n items below skip_value
// 3. remove those n items + skip_value
// 4. push sum
```

### 2.7 Summary

* Parentheses define spans — contiguous groups on the data stack.
* Open parenthesis saves the current DSP on the return stack.
* Close parenthesis computes the skip (distance) from saved DSP to current DSP.
* Skip is pushed as a tagged value onto the data stack.
* Functions consume skips to operate variadically on grouped data.

This mechanism empowers Tacit to handle variadic arguments and build complex data structures natively on the stack without heap allocation.

## 3. Working with Spans: One-Dimensional Vectors on the Stack

Tacit extends traditional stack-based computation by treating grouped sequences of values, called *spans*, as first-class data on the stack. These spans represent contiguous subsequences that can be manipulated as whole units, enabling powerful vector-style operations within the RPN model.

### 3.1 Representing Spans on the Stack

A span is created by grouping values between parentheses, for example:

```
(1 2 3)
```

This pushes a span containing three values onto the stack, representing a simple one-dimensional vector. Internally, the span is identified by a pointer (skip link) marking the segment’s extent on the stack.

Spans behave like single items on the stack but carry the information needed to operate on all their contained values collectively.

### 3.2 Basic Span Operations

Operations like `length` can be applied to spans to query their size:

```
(1 2 3) length
```

Yields:

```
3
```

Similarly, spans can be duplicated, stored in variables, and pushed back onto the stack transparently, just like scalars.

### 3.3 Broadcasting Arithmetic with Spans

Tacit’s arithmetic operators are designed to operate element-wise on spans, applying standard scalar operations across vectors automatically.

For example, adding two spans of equal length:

```
(1 2 3) (4 5 6) +
```

Produces the span:

```
(5 7 9)
```

Each element is summed with its counterpart, preserving the vector nature of the data.

### 3.4 Scalar Broadcasting

When one operand is a scalar and the other a span, Tacit broadcasts the scalar across the span, applying the operation element-wise.

Example:

```
(1 2 3) 10 +
```

Results in:

```
(11 12 13)
```

The scalar `10` is added to each element of the span seamlessly.

### 3.5 Generalized Broadcasting

This broadcasting behavior applies uniformly to all arithmetic operators (`+`, `-`, `*`, `/`) and can be extended to more complex operations. Tacit’s runtime recognizes operand types and dispatches the correct vectorized operation without explicit user intervention.

### 3.6 Combining Spans: The Zip Operation

Tacit supports combining multiple spans element-wise into spans of tuples via a `zip` operation. Given two spans:

```
(1 2 3) (4 5 6)
```

The zip operation:

```
(1 2 3) (4 5 6) zip
```

Produces a new span containing paired elements:

```
((1 4) (2 5) (3 6))
```

This nested span of tuples enables intuitive handling of coordinate pairs, key-value mappings, or any paired data.

By treating spans as first-class stack items with full broadcasting and combining capabilities, Tacit empowers concise and expressive vector computations directly within its RPN environment, bridging traditional stack programming with modern array-oriented programming paradigms.

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

Tacit’s span buffers offer a flexible way to represent nested data directly on the stack. However, for many operations, working with a *flat*, contiguous array in memory is more efficient. This section discusses how Tacit traverses and converts nested span buffers into such linear formats.

### 5.1 Recursive Traversal of Span Buffers

To convert a span buffer into a flat array, Tacit performs a recursive traversal that:

* Visits each element of the span.
* If the element is itself a span, recursively traverses its contents.
* If the element is a scalar, appends it to a linear buffer.

This process ensures that all nested values are extracted in a well-defined order, preserving the logical structure of the original nested spans.

### 5.2 Flattening Nested Spans

Flattening converts a hierarchical, nested span buffer into a one-dimensional memory segment. During flattening, Tacit:

* Accumulates scalar elements into a contiguous block.
* Eliminates skip pointers and recursive structure to produce a pure vector.

This flattening is essential for interfacing with low-level routines and libraries expecting linear memory, such as numerical computation kernels.

### 5.3 Building Shape and Stride Metadata

To preserve the multidimensional semantics after flattening, Tacit simultaneously constructs *shape* and *stride* metadata arrays:

* **Shape array** records the size of each dimension.
* **Stride array** specifies the offset between elements along each dimension in memory.

This metadata allows the flat buffer to be accessed with multidimensional indexing, recreating the view of nested spans as a multidimensional array.

### 5.4 Conversion Algorithm Overview

The conversion algorithm proceeds as:

1. Start with the top-level span buffer.
2. Recursively traverse nested spans, collecting scalars.
3. Track dimension sizes at each recursion level to build shape.
4. Calculate strides based on shape to enable efficient indexing.
5. Store flattened data and metadata in a dedicated buffer structure.

### 5.5 Trade-offs Between Nested and Flat Representations

* **Nested spans** provide flexible, dynamic structures supporting ragged arrays and recursive data.
* **Flat buffers with shape/stride** offer efficient computation and memory usage, favored for numerical operations.

Tacit supports both, allowing developers to choose the most suitable representation per use case and convert seamlessly between them.

## 6. Polymorphism of Span Buffers and Scalars in Tacit

Tacit treats span buffers—both simple and nested—as first-class values that seamlessly integrate with scalar types. This polymorphic behavior enables uniform manipulation of data, allowing scalars, vectors, and nested span structures to coexist and interact naturally.

### 6.1. Uniform Value Representation

At the core of Tacit’s polymorphism is the uniform representation of scalars and spans on the data stack. Scalars are treated as spans of length one, while more complex data structures are represented as tagged pointers to span buffers or nested substacks. This enables functions and operators to accept and return values without explicit type switching or conversions.

### 6.2. Broadcast Semantics in Operations

Operators in Tacit apply broadcast semantics automatically. When presented with span buffers, operations like addition, multiplication, or logical comparison recursively traverse the spans, applying the operation element-wise. Scalars broadcast implicitly, behaving as if they were vectors filled with the scalar value.

This recursive application supports operations between scalars and spans, between two spans of equal length, and between nested spans, allowing flexible and concise data transformations.

### 6.3. Storage and Variable Interactions

Variables in Tacit can hold scalars or span buffers transparently. Loading a variable pushes its value, regardless of complexity, onto the data stack. Storing from the stack into a variable similarly supports scalars and spans alike.

This polymorphic storage eliminates special cases in variable management and enables rich data to be stored locally without heap allocations.

### 6.4. Runtime Type Identification and Tagging

Tacit uses a tagging scheme to differentiate between simple values and pointers to span buffers. At runtime, the tags guide traversal, serialization, and operation dispatch, enabling polymorphic code to interact with deeply nested data structures without explicit type annotations.

This tagging enables efficient recursive descent algorithms that implement broadcast operations and data transformations.

### 6.5. Advantages of Tacit’s Polymorphism Model

This model reduces programmer overhead, enabling concise expression of complex data manipulations. It avoids heap dependency, supporting lightweight and efficient stack-based computation. Polymorphism enhances composability, allowing generic code to operate seamlessly on scalars and multi-dimensional arrays alike.

**7. Conclusion: The Significance of Stack-Based Composite Data in Tacit**

7.1 **A New Paradigm in Data Representation**
The introduction of composite span structures and recursive stack-based data fundamentally reshapes how we think about data in a stack-oriented language. Rather than treating the stack as a simple transient workspace of scalar values, Tacit elevates the stack to a first-class data store capable of holding complex, nested, and variadic structures. This paradigm bridges the gap between the raw efficiency of low-level stack operations and the expressive power traditionally reserved for heap-allocated, pointer-based languages.

7.2 **Efficiency Through Minimalism**
By representing complex data directly on the stack with embedded skip links and spans, Tacit avoids the overhead of garbage collection, heap fragmentation, and indirection penalties. This approach leverages cache locality and memory contiguity inherent in stack layouts, making recursive data traversal and manipulation performant and predictable. It also enables in-place operations and minimizes data copying, which is crucial for high-throughput or resource-constrained environments.

7.3 **Expressive Power and Composability**
The ability to work transparently with spans and nested spans allows for the seamless expression of multidimensional arrays, trees, vectors of complex structures, and more. Operators become polymorphic by default, automatically broadcasting over these composite types, vastly simplifying code and enabling powerful abstractions without complicating the runtime. This composability encourages building complex functionality from simple, reusable components.

7.4 **Philosophical Shift: Embracing the Stack as a Data Model**
Tacit’s design invites a philosophical reexamination of the role of the stack. Traditionally seen as ephemeral scratch space, the stack here becomes a durable, structured data store. This challenges conventional separation between stack and heap, arguing instead for a unified, efficient memory model. The design embodies the minimalist ethos of Tacit itself—favoring clarity, simplicity, and maximal expressiveness from minimal constructs.

7.5 **Future Directions and Potential Impact**
This technology opens pathways for further innovations in language design, compilation techniques, and runtime optimization. It suggests that stack-based languages can be both high-level and efficient, serving domains traditionally dominated by more heavyweight systems. As implementation matures, Tacit’s approach could influence broader language ecosystems, especially in embedded, real-time, and performance-critical applications.

