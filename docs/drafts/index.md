### 1. **Memory and Storage Model**

- **buffers.md** – Defines the arena-based memory model. Buffers begin with a compact header (metadata count + optional fields), followed by user data. Supports stack, string, code, and legacy heap segments. Emphasizes bump allocation and buffer-local metadata. This is the foundation for all higher structures.
- **memory.md** – Expands the memory model to include local variables, list reassignment, and compaction. Describes brute-force strategies for value reassignment and when buffers should be used instead of lists. Introduces stack-segmented tagging (including the “stack bit” for buffer tags) and notes principles like recency-based compaction.

### 2. **Scalar and Value Semantics**

- **tagged-values.md** – Establishes Tacit’s tag-based type system. Tags identify value types (e.g., integer, float, string, buffer), support fast dispatch, and enforce strict typing. Also covers sentinel values like `nil`, segment identifiers, and mutability flags.
- **scalars.md** – Specifies primitive scalar types: numbers, Booleans, characters, and strings. Describes representation, arity, coercion, and tagging. Strings are immutable digests and represented by tagged references into the string segment.

### 3. **Data Grouping and Structure**

- **lists.md** – Defines lists as flat, tagged spans of values. Key features: value semantics, strict length, and group-level operations. Introduces list construction, access, copying, and use in pipelines.
- **records-and-tables.md** – Builds on lists to define records (keyed views over value vectors) and tables (collections of records or arrays). Clarifies that records are not structs; they are views. Tables support mutation, query, and insertion. Records are shaped via key→slot mappings.
- **arrays.md** – Treats arrays as views over flat vectors. Each array has a shape vector, optional offset, and defines index→offset mapping. Strides are derived from shape. Arrays are purely functional—mutation happens only at the buffer level.

### 4. **Computation and Control Flow**

- **local-variables.md** – Describes stack-local variables indexed by static slot. Locals are used to free the data stack during block execution. Buffers and lists can be assigned to locals, and all names are flat—no prefix or scope nesting.
- **coroutines.md** – Models coroutines as yield-based cooperative tasks. Key features: `spawn`, `yield`, `emit`, `join`, atomic fork-join coordination, and round-robin scheduling. Sentinels like `nil` are used for control signaling. Coroutine status is tracked for cleanup and lifecycle management.

### 5. **Composition and Declarative Programming**

- **sequences.md** – Formalizes declarative sequences using sources (e.g. `range`, `from-list`), transformers (`map`, `filter`, `take`, `discard`), and sinks (`to-array`, `for-each`). Emphasizes linear, compositional design with point-free blocks and block-scoped locals.
- **combinators.md** – Core reference for combinator-based logic. Introduces `fanout`, `fanin`, `list-map`, binary variants (`2fanin`, `2fanout`), and capsules. Capsules (lists ending in a function) can be called like functions. Also defines `then`, `else`, `if`, and multi-way branching using tagged conditionals.
- **style-guide.md** – Lays out stylistic rules: use single-line word definitions, avoid nesting, prefer point-free style, minimize stack manipulation, favor lists and combinators. Encourages bottom-up composition and tight, linear code structure.
- **overview\.md** – High-level introduction to Tacit’s design goals: functional dataflow, tagged value model, stack-based evaluation, minimal syntax, compositional logic. Sets the tone for the entire system.
