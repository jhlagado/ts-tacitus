# TACIT Lists Specification

## Overview

TACIT lists are length-prefixed, stack-allocated flat structures that serve as the primary compound data type. Lists are constructed left-to-right, stored contiguously, and use LINK metadata for stack representation.

## Structure

```
LIST structure:
[LIST:n] [element1] [element2] ... [elementN]

Stack representation:
[LIST:n] [element1] [element2] ... [elementN] [LINK]
                                               ↑
                                        stack-only metadata
```

## Key Properties

- **Length-prefixed**: `LIST:n` header contains count
- **Elements in order**: Values follow header sequentially  
- **LINK for stack**: Stack-only backward pointer to locate structure
- **Flat serialization**: No nested structure pointers
- **Word-aligned**: Each element occupies one stack cell

## Constraints

- Lists are **structurally immutable** - no in-place modification
- LINK tags are **stack-only** - not serialized to memory
- Maximum list length: 65535 elements (16-bit count)
- All elements must be simple values (tagged 32-bit cells)

## Stack Effects

```tacit
( )            → LIST:0 LINK           # empty list
( 1 2 3 )      → LIST:3 1 2 3 LINK     # three elements
( 1 ( 2 ) 3 )  → LIST:3 1 LIST:1 2 LINK 3 LINK  # nested
```

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

- LINK emission only in list-construction contexts
- LIST headers stored with count in tagged value
- Nested lists flatten into containing structure
- Stack operations must preserve LINK metadata

## Related Specifications

- `specs/tagged-values.md` - NaN-boxing and tag system
- `specs/stack-operations.md` - Stack manipulation rules
- `specs/capsules.md` - Object model using lists
