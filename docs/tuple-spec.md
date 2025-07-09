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
   - Pushes a placeholder TUPLE tag onto the stack with size 0
   - Pushes the position of the TUPLE tag onto the return stack for later reference

2. `closeTupleOp`:
   - Retrieves the tuple tag position from the return stack
   - Calculates tuple size based on stack pointer difference
   - Updates the TUPLE tag with the correct size
   - Only for outermost tuples (when `vm.tupleDepth === 1`):
     - Pushes a LINK tag with a value indicating the relative number of elements (including the TUPLE tag itself)
   - Decrements `vm.tupleDepth` to update the nesting level
   
   > **Important Implementation Detail**: The `vm.tupleDepth` counter is critical for properly tracking tuple nesting. It determines whether a LINK tag should be added (only for outermost tuples) and must be correctly incremented/decremented.

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
- Serve as markers for operations that need to process an entire tuple as one unit

### Characteristics
- Only present on outermost tuples (tuples at nesting level 1)
- Value represents the offset in elements to the start of the tuple (includes the TUPLE tag itself)
- Not part of the tuple's logical structure but rather a VM implementation detail
- The value stored in the LINK tag is critical for stack manipulation operations

### Important Constraints
1. LINK tags are strictly on outermost tuples; inner tuples do not have LINK tags
2. LINK tags are solely for stack traversal and manipulation
3. When operations create new tuples (e.g., `dup`), LINK tags must be preserved
4. Operations like `drop` rely on LINK tags to calculate how many elements to remove
5. The VM's `tupleDepth` counter must be properly managed to ensure LINK tags are only added at the correct nesting level
6. All tuple manipulation code must be consistent in its treatment of LINK tags to prevent tag mismatches

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

When duplicating a tuple:
```typescript
if (tag === Tag.LINK) {
  const elemCount = value + 1;
  const byteOffset = elemCount * BYTES_PER_ELEMENT;
  const startByte = vm.SP - byteOffset;
  // Now clone the entire tuple block including TUPLE tag and elements
  for (let i = 0; i < elemCount; i++) {
    const val = vm.memory.readFloat32(SEG_STACK, startByte + i * BYTES_PER_ELEMENT);
    vm.push(val);
  }
}
```

This allows for efficient manipulation of entire tuples without needing to manually track the tuple size or structure.

## 6. Common Implementation Pitfalls

### VM Initialization Issues
When writing tests or code that manipulates tuples:

1. Always ensure the VM is properly initialized before tuple operations:
   ```typescript
   initializeInterpreter();
   vm.SP = 0;
   vm.RP = 0;
   vm.BP = 0;
   vm.IP = 0;
   vm.tupleDepth = 0;
   vm.compiler.reset();
   ```

2. The `tupleDepth` counter must be reset to 0 at the start of operations

3. When testing, be aware that tests may fail when run as part of a larger suite but pass individually due to shared VM state

4. Always ensure tuple operations are fully self-contained with proper VM state management

### Tag Validation
When asserting tuple structure:

1. Check for correct tuple tags (Tag.TUPLE = 5) and LINK tags (Tag.LINK = 6)
2. Verify stack layout matches expected tuple nesting
3. Remember that inner tuples do not have LINK tags, only outer tuples do

### Testing Considerations

1. When modularizing tests, duplicate VM initialization code rather than sharing utility functions to avoid shared state issues

2. Use debugging tools to inspect stack contents and tag values:
   ```typescript
   function debugStack(label: string, stack: number[]) {
     console.log(label);
     for (let i = 0; i < stack.length; i++) {
       const { tag, value } = fromTaggedValue(stack[i]);
       console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
     }
   }
   ```

3. Avoid overly strict assertions on tuple size or implementation details that might change

4. Ensure built-in words like `dup` and `drop` are properly registered before testing tuple operations

5. Be aware of the global VM state and reset it completely between tests

## 6. Implementation Philosophy and Constraints

The Tacit VM is designed with a philosophy of being low-level and efficient, which imposes important constraints on implementation:

1. **ABSOLUTELY NO HEAP ALLOCATION**: Operations MUST NOT rely on heap-allocated structures (e.g., temporary arrays, JavaScript arrays) to manipulate tuples. This is a strict requirement, not a guideline.

2. **NO TEMPORARY ARRAYS**: Never create JavaScript arrays to temporarily store tuple elements during operations. This violates the fundamental design philosophy of the VM.

3. **NO GARBAGE COLLECTION**: The VM must not depend on garbage collection for memory management. All memory operations must be explicit.

4. **STACK-ONLY DATA MANIPULATION**: Tuples must remain on the stack during operations; only primitive scalar values should be stored in variables. The stack is the only valid storage for complex data structures.

5. **IN-PLACE OPERATIONS ONLY**: Operations like `swap` must be performed in-place using techniques such as element reversal or direct memory manipulation, never by copying to temporary buffers or arrays.

6. **DIRECT MEMORY ACCESS**: Use `vm.memory.readFloat32()` and `vm.memory.writeFloat32()` to manipulate the stack directly instead of high-level operations that might create hidden allocations.

7. **LINK TAG HANDLING**: When implementing operations like `swap`, careful traversal of LINK tags is required, with awareness that after reversing a range of elements, the LINK tag may not be easily accessible.

8. **OPAQUE TUPLE ELEMENTS**: The elements between a TUPLE tag and its LINK tag should be treated as opaque data - nested structure doesn't need special handling for operations like `swap` and `drop`.

9. **MINIMAL CONTEXT**: Implementation should rely only on the file being modified, not changing other components of the VM.

10. **NO POP/PUSH FOR TUPLE MANIPULATION**: Never use sequences of `vm.pop()` and `vm.push()` to manipulate tuples, as this implicitly creates heap allocations in JavaScript.

### Swap Implementation Requirements

For the `swapOp` operation that exchanges tuple positions on the stack, these requirements must be followed:

1. **Direct Memory Manipulation Only**: Use only direct memory access via `vm.memory.readFloat32()` and `vm.memory.writeFloat32()` to manipulate stack elements.

2. **In-place Reversal Algorithm**: Use an in-place reversal algorithm to swap element ranges without temporary storage.

3. **Zero Temporary Arrays**: Never store tuple elements in JavaScript arrays, even temporarily.

4. **Handle All Cases**: Correctly handle all cases: tuple-to-tuple, tuple-to-value, and value-to-value swaps.

5. **Memory Efficiency**: The implementation should maintain O(1) space complexity regardless of tuple size.

### Implementation Pattern Example

Correct approach for in-place manipulation:

```typescript
// Example of properly swapping two memory regions without temporary arrays
function reverseStackRange(vm: VM, start: number, end: number): void {
  let left = start;
  let right = end - BYTES_PER_ELEMENT;
  
  while (left < right) {
    // Swap values at left and right positions
    const leftVal = vm.memory.readFloat32(SEG_STACK, left);
    const rightVal = vm.memory.readFloat32(SEG_STACK, right);
    
    vm.memory.writeFloat32(SEG_STACK, left, rightVal);
    vm.memory.writeFloat32(SEG_STACK, right, leftVal);
    
    // Move inward
    left += BYTES_PER_ELEMENT;
    right -= BYTES_PER_ELEMENT;
  }
}
```
