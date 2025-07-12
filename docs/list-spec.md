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
  // Clone entire list block
} else {
  // Clone single value
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
// If top of stack is a LINK tag
if (tag === Tag.LINK) {
  // Use the value to calculate where to move the stack pointer
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
  // Now clone the entire list block including LIST tag and elements
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

## Proposal:

I have a new idea for a series of utilities. I want you to think about the stack as a rolling buffer, we should be able to shift the content of the stack down by x elements but instead of overwriting the elements we can copy them into the space created. this way we can implment both swap and rotate.

So this is the algorith to use instead of the three reversal method.

simple case of swapping two simple values

```
100 200 swap
```

```
0: 100
1: 200
```

shift 1 element down
ie copy 1 to 0 but instead of overwriting 0 copy 0 to 1

```
0: 200
1: 100
```

```
( 1 2 ) ( 3 4 ) swap
```

```
0: LIST 2
1: 1
2: 2
3: LINK 3
4: LIST 2
5: 3
6: 4
7: LINK 3
```

shift tos list (link at 7, starts at 4) down by length of lower list but move in such a way that the lower list is not overwritten.

```
save 3 -> x
7 -> 3
x -> 7
save 2 -> x
6 -> 2
x -> 6
save 1 -> x
5 -> 1
x -> 5
save 0 -> x
4 -> 0
x -> 4
```

Does this make sense to you as a general solution for rolling these variable length values?

eventually we can implement rot using this method as well.

Thought Process

You're right - let's clarify what we're implementing and be precise about it.

The standard Forth ROLL operation is defined as:
(x*n x*{n-1} ... x*1 x_0 n -- x*{n-1} ... x_1 x_0 x_n)
where n is the depth of the item to roll to the top.

For example:

1 2 3 0 ROLL -> 1 2 3 (0 ROLL does nothing)
1 2 3 1 ROLL -> 1 3 2 (1 ROLL swaps the top two items)
1 2 3 2 ROLL -> 3 1 2 (2 ROLL brings the third item to the top)
What you described is slightly different, more like a general shifting or cycling operation. But implementing the standard Forth ROLL first is a great approach, because:

It's a well-defined operation with clear semantics
It can serve as a building block for more complex operations
We can also implement -ROLL (reverse roll) to complement it
Then, to implement the list swap operation, we would:

Identify the boundaries of both lists
Calculate the appropriate roll operations to perform based on list sizes
Apply those roll operations to achieve the swap
Let's define the behavior of these operations precisely:

ROLL (n -- ):

Takes a value n from the stack
Rotates the nth stack item (0-indexed, below n itself) to the top
Other items shift down to fill the gap
-ROLL (n -- ):

Takes a value n from the stack
Rotates the top stack item down to the nth position (0-indexed)
Other items shift up to make room
With these operations, we could implement a list swap by carefully calculating the roll depths needed based on the list sizes.

Does this definition match what you had in mind? Shall we implement the ROLL operation first and build from there?

Feedback submitted
Me

ah ok i think there must be another standard op though, what about NROLL, or something like that, is there anything like this in the Forth standard? look around for it

Revert
Thought Process

In the standard Forth vocabulary, there isn't an operation called NROLL specifically. The standard stack manipulation operations include:

ROLL - As we discussed (n -- , rotates the nth item to the top)
PICK - (n -- x, copies the nth item to the top without removing it)
ROT - (a b c -- b c a, rotates the top 3 items)
-ROT - (a b c -- c a b, reverse rotation of the top 3 items)
Some Forth implementations provide additional operations:

ROLL2, 2ROLL - For rotating pairs of items
MOVE - For memory block operations (not stack manipulation)
What you're describing is more like a general "range shift" or "range rotation" operation that would:

Take a range of stack items
Rotate or shift them by a specified amount
Preserve their relative order within the range
This isn't a standard Forth operation that I'm aware of, but it's a useful abstraction for our purposes. We could call it RANGE-ROLL or SHIFT-RANGE and define it as:

RANGE-ROLL ( start-depth count shift -- )
Where:

start-depth: Starting position from the top of stack (0-indexed)
count: Number of elements in the range to rotate
shift: Number of positions to shift (positive = right/down, negative = left/up)
Would this capture the operation you had in mind for implementing the list swap?

Feedback submitted
Me

yes this would be good, the count would equal the total length of all items affect, ie the top two in the case of swap. the start would be the last slot of the deeper element. the shift would be the length of the deeper element? this would in effect shift the deeper element to the top. It is important that nothing gets overwritten so the copy starts from the tail
I am slightly unclear what happens when the itesm are differnt length. is there a well know algorithm we can reference here, not necessarily Forth

Revert
Thought Process

You're right to be concerned about the ordering of operations, especially when dealing with different-length items. What you're describing is conceptually similar to what's known as "in-place array rotation" in algorithm literature, but adapted for a stack with elements of varying sizes.

The algorithm most similar to what you're describing is a variant of "block swap" algorithms for array rotation. Let me outline how this would work for our case:

RANGE-ROLL Implementation for Stack Manipulation
For a swap operation between two items of potentially different lengths:

Parameters:
range_size: Total number of stack elements affected (length of both lists combined)
start_depth: Stack position where our manipulation starts (bottom of the range)
shift_amount: How many positions to rotate by (typically the size of the deeper list)
Algorithm:

function range_roll(vm, start_depth, range_size, shift_amount):
// Normalize shift amount to be within range
shift_amount = shift_amount % range_size
if shift_amount == 0: return

// Critical part: copy direction matters!
// To avoid overwriting, we need to copy in the right direction
if shift_amount > 0:
// Moving items down: start from the bottom
for i from start_depth to (start_depth + range_size - 1):
temp = stack[i]
j = i
while true:
k = (j - shift_amount)
if k < start_depth: k += range_size
if k == i: break
stack[j] = stack[k]
j = k
stack[j] = temp
else:
// Moving items up: start from the top
// Similar logic but reversed

This is an adaptation of the "cycle leader" algorithm for in-place array rotation. It ensures that nothing gets overwritten by carefully tracking the movement of each element through its cycle.

For your specific list swap case, if you have:

(1 2) (3 4) swap
You'd calculate:

range_size = 8 (total elements including LIST and LINK tags)
start_depth = 0 (starting from the bottom of the stack)
shift_amount = 4 (size of the first list)
The algorithm would efficiently rotate these elements without any extra storage beyond a single temporary variable.

Does this approach align with what you were thinking? I can provide a more concrete implementation tailored specifically for the VM's stack structure if this is on the right track.

Feedback submitted
Me

yes this would be perfect, lets get this implemented and tested before we try to use it on swap

Revert
Thought Process

Great! Let's implement the rangeRoll utility first, test it thoroughly, and then use it for the swap operation. I'll start by creating a stack utilities module:
