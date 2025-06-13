# Records and Tables

## 1. Introduction

Records in Tacit are symbolic index functions that map a fixed set of keys—usually interned strings—to slot positions in a parallel value vector. Each record is a view, not a structure: it behaves like a function that translates a field name into an integer index, allowing indexed access to the associated data in a compact, stack-local or buffer-backed array. This makes records highly composable and efficient, without requiring heap allocation or runtime field introspection.

Unlike structs in C or objects in JavaScript, Tacit records are not byte layouts but symbolic maps over uniform-width, slot-based storage. The values themselves—typically tagged values—are stored in a vector-like buffer. Records describe the interpretation of that vector: how each index maps to a named field.

Records can be used on their own or as row schemas for tables. When applied to tables, a single record view is shared across all rows, allowing constant-time field lookup and composable filtering, projection, or joins. A record plus a data vector is effectively a prototype or instance; records without data are just index maps.

Records are first-class views, meaning they can be passed around, applied, and composed. They share the same foundation as array views and shapes, forming part of the same functional hierarchy. This allows Tacit programs to treat data as code: the record is not just metadata—it is an executable index function.

In this model, records support fast access, symbolic clarity, and schema-level reuse. Optional fields default to null (or a sentinel), but validation, typing, and mutation control are left to the host language or pipeline logic. Tacit avoids runtime overhead by assuming well-formed input and favoring simplicity over complex enforcement.

This document outlines how records are defined, how they are applied to value vectors, how they integrate with tables, and how they participate in Tacit's broader view system.

## 2. Record Structure and Semantics

A record in Tacit is a view that maps named fields to specific offsets in a backing value vector. These field names are interned symbols—single-token identifiers—that resolve to fixed integer indices, allowing field lookup to be efficient and index-driven. The values themselves are typically tagged, permitting dynamic typing and structural inspection. Conceptually, a record behaves as a function: it accepts a symbol as input and produces the corresponding value from its slot.

This functional interpretation means a record is not a container in the traditional object-oriented sense, but a keyed projection over a flat vector. The projection is immutable by default and does not carry dynamic dictionaries or shape-shifting metadata. Records must be declared in advance, with all field names and slot positions fixed. This promotes predictable memory layout and compatibility with table representations.

The backing vector for a record may reside in a stack-local buffer, on the heap, or within another structure. Regardless of location, the interpretation of that vector as a record depends entirely on the associated field-to-index mapping. These mappings are provided by the record view—either as a literal or via a symbolic binding—which acts as the schema. The view holds no values itself; it is pure metadata.

Records may share the same view but point to different backing vectors. This allows for reuse of schema definitions and avoids unnecessary duplication. Views are first-class values and can be passed around, applied, and queried. This enables higher-level operations like table joins or schema transforms to be expressed cleanly and without mutation.

Tacit’s records are not hierarchical: they do not nest recursively, and fields must always resolve to direct slots. Nested structures must be represented explicitly using separate buffers and views, not by embedding records within records. This flatness ensures that field access remains a matter of simple index arithmetic and symbol resolution.

**2. Record Structure and Semantics**

A record in Tacit is a view that maps named fields to specific offsets in a backing value vector. These field names are interned symbols—single-token identifiers—that resolve to fixed integer indices, allowing field lookup to be efficient and index-driven. The values themselves are typically tagged, permitting dynamic typing and structural inspection. Conceptually, a record behaves as a function: it accepts a symbol as input and produces the corresponding value from its slot.

This functional interpretation means a record is not a container in the traditional object-oriented sense, but a keyed projection over a flat vector. The projection is immutable by default and does not carry dynamic dictionaries or shape-shifting metadata. Records must be declared in advance, with all field names and slot positions fixed. This promotes predictable memory layout and compatibility with table representations.

The backing vector for a record may reside in a stack-local buffer, on the heap, or within another structure. Regardless of location, the interpretation of that vector as a record depends entirely on the associated field-to-index mapping. These mappings are provided by the record view—either as a literal or via a symbolic binding—which acts as the schema. The view holds no values itself; it is pure metadata.

Records may share the same view but point to different backing vectors. This allows for reuse of schema definitions and avoids unnecessary duplication. Views are first-class values and can be passed around, applied, and queried. This enables higher-level operations like table joins or schema transforms to be expressed cleanly and without mutation.

Tacit’s records are not hierarchical: they do not nest recursively, and fields must always resolve to direct slots. Nested structures must be represented explicitly using separate buffers and views, not by embedding records within records. This flatness ensures that field access remains a matter of simple index arithmetic and symbol resolution.

## 3. Record Views and Field Lookup

The view associated with a record defines the mapping from field names to their corresponding indices in the value vector. This mapping is implemented as a fixed, indexable structure—typically an array of symbols or a compact associative structure optimized for fast lookup. The view is immutable and can be queried or applied as a function.

Field lookup is performed by invoking the view with a symbol, which returns the corresponding numeric index. This index is then used to extract the value from the backing vector. Because the mapping is fixed, the view supports constant-time access and does not require a hash table or dynamic search.

Views are themselves a form of function: given a symbol, they return an index. This allows views to be composed or used to generate projection functions. They can also be introspected, allowing one to enumerate field names, indices, or derive derived views over subsets of fields.

Internally, views may be implemented with simple linear searches, compact binary tries, or static lookup tables, depending on how they are constructed. However, the interface remains consistent: symbols map to indices, and the view encapsulates this mapping entirely.

Multiple records may share the same view, enabling polymorphic access across different value vectors with the same field layout. This is foundational to Tacit’s table model, where each row is treated as a record with a shared view. Field access becomes uniform and stateless, and functions operating on records do not need to inspect or modify the view.

This design promotes separation between schema (view) and data (vector), allowing views to be cached, re-used, or even computed procedurally. Since views are pure and immutable, they are ideal for indexing and symbolic manipulation in pipelines.

## 4. Record Construction and Shape

Records are constructed by pairing a key-to-index view with a backing vector of values. This view acts as a shape descriptor—it defines both the set of allowed fields and their layout in memory. The backing vector holds the actual data in a fixed sequence of slots, and all access occurs through the view’s mapping function.

A view used as a record shape is not a structure or tag dictionary in the conventional sense. It is a function that accepts a symbol and returns an index, or fails if the field does not exist. Since the view is a first-class function, it can be generated, composed, and embedded into larger constructions. Shape views can be constant, computed, or layered to support features like field remapping or aliasing.

Each record value is defined by this shape. The vector may be stack-local or buffer-based, but its slot layout is fixed at construction time. There is no concept of adding fields to an existing record after construction—record shapes are immutable, and modification means constructing a new record with a new shape. This aligns with Tacit’s overall commitment to predictability, functional access, and data locality.

The canonical form of a record is a pair: a shape function and a slot vector. This mirrors the model used for arrays, where views interpret a flat buffer. Records and arrays are distinguished primarily by the nature of the view: records use symbolic keys, arrays use integer indices. Otherwise, the principles are parallel.

Internally, record values are treated as spans—fixed-size aggregates of tagged values. Their shapes are commonly stored or referenced in the metadata of the surrounding buffer or container, enabling batch interpretation (e.g., a table of records) without duplicating the shape function for every row. This avoids memory overhead and improves performance in record-oriented tabular data.

Records may be validated, but only externally. The view does not encode constraints—only layout. Optional fields are supported by allowing null or undefined tags in any slot, and by interpreting absence via the view function's return behavior. Enforcement of constraints or schema invariants is not the role of records themselves, but of any external systems that construct or consume them.

This approach makes records lightweight, composable, and suitable for constrained environments. Like arrays, they are not objects in the object-oriented sense. They are functional descriptors paired with data, and they can be projected, grouped, or accessed symbolically without runtime interpretation or polymorphism.

## 5. Tables as Indexed Record Collections

A table in Tacit is a structured collection of records, where all records share the same shape. Each row is a record with a consistent field layout, and the table provides mechanisms for indexed access, appending, deletion, and traversal. The key purpose of a table is to support symbolic access by field name and efficient row-wise manipulation.

Each table consists of a record shape (a view mapping keys to slot indices) and a buffer or set of buffers containing the actual row data. The data can be stored in row-major form—where each record is stored contiguously in a flat vector—or in columnar form—where each field has its own vector and rows are reconstructed from corresponding entries across vectors.

Row-major layout is straightforward and works well for small or moderately sized tables. Each row is a span of values, and the field names are resolved through the shared view. This enables simple indexing, fast iteration, and direct support for pipelines that operate over rows.

Columnar layout stores each field’s values in a separate array. This is useful for operations that process data one field at a time, such as filters or maps over a specific column. Columnar tables maintain their shape metadata as before but require coordination when constructing or modifying rows, since the data is split across multiple vectors.

Tables support appending by adding new rows to the backing data. This can be done by pushing full records into the row vector (row-major), or by appending individual field values to each column vector (columnar). Deletion may be handled in two ways: by shifting rows downward to fill the gap, or by marking deleted rows and skipping them during iteration. Tacit does not prescribe a deletion strategy but allows either to be implemented using the same underlying structures.

Tables are designed to be queryable. Filters and maps can be applied over rows, with field names resolved via the shared view. Because the structure of each row is fixed, and access is symbolic, queries can be compiled directly without runtime interpretation. This allows tables to be used as simple, efficient data stores in pipelines, logs, or communication buffers.

Schema metadata for the table—such as field names, types, or annotations—can be stored in the table’s view or in auxiliary metadata regions of the buffer. This keeps data representation clean and direct, while still enabling symbolic access and validation where needed.

In summary, Tacit tables are flat, indexable sequences of records, designed for symbolic access, structural regularity, and efficient memory use. Their behavior is defined by the shared record shape and the layout of the backing data, without dependence on external runtimes or dynamic features.

## 6. Querying Tables

Tables in Tacit are structured collections of rows, each of which may be either a record (symbol-indexed view) or an array (positionally-indexed vector). Querying tables means extracting relevant rows, projecting specific fields, and optionally transforming results. These operations are performed through explicitly composed pipelines that act on the underlying buffer, rather than through implicit language constructs or deferred evaluation mechanisms.

Table queries are expressed as dataflow chains, where each stage operates on one row at a time. The core operations are:

* **Filter** – Applies a predicate to each row. Rows failing the test are skipped.
* **Map / Project** – Transforms or reduces each row to a subset of fields, a new structure, or a derived value.
* **Sink** – Collects or emits results. This might mean printing, accumulating in a new buffer, or triggering side effects.

Each table is built atop a buffer, optionally paired with a view or record map. The row count and structure are derived from the buffer length and row shape. Iteration is row-oriented and typically index-driven.

A projection is a selection of named or positional fields from a row. If rows are records, field names are looked up using the record’s internal symbol-to-index mapping, returning a value for each requested name. If rows are vectors, the projection is expressed as an index list.

Filters apply a predicate function to each row. The predicate operates in the same view context as the row—i.e., fields are accessed via symbol or index lookups, not through pattern matching or destructuring. The result must be a single truthy or falsy value; non-boolean results are not interpreted further.

More complex queries may include joins, groupings, or computed aggregates, but these are not built-in concepts. Rather, they are constructed from lower-level primitives using projection, filtering, and accumulation. A join, for instance, is expressed as a nested loop with conditional matching. A group is a scan that partitions rows based on a key function.

All queries are eager and sequential by default. There is no lazy evaluation or query planner. However, intermediate steps can be composed into reusable macros or dictionary-defined words. Table traversal follows the same semantics as any sequence pipeline: pull-based, statically compiled, and streamable.

Because views are functions, query stages can be compiled as inlined code that directly references the underlying buffer. There is no need for wrapper objects or reflection. This gives Tacit tables performance characteristics similar to flat arrays, while maintaining the expressiveness of symbolic access.

Query results are not tied to the source table. A projected or filtered output can be emitted into a new buffer, pushed onto the stack, or further processed inline. This decoupling allows queries to act as standalone data transformations.

## 7. Tables as Mutable Structures

Tacit tables are not static datasets. Although Tacit does not favor mutation generally, tables are designed to support structured, bounded mutation where appropriate—particularly insertion, deletion, and appending of rows. This allows tables to serve as dynamic working sets, staging areas, or accumulators within a pipeline.

At the lowest level, a table is a buffer paired with a row view (either positional or symbolic). The buffer may contain spare capacity at the end, permitting in-place appending without reallocation. The row shape is fixed for the lifetime of the table, but the row count may grow or shrink.

Insertion involves writing a new row’s values into the buffer at the next available position, updating the internal count or cursor. Deletion removes a row either by marking it or by shifting subsequent rows down. In most cases, logical deletion (e.g. setting a null flag) is preferred, since it avoids unnecessary copying and preserves row indices.

Appends are the most common form of mutation. A writer coroutine may emit rows into a shared table buffer using a pointer maintained in metadata. Each append writes a complete row—ensuring shape integrity—then increments the write pointer. If the table reaches capacity, it may emit a signal or wrap around (in circular buffer mode). However, reallocation is not automatic; tables grow only when explicitly resized by the program.

Mutation of individual fields is discouraged but permitted where local correctness is assured. This includes overwriting values in an existing row, or updating an accumulator field during reduction. Field mutation should be treated as a last-resort optimization or low-level effect.

Tables use metadata headers to track mutable cursors. These include the write pointer, optional read pointer (for queues), and total row count. These values are stored in the buffer’s header area and updated atomically by the mutating code. This design avoids global locks or shared memory state.

## 8. Conclusion

Tacit records and tables offer a principled, low-overhead way to represent structured data using the same foundations as arrays and buffers. A record is a functional view over a vector, translating symbolic field names into slot indices. A table is a collection of such records, backed by a buffer and shaped by a view that defines row structure.

Unlike traditional object systems, Tacit makes no assumptions about field types, mutability, or dynamic dispatch. Records are just views—functions that map names to indices—and tables are just buffers with row views and optional metadata to support traversal, indexing, or appending.

This design allows Tacit to treat data layout as a matter of view semantics rather than structural inheritance. Tables can hold rows as vectors or as record instances. Records can be queried, composed, and projected like functions. All views, including array views, row views, and record mappings, obey the same rules of offset calculation and shape enforcement.

By keeping records and tables grounded in buffers and views, Tacit enables compact, efficient, and statically analyzable data structures. The language avoids heap allocation, avoids closures, and minimizes runtime dispatch. Instead, data access is defined by view semantics, and composition happens by layering and reuse of these view definitions.

Validation, mutation, and optionality are left as higher-level concerns. If needed, they can be layered on via schema views, tagged values, or externally defined validation functions. But at the core, Tacit’s record and table model is declarative, deterministic, and shape-driven—ideal for systems where performance, predictability, and clarity matter more than dynamic flexibility.
