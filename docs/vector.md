Certainly! Here are two detailed documentation files, one for `vector.ts` and the other for `heap.ts`, explaining their functionality and design decisions:

---

# Vector Management in Tacit

## Overview

The `vector.ts` file in the Tacit codebase is responsible for managing contiguous data storage in the form of vectors. Vectors are a fundamental data structure in Tacit, allowing for efficient storage and manipulation of numerical data. This file handles the creation, access, and updating of vectors, including support for vectors that span multiple memory blocks.

## Key Features

### Vector Block Layout

- **VEC_SIZE**: Stores the logical length of the vector (2 bytes).
- **VEC_RESERVED**: Reserved field for future use (2 bytes).
- **VEC_DATA**: Marks the start of the actual data within the block (8 bytes).
- **Capacity Calculation**: Each block can store a fixed number of 32-bit floating-point numbers, calculated based on the block size and element size.

### Vector Creation

- **Function**: `vectorCreate`
- **Description**: Creates a new vector from an array of numbers. It calculates the number of blocks needed and allocates memory accordingly. If the data exceeds the capacity of a single block, multiple blocks are linked together.
- **Error Handling**: Returns `UNDEF` if memory allocation fails.

### Vector Access

- **Function**: `vectorGet`
- **Description**: Retrieves an element from a vector at a specified index. It traverses the linked list of blocks to find the correct block and offset.
- **Error Handling**: Returns `UNDEF` if the index is out of bounds.

### Vector Update

- **Function**: `vectorUpdate`
- **Description**: Updates an element in a vector at a specified index. It implements copy-on-write semantics to ensure immutability and structural sharing. If the reference count of a block is greater than one, the block is cloned before updating.
- **Error Handling**: Returns `UNDEF` if the index is out of bounds or if the update fails.

### Multi-Block Vectors

- **Block Linking**: Vectors that exceed the capacity of a single block are stored across multiple linked blocks. Each block contains a pointer to the next block, forming a linked list.
- **Data Access**: Requires traversal of the linked list to locate the correct block and offset for the requested element.
- **Data Update**: May require traversal and cloning of blocks to maintain immutability and structural sharing.

## Design Decisions

### Contiguous Data Storage

- Vectors store data contiguously within each block, allowing for efficient access and traversal. This is essential for performance in array programming languages like Tacit.

### Copy-on-Write Semantics

- Copy-on-write ensures immutability and structural sharing, which is crucial for managing memory efficiently in a constrained environment. This approach is inspired by persistent data structures used in languages like Clojure.

### Fixed Block Size

- Using a fixed block size simplifies memory management and prevents fragmentation. This design decision is suitable for systems with limited memory, ensuring that all blocks are uniform and can be easily reused.

### Reference Counting

- Reference counting manages the lifecycle of vectors, ensuring that memory is reclaimed when it is no longer needed. This approach is chosen over garbage collection to keep the system simple and efficient.

### Error Handling

- Functions return `UNDEF` in case of errors, allowing for graceful error handling in the language. This ensures that the system can handle errors without crashing, which is crucial for robustness.

## Conclusion

The `vector.ts` file is a critical component of the Tacit programming language, providing efficient management of contiguous data storage in the form of vectors. Its design decisions, such as contiguous data storage, copy-on-write semantics, fixed block size, and reference counting, are tailored to the needs of a restrictive system, ensuring efficient memory use and preventing fragmentation.
