Note: Read the [reference counting](./reference-counting.md) document which supercedes this one.

### **Context**
We are implementing a memory model without garbage collection, relying instead on **reference counting**. The system operates using **heap-allocated blocks** and a **stack-based execution model**. Sequences (like `range`, `map`, etc.) are chained and must manage their own lifecycles properly.

---

### **Problem**
The original assumption was that the **stack owns an object**, and popping it should decrement its reference count. However, this fails in sequence chains where the object is **immediately reused**, like:

```text
range → map → sink
```

Here, `map` pops the `range` sequence, but instead of being discarded, it stores it internally. Decrementing its refcount prematurely leads to early deallocation.

---

### **Solution Strategy**
We propose a **transfer flag** when popping from the stack:
- **If `transfer = true`**, popping does **not decrement** the reference count, because ownership is being transferred to another container (like `map`).
- **If `transfer = false`**, popping means the reference is discarded, and the count is decremented.

---

### **Deallocation Policy**
Each consumer (e.g., `map`, `sink`) is **responsible for cleaning up** its internal references when it's done:
- `sink` deallocates `map`
- `map` deallocates `range`

This creates a **clear ownership chain** and avoids dangling references or early frees.

---

### **Polymorphic Cleanup**
We will implement a `dispose()` function for each sequence type (e.g., `disposeMapSeq`, `disposeRangeSeq`) to:
- Decrement references of internal objects
- Free the current object if its count reaches zero

These functions can be dispatched via tag/type checking.

---

### **Principles Derived**
- **Reference count decrements must match the actual loss of ownership**.
- **Stack pops don’t always mean disposal**; context matters.
- **Explicit cleanup at the end of a chain (e.g., by `sink`) ensures proper deallocation**.
- This is a simple and deterministic model that works well for Tacit's non-GC environment.

# Copy-On-Write and Structural Sharing in Block-Based Vectors

This document explores in depth how copy-on-write (COW) and structural sharing can be used in a reference-counted, block-based vector system—such as in a stack-based language runtime like Tacit. It includes strategies for managing both shallow and nested mutations efficiently, with detailed scenarios and reference counting mechanics.

---

## Overview

In systems where memory is managed via reference counting (rather than garbage collection), updates to shared data structures must be handled with care to prevent both memory leaks and premature deallocation. Copy-on-write combined with structural sharing allows safe and efficient mutation semantics while minimizing memory overhead.

This document covers:
- Structural sharing in immutable systems
- Copy-on-write for mutable structures
- Block-level copy-on-write
- Reference management for nested vectors

---

## 1. Structural Sharing with Immutability

### Concept

Structural sharing means new versions of a data structure reuse unchanged parts of the old version. This is fundamental to persistent data structures used in functional programming.

### Linked List Example

```lisp
old = [2, 3, 4]
new = 1:old  ; => [1, 2, 3, 4]
```

Here, `new` shares the entire tail `[2, 3, 4]` with `old`. No copying occurs.

### Benefits
- O(1) prepend cost
- No side effects or race conditions
- Safe and predictable behavior

### Drawbacks
- Inefficient mid-structure updates (full re-copy required)
- GC needed to collect unused tails

---

## 2. Copy-On-Write (COW) Strategy

In mutable systems with reference counting, structural sharing is preserved until mutation occurs. At that point, the object is cloned before modification. This is known as copy-on-write.

### Basic Workflow
1. If the object is shared (refcount > 1), copy it.
2. Modify the copy.
3. Keep the original unchanged.

### Scalar Example
Given `V = [1, 2, 3]` shared between `A` and `B`, writing `V[1] = 9` causes:
- Cloning of `V`
- Refcount adjustments
- Safe mutation on the new version only

---

## 3. Block-Based Vector Model

Tacit's vectors are implemented as **linked chains of fixed-size blocks**.

```text
[Block0] → [Block1] → [Block2]
```

Each block:
- Has a reference count
- Contains multiple elements
- Points to the next block

### Mutation Strategy
When modifying `vector[i]`, find the block containing it:
- If block's refcount == 1, mutate in place.
- If block is shared, copy the block, update the element, and re-link.

### Example
Modify `vector[22]` in:
```text
[Block0] → [Block1] → [Block2]
```
- Index 22 is in `Block1`
- If `Block1` is shared:
  - Clone `Block1`
  - Update element
  - Link it from `Block0`

Only **one block** is copied.

---

## 4. Reference Counting Rules for Heap Values

When assigning a heap-allocated object (like another vector) into a vector slot:

### Always:
- **Increment** the refcount of the new value
- **Decrement** the refcount of the overwritten value

### Special Cases:
- If old value is scalar, skip decrement
- If new value is scalar, skip increment
- If overwriting with the same object, increment before decrement to avoid double-free

---

## 5. Nested Vectors and Copy-on-Write

Nested vectors are heap-allocated objects stored as elements within another vector. Mutating the outer vector involves two layers:
- COW for the **outer vector**
- Refcount changes for the **inner (nested) vector**

### Full Workflow
1. Identify block containing `outer[i]`
2. If block is shared:
   - Copy block
   - Increment refcounts of existing elements
3. Update `outer[i]`:
   - Decrement old value if heap
   - Increment new value if heap

This preserves the outer structure while maintaining correct ownership of inner vectors.

### Optimization: Tag-Aware Checks
Use tag bits to quickly detect whether a value is heap-allocated:
```ts
if (isHeapTag(value)) {
  incrementRef(value);
}
```

Avoids unnecessary operations on scalars.

---

## 6. Efficiency Gains from Block-Level Sharing

By copying only the block being written, and keeping all others shared:
- We get **O(1)** mutation cost for large vectors
- Dramatic **memory savings** when only a few elements change
- Consistent and safe behavior across nested structures

This enables features like undo stacks, transactional views, and efficient branching.

---

## 7. Summary Table

| Scenario                      | Action                                                   |
|------------------------------|----------------------------------------------------------|
| Write scalar to shared vector| Copy modified block, update value                        |
| Write heap value             | Copy block, inc new ref, dec old ref                     |
| Overwrite scalar             | Just write, no refcounting needed                        |
| Overwrite nested vector      | Inc new vector ref, dec old vector ref                   |
| Full vector copy             | Only needed when global structure changes                |

---

## Conclusion

Structural sharing combined with copy-on-write and precise reference counting gives us powerful control over memory in systems without garbage collection. By optimizing mutation at the block level and handling nested vectors gracefully, we can build high-performance, safe, and flexible data structures that scale well across complex use cases.

This model also lays the groundwork for undo systems, snapshot views, and multi-version concurrency — all without incurring the overhead of full copies or the unpredictability of GC.

This document serves as a comprehensive guide for implementing these strategies in Tacit or similar low-level systems with manual memory management.

# Copy-on-Write Scenarios for Nested Vector Mutations

This document provides a detailed walkthrough of the different scenarios encountered when modifying vectors using copy-on-write (COW) in a reference-counted system. It focuses on the tricky edge cases involving heap-allocated values—especially when one vector is embedded inside another—and outlines the exact behavior required for safe and efficient memory handling.

---

## 1. Terminology

- **Parent vector**: The outer vector being modified.
- **Nested vector**: A vector stored as an element within a parent vector.
- **Block**: A fixed-size memory segment containing part of a vector.
- **Heap object**: Any reference-counted object (e.g., vector, dictionary).
- **Scalar**: A non-heap, immutable value (e.g., float, integer).

---

## 2. Scenario: Assigning a Vector to a Vector Element

### Operation:
```text
parent[i] = nested
```

### Preconditions:
- `parent` is a block-based vector, possibly shared.
- `nested` is a heap-allocated vector.

### Correct Sequence of Operations:
1. **Check parent vector’s ownership**:
   - If `parent.refcount > 1`: clone any blocks to be modified (COW).
   - Otherwise, mutation can be done in-place.

2. **Identify the target block** for index `i`.
   - If the block is shared, clone that block only.

3. **Update reference counts**:
   - Increment `nested.refcount`.
   - If `parent[i]` previously held a heap object:
     - Decrement its refcount.
     - If it reaches zero, trigger disposal.

4. **Write the new reference** to the block.

### Gotchas:
- Always increment before decrement if overwriting with the same object.
- Failing to increment `nested` causes premature free if referenced elsewhere.
- If parent’s block isn't cloned when shared, updates become unsafe.

---

## 3. Scenario: Replacing One Nested Vector with Another

### Operation:
```text
parent[i] = new_nested
```
Where `parent[i]` already holds an old nested vector.

### Steps:
1. **Clone the block if necessary** (as above).
2. **Increment `new_nested`'s refcount.**
3. **Decrement `old_nested`'s refcount.**
   - If it reaches zero, dispose recursively.

### Notes:
- Nested vectors might themselves contain more nested structures.
- Deallocation must handle deep chains safely.

### Example:
```text
A = [ [1 2], [3 4] ]
B = [5 6]
A[0] = B
```
Steps:
- B is refcounted → increment B
- A[0] previously pointed to [1 2] → decrement it
- If [1 2] has no other references, it's freed

---

## 4. Scenario: Modifying a Nested Vector in Place

```text
parent[i][j] = x
```

This is a **write-through** operation. We're not replacing the nested vector—we're modifying its contents. This creates a deeper COW scenario.

### Steps:
1. **Check if parent is shared**
   - If not, move on
   - If yes, clone the relevant block

2. **Check if `parent[i]` (the nested vector) is shared**
   - If yes, **clone the nested vector**
   - Replace `parent[i]` with the new clone
   - Increment clone’s refcount
   - Decrement old nested vector’s refcount

3. **Mutate the element inside the clone**

### Gotchas:
- Must not mutate a shared nested vector directly!
- Cloning the nested vector requires **refcount adjustment** in the parent vector too.
- If the nested vector spans blocks, we may need to recursively apply COW at the block level.

---

## 5. Scenario: Appending a Nested Vector

```text
parent.push(nested)
```

This triggers a block-level growth:
1. If the last block is shared → clone it.
2. Add `nested` to the new block.
3. Increment `nested.refcount`.

---

## 6. Summary Table

| Operation                         | Action Required                                                 |
|----------------------------------|------------------------------------------------------------------|
| Assign scalar to vector slot     | Clone block (if shared), write scalar                            |
| Assign vector to vector slot     | Clone block, inc new vector ref, dec old (if heap)               |
| Overwrite nested with nested     | Clone block, inc new, dec old                                    |
| Modify value inside nested vector| Clone parent block (if shared), clone nested (if shared), mutate |
| Append heap value to vector      | Clone last block (if shared), inc ref                            |

---

## 7. Refcount Management Summary

- **Always increment before decrement** when replacing values.
- **Check tags** to distinguish heap from scalar.
- **Clone only blocks or nested structures that are shared** (refcount > 1).
- Mutations to nested structures may require *cascading COW*.

---

## 8. Conclusion

Copy-on-write updates involving heap-allocated nested vectors demand careful cloning and refcounting. The key to correctness is:
- Never modify shared structures directly
- Clone only what’s necessary (blocks, nested vectors)
- Keep reference counts exact

With these rules, we can build an efficient, safe, and composable memory system where even deeply nested structures can be updated predictably and cheaply using structural sharing.

