# Tacit Reference Counting and Structural Sharing Model

This document outlines the implementation strategy for reference counting, copy-on-write semantics, and structural sharing in the Tacit programming language's block-based memory model. It formalizes key behaviors discussed in the development of ownership, mutability, and cloning in a stack-oriented environment.

## Introduction
Tacit aims to combine the rigor of ownership-based memory safety with the flexibility of functional programming, without resorting to garbage collection. This approach draws inspiration from Rust's ownership model and Clojure's immutable data structures. In Tacit, we want deterministic memory management, fast mutation where possible, and structural sharing to reduce overhead. 

The goal is to support functional-style immutability by default, enable safe in-place mutation when an object is uniquely owned, and preserve performance in common data manipulation tasks. Reference counting gives us deterministic lifecycle control, while copy-on-write and structural sharing let us maintain efficiency across deep, nested data structures.

## Ownership and Ref Count Semantics

### Reference Count Values
- **refCount = 1**: The block is uniquely owned and can be safely mutated.
- **refCount > 1**: The block is shared and must be cloned before any mutation (copy-on-write).
- **refCount = 0**: The block is unreachable and should be deallocated.

### Implication
Tacit treats refCount == 1 as the fast path for in-place mutation. The presence of more than one reference (refCount > 1) signals that the block is being shared, and thus no mutation is allowed directly.

## Copy-On-Write Semantics

When an operation attempts to mutate a block:
1. **If refCount == 1**: Proceed with in-place mutation.
2. **If refCount > 1**:
   - Clone the block.
   - Decrement the refCount of the original.
   - Set the new block's refCount to 1.
   - Proceed with mutation on the newly cloned block.

## Structural Sharing in Nested Vectors

Tacit supports deeply nested structures, such as vectors of vectors (tree-like shapes). Modifying a nested vector while maintaining the single-owner model follows this approach:

1. Begin at the root vector.
2. Traverse down the path to the nested target block.
3. At each step:
   - If the current block has refCount > 1, clone it.
   - Rebuild the path downward with newly cloned blocks.
4. Mutate the final block.
5. Unmodified parts of the tree may be structurally shared (e.g., shared tail blocks).

### Example: Shared Tail Modification
Two vectors share a tail:
- `vecA` and `vecB` each have their own unique head.
- Their tail blocks are shared (`refCount > 1`).

Modifying the tail from `vecA`'s perspective:
```ts
// Conceptual pseudocode
if (vecA.tail.refCount > 1) {
  let newTail = clone(vecA.tail);
  decrement(vecA.tail.refCount);
  newTail.refCount = 1;
  vecA.tail = newTail;
}
vecA.tail.modify(...); // safe to mutate
```

**Diagram: Shared Tail Scenario Before Mutation**
```
vecA -> [A1] -> [SharedTail1] -> [SharedTail2]
vecB -> [B1] -> [SharedTail1] -> [SharedTail2]
```

**After Mutation of vecA Tail**
```
vecA -> [A1'] -> [NewTail1] -> [NewTail2]
vecB -> [B1]  -> [SharedTail1] -> [SharedTail2]
```

## Stack Duplication and Mutation

Duplicating a vector on the stack:
```ts
// Initial vector
let vector = allocBlock();
vector.refCount = 1;

// Stack duplication
let dup1 = vector;
let dup2 = vector;
vector.refCount += 1; // refCount now 2
```

Now we mutate the first block of `dup1`:
```ts
// Mutation triggers copy-on-write
if (dup1.refCount > 1) {
  let newVec = clone(dup1);
  decrement(dup1.refCount);
  newVec.refCount = 1;
  dup1 = newVec;
}
mutate(dup1); // safely mutate newVec
```

**Diagram: Before Mutation**
```
Stack:
  dup1 -> [VecBlock1] (refCount = 2)
  dup2 -> [VecBlock1] (refCount = 2)
```

**Diagram: After Mutation**
```
Stack:
  dup1 -> [VecBlock1'] (refCount = 1, modified)
  dup2 -> [VecBlock1]  (refCount = 1, original)
```

Now `dup1` and `dup2` are distinct and independently owned.

## Tree Structure Walkthrough

### Setup:
We have a balanced tree represented as nested vectors:
```ts
let leaf = allocBlock(); // leaf node
leaf.refCount = 1;

let child1 = vectorWith(leaf);
let child2 = vectorWith(leaf); // shared leaf
leaf.refCount += 1;

let root = vectorWith(child1, child2);
child1.refCount += 1;
child2.refCount += 1;
```

### Now we want to modify the `leaf` as seen through `child1`
1. **leaf.refCount > 1** → clone leaf.
2. Decrement original leaf refCount.
3. New cloned leaf gets refCount = 1.
4. Since `child1` now needs to point to the new leaf:
   - Check `child1.refCount > 1` → clone `child1`, attach new leaf.
5. Update `root` to point to new `child1`.

**Diagram: Before Mutation**
```
root -> [child1] -> [leaf]
      -> [child2] -> [leaf]
(leaf refCount = 2)
```

**Diagram: After Mutation of leaf through child1**
```
root -> [child1'] -> [leaf'] (refCount = 1)
      -> [child2]  -> [leaf] (refCount = 1)
```

## Reference Counting in Practice
- **Pushing to the stack**: If a value is moved, no change. If duplicated (`DUP`), increment `refCount`.
- **Popping from the stack**: Decrement `refCount`; if it becomes 0, free the block.
- **Storing a value elsewhere**: Increment `refCount` (if creating a second reference).

## Conclusion
Tacit achieves a powerful balance between the simplicity of single ownership and the efficiency of persistent data structures. Reference counting provides deterministic cleanup, while copy-on-write and structural sharing enable immutable semantics and safe concurrent logic without garbage collection.

This model is predictable, efficient, and expressive. It empowers developers to build complex data structures with performance and safety in mind, leveraging the best of functional programming and systems-level control. Tacit’s approach minimizes runtime overhead while retaining clarity of ownership and memory flow.

