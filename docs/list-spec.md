# Tacit VM List Specification

This document specifies how lists are implemented and manipulated in the Tacit VM.

## 1. List Basics

Lists in Tacit are ordered collections of values that can contain any type, including nested lists. They are immutable once created and serve as a fundamental data structure in the language.

### Key Characteristics:

- Heterogeneous: Can hold elements of different types
- Fixed-size: Size is determined at creation time
- Immutable: Cannot be modified after creation
- Zero-indexed: Elements are accessed by numeric index starting at 0
- Can be nested: Lists can contain other lists

### Syntax:

```
( element1 element2 ... elementN )
```

## 2. Stack Representation

Lists are stored on the stack as contiguous blocks with special tags to mark their structure:

### Basic List Layout:

```
Position  | Tag    | Value           | Description
----------|--------|-----------------|------------------
0         | LIST  | list size (N)  | Start of list with element count
1...N     | any    | element values  | Individual list elements
N+1       | LINK   | offset (N+1)    | Link to list start (only on outermost lists)
```

### Tags:

- `Tag.LIST (5)`: Marks the beginning of a list with the value indicating the number of elements
- `Tag.LINK (6)`: Found only on outermost lists, marks the end of a list with the value indicating offset to the beginning

## 3. List Operations

### Creation

Lists are created using the `openListOp` and `closeListOp` operations:

1. `openListOp`:
   - Increments `vm.listDepth` to track nesting level
   - Pushes a placeholder LIST tag onto the stack with size 0
   - Pushes the position of the LIST tag onto the return stack for later reference

2. `closeListOp`:
   - Retrieves the list tag position from the return stack
   - Calculates list size based on stack pointer difference
   - Updates the LIST tag with the correct size
   - Only for outermost lists (when `vm.listDepth === 1`):
     - Pushes a LINK tag with a value indicating the relative number of elements (including the LIST tag itself)
   - Decrements `vm.listDepth` to update the nesting level

   > **Important Implementation Detail**: The `vm.listDepth` counter is critical for properly tracking list nesting. It determines whether a LINK tag should be added (only for outermost lists) and must be correctly incremented/decremented.

### Duplication (`dupOp`)

- Checks if top of stack is a LINK tag
- If so, duplicates the entire list including LIST tag, elements, and LINK tag
- Otherwise, duplicates a single value

```typescript
if (tag === Tag.LINK) {
  const elemCount = value + 1;
} else {
}
```

### Dropping (`dropOp`)

- Checks if top of stack is a LINK tag
- If so, adjusts stack pointer to remove entire list
- Otherwise, removes just the top value

```typescript
if (tag === Tag.LINK) {
  const targetSP = vm.SP - value * BYTES_PER_ELEMENT;
  vm.SP = targetSP;
}
```

## 4. Nested Lists

Nested lists introduce complexity in stack representation:

### Example: `( 1 ( 2 3 ) 4 )`

Stack layout:

```
Position  | Tag    | Value  | Description
----------|--------|--------|------------------
0         | LIST  | 3      | Outer list with 3 elements
1         | NUMBER | 1      | First element of outer list
2         | LIST  | 2      | Inner list with 2 elements
3         | NUMBER | 2      | First element of inner list
4         | NUMBER | 3      | Second element of inner list
5         | NUMBER | 4      | Third element of outer list
6         | LINK   | 6      | Link to outer list's start
```

Key points:

- Only the outermost list has a LINK tag
- Inner lists have LIST tags but no LINK tags
- VM tracks list nesting depth to determine when to add LINK tags

## 5. LINK Tags

LINK tags are a critical implementation detail for stack manipulation of lists:

### Purpose

- Enable efficient manipulation of lists as single units
- Allow operations like `dup` and `drop` to identify list boundaries
- Provide quick navigation to the start of a list without traversing all elements
- Serve as markers for operations that need to process an entire list as one unit

### Characteristics

- Only present on outermost lists (lists at nesting level 1)
- Value represents the offset in elements to the start of the list (includes the LIST tag itself)
- Not part of the list's logical structure but rather a VM implementation detail
- The value stored in the LINK tag is critical for stack manipulation operations

### Important Constraints

1. LINK tags are strictly on outermost lists; inner lists do not have LINK tags
2. LINK tags are solely for stack traversal and manipulation
3. When operations create new lists (e.g., `dup`), LINK tags must be preserved
4. Operations like `drop` rely on LINK tags to calculate how many elements to remove
5. The VM's `listDepth` counter must be properly managed to ensure LINK tags are only added at the correct nesting level
6. All list manipulation code must be consistent in its treatment of LINK tags to prevent tag mismatches

### Example Usage

When dropping a list:

```typescript
if (tag === Tag.LINK) {
  const targetSP = vm.SP - value * BYTES_PER_ELEMENT;
  vm.SP = targetSP;
}
```

When duplicating a list:

```typescript
if (tag === Tag.LINK) {
  const elemCount = value + 1;
  const byteOffset = elemCount * BYTES_PER_ELEMENT;
  const startByte = vm.SP - byteOffset;

  for (let i = 0; i < elemCount; i++) {
    const val = vm.memory.readFloat32(SEG_STACK, startByte + i * BYTES_PER_ELEMENT);
    vm.push(val);
  }
}
```

This allows for efficient manipulation of entire lists without needing to manually track the list size or structure.

## 6. Common Implementation Pitfalls

### VM Initialization Issues

When writing tests or code that manipulates lists:

1. Always ensure the VM is properly initialized before list operations:

   ```typescript
   initializeInterpreter();
   vm.SP = 0;
   vm.RP = 0;
   vm.BP = 0;
   vm.IP = 0;
   vm.listDepth = 0;
   vm.compiler.reset();
   ```

2. The `listDepth` counter must be reset to 0 at the start of operations

3. When testing, be aware that tests may fail when run as part of a larger suite but pass individually due to shared VM state

4. Always ensure list operations are fully self-contained with proper VM state management

### Tag Validation

When asserting list structure:

1. Check for correct list tags (Tag.LIST = 5) and LINK tags (Tag.LINK = 6)
2. Verify stack layout matches expected list nesting
3. Remember that inner lists do not have LINK tags, only outer lists do

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

3. Avoid overly strict assertions on list size or implementation details that might change

4. Ensure built-in words like `dup` and `drop` are properly registered before testing list operations

5. Be aware of the global VM state and reset it completely between tests

## 6. Implementation Philosophy and Constraints

The Tacit VM is designed with a philosophy of being low-level and efficient, which imposes important constraints on implementation:

1. **ABSOLUTELY NO HEAP ALLOCATION**: Operations MUST NOT rely on heap-allocated structures (e.g., temporary arrays, JavaScript arrays) to manipulate lists. This is a strict requirement, not a guideline.

2. **NO TEMPORARY ARRAYS**: Never create JavaScript arrays to temporarily store list elements during operations. This violates the fundamental design philosophy of the VM.

3. **NO GARBAGE COLLECTION**: The VM must not depend on garbage collection for memory management. All memory operations must be explicit.

4. **STACK-ONLY DATA MANIPULATION**: Lists must remain on the stack during operations; only primitive scalar values should be stored in variables. The stack is the only valid storage for complex data structures.

5. **IN-PLACE OPERATIONS ONLY**: Operations like `swap` must be performed in-place using techniques such as element reversal or direct memory manipulation, never by copying to temporary buffers or arrays.

6. **DIRECT MEMORY ACCESS**: Use `vm.memory.readFloat32()` and `vm.memory.writeFloat32()` to manipulate the stack directly instead of high-level operations that might create hidden allocations.

7. **LINK TAG HANDLING**: When implementing operations like `swap`, careful traversal of LINK tags is required, with awareness that after reversing a range of elements, the LINK tag may not be easily accessible.

8. **OPAQUE LIST ELEMENTS**: The elements between a LIST tag and its LINK tag should be treated as opaque data - nested structure doesn't need special handling for operations like `swap` and `drop`.

9. **MINIMAL CONTEXT**: Implementation should rely only on the file being modified, not changing other components of the VM.

10. **NO POP/PUSH FOR LIST MANIPULATION**: Never use sequences of `vm.pop()` and `vm.push()` to manipulate lists, as this implicitly creates heap allocations in JavaScript.

### Swap Implementation Requirements

For the `swapOp` operation that exchanges list positions on the stack, these requirements must be followed:

1. **Direct Memory Manipulation Only**: Use only direct memory access via `vm.memory.readFloat32()` and `vm.memory.writeFloat32()` to manipulate stack elements.

2. **In-place Reversal Algorithm**: Use an in-place reversal algorithm to swap element ranges without temporary storage.

3. **Zero Temporary Arrays**: Never store list elements in JavaScript arrays, even temporarily.

4. **Handle All Cases**: Correctly handle all cases: list-to-list, list-to-value, and value-to-value swaps.

5. **Memory Efficiency**: The implementation should maintain O(1) space complexity regardless of list size.

### Implementation Pattern Example

Correct approach for in-place manipulation:

```typescript
function reverseStackRange(vm: VM, start: number, end: number): void {
  let left = start;
  let right = end - BYTES_PER_ELEMENT;

  while (left < right) {
    const leftVal = vm.memory.readFloat32(SEG_STACK, left);
    const rightVal = vm.memory.readFloat32(SEG_STACK, right);

    vm.memory.writeFloat32(SEG_STACK, left, rightVal);
    vm.memory.writeFloat32(SEG_STACK, right, leftVal);

    left += BYTES_PER_ELEMENT;
    right -= BYTES_PER_ELEMENT;
  }
}
```
