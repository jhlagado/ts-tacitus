## 1. Introduction

### 1.1 Purpose and Scope

This document describes the design and implementation principles of local variables in Tacit, focusing on their dynamic nature, storage, and lifecycle within the virtual machine. Local variables are fundamental to function execution, serving as the primary means of holding temporary data, including scalar values, pointers, and—crucially—buffers, which represent collections of data as first-class entities.

### 1.2 Evolution of Local Variables in Tacit

Tacit’s local variable model has evolved significantly from a simple scalar-and-pointer approach toward a buffer-centric paradigm. Buffers now are not just aggregates but essential primitives that support complex data structures, including arrays and records, and can reside both locally and in other storage contexts. This evolution reflects a shift away from traditional heap-based memory management and reference counting, favoring stack-local, arena-like buffer management.

### 1.3 Design Goals

The main goals guiding the design of local variables are:

* **Efficiency:** Minimal runtime overhead by pre-allocating storage when possible and avoiding complex heap interactions.
* **Flexibility:** Support for both simple scalar values and complex buffers without sacrificing clarity or performance.
* **Determinism:** Compile-time resolution of offsets when feasible, but allowing runtime dynamic sizing where necessary, particularly for buffers.
* **Simplicity in Cleanup:** Avoidance of reference counting to simplify stack cleanup and lifecycle management.
* **Alignment with Multitasking:** Local variables must coexist cleanly with Tacit’s emerging multitasking and resumable function model.

### 1.4 Conclusion

The design of local variables in Tacit lays a foundation for efficient and versatile storage within function execution. By treating buffers as first-class citizens alongside scalars and pointers, Tacit enables flexible data management while maintaining simple, deterministic memory handling. This approach supports robust multitasking and resumable functions, ensuring local variable management integrates smoothly with Tacit’s core execution model.

## 2. The Role and Nature of Local Variables in Tacit

### 2.1 Overview

Local variables in Tacit are the primary means of storing intermediate and persistent state within functions. Unlike languages that treat locals solely as scalars, Tacit elevates buffers—contiguous memory regions—to first-class local variables. This approach allows efficient handling of arrays, records, and complex data structures directly within a function’s local frame.

### 2.2 Static Declaration and Layout

Local variables are statically declared and sized at compile time. This enables precise calculation of their offsets within the stack frame. Each local, scalar or buffer, occupies a contiguous region, allowing fast, predictable access during execution with fixed offset addressing.

### 2.3 Buffers as Local Variables

Buffers as locals can represent a variety of data types, from simple byte arrays to multi-dimensional arrays and tables with associated shape metadata. The shape remains constant through the buffer’s lifetime, supporting efficient memory allocation and manipulation without reliance on a separate heap.

### 2.4 Compiler Responsibilities

The compiler maps local variable names to fixed offsets within the stack frame. This mapping allows code generation to use simple pointer arithmetic for variable access, keeping runtime overhead minimal and predictable.

### 2.5 Dynamic Initialization

Local buffers support dynamic initialization through stack-based expressions. Using grouping operators, sequences of values can be collected at runtime and assigned to buffer variables. This design balances expressiveness with compile-time guarantees on memory layout and sizing.

## 3. Variable Table and Runtime Local Variable Management

### 3.1 Overview

In Tacit, local variables are managed dynamically at runtime rather than being fully pre-allocated at compile time. This approach is essential for supporting flexible data types, especially buffers and composite objects, whose sizes may not be known until execution.

Instead of directly binding variable names to fixed stack offsets during compilation, Tacit maintains a **variable table** at runtime. This table holds references — typically pointers or offsets — that map symbolic variable identifiers to their actual locations or resources.

### 3.2 Structure of the Variable Table

The variable table is a contiguous block of memory stored on the return stack near the base pointer (BP). It begins with a **length field** that indicates the total number of variables declared in the current function scope.

Following the length, each slot corresponds to one variable’s pointer or offset. This structure enables:

* Fast indexing of variables by their compiled slot number.
* Easy iteration during cleanup or promotion phases.
* Uniform access to local variables regardless of their underlying representation.

### 3.3 Flexibility of Tagged Values

Each entry in the variable table is a **tagged value** using IEEE 754 NaN-boxing, capable of representing:

* Direct scalar values like integers and floating point numbers
* NIL values for uninitialized variables
* Pointers to buffers and arrays stored in the stack region above the table
* References to string constants or other immutable resources
* Any other tagged entity recognized by the Tacit runtime

This unified value representation provides a consistent mechanism for accessing and type-checking various data types transparently, while encoding both simple and complex values in the same fixed-size slot.

### 3.4 Runtime Variable Initialization and Allocation

Variables are initialized lazily at runtime during function execution. When a variable is assigned a value for the first time:

* If its entry in the variable table is null or zero, the current return stack pointer is recorded as the variable’s storage location.
* The return stack pointer is then incremented (bumped) by the size of the assigned data, which can vary depending on whether the variable is a scalar, buffer, or complex structure.

This dynamic allocation model enables efficient management of local storage, particularly for buffers whose size and lifetime are controlled entirely at runtime.

### 3.5 Benefits of the Runtime Indirection Model

* **Dynamic sizing:** Supports arbitrarily sized buffers and structures without rigid compile-time constraints.
* **Simplified cleanup:** The variable table provides a direct index of live variables for cleanup or promotion.
* **Unified handling:** Both scalars and complex types use the same lookup mechanism, simplifying runtime code.
* **Extensibility:** New resource types can be integrated by extending tagging conventions without changing the underlying variable table logic.

## 4. Symbol Handling and Dictionary Management During Compilation

### 4.1. Role of the Dictionary in Compilation

The compiler maintains a dictionary that maps symbol names to their corresponding slots or offsets in the local variable table. This dictionary is essential for resolving references to local variables during the compilation of a function.

### 4.2. Dictionary Marking and Scope Boundaries

At the start of compiling a function, the compiler records the current position or marker within the dictionary. This marker defines the scope boundary for symbols introduced during the compilation of this particular function.

### 4.3. Adding Local Variable Symbols

As new local variables are declared within the function, their symbols are added to the dictionary and assigned unique slot numbers. These slot numbers correspond to the variable’s offset in the function’s local variable table, enabling efficient access at runtime.

### 4.4. Symbol Resolution During Code Generation

When the compiler encounters a reference to a local variable symbol in the function code, it looks up the symbol in the dictionary to determine its assigned slot. The compiler then generates code that accesses the variable at the fixed offset, replacing symbolic names with numeric positions.

### 4.5. Dictionary Restoration After Compilation

Upon completion of the function’s compilation, the dictionary is reset to the previously recorded marker. This discards all symbols that were added during the function’s compilation, ensuring they do not leak into other scopes or interfere with global symbols.

### 4.6. Benefits of Scoped Dictionary Management

This scoped dictionary management ensures a clean separation between function-local symbols and global or other function symbols. It simplifies incremental compilation and supports modularity by confining local variable symbol lifetimes to their function’s compilation duration.

## 5. The Variable Table and Runtime Binding

The variable table is the core runtime structure enabling dynamic local variable management within a function's stack frame. It provides direct storage for scalar values and references to buffers, supporting efficient access to both simple and complex data.

### 5.1 Structure and Purpose

At runtime, the variable table contains a sequence of slots, each holding a tagged value. The first slot contains the length of the table, indicating how many variables are declared. All values in Tacit use a uniform tagged representation based on IEEE 754 floating point with NaN-boxing, allowing each slot to contain:

* **Scalar values** (integers, floats, etc.) encoded directly within the tagged value
* **NIL values** for unassigned variables, maintaining type safety
* **Tagged pointers** to buffers and complex structures allocated in the stack region above the table
* Other **specialized tags** for specific Tacit types

This table allows variables to be dynamically assigned locations at runtime, decoupling compile-time symbol resolution from concrete memory addressing while minimizing access overhead.

### 5.2 Return Stack Memory Layout

The function's local storage on the return stack follows a specific layout:

```
Lower addresses
+----------------+ <- Base Pointer (BP)
| Length         |    
+----------------+
| Scalar/Pointer |    Variable Table
| Scalar/Pointer |    (Directly holds scalar values or
| ...            |     pointers to buffers)
+----------------+
| Buffer Data    |
| Buffer Data    |    Buffer Allocation Region
| ...            |    (Contiguous memory above the table)
+----------------+ <- Return Stack Pointer (RSP)
Higher addresses
```

This layout ensures that all local storage—both the variable table and any buffers—can be cleaned up atomically when a function exits by simply resetting the return stack pointer to the base pointer.

### 5.3 Binding Symbols to Slots

During compilation, each symbolic variable name is assigned an index into the variable table. At runtime, these indices are used to access and update the corresponding slot, ensuring efficient variable access without embedding fixed offsets in the generated code.

### 5.4 Assignment and Mutation Rules

Tacit enforces specific rules for variable assignment and mutation to ensure memory integrity:

* **Scalar variables** can be freely reassigned to new values
* **Buffer variables** can be initialized only once and cannot be reassigned to different buffers
* The **contents** of buffers can be modified through standard operations
* Only the **reference** to the buffer is immutable after initialization

These constraints prevent fragmentation in the stack region. If buffer reassignment were allowed, it could create "holes" in the contiguous memory area that would complicate cleanup and potentially waste space.

### 5.5 Cleanup and Benefits

The length field at the start of the table allows the runtime system to traverse all local variables systematically during cleanup or promotion. Since all variables are referenced through this table, the cleanup logic can be simple, efficient, and type-aware.

This approach to local variable management offers significant advantages:

* **Atomic cleanup**: When a function exits, all local variables and buffers are reclaimed in a single operation by resetting RSP to BP
* **Zero fragmentation**: The one-time buffer allocation policy ensures that memory remains contiguous
* **Minimal overhead**: Scalar values are accessed with minimal indirection
* **Predictable performance**: Memory allocation follows simple, deterministic patterns

## 6. Local Variables — Initialization and Lifetime

Local variables are the fundamental storage units within a function’s execution context. Unlike simple scalars, local variables in Tacit encompass buffers—first-class entities that represent collections of data with associated shapes. This broadens the traditional concept of locals beyond single values to include complex, structured storage.

### 6.1 Declaration and Allocation

Local variables are declared at compile time, creating symbolic bindings to slots in the variable table. This table itself is allocated dynamically at runtime as part of the function's stack frame setup. Each slot contains a tagged value using IEEE 754 floating point with NaN-boxing. These tagged values represent scalars directly (integers, floats) or contain pointers to buffers and other complex structures. This uniform representation enables efficient type checking while maintaining a consistent access model for all variable types.

The variable table starts with a length field, indicating the number of declared locals. This allows runtime systems to traverse all local variables for tasks such as cleanup or promotion.

### 6.2 Initialization

Variables can be initialized either with literal constants or with dynamic data computed at runtime. Initialization involves assigning values or pointers into the slots of the variable table. Buffers are allocated as needed, using runtime knowledge of size and shape. This dynamic initialization enables flexible and powerful local storage patterns.

### 6.3 Lifetime and Cleanup

The lifetime of local variables is tied to the lifespan of the function call stack frame. When the function terminates or yields, the system cleans up local variables by iterating over the variable table and handling each resource appropriately. Because locals are represented as tagged values, the cleanup logic can be uniform and type-aware, responding differently based on the tag.

Notably, without a traditional heap, cleanup is simplified: resetting the stack pointer to the base pointer effectively frees all locals, avoiding complex reference counting or garbage collection.

### 6.4 Promotion and Scope Interaction

Local variables can be promoted to parent scopes or shared with child functions, facilitated by the variable table and the uniform tagged value representation. This allows for dynamic lifetime extension and sharing of both scalar values and buffer references across function boundaries.

## 7. Local Variable Initialization and Lifetime Management

Local variables in Tacit are dynamic entities managed through the variable table and the return stack. This section explores how local variables are initialized, managed, and cleaned up during function execution, ensuring correctness and efficiency.

### 7.1 Initialization Strategy

Local variables are not statically allocated at function entry. Instead, initialization occurs dynamically at runtime. When a variable is first assigned, the runtime records its location in the variable table. This lazy initialization enables flexible handling of buffers and scalars, whose sizes may vary or be unknown at compile time.

### 7.2 Initialization Ordering and Constraints

To ensure predictable behavior, all local variable initializations must occur before any yielding or suspension points within the function. This rule prevents inconsistencies in the stack layout and simplifies cleanup. Any attempt to initialize locals after yielding triggers an exception, preserving stack integrity.

### 7.3 Lifetime Boundaries

The lifetime of local variables corresponds to the duration of the function call. However, the function may yield, temporarily suspending execution without cleaning up locals. Cleanup only occurs once the function fully terminates and the runtime resets the stack pointer based on the variable table.

### 7.4 Dynamic Allocation and Buffer Management

Buffers as local variables can grow or shrink during execution, with their updated pointers reflected in the variable table. The runtime supports appending or truncating buffer contents, allowing local variables to behave like bump-allocated arenas or flexible stacks.

### 7.5 Cleanup Protocol

When a function terminates, the runtime iterates over the variable table using its length to clean up all locals. Tagged pointers guide the cleanup process, distinguishing between scalars requiring no action and buffers or other resources requiring deallocation or release.

## 8. Accessing Local Variables and Buffers

### 8.1 Variable Access Protocol

Access to local variables and buffers is fundamental to function execution. Local variables are accessed via indices in the variable table, retrieving tagged values. Each tagged value may directly encode a scalar (integer, float) or contain a pointer to a buffer or complex structure. This unified access protocol ensures consistent handling of all variable types.

### 8.2 Tagged Value Interpretation
Each local variable reference yields a tagged value from the variable table. The runtime interprets this value based on its tag: direct scalar values are used as-is, while buffer pointers are followed to access the allocated memory. This tagging system enables type safety while maintaining efficient access for all variable types.

### 8.3 Buffer Access
Buffers are accessed via their base pointer and shape metadata. The shape guides indexing into the buffer, allowing for multidimensional data retrieval and manipulation. This structured access supports efficient operations on arrays, records, and tables.

### 8.4 Uniform Access Model
The uniformity of access for all variable types simplifies the compiler and runtime. By using a consistent tagged value representation for all local data, retrieved from a common variable table, the system efficiently handles both direct scalar values and references to complex data structures.

### 8.5 Summary
Local variable access relies on a variable table that maps names to tagged values. This design unifies all data types under a single access model, enabling efficient type checking, direct representation of scalar values, and references to buffer structures all within the same framework.

## 9: Dynamic Local Variable Management and Lifetime

### 9.1 Introduction
Local variables in Tacit are managed dynamically at runtime through a variable table, enabling flexible allocation and lifetime control. This approach supports varying sizes and types of locals, including first-class buffers.

### 9.2 Allocation Strategy
Rather than fixed compile-time allocation, local variables are assigned slots in the variable table during function execution. When a variable is first assigned, it receives a pointer to an allocated space, which can be scalar or buffer. This allows buffers of varying sizes to coexist with scalars seamlessly.

### 9.3 Lifetime and Cleanup
Variable lifetime is tied to the function activation. Cleanup involves resetting the stack pointer to the base pointer and optionally iterating the variable table to release or finalize referenced resources. Without reference counting, cleanup is simplified to stack pointer adjustment.

### 9.4 Interaction with Resumables
For resumable functions, local variable management must accommodate suspended execution states. The variable table persists across suspensions, maintaining pointers to local storage. Cleanup is deferred until all resumable activations referencing the locals have completed.

### 9.5 Implications for Compilation
This dynamic model requires the compiler to emit code that interacts with the variable table for all locals, rather than assuming static offsets. This shifts some responsibility to runtime but gains flexibility and simplifies stack frame management.

### 9.6 Summary
Dynamic local variable management in Tacit leverages a runtime variable table to support flexible, first-class buffers and scalars with simplified lifetime handling, providing a robust foundation for modern function execution.

## 10. **Section: Detailed Buffer Management**

Buffers are the fundamental building blocks of data storage in Tacit. At their core, a buffer represents a contiguous block of memory, allocated to hold elements of a specific type or shape. Buffers serve as the workspace for arrays, records, and other composite data structures, making their management critical for performance and flexibility.

### 10.1 Allocation and Capacity
Buffers are allocated with a fixed capacity upfront, representing the maximum number of elements they can contain. This capacity is determined by the product of the shape’s element size and the number of elements requested. While the capacity is static, the *length* — the number of elements currently stored — can be dynamic and managed via a pointer or counter, enabling buffers to act as stacks, queues, or growable arrays.

### 10.2 Shape and Element Size
Each buffer is associated with a *shape* object, which defines the dimensionality and size of the elements it stores. The shape functions like a type descriptor, allowing the buffer to interpret its raw memory correctly. Importantly, shapes are immutable and global, ensuring consistency across buffers that share the same element type.

### 10.3 Buffer Variants
Several buffer variants support different use cases:

* *Fixed-size buffers*: simple, statically sized blocks with length equal to capacity.
* *Growable buffers*: include an internal pointer indicating the current length, enabling append/pop operations without reallocating.
* *Queues or ring buffers*: maintain separate read and write pointers to allow asynchronous consumption and production, wrapping around the allocated space.

### 10.4 Interaction with Local Variables
Buffers can be stored in local variables, providing a way to allocate arrays or records with well-defined lifetimes tied to function calls. Because buffers can be large and potentially growable, their allocation and cleanup require careful management, typically relying on bump allocation strategies or arenas, avoiding complex heap interactions.

### 10.5 Buffer Metadata and Overhead
To preserve efficiency, buffers carry minimal metadata: capacity, current length (if applicable), and a reference to their shape. No heap-based overhead is introduced unless explicitly necessary. This keeps the memory footprint low and operations fast.

### 10.6 Serialization and Deserialization
Buffers support serialization into a linear format suitable for storage or transmission and deserialization back into structured form. The shape vector guides the serialization process, ensuring that multidimensional and composite data are correctly interpreted.

### 10.7 Extensibility and Specialization
Buffers serve as a platform for specialized data structures. By implementing custom ‘do pointers’ or function pointers associated with buffers, it is possible to define bespoke behaviors such as dynamic resizing, reference counting (if needed), or specialized access patterns.

## 11 Detailed Buffer Management

### 11.1 Overview
Buffers form the fundamental storage unit in Tacit. They represent contiguous regions of memory capable of holding sequences of data elements. Effective buffer management is essential to support the language’s array-first design, enable flexible local variable storage, and facilitate efficient data manipulation without relying on a traditional heap.

### 11.2 Buffer Structure
Each buffer consists primarily of a contiguous memory area and associated metadata describing its size, capacity, and element layout. Buffers may be fixed-length or dynamically appendable, with mechanisms to track current usage versus allocated capacity. Metadata can also include a reference to a shape or type descriptor that governs element interpretation.

### 11.3 Allocation and Initialization
Buffers can be allocated either as local variables or passed as parameters to functions. Local buffers are allocated at runtime within the stack frame or arena, avoiding heap allocation. Initialization supports bulk loading of data from literals or other buffers, respecting element sizes and shapes.

### 11.4 Appendable Buffers
To enable dynamic data growth, buffers support append operations with capacity checks. When the buffer’s allocated capacity is reached, either further appends are disallowed or a larger buffer must be allocated and data migrated. Append operations update the buffer’s size metadata to track the number of valid elements.

### 11.5 Buffer Views and Shapes
Buffers do not intrinsically impose multi-dimensional structure. Instead, views and shapes provide a functional interface interpreting the linear data as multi-dimensional arrays, records, or tables. Buffer management interacts closely with these descriptors to correctly index, slice, and reshape the data.

### 11.6 Buffer Lifetimes and Cleanup
Buffers’ lifetimes are tied to their allocation context—typically the lifetime of the local variables or arenas that own them. Tacit’s design minimizes the need for explicit cleanup by favoring stack-based allocation patterns. Where buffers reference external resources or require special cleanup, metadata or protocols can indicate disposal needs.

## 12. Serialization and Deserialization

### 12.1 Purpose
Serialization converts Tacit’s core data structures—buffers, arrays, and trees—into linear streams for storage or transmission. Deserialization reconstructs these structures from such streams.

### 12.2 Pointer-Based Trees
Recursive structures are represented using embedded pointers within the stream, enabling efficient reconstruction without heap allocation. This pointer system supports hierarchical and nested data.

### 12.3 Integration with Buffers
Serialization behavior depends on buffer types and shapes, allowing polymorphic interpretation of the same stream as arrays, records, or trees.

### 12.4 Future Work
Detailed serialization protocols, including pointer-based tree formats, will be specified separately as the system evolves.

## 13. Task Scheduler and Cooperative Multitasking

### 13.1 Overview
The Tacit task scheduler manages lightweight tasks by maintaining a list of active functions that yield control cooperatively. Tasks share a single large return stack, avoiding heavy VM overhead.

### 13.2 Task Lifecycle
Tasks are created with allocated local variables and registered with the scheduler. They execute until they yield or terminate. Termination occurs only when it is safe to clean up the stack in call order.

### 13.3 Communication
Tasks communicate via message passing through a pub-sub system with optional event queues. This decouples task execution and enables asynchronous interaction without direct stack sharing.

### 13.4 Stack Management
Local variables are allocated before yielding. The stack pointer is only reset to the base pointer after all dependent tasks have terminated, ensuring proper cleanup without fragmentation.

### 13.5 Design Goals
This lightweight model avoids multiple full VMs or heaps, focusing on efficiency and simplicity while supporting concurrency through controlled cooperative multitasking.

## 14. Conclusion

This document has detailed the design principles and implementation strategies for local variables, buffers, serialization, and multitasking in Tacit. Buffers are the core primitive for data storage, enabling flexible and efficient memory management without a traditional heap. The cooperative multitasking system leverages a shared return stack with careful lifecycle control to support concurrent execution while minimizing overhead.

Together, these mechanisms form a cohesive, minimalistic foundation that emphasizes simplicity, performance, and extensibility. Future expansions will build on this foundation to support richer data types, serialization formats, and scheduling policies, always adhering to the core philosophy of streamlined, stack-oriented computation.

