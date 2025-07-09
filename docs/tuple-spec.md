# Tacit VM Tuple Specification

This document specifies how tuples are implemented and manipulated in the Tacit VM.

## 1. Tuple Basics

Tuples in Tacit are ordered collections of values that can contain any type, including nested tuples. They are immutable once created and serve as a fundamental data structure in the language.

### Key Characteristics:
- Heterogeneous: Can hold elements of different types
- Fixed-size: Size is determined at creation time
- Immutable: Cannot be modified after creation
- Zero-indexed: Elements are accessed by numeric index starting at 0
- Can be nested: Tuples can contain other tuples

### Syntax:
```
( element1 element2 ... elementN )
```

## 2. Stack Representation

Tuples are stored on the stack as contiguous blocks with special tags to mark their structure:

### Basic Tuple Layout:
```
Position  | Tag    | Value           | Description
----------|--------|-----------------|------------------
0         | TUPLE  | tuple size (N)  | Start of tuple with element count
1...N     | any    | element values  | Individual tuple elements
N+1       | LINK   | offset (N+1)    | Link to tuple start (only on outermost tuples)
```

### Tags:
- `Tag.TUPLE (5)`: Marks the beginning of a tuple with the value indicating the number of elements
- `Tag.LINK (6)`: Found only on outermost tuples, marks the end of a tuple with the value indicating offset to the beginning

## 3. Tuple Operations

### Creation
Tuples are created using the `openTupleOp` and `closeTupleOp` operations:

1. `openTupleOp`:
   - Increments `vm.tupleDepth` to track nesting level
   - Pushes a placeholder TUPLE tag onto the stack
   - Pushes the position of the TUPLE tag onto the return stack

2. `closeTupleOp`:
   - Retrieves the tuple tag position from the return stack
   - Calculates tuple size based on stack pointer difference
   - Updates the TUPLE tag with the correct size
   - Only for outermost tuples (when `vm.tupleDepth === 1`):
     - Pushes a LINK tag with a value indicating offset to the TUPLE tag
   - Decrements `vm.tupleDepth`

### Duplication (`dupOp`)
- Checks if top of stack is a LINK tag
- If so, duplicates the entire tuple including TUPLE tag, elements, and LINK tag
- Otherwise, duplicates a single value

```typescript
if (tag === Tag.LINK) {
  const elemCount = value + 1;
  // Clone entire tuple block
} else {
  // Clone single value
}
```

### Dropping (`dropOp`)
- Checks if top of stack is a LINK tag
- If so, adjusts stack pointer to remove entire tuple
- Otherwise, removes just the top value

```typescript
if (tag === Tag.LINK) {
  const targetSP = vm.SP - value * BYTES_PER_ELEMENT;
  vm.SP = targetSP;
}
```

## 4. Nested Tuples

Nested tuples introduce complexity in stack representation:

### Example: `( 1 ( 2 3 ) 4 )`
Stack layout:
```
Position  | Tag    | Value  | Description
----------|--------|--------|------------------
0         | TUPLE  | 3      | Outer tuple with 3 elements
1         | NUMBER | 1      | First element of outer tuple
2         | TUPLE  | 2      | Inner tuple with 2 elements
3         | NUMBER | 2      | First element of inner tuple
4         | NUMBER | 3      | Second element of inner tuple
5         | NUMBER | 4      | Third element of outer tuple
6         | LINK   | 6      | Link to outer tuple's start
```

Key points:
- Only the outermost tuple has a LINK tag
- Inner tuples have TUPLE tags but no LINK tags
- VM tracks tuple nesting depth to determine when to add LINK tags

## 5. LINK Tags

LINK tags are a critical implementation detail for stack manipulation of tuples:

### Purpose
- Enable efficient manipulation of tuples as single units
- Allow operations like `dup` and `drop` to identify tuple boundaries
- Provide quick navigation to the start of a tuple without traversing all elements

### Characteristics
- Only present on outermost tuples
- Value represents the offset in elements to the start of the tuple (includes the TUPLE tag itself)
- Not part of the tuple's logical structure but rather a VM implementation detail

### Important Constraints
1. LINK tags are strictly on outermost tuples; inner tuples do not have LINK tags
2. LINK tags are solely for stack traversal and manipulation
3. When operations create new tuples (e.g., `dup`), LINK tags must be preserved
4. Operations like `drop` rely on LINK tags to calculate how many elements to remove

### Example Usage
When dropping a tuple:
```typescript
// If top of stack is a LINK tag
if (tag === Tag.LINK) {
  // Use the value to calculate where to move the stack pointer
  const targetSP = vm.SP - value * BYTES_PER_ELEMENT;
  vm.SP = targetSP;
}
```

This allows for efficient dropping of entire tuples without needing to manually track the tuple size or structure.
