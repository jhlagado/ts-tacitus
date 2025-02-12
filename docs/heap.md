# Heap Management in Tacit

## Overview

The `heap.ts` file in the Tacit codebase manages dynamic memory allocation and deallocation within the constraints of a 64KB memory space. It provides mechanisms for allocating and freeing memory blocks, maintaining a free list of available blocks, and supporting reference counting to manage object lifecycles. This is essential for efficient memory use in a constrained environment.

## Key Features

### Block Size and Layout

- **BLOCK_SIZE**: Each memory block is 64 bytes. This fixed size simplifies memory management and prevents fragmentation.
- **BLOCK_NEXT**: An offset within each block that points to the next free block, allowing for a linked list of free blocks.
- **BLOCK_REFS**: An offset for storing the reference count of each block, enabling reference counting.

### Free List Management

- **Free List**: A linked list of free blocks, allowing for quick allocation and deallocation of memory blocks.
- **Initialization**: The `initializeFreeList` method sets up the free list by linking all blocks together when the heap is initialized.

### Memory Allocation

- **Function**: `malloc`
- **Description**: Allocates one or more contiguous blocks from the free list. It traverses the free list to find enough contiguous blocks to satisfy the request. If enough blocks are found, they are removed from the free list and returned to the caller.
- **Error Handling**: Returns `NULL` if not enough blocks are found.

### Memory Deallocation

- **Function**: `free`
- **Description**: Decrements the reference count of a block. If the reference count reaches zero, the block is added back to the free list.
- **Error Handling**: Ensures that memory is reclaimed when it is no longer in use.

### Reference Counting

- **Functions**: `incrementRef`, `decrementRef`
- **Description**: Adjust the reference count of a block. Reference counting helps manage the lifecycle of objects, ensuring that memory is reclaimed when it is no longer needed.
- **Error Handling**: Prevents memory leaks by ensuring that blocks are freed when they are no longer referenced.

### Block Cloning

- **Function**: `cloneBlock`
- **Description**: Creates a copy of a block, which is essential for implementing copy-on-write semantics. This method is used to create new versions of blocks when they are modified, allowing for structural sharing and efficient memory use.

### Available Memory Calculation

- **Function**: `available`
- **Description**: Calculates the total amount of free memory by traversing the free list. This is useful for monitoring memory usage and ensuring that the system does not run out of memory.

### Multi-Block Data Structures

- **Linked List of Blocks**: Larger data structures, such as vectors, can span multiple blocks. Each block contains a pointer to the next block, forming a linked list.
- **Data Access**: Requires traversal of the linked list to access elements stored across multiple blocks.

## Design Decisions

### Fixed Block Size

- Using a fixed block size simplifies memory management and prevents fragmentation. This design decision is suitable for systems with limited memory, ensuring that all blocks are uniform and can be easily reused.

### Free List

- The free list allows for efficient allocation and deallocation of memory blocks. By maintaining a linked list of free blocks, the heap can quickly find and reuse available memory.

### Reference Counting

- Reference counting is used to manage the lifecycle of objects, ensuring that memory is reclaimed when it is no longer needed. This approach is chosen over garbage collection to keep the system simple and efficient, given the constraints of the environment.

### Copy-on-Write

- Copy-on-write is used to implement structural sharing, which allows for efficient memory use and prevents cyclic references. This approach is inspired by persistent data structures, such as those used in Clojure, and is essential for maintaining immutability.

### No Garbage Collection

- The decision to avoid garbage collection is driven by the need to keep the system simple and efficient. Reference counting provides a lightweight alternative that is suitable for the constraints of the environment.

## Conclusion

The `heap.ts` file is a critical component of the Tacit programming language, providing efficient memory management within the constraints of a 64KB memory space. Its design decisions, such as fixed block size, free list management, reference counting, and copy-on-write semantics, are tailored to the needs of a restrictive system, ensuring efficient memory use and preventing fragmentation.
