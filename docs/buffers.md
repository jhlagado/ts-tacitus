# Buffers

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Buffers – Raw Memory as a First-Class Value](#2-buffers--raw-memory-as-a-first-class-value)
- [3. Buffer Headers and Metadata Layout](#3-buffer-headers-and-metadata-layout)
  - [3.1 Metadata Length Encoding](#31-metadata-length-encoding)
  - [3.2 Optional Metadata Fields](#32-optional-metadata-fields)
  - [3.3 Header Variability and Optimization](#33-header-variability-and-optimization)
  - [3.4 Summary](#34-summary)
- [4. Views – Interpreting Buffer Contents](#4-views--interpreting-buffer-contents)
- [5. Views – Translating Indices to Offsets](#5-views--translating-indices-to-offsets)
  - [5.1 View Structure](#51-view-structure)
  - [5.2 View Types](#52-view-types)
  - [5.3 View Attachment](#53-view-attachment)
  - [5.4 Functional Semantics](#54-functional-semantics)
- [6. Shapes – Metadata-Enriched Views](#6-shapes--metadata-enriched-views)
  - [6.1 The Shape Vector](#61-the-shape-vector)
  - [6.2 Derived Strides](#62-derived-strides)
  - [6.3 Shapes as Views](#63-shapes-as-views)
  - [6.4 Usage and Reuse](#64-usage-and-reuse)
  - [6.5 Shape vs Prototype](#65-shape-vs-prototype)
- [7. Prototypes – Shaped, Initialized Instances](#7-prototypes--shaped-initialized-instances)
  - [7.1 Definition and Semantics](#71-definition-and-semantics)
  - [7.2 Creation and Use](#72-creation-and-use)
  - [7.3 As View, As Shape](#73-as-view-as-shape)
  - [7.4 Usage Patterns](#74-usage-patterns)
  - [7.5 Lifecycle and Identity](#75-lifecycle-and-identity)
- [8. Tables – Indexed Collections of Records](#8-tables--indexed-collections-of-records)
  - [8.1 Structural Definition](#81-structural-definition)
  - [8.2 View Semantics](#82-view-semantics)
  - [8.3 Indexing and Access](#83-indexing-and-access)
  - [8.4 Table as Stream](#84-table-as-stream)
  - [8.5 Mutation and Row Replacement](#85-mutation-and-row-replacement)
  - [8.6 Symbolic Columns and Field Labels](#86-symbolic-columns-and-field-labels)
  - [8.7 Tables and Prototypes](#87-tables-and-prototypes)
- [9. Mutation and Control over Tabular Data](#9-mutation-and-control-over-tabular-data)
  - [9.1 Mutable vs Read-Only Row Access](#91-mutable-vs-read-only-row-access)
  - [9.2 Projection vs Mapping](#92-projection-vs-mapping)
  - [9.3 Filtering and Early Exit](#93-filtering-and-early-exit)
  - [9.4 Sentinel Control and End-of-Table](#94-sentinel-control-and-end-of-table)
  - [9.5 Coroutine Constraints and Side Effects](#95-coroutine-constraints-and-side-effects)
  - [9.6 Composite Updates and Row Replacement](#96-composite-updates-and-row-replacement)
- [10. Stack and Queue Semantics in Buffers](#10-stack-and-queue-semantics-in-buffers)
  - [10.1 Header-Based Control Structures](#101-header-based-control-structures)
  - [10.2 Stack Implementation](#102-stack-implementation)
  - [10.3 Queue Implementation](#103-queue-implementation)
  - [10.4 Symbolic Offsets and Standards](#104-symbolic-offsets-and-standards)
  - [10.5 Integration with System Flow](#105-integration-with-system-flow)
- [11. Hybrid Structures and View-Defined Semantics](#11-hybrid-structures-and-view-defined-semantics)
  - [11.1 Compositional Views](#111-compositional-views)
  - [11.2 Prototypes as Complete Templates](#112-prototypes-as-complete-templates)
  - [11.3 View Interface Standards](#113-view-interface-standards)

## 1. Introduction

Tacit is structured around a simple and explicit memory model in which *buffers* play a central role. A buffer in Tacit is a raw, linear memory region measured in bytes. It is the most fundamental data container in the language—every higher structure, including arrays, records, tables, and streams, builds upon it. Buffers expose no intrinsic type or structure beyond their byte count and an associated *view* that defines how to interpret their contents. This strict separation between memory and interpretation is foundational: it enables precise control over memory layout, supports composable access models, and allows for high-performance, low-overhead computation across both structured and unstructured data.

Each buffer consists of two primary components: its byte size and its view pointer. The size is always in bytes and reflects the full allocated extent of the memory region. The view pointer, by contrast, defines how the buffer is *interpreted*—what kind of elements it contains, how to access them, and how iteration or indexing proceeds. A buffer with no explicit view is treated as a byte vector by default, which makes it usable for simple data movement and unstructured byte-wise operations. Once a view is assigned, the buffer is effectively lifted into a higher semantic space: it becomes a vector of floats, a list of records, a multidimensional array, or even a table of spanners, depending on how the view resolves.

This model deliberately avoids implicit typing. Buffers do not remember their interpretation; it is always provided or inferred from context. This keeps memory usage predictable and allows functions to operate generically over any buffer so long as a compatible view is supplied. In particular, it enables operations like casting, reinterpreting, or reshaping buffers without copying the underlying data. This kind of composability is key to Tacit’s design philosophy: values remain simple, and higher-level behavior emerges from how they are interpreted.

At runtime, views act as functions: they accept one or more indices and return an offset into the buffer, optionally accompanied by stride or shape metadata. This functional interpretation means that even complex data layouts—like nested arrays, shaped records, or partitioned tables—can be represented and queried efficiently without transforming the buffer’s contents. Moreover, this encourages the use of lightweight, declarative composition over imperative memory manipulation. Rather than storing values in nested heap-allocated objects, Tacit favors the reuse of flat memory regions indexed through increasingly sophisticated view logic.

Buffers also integrate smoothly with Tacit’s coroutine and local variable systems. Buffers can be allocated locally and passed across stages, allowing in-place mutation or efficient reuse. They support stack-local lifetimes, promotion to outer scopes, and restricted mutation following coroutine yield, all consistent with Tacit’s minimal and predictable execution model. Because buffers are reference-counted, yet copy-on-write and view-driven, they enable both safety and performance—avoiding hidden allocations, dangling pointers, or automatic coercion.

In short, buffers are not containers in the traditional object-oriented sense. They are raw memory regions with clear ownership and reinterpretation semantics, capable of being composed, sliced, projected, and transformed through functional views. This lays the groundwork for higher-level abstractions, such as arrays and tables, while maintaining full control over layout, memory usage, and execution flow.

## 2. Buffers – Raw Memory as a First-Class Value

A buffer in Tacit is a flat, untyped region of memory, always measured in bytes, and always accompanied by a view that governs how its contents are interpreted. This section defines what a buffer *is*, what it *contains*, and how it interacts with the rest of the system.

A buffer begins its life as a block of raw bytes. It has no intrinsic structure, no internal pointers, no metadata beyond its size and its view reference. This makes buffers lightweight and deterministic. They can be stack-local, heap-allocated, or statically embedded, depending on the context in which they’re created. All operations on a buffer assume that the view is what defines the buffer’s shape—there is no type tag baked into the memory itself. This eliminates the need for type introspection at runtime and avoids the complexity of heap-allocated object graphs.

Tacit buffers support reference counting but do not enforce exclusive ownership. Instead, they rely on a copy-on-write discipline where modifications trigger allocation only when necessary. When passed between coroutines or stored in local variables, buffers retain their identity and share memory safely. Mutation is explicitly controlled: buffers can be declared as mutable or read-only based on context, and once a coroutine yields, new allocations into local variables are disallowed. This restriction is enforced to ensure that buffers with uncertain lifetime are not mutated or overwritten unintentionally during resumption.

Internally, a buffer’s structure is extremely compact. It may consist of as little as four bytes of size metadata, followed by a view reference (which itself is typically a pointer to a shape or function), and the actual byte contents. The size is stored in raw bytes, not elements, and the view provides the element width needed to interpret this. For example, a buffer of 1024 bytes with a view of `float32` is interpreted as 256 elements, while the same buffer with a record view of eight bytes per entry would be seen as 128 records. No conversion or copying is performed—the interpretation is purely functional.

This minimalism enables powerful behavior. The same physical buffer can be sliced into multiple logical vectors, reshaped into multidimensional arrays, or reinterpreted as typed records—all without changing its contents. A new view can be assigned at any time, effectively re-casting the buffer. This dynamic reinterpretation enables techniques like zero-copy deserialization, lens-based projection, tabular reshaping, and metadata-driven record parsing.

Crucially, buffers can also participate in dynamic schema systems. In Tacit, some buffers are self-describing: they store a spanner, prototype, or record in their first entry, which then defines the interpretation for all subsequent entries. These *schema-bearing* buffers use the first value as both data and descriptor. This allows tables to carry their own row layout implicitly, without requiring hardcoded views. A flag in the buffer’s header may indicate whether this first entry is live data or acts only as metadata (a tombstone), allowing deletion without schema loss.

This mechanism makes buffers ideal for dynamic tabular processing. Combined with coroutine pipelines and declarative access functions, a buffer can serve as the backend for a full table: indexed, sliced, filtered, mutated, projected, and emitted row-by-row with deterministic memory and type behavior. Buffers are also the unit of exchange between pipeline stages, making them central to Tacit’s dataflow semantics.

In summary, buffers are the lowest common denominator of data in Tacit. They are byte-addressable, layout-transparent, view-driven, and safe for concurrent or pipeline use. Their simplicity enables flexibility. Their determinism enables performance. And their functional reinterpretation model allows them to underpin all other data structures in the system, from arrays to records to dynamic tables.

## 3. Buffer Headers and Metadata Layout

Every buffer in Tacit begins with an optional metadata region, called the *header*. This header precedes the main content area and provides structured, self-describing information about how the buffer should be interpreted or manipulated. The metadata is composed of a sequence of 32-bit values, whose meaning and presence are determined by a compact, standardized layout.

### 3.1 Metadata Length Encoding

At minimum, the header contains a single 32-bit word: the *header length*. This value encodes the number of metadata words present, including itself. The value is expressed in 32-bit units, not bytes. If the value is one, the buffer has no metadata beyond the header length. If it is zero, the buffer is malformed. A buffer with no view and no auxiliary pointers will typically have a header length of one and behave as a raw byte array.

The length field uses a nibble (four bits) within the high byte of the first 32-bit word to record the number of metadata slots. The remaining bits in that word may be reserved for future use (e.g., buffer flags, permissions, or ownership tags), but by default only the lower nibble is significant. A maximum value of fifteen gives up to fifteen 32-bit metadata entries, occupying sixty bytes total. This is generous and well beyond typical needs.

The metadata region is always followed immediately by the buffer's content area. Consumers that do not need metadata can ignore the region by skipping the number of words specified in the length field.

### 3.2 Optional Metadata Fields

The following fields may appear in the metadata region, in any order, subject to convention. Their presence and meaning are determined by context or by the view assigned to the buffer.

* **View Pointer**: A tagged reference to a view, typically used to interpret the layout of elements in the buffer (e.g., vector, record, array, or spanner). If present, this is usually in the second metadata slot (index one).
* **Stack Pointer**: An integer indicating the current logical size of the buffer when used as a stack. Enables push and pop operations without external tracking.
* **Read/Write Cursors**: Two optional indices indicating read and write positions, useful when the buffer is used as a streaming I/O channel, ring buffer, or text input queue.
* **Custom Pointers**: Any application-specific slots that provide fast access to cached state, ownership chains, or synchronized resources.

There is no fixed meaning assigned to each slot beyond the length header. The view, if present, may dictate a particular layout. Consumers should use conventions or introspection to determine slot semantics.

### 3.3 Header Variability and Optimization

Because many buffers do not require metadata beyond the header length, most buffers will incur no more than four bytes of overhead. More complex structures, such as self-describing tables, shared stacks, or coroutine mailboxes, may benefit from embedding stack pointers, views, or control cursors directly in the metadata.

This model encourages compactness while allowing flexible augmentation. It avoids heap allocation for auxiliary structures by reserving minimal header space for control metadata. In stack-local scenarios, this allows fully encapsulated, in-place mutation and introspection without pointer chasing.

### 3.4 Summary

The buffer header model is compact, flexible, and self-describing. It accommodates both raw byte arrays and structured, polymorphic data containers. Metadata is optional but standard; layout is fixed but extensible; and all semantics are discoverable through the header length and optional view.

## 4. Views – Interpreting Buffer Contents

In Tacit, a buffer on its own is just a raw sequence of bytes—useful for storage, but semantically meaningless without further context. A *view* provides that context. It acts as a functional interpreter over the buffer, allowing structured access through index-based or key-based lookups. Conceptually, a view is a function: it maps one or more inputs (indices, axes, or symbolic keys) to an offset in memory and a data width. By applying a view to a buffer, the system reinterprets the buffer’s contents without changing the data itself.

At minimum, a view defines how to locate elements. For example, a one-dimensional array view maps a single integer index to an offset. A two-dimensional array view maps a pair of indices to a linearized offset using the shape vector. A record view maps field names (symbols) to fixed offsets within a unit of data. More complex views, such as those used in spanners or nested tables, may combine both behaviors or derive their structure dynamically.

Each buffer may carry a view reference in its metadata header, enabling the system to treat that buffer as a structured object. This reference can be nil, in which case the buffer defaults to a flat byte vector. But once a view is attached—whether array, record, span, or otherwise—the buffer becomes structurally meaningful. It now supports read and write operations interpreted through the lens of its view.

This mechanism supports composability. Since a view is a function, it can be replaced or overridden at runtime to reinterpret the buffer differently. The same raw data might be treated as an array of integers, a series of records, or a text stream, depending on context. In practice, this allows Tacit to simulate a form of ad-hoc polymorphism without relying on object inheritance or dynamic type tagging.

A key property of views is that they are pure. They do not themselves store state beyond their shape metadata or transformation logic. This keeps them compact, shareable, and suitable for embedding directly into code or headers. They may also serve as canonical schemas—detached from data—especially in cases where many buffers share the same structure. For example, all rows in a table might share a single row view used repeatedly to interpret each record.

When working with self-describing buffers like spanners, the view reference may point to an instance of a prototype—an initialized record that functions as both schema and example. This blurs the line between data and metadata and allows for flexible and decentralized schema definitions. Spanners are therefore a higher-level case where a single record acts as a dynamic view for others.

In summary, views are the primary means by which raw memory is structured and accessed in Tacit. They allow buffers to act like arrays, records, or other abstractions without altering the underlying data layout. This model supports lazy reinterpretation, structural polymorphism, and zero-copy projection of data—all within a compact and efficient system.

## 5. Views – Translating Indices to Offsets

A view is a function. Its role is to interpret indexing requests and translate them into memory offsets within a buffer. This fundamental abstraction enables arrays, records, spans, and tables to share a common memory representation while exhibiting radically different access patterns and semantics.

A view accepts one or more indices and returns an offset. For example, a one-dimensional array view receives a single index and returns a byte offset; a two-dimensional shape view accepts two indices and computes the corresponding linearized offset using shape and stride metadata.

### 5.1 View Structure

In Tacit, a view is not merely metadata—it is an executable function. Views are stored as tagged values pointing to callable code with optional attached data. This allows views to be freely passed, duplicated, and used as values, even within other data structures.

Typical view payloads include:

* Base offset (default zero, often omitted)
* Element width (in bytes)
* Shape vector (for multidimensional structures)
* Stride vector (optional, derived from shape if absent)

These payloads live in dedicated memory or may be embedded in code, depending on how the view was constructed.

### 5.2 View Types

Several standard views are expected:

* **Byte View**: Default view; treats the buffer as a flat byte array.
* **Shape View**: Interprets the buffer as a multidimensional array using a shape vector.
* **Record View**: Treats the buffer as a sequence of fixed-size structs.
* **Span View**: Views the buffer as a table of dynamically-typed or variable-length entries.
* **Self-Describing View**: Reads its layout from the first element of the buffer (used in spanners or prototypes).

Custom views may also be created dynamically or derived from existing metadata.

### 5.3 View Attachment

Views are attached to buffers via the metadata header. A specific slot in the header is reserved for the view pointer. If absent, the buffer defaults to a Byte View. This design supports efficient raw memory manipulation while preserving rich structure when needed.

When a buffer is passed to an operation requiring indexing, the presence of a view determines whether structured access is possible. This separation of raw storage and interpretive schema is essential to Tacit’s dual goals of low overhead and high expressiveness.

### 5.4 Functional Semantics

Since views are functions, they obey composition and reuse principles. A view may be queried, called, or partially applied. More advanced views—such as those returned by slicing or projection—can themselves produce new views.

For instance, a table row view may expose a sub-view over one record’s fields, and a column projection can produce a new view mapping a single field across multiple records.

This composability makes views not just metadata, but programmable schemas. They can describe memory, guide layout, and drive computation, all without additional allocation or closure-based runtime overhead.

## 6. Shapes – Metadata-Enriched Views

A shape is a specific kind of view: one that defines structured dimensional layout. While all views translate indices to offsets, shapes go further—they encode the full rank, extent, and optionally stride of a memory region. In doing so, shapes act as both schema and interface for structured access.

### 6.1 The Shape Vector

At its core, a shape is represented as a vector of integers, each describing the extent of one axis. A one-dimensional shape might be `[10]`, a two-dimensional shape `[4 5]`, and so on. The length of this shape vector determines the rank.

Shapes are stored in ordinary Tacit buffers, typically with a known format: the first word is the rank, followed by the extent of each dimension. Optionally, additional values may define strides.

These shapes are typically embedded into view metadata. They inform the view how to compute the offset for a given tuple of indices using standard row-major or column-major logic.

### 6.2 Derived Strides

In most cases, strides are not stored explicitly. Instead, they’re computed on demand from the shape itself using a standard linearization formula. For example, the strides for shape `[3 4 5]` in row-major order would be `[20 5 1]`. This reduces memory footprint and allows shape objects to remain compact.

When strides are stored, they are simply placed after the shape vector in the same buffer. This allows views to switch between computed and stored stride modes without altering the core layout of the shape.

### 6.3 Shapes as Views

Because shapes are also functions, they are used directly as views. A shape view accepts as many indices as its rank and returns an offset by combining them with the stride vector (real or derived).

For instance, calling a rank-two shape `[4 5]` with arguments `(2 3)` yields an offset of `2*5 + 3 = 13`. The caller may then scale this offset by the element width, or defer that to the view function.

This uniformity—treating shapes as first-class views—means they can be passed to indexing operations, stored in metadata, and used to construct derived arrays without any syntactic distinction.

### 6.4 Usage and Reuse

Shapes are typically allocated once and reused across many arrays. A single shape vector `[10 20]` can define a grid layout shared by hundreds of buffers. This reuse is critical in table-like systems, where thousands of records may share the same layout.

This also enables the use of prototype-driven semantics, where a single record or array structure can act as the template for all similar instances.

### 6.5 Shape vs Prototype

While a shape defines layout, it does not define contents. A prototype (discussed in the next section) merges shape and data into a single instance that can act as both schema and example.

In this way, shapes sit squarely in the middle of the view hierarchy: more expressive than a bare view, but more abstract than a full prototype. They are light, interpretable, and foundational to array construction.

## 7. Prototypes – Shaped, Initialized Instances

A prototype is the highest level of view abstraction in Tacit. It behaves like a shape in that it encodes layout, like a view in that it maps indices to memory offsets, but it also carries initialized data. It’s a concrete, structured example—one that can be used both as a runtime value and as a blueprint for new objects.

### 7.1 Definition and Semantics

A prototype is a buffer-view pair, where the buffer holds a fully initialized instance of data, and the view interprets that data in a structured way. Unlike shapes, which only describe memory layout, a prototype is an actual array, record, or span with contents. Calling it yields access to real values, not just offsets.

This makes prototypes dual-purpose: they can be executed like functions (to project into data), queried for metadata (like shape, rank, field names), or cloned to produce new, similarly structured instances.

### 7.2 Creation and Use

A prototype is often created by filling a buffer according to a known shape or schema. For instance, a structured record might be initialized with default field values, and its layout defined by a shape vector or spanner. That combination becomes a prototype.

Later code can reference this prototype to create new records, validate conformance, or treat the prototype itself as an object. In practice, this might look like:

```
record-init → proto
proto @name → "John"
proto (2 3) → 42
```

Where `@name` and `(2 3)` are field or index lookups through the view layer, but `proto` carries both the data and the view.

### 7.3 As View, As Shape

Every prototype is also a view. You can call it with index arguments, and it will translate those into data accesses. Because it also includes the metadata required to do this (either in the buffer header or embedded), it serves as a fully standalone value.

In this way, a prototype *is* its own shape. It satisfies the same calling conventions, participates in array-style access, and can even be queried for its structure. This allows functions that expect views or shapes to work transparently with prototypes.

### 7.4 Usage Patterns

Prototypes play a central role in table and record design. A table might reference a prototype for its row schema. A new record might be initialized by copying a prototype and tweaking a few fields.

They also provide a foundation for functional serialization and code generation—prototypes can be defined at compile time, stored in memory, and referenced by ID or symbol. This means entire data schemas can be embedded directly in the code, no runtime parsing required.

### 7.5 Lifecycle and Identity

Unlike ephemeral buffers, prototypes often have persistent identity. A prototype may be registered globally, assigned a symbolic name, or treated as a singleton within a module. When used this way, it acts almost like a class—its structure is stable, its contents meaningful, and it serves as the model for others.

Prototypes enjoy several lifecycle advantages:

1. **Registration and Lookup**: They can be stored in named dictionaries or registries, allowing symbolic access by name or ID
2. **Versioning and Evolution**: A prototype can be evolved while maintaining backward compatibility with instances
3. **Serialization Support**: Prototypes serve as canonical examples for serialization and deserialization logic
4. **Compilation Targets**: They provide concrete templates for code generation and JIT specialization

The identity of a prototype extends beyond its memory address—it encompasses its structure, expected behavior, and role in the system. Two prototypes with identical memory layouts but different field names or validation rules are considered distinct, as they represent different semantic contracts.

This is particularly useful when working with structured formats like rows, spans, or tagged records, where the consistency of shape and initialization matters as much as the data itself.

## 8. Tables – Indexed Collections of Records

A table in Tacit is a buffer that holds a series of structurally identical records, coupled with a view that describes the shape of each row. Unlike single-record prototypes, tables provide ordinal access to many such rows and support a wide range of indexed operations, selection, transformation, and projection.

### 8.1 Structural Definition

At the core, a table is composed of three elements:

* A backing buffer that contains serialized records in row-major order.
* A row view (schema or prototype) that describes how to interpret each record.
* A rank-one or rank-two shape vector defining how many records there are and how large each is.

This makes tables a natural extension of arrays and records. You can treat them as sequences of structured values, or you can treat the entire buffer as a raw region and access it with a lens or slicing function.

### 8.2 View Semantics

The table’s view defines how to traverse rows and access fields within them. Internally, the view is just a function from a pair of indices—row and column—to a byte offset within the buffer. This allows for flexible decoding and reshaping, including tables with nested or variable-sized rows.

In many cases, the view is derived from a prototype: the prototype defines the shape of a single row, and the table applies that view repeatedly over its rows. The prototype may even be embedded in the table's metadata header.

### 8.3 Indexing and Access

Accessing a table value is a two-step function application:

```
table (row-index field-index) → value
```

This projects the field from the row and returns its value. Under the hood, the buffer offset is computed via:

```
offset = base + (row-index * row-size) + field-offset
```

where `row-size` comes from the shape or prototype, and `field-offset` is field-specific. For named fields, symbol lookup is used to resolve the field index.

This model supports simple scalar reads, full row extraction, column slicing, and subtable views without ever copying data.

### 8.4 Table as Stream

Because tables in Tacit are fundamentally buffers, they are streamable. You can treat them as sources in coroutine pipelines, apply `map` or `filter`, and produce new views or transformations without allocating new buffers.

This allows Tacit to emulate SQL-style queries or APL-style transformations without needing a separate runtime engine. Tables become pipelines of rows, and projections or filters become view transformations or short-circuiting consumers.

### 8.5 Mutation and Row Replacement

Although buffers are typically treated as immutable in functional operations, Tacit allows controlled mutation. A table’s rows may be edited in-place if the buffer is marked mutable, and the view provides enough metadata to navigate and modify fields.

This is especially useful in update pipelines, where rows are read, updated, and replaced in the same buffer. Combined with the metadata header, this allows tables to serve as in-memory databases, log windows, or serialized snapshots with controlled mutability.

### 8.6 Symbolic Columns and Field Labels

To support symbolic access, tables often carry a spanner or record schema in their view metadata. This enables field names to be resolved to column indices, and operations like:

```
table (3 %name) → "Alice"
```

where `%name` resolves to a field offset or index via the view’s symbol table. This gives Tacit tables the expressive power of JSON or CSV field names, but in a fully compiled, offset-driven format.

### 8.7 Tables and Prototypes

Every table ultimately refers to a prototype—it’s the canonical row shape used to decode each entry. This allows type-checking, row replacement, and serialization to be consistent across different systems. A prototype can also act as the template for constructing new rows to be inserted or mutated.

## 9. Mutation and Control over Tabular Data

While Tacit favors immutability and composition, controlled mutation of tabular structures is a core capability—especially when buffers act as shared state across coroutine pipelines or host serialized intermediate results. This section covers the principles and mechanisms by which table data may be mutated or traversed conditionally, either during execution or as part of staged transformations.

### 9.1 Mutable vs Read-Only Row Access

Once a table row has been identified—typically via ordinal index—Tacit provides two fundamental ways to access it:

1. **Read-only access**: Extracting values from the row without modifying the underlying buffer
2. **Mutable access**: Obtaining a reference that allows modification of the row's fields

The ability to modify rows depends on two key factors:

* The buffer must be explicitly marked as mutable
* The associated view must support bidirectional access (read and write operations)

When these conditions are met, row access operations can return a specialized reference—effectively a combination of base pointer and field offset mapping—that enables direct updates to individual fields within the row. This reference mechanism enables clean syntax for field updates in Tacit's stack-oriented notation:

```
row-reference 42 'age set-field  
```

Without this explicit mutability, all row projections remain read-only, preserving data integrity in functional transformation chains.

### 9.2 Projection vs Mapping

In Tacit, projection is the direct extraction of fields from a record, while mapping involves transforming that record into some derived value—possibly with side effects.

Projection:

```
(table row field) → value
```

Mapping:

```
map (table) { row → transform(row) }
```

If the transform function mutates `row`, and the buffer is writable, the change is committed directly to the buffer. Otherwise, it returns a new value, as in classic functional mapping.

This dual use—read-only versus in-place mapping—is a powerful idiom. Tables become updatable views with embedded logic, and pipeline stages can act as updaters or filters depending on context.

### 9.3 Filtering and Early Exit

Table traversal may be short-circuited by a predicate, just like SQL `WHERE`. In Tacit, this takes the form of a coroutine stage that consumes rows conditionally:

```
filter (table) { row → row.age > 18 }
```

If the row fails the predicate, it's skipped. Otherwise, it's passed along—either as-is or post-mutation. Filtering is lazy, pulling rows only as needed, and yields are controlled via coroutine flow semantics.

Combined with projection, this forms the basis of conditional row rewriting:

```
for-each (table)
  if row.status == %pending
    row.status := %approved
```

Here, symbolic field names are resolved via the view, and assignment modifies the underlying buffer directly, assuming appropriate mutability.

### 9.4 Sentinel Control and End-of-Table

Tacit introduces the notion of sentinel values to control flow within pipelines. A row that maps to a sentinel may trigger shutdown of the consumer stage or signal end-of-stream to a join or accumulator.

Example:

```
map (table) { row → row.done? → sentinel }
```

Sentinels are not special values, but tagged indicators defined in the same namespace as regular results. Their propagation depends on consumer behavior: a join stage may collapse the entire pipeline on receiving a sentinel from one branch.

This allows advanced control like:

* Skipping remaining records.
* Terminating a search early.
* Signaling that a mutation completed.

### 9.5 Coroutine Constraints and Side Effects

After a coroutine yields, Tacit disallows further local buffer allocation. This means that mutations to table rows must complete before the next yield or be restricted to preallocated fields. This rule ensures stack discipline and eliminates unsafe aliasing of mutable buffers across coroutine boundaries.

For safe mutation:

* Allocate working buffers before entering the loop.
* Use stable views that refer to the same record layout throughout.
* Ensure all updates are committed before yielding.

Violation of these rules may result in undefined behavior or allocation errors.

### 9.6 Composite Updates and Row Replacement

In some cases, a full row must be replaced, not just patched. This is typically done by:

1. Creating a new record conforming to the prototype.
2. Copying it over the old record at the correct offset.
3. Updating any relevant pointers or indices.

This model aligns with how Spanners behave as prototypes: they provide not just field structure, but also initialization values. A prototype may be copied into the table with selected fields modified before insertion.

## 10. Stack and Queue Semantics in Buffers

Tacit buffers are not limited to serving as static memory blocks or array backings—they may be given runtime semantics through metadata specialization. Two of the most common behaviors required of a dynamic buffer are those of a stack (LIFO) and a queue (FIFO). Rather than layering these behaviors externally, Tacit treats them as intrinsic extensions of buffer capability, activated through the presence of standardized metadata fields.

### 10.1 Header-Based Control Structures

The buffer header always begins with a single 32-bit word describing the number of metadata entries. This word, stored at offset zero, dictates how many subsequent 32-bit fields follow before the actual buffer data begins. If this count is greater than one, it opens the door for stack or queue behavior via well-defined field positions.

### 10.2 Stack Implementation

For stacks, the second word in the header (offset one) may be reserved for a stack pointer (`sp`). This pointer indicates the next free slot in the buffer's active area and can be adjusted directly by push and pop operations. The presence of this metadata field implies that the buffer's primary mode is linear growth from a known base, and elements will be added or removed in order. There is no need for an external stack controller—any buffer with a valid `sp` field may act as a stand-alone stack.

### 10.3 Queue Implementation

For queues, we generalize this idea by reserving two metadata slots: one for a read pointer (`rp`) and one for a write pointer (`wp`). The read pointer tracks the position from which the next value should be dequeued, while the write pointer tracks where the next enqueued value will be written. The queue grows cyclically within the buffer bounds, and when `wp` overtakes `rp`, wraparound logic must be applied to maintain continuity.

Buffers intended for queue use should allocate three or more metadata fields: one for the header, and two for the pointers. Some implementations may also include a count field to assist with full/empty detection, although this can often be derived implicitly.

### 10.4 Symbolic Offsets and Standards

To ensure compatibility and clarity, Tacit establishes symbolic offsets for standard metadata roles. These are typically defined in the standard library as constants:

* `META_SP = 1` for stack pointer
* `META_RP = 1`, `META_WP = 2` for queues
* `META_VIEW = 1` for standard view metadata (if no pointer-based semantics are used)

Only one set of these fields should be active for a given buffer role. That is, a buffer acting as a stack should not simultaneously store read/write pointers unless specifically required by a hybrid algorithm. This avoids wasted header space and improves interpretation predictability.

### 10.5 Integration with System Flow

By incorporating dynamic pointer fields directly into the buffer metadata area, Tacit permits complex control flows—such as recursive coroutines, data pipelines, or device buffers—to be executed with minimal overhead. All buffer state is kept local to the structure itself, avoiding external controller objects, and allowing buffers to remain portable, inspectable, and self-contained.

## 11. Hybrid Structures and View-Defined Semantics

In Tacit, buffers serve not only as storage but as the substrate for user-defined semantics. By pairing a buffer with a view—a function that maps one or more indices to an offset—we define structured access over otherwise flat memory. This idea can be pushed further: views can define not just layout, but behavioral semantics. When buffers are treated as tables, records, stacks, queues, or even state machines, the view interprets the buffer structure and governs how the data is used.

This opens the door to hybrid structures: a buffer that simultaneously presents multiple access modes. For instance, a single buffer might store a fixed-width array of records with tabular semantics, while also containing a stack pointer for runtime expression evaluation, or a cursor for streaming input. These roles coexist because they are compartmentalized into distinct regions of the buffer and made visible through the view-function lens.

### 11.1 Compositional Views

Hybrid behavior arises from compositional views. A higher-order view can wrap a simpler one, modifying how it maps indices or injecting side effects. For instance, a base view might map `(row, col)` to byte offsets in a matrix, while a wrapper view might reinterpret certain rows as headers or control structures. This allows behaviors like dynamic schema-switching, sparse matrix access, or tagged unions—without changing the buffer's contents.

Hybrid structures also emerge by layering metadata roles. A buffer may include a view pointer in its header, which defines the layout of each element (e.g., record field offsets). Alongside that, the metadata may include a stack pointer or other operational cursor. The buffer's core memory block is then simultaneously interpreted in multiple ways: as a sequence of fields, as a push/pop surface, or as a communication pipe. The metadata layout serves as the glue.

### 11.2 Prototypes as Complete Templates

Prototypes serve a special role in these hybrid systems. A prototype is an instance that carries its own view and initialized values, and can be cloned to produce similar objects. When a prototype is treated as a view, it informs not just the shape but also the semantics and behavior of new structures created from it. 

A record prototype, for example, may define field names, types, default values, and validation logic—all encapsulated in the view. When such a prototype is assigned as the view of a buffer, the buffer adopts its structure and behavior wholesale.

### 11.3 View Interface Standards

To make hybrid structures work in practice, Tacit standardizes the view interface to accept arguments (usually indices) and return an offset, potentially with associated metadata (e.g., width, type tag, mutability flag). Complex views may require auxiliary metadata or external context, but their core remains functional: input in, offset out. This means hybrid views can still compose like functions, keeping the language uniform.

Importantly, hybrid structures are optional. Simple uses—like a raw byte buffer or a flat numeric array—do not require views at all. Only when behavior or structured layout is desired does a view need to be introduced. This ensures Tacit buffers remain lightweight by default, and that structure is always opt-in and explicit.

In summary, Section 11 highlights how Tacit buffers gain expressive power when views are used to define hybrid semantics. The separation of storage (buffers) from interpretation (views) allows composable, minimal, and functional design—extending from basic arrays to self-structured tables, queues, and beyond.

