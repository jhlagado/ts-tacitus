## 1. Introduction

### 1.1 Purpose and Scope

This document describes the design and implementation principles of local variables in Tacit, focusing on their dynamic nature, storage, and lifecycle within the virtual machine. Local variables are fundamental to function execution, serving as the primary means of holding temporary data, including scalar values, pointers, and—crucially—buffers, which represent collections of data as first-class entities.

### 1.2 Local Variable Model

Tacit's local variable model uses a buffer-centric paradigm where buffers are essential primitives that support complex data structures, including arrays and records. Buffers can reside both locally and in other storage contexts. This approach uses stack-local, arena-like buffer management rather than heap-based memory management and reference counting.

### 1.3 Design Goals

The main goals guiding the design of local variables are:

* **Efficiency:** Minimal runtime overhead by pre-allocating storage when possible and avoiding complex heap interactions.
* **Flexibility:** Support for both simple scalar values and complex buffers without sacrificing clarity or performance.
* **Determinism:** Compile-time resolution of variable locations while allowing runtime dynamic sizing where necessary.
* **Simplicity in Cleanup:** Avoidance of reference counting to simplify stack cleanup and lifecycle management.
* **Alignment with Multitasking:** Local variables must coexist cleanly with Tacit's multitasking and resumable function model.

## 2. The Role and Nature of Local Variables in Tacit

### 2.1 Overview

Local variables in Tacit are the primary means of storing intermediate and persistent state within functions. Unlike languages that treat locals solely as scalars, Tacit elevates buffers—contiguous memory regions—to first-class local variables. This approach allows efficient handling of arrays, records, and complex data structures directly within a function's local frame.

### 2.2 Declaration and Layout

Local variables are statically declared at compile time, but sized at runtime. This approach allows for dynamic allocation of buffers while maintaining the ability to reference variables by their slot indices. Each local variable is assigned a slot in the variable table, ensuring consistent access during execution.

### 2.3 Buffers as Local Variables

Buffers as locals can represent a variety of data types, from simple byte arrays to multi-dimensional arrays and tables with associated shape metadata. The shape remains constant through the buffer's lifetime, supporting efficient memory allocation and manipulation using stack-based allocation.

### 2.4 Compiler Responsibilities

The compiler maps local variable names to slot indices within the variable table. This mapping allows code generation to reference variables by their index, keeping runtime access efficient and type-safe.

## 3. Symbol Handling and Dictionary Management

### 3.1 Role of the Dictionary in Compilation

The compiler maintains a dictionary that maps symbol names to their corresponding slots in the local variable table. This dictionary is essential for resolving references to local variables during the compilation of a function.

### 3.2 Dictionary Marking and Scope Boundaries

When compiling a function or other lexical scope, the compiler marks the current state of the dictionary. As local variables are declared within the scope, they are added to the dictionary with information about their slot assignments. The dictionary maintains this scope boundary information to properly handle nested scopes and distinguish between locals and other symbols.

### 3.3 Symbol Resolution During Code Generation

When the compiler encounters a reference to a local variable symbol in the function code, it looks up the symbol in the dictionary to determine its assigned slot index. The compiler then generates code that accesses the variable using this index in the variable table, replacing symbolic names with numeric slot references.

## 4. The Variable Table and Memory Layout

### 4.1 Overview of the Variable Table

The variable table is the core abstraction for managing local variables in Tacit. It stores all local variables as tagged values in a uniform structure at the beginning of a function's stack frame. Each slot in the table can contain:

* **Scalar values** (integers, floats, etc.) encoded directly within the tagged value
* **NIL values** for unassigned variables, maintaining type safety
* **Tagged pointers** to buffers and complex structures allocated in the stack region above the table
* Other **specialized tags** for specific Tacit types

This table allows variables to be dynamically assigned locations at runtime, decoupling compile-time symbol resolution from concrete memory addressing while minimizing access overhead.

### 4.2 Return Stack Memory Layout

The function's local storage on the return stack follows a specific layout:

```
Lower addresses
+----------------+ <- Base Pointer (BP)
| Length         |    
+----------------+
| Tagged Value   |    Variable Table
| Tagged Value   |    (Each slot contains a NaN-boxed tagged value
| ...            |     representing scalars or pointers to buffers)
+----------------+
| Buffer Data    |
| Buffer Data    |    Buffer Allocation Region
| ...            |    (Contiguous memory above the table)
+----------------+ <- Return Stack Pointer (RSP)
Higher addresses
```

This layout ensures that all local storage—both the variable table and any allocated buffers—can be reclaimed with a single stack pointer adjustment when the function exits.

### 4.3 Binding Symbols to Slots

During compilation, each symbolic variable name is assigned an index into the variable table. At runtime, these indices are used to access and update the corresponding slot, ensuring efficient variable access based on table indices rather than memory offsets.

### 4.4 Assignment and Mutation Rules

Tacit enforces specific rules for variable assignment and mutation to ensure memory integrity:

* **Scalar variables** can be freely reassigned to new values
* **Buffer variables** can be initialized only once and cannot be reassigned to different buffers
* **Buffer contents** can be mutated in-place after initialization

These rules ensure that buffers allocated in the stack region maintain their allocated positions, preventing fragmentation and ensuring that all memory above the variable table forms a contiguous, ordered region. This simplifies cleanup and supports bump allocation for new buffer data.

## 5. Variable Initialization and Lifetime

### 5.1 Variable Table Structure and Access

The variable table begins with a length field that indicates the number of local variables. This allows the runtime system to efficiently traverse all locals for operations like cleanup and promotion. 

When a function is called, a new stack frame is created with space for the variable table. The BP (base pointer) marks the bottom of this frame, while the RSP (return stack pointer) marks the top, which grows as buffers are allocated.

### 5.2 Initialization Strategy

Local variables are initialized at runtime when they are first assigned. The variable's slot in the table receives a tagged value appropriate to the data being stored. This dynamic initialization enables flexible handling of buffers and scalars, whose sizes may vary or are not known until execution time.

For buffers, initialization involves allocating memory in the stack region above the variable table, setting up any necessary metadata (like shape information), and storing a tagged pointer to this memory in the variable's slot. Scalar values are encoded directly in the slot using NaN-boxing.

### 5.3 Lifetime and Cleanup

The lifetime of local variables is tied to the lifespan of the function call stack frame. When the function terminates or yields, the system cleans up local variables by iterating over the variable table and handling each resource appropriately. Because locals are represented as tagged values, the cleanup logic can be uniform and type-aware, responding differently based on the tag.

Cleanup is simplified: resetting the stack pointer to the base pointer effectively frees all locals, avoiding the need for reference counting or garbage collection.

### 5.4 Promotion and Scope Interaction

In some cases, local variables may need to persist beyond their original function call, particularly in coroutines and suspended functions. The variable table facilitates this by allowing the runtime to identify and promote specific locals to parent contexts or other storage when needed.

## 6. Variable Access and Operations

### 6.1 Scalar Variable Access

Scalar variables are accessed directly through their slot in the variable table. The runtime decodes the tagged value to determine its type and retrieve the encoded value. This unified access pattern supports type checking and ensures consistent handling of all scalar types.

### 6.2 Buffer Access and Manipulation

Buffers are accessed via their tagged pointers stored in the variable table. The pointer leads to the buffer's base address on the stack, where data can be read or written. Buffer operations include:

* **Indexing** into specific elements
* **Slicing** to create logical views of buffer regions
* **Mutation** of buffer contents within the allocated capacity
* **Metadata access** for shape, type, and capacity information

Buffers support different shapes and element types, enabling operations on arrays, records, and more complex data structures.

### 6.3 Tagged Value Operations

The use of tagged values enables precise type checking and specialized operations based on the value type. The runtime can perform operations like:

* Type checking before operations
* Type-specific arithmetic and comparison
* Conversion between different representations
* Specialized handling for non-scalar types and pointers

## 7. Buffer Architecture and Management

### 7.1 Buffer Structure and Organization

Buffers are contiguous memory regions allocated on the return stack with:

* Base address (referenced via tagged pointer)
* Shape metadata (dimensions, type information)
* Content area (the actual data storage)
* Optional capacity management for dynamic operations

They can represent various structures including arrays, records, tuples, and tables with associated metadata.

### 7.2 Buffer Variants

Several buffer variants support different use cases:

* **Fixed-size buffers**: Simple, statically sized blocks with length equal to capacity
* **Appendable buffers**: Dynamic buffers with separate size and capacity tracking
* **Shaped buffers**: Buffers with associated shape descriptors for multi-dimensional data
* **Record buffers**: Structured data with named fields and type information

### 7.3 Buffer Views and Shapes

Buffers do not intrinsically impose multi-dimensional structure. Instead, views and shapes provide a functional interface interpreting the linear data as multi-dimensional arrays, records, or tables. Buffer management interacts closely with these descriptors to correctly index, slice, and reshape the data.

## 8. Multitasking Integration

### 8.1 Task Lifecycle and Variable Management

The Tacit task scheduler manages lightweight tasks by maintaining a list of active functions that yield control cooperatively. Tasks share a single large return stack, avoiding heavy VM overhead.

For resumable functions, the variable table persists across yields/suspensions, and cleanup is deferred until all resumptions complete. Variables may be promoted to parent scopes when needed.

### 8.2 Stack Management

Local variables are allocated before yielding. The stack pointer is reset to the base pointer only after all dependent tasks have terminated, ensuring proper cleanup without fragmentation.

This design supports a lightweight model that avoids multiple full VMs or heaps, focusing on efficiency and simplicity while supporting concurrency through controlled cooperative multitasking.

## 9. Conclusion

Tacit's local variable system provides a unified approach to managing both scalar values and complex data structures within a function's execution context. Through the variable table with tagged values, it achieves a balance between compile-time resolution and runtime flexibility.

This system has several key advantages:

* **Unified representation**: All variable types share a common tagged value format
* **Stack-based allocation**: Efficient memory use without fragmentation
* **Simple cleanup**: Atomic reclamation of all locals with a single operation
* **Type safety**: Runtime type checking via the tag system
* **Support for complex data**: First-class buffer handling

By building on this foundation, Tacit achieves a minimalist but powerful approach to local variable management that aligns with its overall design philosophy of simplicity, performance, and expressiveness.
