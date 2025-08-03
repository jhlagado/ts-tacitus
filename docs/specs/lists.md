# TACIT Lists Specification

## Overview

TACIT lists are length-prefixed, stack-allocated flat structures that serve as the primary compound data type. Lists are constructed left-to-right, stored contiguously, and use LINK metadata for stack navigation.

## Basic Structure

A list in memory would look like:
```
[LIST:n] [element1] [element2] ... [elementN]
```

However, TACIT operates on a stack, which creates navigation challenges that require special metadata.

## Stack Representation Challenge

On a stack, the **Top of Stack (TOS)** is the most accessible position, but it corresponds to the **end** of the list:

```
[LIST:n] [element1] [element2] ... [elementN] [LINK] ← TOS
   ↑                                           ↑
start of list                          stack metadata
(hard to reach)                       (navigation anchor)
```

**Critical Problem**: In nested lists, backward traversal becomes impossible because you cannot distinguish between:
- Elements belonging to the current list
- Elements belonging to inner lists  
- Multiple LINK markers from different nesting levels

**Example of the navigation problem**:
```tacit
( 1 ( 2 3 ) 4 )  →  [LIST:3] [1] [LIST:2] [2] [3] [LINK] [4] [LINK]
```
Walking backward from TOS, you encounter `[4]`, `[LINK]`, `[3]`, `[2]`, `[LIST:2]` - but you've lost track of which list owns which elements!

## LINK: The Navigation Solution

**LINK is essential stack infrastructure** - not part of the list data itself:

- **Purpose**: Provides reliable backward pointer to list start
- **Scope**: Stack-only metadata, never serialized
- **Function**: Enables forward-only traversal from a known starting point
- **Analogy**: Like Pascal strings - you must traverse forward from the length header

**Stack representation with LINK**:
```
[LIST:n] [element1] [element2] ... [elementN] [LINK] ← TOS
                                               ↑
                                        points backward to LIST:n
```

## Key Properties

- **Length-prefixed**: `LIST:n` header contains element count
- **Sequential storage**: Values follow header in order (element1, element2, ...)
- **Forward-only traversal**: Like Pascal strings, must start from header and count forward
- **LINK anchoring**: Stack-only backward pointer enables finding the list start
- **Flat serialization**: No nested pointers - all elements are simple tagged values
- **Word-aligned**: Each element occupies exactly one 32-bit stack cell

## Safe List Access Pattern

**Always follow this pattern** for list operations:

1. **Start with LINK**: Use TOS LINK to locate the LIST:n header
2. **Read count**: Extract n from the LIST:n header  
3. **Forward traverse**: Process exactly n elements sequentially
4. **Respect boundaries**: Never assume stack positions belong to your list

**Never attempt**:
- Backward traversal from arbitrary stack positions
- Guessing list boundaries from element values
- Assuming TOS-1 belongs to the current list (it may be part of a nested structure)

## Constraints

- Lists are **structurally immutable** - modifying list structure (length, element positions) is discouraged but not impossible
- **Element mutability**: Simple value elements within lists can be mutated and updated in-place
- LINK tags are **stack-only** - not serialized to memory
- Maximum list length: 65535 elements (16-bit count)
- All elements must be simple values (tagged 32-bit cells)

## Stack Effects and Examples

**Simple lists**:
```tacit
( )            → LIST:0 LINK           # empty list
( 1 2 3 )      → LIST:3 1 2 3 LINK     # three elements
```

**Nested lists** (showing why LINK is essential):
```tacit
( 1 ( 2 ) 3 )  → LIST:3 1 LIST:1 2 LINK 3 LINK
                           ↑       ↑     ↑
                    inner list  inner  outer
                     header     LINK   LINK
```

In the nested example:
- The inner `( 2 )` creates: `LIST:1 2 LINK`
- The outer list sees three elements: `1`, `LIST:1 2 LINK` (as one unit), `3`
- Each list level maintains its own LINK for navigation
- Backward traversal would encounter multiple LINKs and lose track of nesting levels

## List Operations Strategy

**Reading elements** (e.g., getting element at index i):
1. Follow LINK to find LIST:n header
2. Verify i < n (bounds checking)
3. Navigate forward i positions from header
4. Extract element value

**Transforming lists** (discouraged but possible):
1. Use LINK to locate source list boundaries
2. Traverse forward through source elements
3. Apply transformation logic
4. Construct new list with its own LINK
5. Original list structure remains unchanged (structural immutability)

**Mutating elements** (efficient for simple values):
1. Use LINK to locate target element position
2. Verify element is a simple value (not compound)
3. Update element value in-place
4. List structure and other elements remain unchanged

## Mutability Semantics

- **Read**: Extract elements without modifying structure
- **Transform**: Create new lists from existing ones (discouraged but possible)
- **Composition**: Combine lists into larger structures
- **Element mutation**: Update simple values in-place (efficient)
- **Structural immutability**: Avoid changing list structure (length, positions)

## Zero-Length Lists

Empty lists are valid and represented as:
- Structure: `LIST:0`
- Stack: `LIST:0 LINK`
- Use cases: Initialization, containers, sentinels

## Implementation Notes

**LINK management**:
- LINK emission occurs only during list-construction contexts
- Each list level requires its own LINK marker
- LINK preservation is critical during stack operations
- LINK removal happens only when list is consumed/destructured

**Memory vs Stack distinction**:
- LIST headers store count in tagged value format
- Nested lists flatten into the containing stack structure
- LINK tags exist only on stack, never in serialized form
- Forward traversal pattern matches memory-based list processing

**Performance considerations**:
- Element access requires LINK traversal (O(1) to find start, O(i) to reach element i)
- List operations that need random access are inherently expensive
- Prefer head/tail operations when possible
- Construction is naturally efficient (left-to-right, single pass)

## List Traversal Patterns

### Index-Based Access

**Pattern**: Access elements by numeric position (0-indexed)

```tacit
( 1 2 3 ) 1 get    → 2        # Get element at index 1
( 1 2 3 ) 0 get    → 1        # Get first element  
( 1 2 3 ) 2 get    → 3        # Get last element
( 1 2 3 ) 5 get    → NIL      # Out of bounds: return NIL
```

**Stack effect**: `( list index — element | NIL )`

**Implementation strategy**:
1. Follow LINK to locate LIST:n header
2. Check if index >= n (bounds checking)
3. If out of bounds, return NIL (INTEGER tagged value with value 0)
4. Otherwise, navigate forward `index` positions from header
5. Extract element value

**Error Handling**: Out-of-bounds access returns NIL rather than throwing exceptions

**Performance**: O(i) where i is the target index, O(1) for out-of-bounds

## NIL Value Semantics

When list operations encounter error conditions (like out-of-bounds access), they return **NIL** rather than throwing exceptions:

- **NIL definition**: INTEGER tagged value with value 0
- **Purpose**: Graceful degradation for stack-based programming
- **Usage**: Check if result is NIL before using value
- **Benefit**: Eliminates exception handling complexity in stack environment

Example NIL handling:
```tacit
( 1 2 3 ) 5 get dup 0 = if drop "Not found" else "Found: " swap concat then
```

This pattern allows programs to continue executing and handle missing data gracefully.

### Forward Iteration Pattern

**Safe traversal** for processing all elements:

```tacit
: process-list ( list — )
  # Follow LINK to header
  # Read count n
  # Process elements 0 through n-1 sequentially
;
```

**Critical constraint**: Must traverse forward from header, never backward from TOS.

### Element Modification Patterns

**Structural modifications** (discouraged but possible - create new lists):

```tacit
: update-at ( list index new-value — new-list )
  # Traverse to target index
  # Create new list with modified element
  # Copy all other elements unchanged
;

: insert-at ( list index value — new-list )
  # Create new list with element inserted
  # Shift subsequent elements right
  # Increment list count
;

: remove-at ( list index — new-list )
  # Create new list without target element
  # Shift subsequent elements left  
  # Decrement list count
;
```

**Element mutations** (efficient for simple values):

```tacit
: set-at ( list index new-value — )
  # Follow LINK to locate LIST:n header
  # Navigate to target index
  # Verify element is simple value
  # Update element in-place
  # List structure remains unchanged
;

: increment-at ( list index — )
  # Locate element at index
  # Verify element is numeric
  # Increment value in-place
;
```

## Simple vs Compound Values

For efficient operations and clear mental models, TACIT distinguishes between:

### Simple Values
**Definition**: Single-slot tagged values that fit in exactly one stack cell

**Types**:
- Numbers (integers, floats)
- Strings (symbol table references)
- Symbols (digested strings with ` prefix)
- Built-in operations
- Code references (@symbol)
- Null/boolean values

**Characteristics**:
- Efficient comparison operations
- Predictable memory usage (exactly one stack cell)
- Can be copied/moved atomically
- Suitable as hash keys or search targets

### Compound Values
**Definition**: Multi-slot structures requiring traversal to process

**Types**:
- Lists (with LINK metadata)
- Future capsules/objects
- Complex nested structures

**Characteristics**:
- Require LINK-based navigation for safe access
- Forward traversal from known boundaries
- Structural awareness during operations
- Variable memory footprint

### Design Implications

**For list elements**:
- Simple values: Direct comparison, efficient searching
- Compound values: Structural comparison, recursive traversal required

**For performance**:
- Lists of simple values: Predictable access patterns
- Lists of compound values: Variable traversal costs

**For algorithms**:
- Simple values enable efficient sorting, searching, indexing
- Compound values require specialized handling

## List Composition Patterns

### Homogeneous Lists
**Pattern**: All elements are the same type

```tacit
( 1 2 3 4 5 )           # Numbers only
( "a" "b" "c" )         # Strings only  
( `red `green `blue )   # Symbols only
```

**Advantages**:
- Predictable processing
- Efficient batch operations
- Simple iteration patterns

### Heterogeneous Lists
**Pattern**: Mixed element types

```tacit
( 1 "hello" `symbol 3.14 )     # Mixed simple values
( 1 ( 2 3 ) "text" )           # Mixed simple and compound
```

**Considerations**:
- Require type checking during processing
- More complex iteration logic
- Flexible but potentially slower

### Nested Lists
**Pattern**: Lists containing other lists

```tacit
( 1 ( 2 3 ) ( 4 ( 5 6 ) 7 ) )  # Arbitrary nesting depth
```

**Navigation rules**:
- Each nested list has its own LINK
- Forward traversal required at each level
- Cannot traverse backward through nesting boundaries

## List Construction Strategies

### Left-to-Right Building
**Natural pattern**: Elements added in sequence

```tacit
# During parsing: ( 1 2 3 )
# Stack evolution:
# [] → [LIST:3] → [LIST:3, 1] → [LIST:3, 1, 2] → [LIST:3, 1, 2, 3] → [LIST:3, 1, 2, 3, LINK]
```

**Efficiency**: O(n) single pass construction

### Programmatic Building
**Pattern**: Building lists from other operations

```tacit
: build-range ( start end — list )
  # Create empty list
  # Loop from start to end
  # Append each number
  # Return completed list
;
```

### List Combination
**Pattern**: Joining existing lists

```tacit
: concat ( list1 list2 — combined-list )
  # Extract all elements from list1
  # Extract all elements from list2  
  # Create new list containing all elements
;
```

## Performance Characteristics

### Access Patterns
- **Head access**: O(1) with LINK navigation to header
- **Random access**: O(i) where i is index
- **Tail access**: O(n) requires full traversal
- **Sequential scan**: O(n) but cache-friendly

### Modification Patterns
- **Element mutation**: O(1) for simple values at known positions
- **Structural changes**: O(n) - must rebuild list structure
- **Prepend**: O(n) - must rebuild entire list
- **Append**: O(n) - must rebuild entire list  
- **Insert/Delete**: O(n) - must rebuild with shift
- **Update structure**: O(n) - must rebuild with substitution

### Memory Patterns
- **Allocation**: Contiguous stack allocation
- **Sharing**: No sharing - each list is independent
- **Fragmentation**: Minimal - lists are compact
- **Cache**: Sequential access is cache-friendly

## Related Specifications

- `docs/specs/tagged-values.md` - NaN-boxing and tag system
- `docs/specs/stack-operations.md` - Stack manipulation rules
- `docs/specs/maplists.md` - Key-value associative structures built on lists
- `docs/specs/capsules.md` - Object model using lists
