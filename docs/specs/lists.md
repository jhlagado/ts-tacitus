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

- Lists are **structurally immutable** - no in-place modification
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

**Transforming lists** (all operations create new lists):
1. Use LINK to locate source list boundaries
2. Traverse forward through source elements
3. Apply transformation logic
4. Construct new list with its own LINK
5. Original list remains unchanged (structural immutability)

## Mutability Semantics

- **Read**: Extract elements without modifying structure
- **Transform**: Create new lists from existing ones
- **Composition**: Combine lists into larger structures
- **No mutation**: Original lists remain unchanged

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

## Related Specifications

- `docs/specs/tagged.md` - NaN-boxing and tag system
- `docs/specs/stack-operations.md` - Stack manipulation rules
- `docs/specs/capsules.md` - Object model using lists
