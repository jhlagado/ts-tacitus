# Memory

## Table of Contents
- [1. Arena-Based Memory Model](#1-arena-based-memory-model)
- [2. Segments and Arena Identity](#2-segments-and-arena-identity)
- [3. Allocation and Lifetime Semantics](#3-allocation-and-lifetime-semantics)
- [4. Value Semantics and Tuple Assignment](#4-value-semantics-and-tuple-assignment)
- [5. Reference Semantics and Buffer Behavior](#5-reference-semantics-and-buffer-behavior)
- [6. Tuple Value Semantics in Detail](#6-tuple-value-semantics-in-detail)
- [7. Reference Semantics and Buffer Assignment](#7-reference-semantics-and-buffer-assignment)
- [8. Scalars and Tagged Simple Values](#8-scalars-and-tagged-simple-values)
- [9. Copying, Reassignment, and Reuse](#9-copying-reassignment-and-reuse)
- [10. Compaction and Fragmentation Strategies](#10-compaction-and-fragmentation-strategies)
- [11. Closing Principles and Design Guidelines](#11-closing-principles-and-design-guidelines)

## 1. Arena-Based Memory Model

Tacit's memory management is grounded in the concept of arenas—contiguous, grow-only regions of memory that manage allocation through a simple bump-pointer strategy. Every context in Tacit, whether local variables, global storage, or dynamic buffers, can be understood as operating within an arena. This unifying model simplifies memory semantics across the language and reduces the need for complex garbage collection or reference tracking systems.

Arenas provide linear allocation with no internal deallocation until the entire region is reset or compacted. This strategy favors allocation speed and predictable performance, especially on constrained or embedded systems. Arenas also support metadata for managing internal layout, such as stack pointers or bump offsets, enabling stack-like behavior or segmented views within each region.

The arena model is foundational to Tacit’s philosophy of ownership, locality, and predictable resource use. It enables the language to treat buffers, tuples, and even entire stacks as consistent allocation domains, each following the same memory principles while allowing for contextual specialization.

## 2. Segments and Arena Identity

Tacit divides memory into four canonical segments: stack, string, code, and heap. Each segment is itself an arena, governed by the same bump allocation rules but serving distinct semantic roles. Tagged values that represent references—such as buffers or tuples—encode segment identity directly in their type tag, allowing runtime systems to interpret their origin, manage their lifetime, and apply appropriate constraints.

Stack-segmented arenas host local variables and transient tuples. These allocations are frame-local and cannot safely escape their context. Heap arenas hold globally allocated or long-lived values, often shared between tasks or passed across coroutine boundaries. Code segments contain immutable program data, including constants and precompiled tuples. String segments store unique, immutable digests that represent string values by reference.

Segment tagging allows Tacit to enforce memory safety and lifetime discipline without runtime garbage collection. For instance, a tuple allocated on the stack may not be reassigned to a global variable, and buffers allocated in heap arenas may be freely shared across scopes. Segment-aware tagging ensures that all memory operations are interpreted correctly, regardless of where the value originated.

## 3. Allocation and Lifetime Semantics

All memory in Tacit is allocated through bump allocation within arenas. Each arena maintains a cursor (or bump pointer) indicating the next free slot. When a value—such as a buffer or tuple—is created, space is carved out at the bump pointer and the pointer is incremented by the size of the allocation. This process is constant-time and requires no metadata traversal or pointer arithmetic beyond the arena's current position.

The lifetime of an allocation is determined by the arena in which it resides. Stack arena values exist only for the duration of the current frame. Once the frame ends, all its allocations are considered invalid, and no cleanup is needed beyond pointer reset. Heap allocations persist until explicitly released or the program ends. Code and string segment allocations are immutable and globally accessible for the duration of the program.

Tuple values are copied into the arena at the time of assignment. If reassigned later, the new value is written to a fresh allocation, leaving the old one unreferenced. This can lead to fragmentation in the arena. Because Tacit does not use garbage collection, any reuse of space must be handled manually through compaction or explicitly managed free lists. In the simplest case, reassignment always appends and never overwrites, ensuring safety at the cost of space.

Buffers follow the same allocation model but are typically designed to allow internal reuse: they often include their own bump pointer to enable append operations. This makes them ideal for building mutable, extensible data structures while preserving the immutability of tuples and values elsewhere in the language.

## 4. Value Semantics and Tuple Assignment

Tacit enforces value semantics for tuples by default. When a tuple is assigned to a variable, the entire structure—including its span and all contained values—is copied into the arena associated with that variable. This ensures that the assignment is isolated and does not create unintended references to mutable or shared memory.

A tuple assigned from the data stack to a local variable is treated as a fixed-size object. Although its contents may include reference types (e.g., buffers), the tuple itself is treated as a value. This means that reassignment does not mutate the existing memory but allocates a new region for the new tuple and updates the variable’s reference. Overwriting a tuple in-place is only permissible if the new value is the same size as the original. Otherwise, fragmentation or reallocation must be handled.

This model simplifies reasoning about ownership: the writer owns the new allocation; the old one becomes unreachable unless stored elsewhere. Mutating a tuple’s internal references (e.g., buffer fields) does not alter the tuple’s span or structure. However, if a tuple contains only value types, it can be treated as a self-contained, constant-sized unit and reused or optimized in the arena without additional reference tracking.

The consistency of value semantics across tuples improves predictability in function boundaries. Passing a tuple to a function from the stack copies the tuple’s content into the child function’s frame. Once consumed, the original reference is no longer valid in the parent scope. This avoids aliasing and ensures that tuples behave as pure data objects unless explicitly wrapped in a buffer or another reference-bearing construct.

## 5. Reference Semantics and Buffer Behavior

Buffers in Tacit are explicitly reference types. When assigned to a variable or passed between functions, only the reference is transferred, not the buffer’s contents. This distinction is central to how buffers are used for mutable or shared data structures like tables, queues, or large vectors.

Because buffers can grow, mutate, or be appended to, their lifetime and mutability must be managed carefully. Assigning a buffer to a local or global variable preserves its identity and structure. Any mutation via that reference is visible across all holders of the reference. Thus, buffers act as shared mutable arenas, contrasting with the isolated, copy-on-write behavior of tuples.

Unlike tuples, buffers are not automatically copied when reassigned. Instead, reassigning a buffer reference simply updates the variable to point to a different buffer. This means previous buffer instances remain alive until explicitly freed or fall out of scope. The system must therefore track buffer lifetimes either via ownership rules, scope-bound cleanup, or manual reclamation strategies.

When used as function parameters, buffers are always passed by reference. The callee receives a live pointer to the buffer and can read or mutate it directly. If isolation or immutability is required, the caller must create a copy beforehand. This pattern encourages explicit ownership management: if you intend to mutate, own or borrow the buffer intentionally.

Buffers can also contain other reference types, including tuples and nested buffers. However, the semantics of the outer buffer are always governed by reference rules. Mutation of the buffer does not clone or isolate its contents unless the program does so explicitly.

## 6. Tuple Value Semantics in Detail

Tuples in Tacit are treated as value types. They consist of a tagged `span` containing a length and a fixed sequence of values. When assigned to a variable, a tuple is copied by value. This applies whether the tuple originated on the stack, from a literal, or from the result of another operation. The destination variable receives a fresh allocation containing the tuple's content.

This value-copy model makes tuple reassignment semantically clean. Each assignment creates a new copy of the structure. The original instance remains unaffected unless manually deallocated or replaced. Tuple variables are therefore immutable in structure, though their elements may be mutated in place if needed.

Importantly, reading a tuple from a variable always pushes a copy onto the stack. No implicit reference is passed. This guarantees isolation between caller and callee when tuples are passed to functions. A callee consuming a tuple from the stack owns its copy outright, and any mutation does not affect the original binding.

When a tuple is reassigned to a variable, the old value is not overwritten in place. Instead, a new copy is allocated—typically via bump allocation—and the old memory is left behind. While simple, this approach introduces the potential for fragmentation. However, due to the short-lived nature of many tuples and the stack-oriented design, most old allocations become unreachable quickly, and memory reuse strategies can be applied.

If precise memory management is needed, the programmer may use buffers instead, which provide explicit reference semantics. But for most transient or intermediate structures, tuple value semantics are preferred. They avoid aliasing, reduce complexity, and enable efficient reuse when paired with copy-on-write strategies.

## 7. Reference Semantics and Buffer Assignment

Buffers in Tacit are reference types. When assigned to a variable or passed between functions, only the reference is copied, not the contents. This allows for shared mutation and efficient handling of large or growing data, but requires caution when managing lifetime, aliasing, and access patterns.

Assigning a buffer to a variable does not trigger a copy of its memory. The variable simply points to the same buffer, which may reside in a global arena, a local stack segment, or another buffer. If a buffer is read from a variable, the reference is pushed onto the stack—again, not its content—allowing the receiver to mutate or inspect it in place.

When modifying a buffer, additional context is usually required, such as an index or offset. Unlike tuples, which are copied whole, buffer assignments are not semantic replacements of content but references to a location. A function writing to a buffer may append, overwrite, or restructure depending on the buffer’s mode—most often controlled by a bump pointer in the buffer’s header.

Reassigning a buffer variable simply replaces the pointer. The buffer itself is not affected unless explicitly deallocated or cleared. However, appending or resizing often requires careful memory planning, especially when buffers are nested or shared. To avoid fragmentation or lifetime issues, buffers intended for persistent or shared use should be allocated early and reused rather than repeatedly reassigned.

The reference nature of buffers also enables more complex behaviors, such as indirect assignment, zero-copy transfer, and mutation across coroutine or module boundaries. In contrast to the tuple model, buffer use generally reflects longer-lived or dynamically sized data, often backing arrays, tables, and external I/O regions.

This dual model—value for tuples, reference for buffers—provides Tacit with a flexible and performant memory system. It allows the programmer to select the most appropriate semantics for the task, balancing safety, efficiency, and control.

## 8. Scalars and Tagged Simple Values

Scalars are the simplest category of values in Tacit. These include integers, floats, Booleans, and internal system constants. They are always passed and assigned by value, occupy a single slot, and do not reference memory outside the value itself. Their representation is typically a tagged 32-bit or 64-bit word, with the tag identifying the type and the remainder holding the payload directly.

These values are immutable, atomic, and require no memory management. They are copied freely between stack, locals, and buffers without reference semantics or allocation overhead. Scalars form the core of most control logic, arithmetic, and indexing expressions in Tacit programs.

From a memory management perspective, scalars do not participate in bump allocation, reclamation, or compaction. Their storage footprint is constant, their lifetime is tied to the container that holds them, and their presence poses no fragmentation risk. When stored in a buffer or tuple, they simply occupy fixed-size slots, making them ideal for arrays of primitives or compact tables.

Scalars are also the default type produced by many stack operations and system functions. For example, a comparison yields a Boolean, arithmetic yields an integer or float, and function arity checks yield integers. Because of their simplicity, they require no special treatment in this memory model, and form the foundation from which more complex value types—like tuples and buffers—are constructed.

Together, scalars, tuples, and buffers represent the three principal classes of Tacit data values, each with distinct semantics and memory behavior: scalars as atomic and immutable, tuples as grouped and copyable, and buffers as mutable and reference-bound.

## 9. Copying, Reassignment, and Reuse

Tacit distinguishes clearly between value copying and reference passing. Scalars are always copied. Tuples are typically copied when assigned to variables, preserving value semantics. Buffers, on the other hand, are assigned and passed by reference.

Reassigning a tuple to a variable allocates a new memory region and updates the variable to point to the new value. The old allocation becomes unreachable unless tracked for reuse or compaction. Because tuples are tagged with their size, compaction is theoretically possible—moving later allocations downward to fill any gaps—but it introduces runtime cost. Tacit assumes the simplest model first: bump allocation with no implicit deallocation or reuse.

This model leads to natural reuse patterns. Frequently reassigned or short-lived tuples tend to rise to the top of the allocation arena and become cheaper to overwrite, while long-lived tuples settle lower and remain stable. Programmers can optimize for this behavior by reassigning short tuples later in a function or allocating larger, more stable buffers early.

Variable reassignment is allowed, but treated cautiously. If reassignments cause excessive fragmentation or stack growth, the programmer may need to adopt a more deliberate memory strategy. Tacit favors brute simplicity over implicit magic. Tuples can be reassigned, but doing so allocates fresh memory. No garbage collection or implicit reuse is performed unless explicitly configured.

Thus, reassignment acts as a contract: you take on the cost of fresh memory each time, and if you wish to avoid it, you must manage that yourself, by using buffers or restructuring your code.

## 10. Compaction and Fragmentation Strategies

Tacit’s bump allocator does not track freed regions, but compaction is permitted. If a tuple or buffer is overwritten or discarded, the region it occupied can be marked for reclamation. A compaction pass can slide higher allocations down to close the gap. This is expensive in general but cheap if only a few values must move.

Tacit’s bias is: never compact implicitly. Instead, provide the user tools to invoke compaction explicitly. Compaction may be desirable after a phase of allocation and deletion, or before reusing a large tuple slot. Tacit may implement simple mark-and-copy passes to preserve stack shape while reclaiming space, but these are always programmer-directed.

This strategy assumes the “last-in, first-out” lifetime heuristic: newer allocations tend to die sooner. This makes localized compaction very effective. If a single reassigned tuple causes fragmentation, it is often at the top of the arena and easily cleared. Lower allocations are typically stable.

Tacit also encourages data partitioning. If long-lived buffers and short-lived tuples are placed in separate arenas, compaction or reuse becomes easier without coordination. Buffers meant for reuse can be reset or zeroed without fragmentation issues. Tuples, being immutable and compact, are better simply copied.

## 11. Closing Principles and Design Guidelines

Tacit’s memory model is designed to be consistent, simple, and explicit. Memory is divided into arenas. Each arena (local stack, global buffer, embedded structure) uses the same principles: linear bump allocation, optional compaction, and tag-based metadata to guide reuse.

There is no garbage collection, but there is structure. Scalars are immutable and copied. Tuples are values with span and content, passed by value but allowed to live in reference structures. Buffers are mutable and passed by reference, and are the only truly heap-like object.

Assignment is not mutation. Reassignment is allocation. And copying is always safe—but never free.

Tacit places power in the hands of the programmer. Simplicity is enforced, and discipline is expected. In return, you gain predictable performance, precise memory behavior, and a model that scales from embedded devices to structured tabular computation without runtime indirection or GC overhead.

The system rewards careful layout, deliberate ownership, and structural clarity—whether you’re working with a scalar, a tuple, or a whole arena.
