# **Tacit: Language Overview**

## Table of Contents
- [**Tacit: Language Overview**](#tacit-language-overview)
  - [Table of Contents](#table-of-contents)
  - [1. Introduction](#1-introduction)
  - [2. Core Design Philosophy](#2-core-design-philosophy)
  - [3. Key Language Concepts](#3-key-language-concepts)
    - [3.1 Stack-Oriented Programming](#31-stack-oriented-programming)
    - [3.2 Memory Model](#32-memory-model)
    - [3.3 Type System and Tagged Values](#33-type-system-and-tagged-values)
    - [3.4 Data Structures](#34-data-structures)
    - [3.5 Control Flow](#35-control-flow)
  - [4. Documentation Structure](#4-documentation-structure)
  - [5. Getting Started](#5-getting-started)
  - [2. Tagged Values and NaN-Boxing](#2-tagged-values-and-nan-boxing)
  - [3. Buffers and Tuples](#3-buffers-and-tuples)
    - [Buffers](#buffers)
    - [Tuples](#tuples)
  - [4. Views, Shapes, and Arrays](#4-views-shapes-and-arrays)
    - [Views](#views)
    - [Shapes](#shapes)
    - [Arrays](#arrays)
  - [5. Records and Tables](#5-records-and-tables)
    - [Records](#records)
    - [Tables](#tables)
  - [6. Local Variables and Stack Allocation](#6-local-variables-and-stack-allocation)
  - [7. Coroutines and Scheduling](#7-coroutines-and-scheduling)
  - [8. Compiled Sequences](#8-compiled-sequences)
  - [9. Stylistic Idioms and Syntax](#9-stylistic-idioms-and-syntax)
  - [10. Suggested Reading Order](#10-suggested-reading-order)

## 1. Introduction

Tacit is a compact, stack-oriented programming language designed for stream processing, embedded systems, and declarative computation pipelines. It emphasizes deterministic semantics, low overhead, and fine-grained control over memory and execution, avoiding closures, garbage collection, and implicit mutation.

Tacit combines functional programming ideals with stack machine pragmatics, using buffers and spans to structure memory, and compiles sequences and coroutines into explicitly managed state machines. This design achieves predictable performance, minimal runtime overhead, and simplified reasoning about program behavior.

## 2. Core Design Philosophy

Tacit minimizes runtime complexity through static layout, inlined execution, and first-class memory representations. Its key principles include:

* **Stack locality**: Function calls, variables, and structures are stack-managed, not heap-allocated
* **Explicit memory**: Buffers are owned, shaped, and interpreted explicitly
* **Composability**: Arrays, views, spans, and pipelines compose via simple rules
* **Determinism**: Execution proceeds via statically compiled control flow without dynamic dispatch
* **Minimalism**: No closures, no classes, no mutation of locals; programs are pipelines over values
* **Zero-copy**: Data transformations create new views rather than copying data
* **Contiguous memory**: All data structures operate on contiguous memory regions
* **Explicit control flow**: Coroutines and sequences with deterministic behavior

## 3. Key Language Concepts

### 3.1 Stack-Oriented Programming

In Tacit, computation centers around manipulating values on stacks:

- **Data Stack**: The primary workspace for most operations, storing values being processed
- **Return Stack**: Manages function call returns and can temporarily hold local variables
- **Stack Composition**: Functions compose by consuming and producing stack values
- **Stack Effects**: Functions have predictable effects on the stack, enabling static verification

Unlike many stack languages, Tacit provides structured abstractions that make stack operations logical and manageable.

### 3.2 Memory Model

Tacit's memory model emphasizes locality, contiguity, and explicit management:

- **Buffers**: Contiguous memory regions with metadata that can exist on the stack or elsewhere
- **Local Variables**: Stack-allocated values with deterministic lifetimes
- **No Heap**: Avoids traditional heap allocation and garbage collection
- **Explicit Layout**: Memory layout is explicitly controlled through buffers and views
- **Deterministic Cleanup**: Resources are released in a predictable, deterministic order

See the [buffers](./buffers.md) and [local-variables](./local-variables.md) documentation for details.

### 3.3 Type System and Tagged Values

Tacit uses a uniform 32-bit value representation with NaN-boxing:

- **Tagged Values**: All values carry type information through NaN-boxing in Float32
- **Core Types**: Numbers, integers, strings, code references
- **Buffer Types**: References to buffers with associated views and shapes
- **Span Types**: References to tuple tags and tuples
- **Composition**: Types compose through views and interpretations

For more information, see the [tagged-values](./tagged-values.md) documentation.

### 3.4 Data Structures

Tacit provides several core data structure abstractions:

- **Tuples**: Composable sequences in contiguous memory with tuple tag footers
- **Records**: Views that map symbolic field names to memory offsets
- **Tables**: Collections of records with shared structure
- **Arrays**: Multi-dimensional sequences with shape information
- **Views**: Functions that interpret buffer contents in specific ways

These structures compose to create complex data representations without sacrificing performance or locality.  

See the documentation for [tuples](./tuples.md), [records-and-tables](./records-and-tables.md), and [arrays](./arrays.md).

### 3.5 Control Flow

Tacit provides structured control flow without dynamic dispatch:

- **Functions**: Stack-based units of computation with explicit in/out effects
- **Coroutines**: Statically compiled state machines for cooperative multitasking
- **Sequences**: Iteration constructs with deterministic behavior
- **Pipelines**: Composition of operations in a data-flow style

For details on concurrency and control flow, see the [coroutines](./coroutines.md) documentation.


## 4. Documentation Structure

The Tacit documentation is organized by concept, with each file focusing on a specific aspect of the language:

- **[overview.md](./overview.md)**: This introduction and orientation (you are here)
- **[tagged-values.md](./tagged-values.md)**: The type system and value representation
- **[buffers.md](./buffers.md)**: The buffer system for contiguous memory management
- **[tuples.md](./tuples.md)**: Span-based data structures and operations
- **[records-and-tables.md](./records-and-tables.md)**: Record and table abstractions
- **[arrays.md](./arrays.md)**: Multi-dimensional array concepts
- **[local-variables.md](./local-variables.md)**: Stack-local variable management
- **[coroutines.md](./coroutines.md)**: Coroutine implementation and usage
- **[architecture.md](./architecture.md)**: System architecture and implementation details

## 5. Getting Started

To begin using Tacit:

1. **Understand the basics**: Read through this overview to grasp the core concepts
2. **Explore the stack model**: Familiarize yourself with stack-oriented programming
3. **Learn about buffers**: Buffers are fundamental to Tacit's memory model
4. **Study data structures**: Understand tuples, records, and tables
5. **Practice with examples**: Experiment with the provided code examples

Tacit's design emphasizes simplicity through composition. Once you grasp the fundamental elements, you'll find they combine in predictable ways to build powerful programs without the complexity of traditional programming models.

## 2. Tagged Values and NaN-Boxing

All values in Tacit use a 32-bit tagged format. These include:

* **Small scalars** (integers, floats, booleans)
* **Pointers** to buffers, spans, or other composite data
* **Tags** (6-bit fields) encode type and behavior
* **Special tags** represent buffer handles, tuple tags, or symbolic constants

This representation ensures uniform stack operations, type safety, and efficient dispatch.

> See: *Tagged Values document*

---

## 3. Buffers and Tuples

### Buffers

Buffers are raw memory regions with structured headers. They are used for:

* Raw byte storage
* Vectors (typed, uniform arrays)
* Stacks, queues, or structured regions (via metadata)
* Self-describing payloads (when paired with a view)

Each buffer starts with a compact header encoding metadata slots. The buffer is responsible for ownership, reference counts (if applicable), and memory interpretation.

### Tuples

Tuples are grouped values on the stack, enclosed in parentheses and terminated with a footer tag that records their length. They resemble TLV structures with trailing metadata and support:

* Composite value passing
* Broadcasting/group operations
* Span-pointer computation for nested stack data

> See: *Buffers document*, *Tuples document*

---

## 4. Views, Shapes, and Arrays

### Views

A view is a function from indices to offsets. It defines how to interpret a buffer as a higher-level structure—typically a multidimensional array or a record.

### Shapes

A shape is a special kind of view enriched with metadata (like rank and dimensions). It supports:

* Rank-driven indexing
* Derived stride calculation
* Composable reshaping and slicing

### Arrays

An array is a combination of a buffer and a view (often a shape). This pairing allows for:

* Multidimensional access over flat memory
* Functional indexing
* Composition via view transformation

Arrays are immutable in layout but can be updated via new views or new buffers.

> See: *Arrays document*

---

## 5. Records and Tables

### Records

Records are symbolic views over vectors. A record defines a mapping from field names (symbols) to slot indices and applies this view to a value vector. Records support:

* Schema-based access (`name → index`)
* Functional interpretation (record as a lookup function)
* Static layouts with symbolic fields

### Tables

Tables are collections of homogeneous records. A table includes:

* A shared schema (the record view)
* A buffer or array of rows (typically as vectors)
* Support for row-oriented operations (insert, query, etc.)

Tables are mutable in content but immutable in structure—new rows can be added, but the schema is fixed.

> See: *Records and Tables document*

---

## 6. Local Variables and Stack Allocation

Tacit uses a disciplined, slot-based local variable model:

* **Locals are stored** in a fixed table on the return stack
* **Access is by index**, determined statically at compile time
* **Values are single-assignment**, with no mutation
* **Post-yield allocation is disallowed**, preserving call integrity

Buffers, spans, and other structures can be allocated above the variable table before a coroutine yield. Cleanup proceeds by walking down from stack top to the base pointer, deallocating or dereferencing as needed.

> See: *Local Variables document*

---

## 7. Coroutines and Scheduling

Tacit supports cooperative multitasking through coroutines:

* **Each coroutine owns its local frame** and uses the shared return stack
* **Execution is round-robin**, one step per coroutine per tick
* **Yielding occurs after an `emit`**, which pushes a value downstream
* **No allocation is allowed post-yield**, to preserve frame consistency
* **Status flags** track whether a coroutine is active, yielded, or shutting down
* **Forks and joins** enforce atomic communication; all outputs/inputs are handled in one step

This model enables highly predictable task switching and supports stream-oriented pipelines.

> See: *Coroutines document*

---

## 8. Compiled Sequences

Sequences in Tacit are compiled to inline control structures. They consist of:

* **Source stages**: Producers (e.g., ranges, vectors)
* **Processor stages**: Mappers, filters, etc.
* **Sink stages**: Consumers (e.g., `for-each`, side effects)

Each stage is compiled as a small state machine, using `init`, `restart`, and `next` entry points. Execution is **pull-based** and **synchronous**—each call to `next` either returns a value or signals termination.

Forks duplicate values for multiple branches. Joins coordinate multiple upstreams atomically.

> See: *Compiled Sequences document*

---

## 9. Stylistic Idioms and Syntax

Tacit favors a sparse, expressive style using:

* **Parenthesis-based grouping** for spans
* **Stack-based function application**, with postfix notation
* **Fixed arity** and explicit local variables
* **Views as first-class values**, assignable and composable
* **Slot-based field access** via symbolic names or indices
* **No closures, no mutation**, and minimal hidden state

This enables a declarative, stream-based programming model, especially suited to low-resource or predictable systems.

---

## 10. Suggested Reading Order

For most readers, the following order builds the best intuition:

1. **Tagged Values**
2. **Buffers**
3. **Views and Arrays**
4. **Records and Tables**
5. **Tuples**
6. **Local Variables**
7. **Coroutines**
8. **Compiled Sequences**

This sequence leads from raw memory through structured data to execution semantics.
