# Local Variables

## Table of Contents

- [1. Introduction](#1-introduction)
  - [1.1 Purpose and Scope](#11-purpose-and-scope)
  - [1.2 Local Variable Model](#12-local-variable-model)
  - [1.3 Design Goals](#13-design-goals)
- [2. The Role and Nature of Local Variables in Tacit](#2-the-role-and-nature-of-local-variables-in-tacit)
  - [2.1 Overview](#21-overview)
  - [2.2 Declaration and Layout](#22-declaration-and-layout)
  - [2.3 Buffers as Local Variables](#23-buffers-as-local-variables)
  - [2.4 Compiler Responsibilities](#24-compiler-responsibilities)
- [3. Symbol Handling and Dictionary Management](#3-symbol-handling-and-dictionary-management)
  - [3.1 Role of the Dictionary in Compilation](#31-role-of-the-dictionary-in-compilation)
  - [3.2 Dictionary Marking and Scope Boundaries](#32-dictionary-marking-and-scope-boundaries)
  - [3.3 Symbol Resolution During Code Generation](#33-symbol-resolution-during-code-generation)
- [4. The Variable Table and Memory Layout](#4-the-variable-table-and-memory-layout)
  - [4.1 Overview of the Variable Table](#41-overview-of-the-variable-table)
  - [4.2 Return Stack Memory Layout](#42-return-stack-memory-layout)
  - [4.3 Binding Symbols to Slots](#43-binding-symbols-to-slots)
  - [4.4 Assignment and Mutation Rules](#44-assignment-and-mutation-rules)
- [5. Variable Initialization and Lifetime](#5-variable-initialization-and-lifetime)
  - [5.1 Variable Table Structure and Access](#51-variable-table-structure-and-access)
  - [5.2 Initialization Strategy](#52-initialization-strategy)
  - [5.3 Lifetime and Cleanup](#53-lifetime-and-cleanup)
- [6. Variable Access and Operations](#6-variable-access-and-operations)
  - [6.1 Scalar Variable Access](#61-scalar-variable-access)
  - [6.2 Buffer Access and Manipulation](#62-buffer-access-and-manipulation)
  - [6.3 Tagged Value Operations](#63-tagged-value-operations)
- [7. Buffer Architecture and Management](#7-buffer-architecture-and-management)
  - [7.1 Buffer Structure and Organization](#71-buffer-structure-and-organization)
  - [7.2 Buffer Variants](#72-buffer-variants)
  - [7.3 Buffer Views and Shapes](#73-buffer-views-and-shapes)
- [8. Multitasking Integration](#8-multitasking-integration)
- [9. Conclusion](#9-conclusion)

## 1. Introduction

### 1.1 Purpose and Scope

This document outlines the design of local variables in Tacit, emphasizing their stack-based nature, dynamic allocation model, and integration with function execution. Local variables are used to hold transient data such as scalars, references, and buffers—where buffers represent structured, indexable data like arrays or records. The design avoids heap-based storage in favor of structured stack allocation and disciplined lifetimes.

### 1.2 Local Variable Model

Local variables in Tacit include both scalars and buffers. Buffers are treated as first-class entities and form the foundation for complex data structures. Unlike heap-oriented models, Tacit uses stack-local buffer allocation with arena-style discipline: buffers are initialized into a contiguous region above the function’s variable table, avoiding fragmentation and simplifying cleanup.

Each function allocates a local variable table on the return stack. This table holds tagged values corresponding to variables, including references to any buffers allocated in the region immediately above the table. Scalars are stored directly in the table using tagged values; buffers are represented by pointers with associated shape metadata.

### 1.3 Design Goals

Tacit’s local variable system is built on the following goals:

Efficiency is achieved by compiling all slot indices at build time and avoiding dynamic lookup or heap allocation. Buffers reside close to the function call site, minimizing overhead.

Flexibility is maintained by allowing both scalar and structured data in the same table, with runtime sizing for buffers where necessary. Buffer contents may be mutated in place after allocation.

Determinism is enforced by fixed slot indices and by constraining all allocation and initialization to occur before the first yield. This ensures predictable layout and behavior.

Simplicity in cleanup is realized through stack discipline. When a function exits, its entire frame—including variables and buffers—is discarded in a single operation by resetting the return stack pointer to the base pointer.

Alignment with multitasking is ensured by isolating local storage per function and disallowing cross-frame references. This guarantees safety in the presence of coroutines and nested stack frames.

## 2. The Role and Nature of Local Variables in Tacit

### 2.1 Overview

Local variables in Tacit provide structured, per-function state. Unlike scalar-only models, Tacit supports both immediate values and structured buffers as first-class locals. Buffers are essential for expressing arrays, records, and shaped data, and are allocated above the variable table on the return stack. Each buffer remains local to the function that allocated it and cannot be moved or reassigned.

This unified model avoids heap interaction and keeps all transient state close to the function frame. Locals form the backbone of compiled sequences, coroutine stages, and pipelines by enabling stack-persistent, shape-aware state without closures or garbage collection.

### 2.2 Declaration and Layout

All local variables are statically declared at compile time and assigned a numeric slot index in the function’s variable table. Scalars occupy the slot directly; buffers are initialized at runtime and referenced via tagged pointers stored in their slot.

The variable table is a flat region at the base of the function’s return stack frame. It contains tagged values for all declared variables, with buffers allocated upward from the top of the table. This layout supports fast access and cleanup via fixed slot indexing and LIFO buffer lifetime.

### 2.3 Buffers as Local Variables

A buffer is an unboxed memory region coupled with shape metadata, representing an array, record, or structured sequence. When a buffer is declared as a local, it is allocated into the stack above the variable table and its tagged pointer is stored in the assigned slot.

Buffers are initialized once per frame and persist until the function exits. They may be indexed, sliced, or mutated in place. The buffer’s shape remains constant across its lifetime, simplifying access patterns and ensuring alignment with the surrounding multitasking environment.

### 2.4 Compiler Responsibilities

The compiler assigns each variable a slot index at compile time. This index is used throughout code generation to emit direct slot references for reads, writes, and buffer access. Symbolic variable names are resolved during compilation and discarded; only numeric slot references remain at runtime.

The compiler also ensures that all buffers are initialized before any yield can occur, enforcing linear, safe allocation discipline and preventing mid-frame mutation of structure. This simplifies runtime enforcement and aligns with Tacit's coroutine execution model.

## 3. Symbol Handling and Dictionary Management

### 3.1 Role of the Dictionary in Compilation

During function compilation, Tacit maintains a symbol dictionary that maps variable names to slot indices in the variable table. This dictionary is used only at compile time and discarded before execution. It ensures that all variable references are statically resolved and translated into efficient slot-based access operations.

The dictionary enables shadowing and nested scopes, maintaining separation between global symbols, lexical variables, and local bindings. It provides the symbolic resolution needed to convert human-readable source code into compact, index-driven bytecode.

### 3.2 Dictionary Marking and Scope Boundaries

When entering a new lexical scope—typically at the start of a function—the compiler marks the current dictionary state. New local variable declarations extend this dictionary with slot assignments. Upon scope exit, the dictionary reverts to its previous state, preserving outer bindings and discarding any shadowed variables or temporary entries.

This mechanism provides consistent scoping and prevents accidental collisions between local and global names. It also permits nested function definitions and future macro expansion systems to manipulate local scope boundaries without interfering with the global symbol table.

### 3.3 Symbol Resolution During Code Generation

When the compiler encounters a variable reference during code emission, it performs a lookup in the current dictionary. If the symbol corresponds to a declared local, its slot index is retrieved and embedded into the generated code. This numeric index is then used at runtime to access the correct location in the variable table.

This final mapping step ensures that all variable access is position-based, allowing the runtime system to operate without symbol resolution or hash table lookups. The compiled code thus executes efficiently, with all variable usage reduced to simple table lookups by index.

## 4. The Variable Table and Memory Layout

### 4.1 Overview of the Variable Table

The variable table is the primary mechanism for managing local variables in Tacit. It occupies the lowest portion of each function’s stack frame and contains a fixed number of slots, each holding a tagged value. These slots represent the storage for all scalar and reference-type locals declared in the function.

Each slot can contain:

* A scalar value (e.g., float or integer) encoded directly in the tagged value
* A tagged NIL indicating an uninitialized or absent value
* A reference to a buffer allocated above the table in the same stack frame
* Other special tagged values representing complex structures or system types

The table's uniform structure supports efficient variable access by slot index, dynamic type dispatch, and systematic cleanup.

### 4.2 Return Stack Memory Layout

The layout of the return stack during function execution is structured as follows:

```
Lower addresses
+----------------+ <- Base Pointer (BP)
| Length         |
+----------------+
| Tagged Value   |    ← Variable Table
| Tagged Value   |
| ...            |
+----------------+
| Buffer Data    |    ← Buffer Allocation Region
| Buffer Data    |
| ...            |
+----------------+ <- Return Stack Pointer (RSP)
Higher addresses
```

This organization ensures that both scalar values and associated buffers are stored within a single contiguous region of memory. The variable table is accessed by slot index from BP, while buffer allocations grow upward from the end of the table.

### 4.3 Binding Symbols to Slots

During compilation, each local variable name is assigned a unique index corresponding to a slot in the variable table. These slot indices are embedded in the emitted code for variable access. At runtime, variable operations refer directly to these indices rather than names or offsets, enabling fast access and compact representation.

This slot-based model separates naming concerns from runtime execution and allows the compiled bytecode to be entirely name-independent.

### 4.4 Assignment and Mutation Rules

Tacit enforces the following rules to preserve stack integrity and support deterministic cleanup:

* **Scalar variables** can be reassigned freely. Their slot may be updated with new tagged values at any time.
* **Buffer variables** may only be initialized once. They are immutable with respect to their memory reference but support in-place mutation of contents.
* **Buffer contents** may be modified after initialization, but the reference itself remains fixed.

This discipline guarantees that all allocated buffers remain within a fixed stack region above the variable table. No buffer can be moved or reassigned, preventing fragmentation and ensuring all memory is linearly reclaimable at function exit.

## 5. Variable Initialization and Lifetime

### 5.1 Variable Table Structure and Access

Each function call establishes a stack frame containing a variable table, initialized with a length field followed by a fixed number of tagged slots. These slots hold either scalar values, NILs, or references to buffer data located above the table.

The base pointer (BP) marks the start of this region, while the return stack pointer (RSP) grows upward as buffer memory is allocated. This organization enables direct indexing of variable slots and linear bump-style allocation of any required storage for complex types.

Access to variables is always mediated through their slot index, determined at compile time. Runtime code reads and writes tagged values in these slots, using tag bits to distinguish between types.

### 5.2 Initialization Strategy

Local variables are initialized lazily at runtime. Scalar values may be assigned directly to their table slot. Buffer variables, when first initialized, allocate memory above the variable table and store a tagged reference in their assigned slot.

Each buffer is allocated contiguously, with any associated metadata (e.g., shape descriptors) placed alongside or within the same region. Tagged references are used to identify the buffer's base address and type.

This strategy allows buffer size and shape to be determined dynamically at runtime, while maintaining full compatibility with the variable table model. Once initialized, buffer variables are fixed: their reference may not be reassigned, though the contents they point to may be mutated.

### 5.3 Lifetime and Cleanup

Local variables and their buffers are deallocated together at function termination. This is achieved by resetting the return stack pointer (RSP) to the stored base pointer (BP), which reclaims all storage above the base, including buffers and the variable table itself.

No reference counting or explicit destructor logic is required. This model supports safe and efficient function exits, even in the presence of complex data structures, as long as all buffer allocations occur strictly above the variable table and are never shared across frames.

Cleanup is deterministic, fast, and stack-local, in keeping with Tacit's emphasis on minimal runtime overhead.

## 6. Variable Access and Operations

### 6.1 Scalar Variable Access

Scalar variables are stored directly in the variable table as tagged values. These include integers, floats, booleans, and special constants such as NIL. Tagged encoding allows each value to be type-checked at runtime and interpreted according to its tag.

Access is performed by indexing into the table at the slot associated with the variable, as determined at compile time. Read and write operations are performed directly on the tagged value. Mutation of scalars is permitted at any time, and reassignment replaces the existing value.

The tag mechanism ensures consistent and type-safe handling of all scalar types, while the use of a fixed slot table allows constant-time access with minimal instruction overhead.

### 6.2 Buffer Access and Manipulation

Buffers are referenced via tagged values in the variable table. These tagged entries contain pointers to the buffer's location in the stack region above the table. Buffer contents reside in a compact, contiguous memory block allocated at the time of initialization.

Access to buffer elements requires decoding the reference from the tagged value, locating the buffer’s base address, and interpreting the layout based on metadata. Typical operations include:

* Reading or writing elements at an indexed offset
* Creating logical views (slices or lenses) over portions of the buffer
* In-place mutation of elements
* Accessing metadata such as shape or capacity

While buffer variables themselves are immutable after initialization (their reference is fixed), the contents of the buffer can be freely modified as long as they remain within the allocated bounds.

### 6.3 Tagged Value Operations

All local variables—scalars and buffers—are uniformly managed as tagged values. This enables the runtime to inspect, dispatch, and manipulate variable contents in a type-aware fashion. Common operations include:

* Checking the tag before performing arithmetic or comparisons
* Dispatching type-specific logic (e.g., distinguishing between integer and float math)
* Converting between tags where coercion is required
* Detecting NIL values and uninitialized entries

Tagged values form the core runtime representation for all local data in Tacit. This unified model simplifies the interpreter, enforces type discipline, and allows compact and fast operations across the entire local variable space.

## 7. Buffer Architecture and Management

### 7.1 Buffer Structure and Organization

Buffers in Tacit are linear memory regions allocated on the return stack above the variable table. Each buffer is represented by a tagged value in the table that holds a reference to its base address. The buffer structure includes:

* A header containing shape or capacity metadata
* A contiguous memory region for element storage
* Optional control flags for dynamic behavior (e.g., appendable)

This structure supports efficient allocation, access, and cleanup using stack-local memory. Since buffers are allocated above the variable table, they are automatically reclaimed when the function stack frame is exited.

### 7.2 Buffer Variants

Tacit supports several buffer types to accommodate a range of usage patterns:

* **Fixed-size buffers** are pre-allocated with a known length and cannot grow.
* **Appendable buffers** track both current size and maximum capacity, supporting efficient incremental writes.
* **Shaped buffers** store multi-dimensional metadata for array-style access.
* **Record buffers** maintain structured fields with type and name metadata, suitable for tabular or schema-driven data.

Each buffer variant shares a common memory layout and header format, allowing generic access patterns while enabling specialized behavior when required.

### 7.3 Buffer Views and Shapes

Tacit separates physical buffer storage from logical structure. Views interpret raw buffer contents as structured data—such as arrays, records, or tables—based on associated shape metadata. This shape data includes dimensions, strides, and field descriptors.

Views can be composed, sliced, or transformed without modifying the underlying buffer. This enables powerful abstractions such as lenses, array slices, and field projections, all implemented through metadata and index calculation rather than copying.

The combination of flat storage and structured views supports high-performance, low-overhead operations on complex data, and enables functional composition over local structures.

## 8. Multitasking Integration

Tacit’s local variable system is designed to integrate seamlessly with its coroutine-based multitasking model. All coroutine tasks share a single global return stack, with each task occupying a distinct contiguous region. Local variables, including buffers, are allocated within a coroutine’s stack frame and are tightly scoped to that coroutine’s lifetime.

Each coroutine stack frame contains:

* A base pointer marking the start of the variable table
* A variable table storing scalar and reference-type locals
* A buffer allocation region above the table for any buffers needed during execution

Because coroutines yield cooperatively, each one resumes execution in a well-defined state, preserving all local variables between yields. No additional heap-based context switching is required. Buffers and scalars remain valid across yields, and no relocation occurs.

When a coroutine terminates, its stack frame is cleaned up in LIFO order. This means that a coroutine must not exit until all child coroutines spawned after it have also completed. The task scheduler enforces this constraint to ensure that local variables are never accessed after their owning coroutine has been deallocated.

This model enables extremely lightweight concurrency with minimal memory overhead, making it ideal for systems with constrained resources. All local variable storage is tightly bounded, and cleanup is deterministic and atomic.

## 9. Conclusion

Tacit’s local variable system offers a coherent, stack-based model for managing both scalar values and complex data structures. By combining static symbol resolution with runtime dynamic sizing, it balances performance with flexibility. The use of a unified tagged value representation ensures that all types—scalars, buffers, and references—are treated consistently and safely.

Each function maintains a self-contained local memory region composed of a variable table and an adjacent buffer allocation area. This structure allows fast access to variables, deterministic cleanup, and compatibility with the coroutine multitasking system.

The model emphasizes:

* **Simplicity**: All memory is allocated and reclaimed using stack pointer adjustments. No garbage collection or reference counting is needed.
* **Power**: Buffers are first-class values, supporting arrays, records, and tables with metadata like shape and capacity.
* **Type safety**: Tagged values enable reliable runtime checking and allow polymorphic handling across variable types.
* **Predictability**: All allocation and cleanup patterns are statically analyzable and bounded in time and space.

Tacit’s local variable design reflects the language’s broader philosophy: direct control over execution, minimal runtime machinery, and a preference for statically structured systems that operate efficiently even on small machines.
