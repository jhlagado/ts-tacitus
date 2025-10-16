# Top-Level Variables Specification

> Status: Draft - Proposed Architecture

## Overview

This document specifies how variables work at the top level of Tacit programs. Currently, variables can only be declared inside function definitions. This proposal enables `var` declarations at the top level.

## Current Issues

The existing implementation:
1. **No Top-Level Locals**: Variables can only be declared inside function definitions
2. **Only Globals Available**: Top-level must use `global` keyword with different semantics than `var`
3. **Storage Collision Bug**: Current global implementation has GP=0 collision with slot 0

## Proposed Architecture

### Top-Level Frame

Top-level code execution occurs within a persistent root frame on the return stack:

- **Frame Location**: Return stack (SEG_RSTACK)
- **Lifetime**: Exists for entire program execution
- **Scope**: Top-level code only (not visible inside function definitions)
- **Storage**: Variable slots on return stack, compound data in global segment

### Variable Declaration at Top-Level

Syntax:
```tacit
10 var x           # Creates top-level variable x = 10
( 1 2 3 ) var y   # Creates top-level variable y = list
```

**Properties:**
- Declared with `var` keyword (same as function-local vars)
- Slots stored on return stack in root frame
- Dynamic allocation (slots grow as variables declared)
- Simple values stored directly in slots
- Compounds stored in global segment at GP, slot holds GLOBAL_REF

**Lifetime:**
- Exist until program ends
- Not automatically reclaimed

### Storage Layout

#### Return Stack (Top-Level Frame)
```
┌─────────────────────────┐
│ Top-level BP (saved)    │ ← Root frame starts here
├─────────────────────────┤
│ Slot 0: x = 10          │ Simple value
├─────────────────────────┤
│ Slot 1: y = GLOBAL_REF(0)│ Reference to compound
└─────────────────────────┘
```

#### Global Segment (Compound Storage)
```
┌─────────────────────────┐
│ List payload [1, 2, 3]  │ ← GP=0..2 (y's list data)
├─────────────────────────┤
│ List header LIST:3      │ ← GP=3
├─────────────────────────┤
│ (available for more compounds)
└─────────────────────────┘
```

### Symbol Table Integration

**Top-Level Variables:**
- Tag: `Tag.LOCAL`
- Payload: Slot number in root frame
- Lifetime: Program duration
- Scope: Top-level only (not visible inside function definitions)

### Access Patterns

```tacit
10 var x          # x = LOCAL(slot 0) in root frame
x                 # Load from root frame slot 0
20 -> x           # Store to root frame slot 0

: foo
  10 var y        # y = LOCAL(slot 0) in foo's frame
  x               # ERROR: x not visible in function
;
```

## Implementation Requirements

### Parser Modifications

The parser must:
- Allow `var` declarations at top-level (remove current restriction)
- Track top-level locals separately from function locals
- Emit InitVar targeting root frame for top-level variables
- Maintain existing behavior for function-local variables

### VM Initialization

The VM must:
- Initialize BP to RSTACK_BASE for root frame
- Track top-level local count separately
- Ensure root frame persists for program duration

## Examples

### Simple Values
```tacit
10 var x
20 var y
x y add .         # Prints: 30
x .               # Prints: 10
```

### Compound Values
```tacit
( 1 2 3 ) var mylist
mylist length .   # Prints: 3
mylist 0 elem fetch . # Prints: 1
```

### With Functions
```tacit
10 var globalX

: double
  2 mul
;

globalX double .  # Prints: 20

: makeLocal
  5 var localY
  localY .        # Prints: 5
;

makeLocal
globalX .         # Still works: 10
localY .          # ERROR: localY not in scope
```

### Capsules
```tacit
: make-counter
  0 var count
  capsule case
    'inc of 1 +> count ;
    'get of count ;
  ;
;

make-counter var myCounter
'inc myCounter dispatch
'get myCounter dispatch .  # Prints: 1
```

## Constraints

1. Top-level variables not visible inside function definitions
2. Top-level frame size limited by return stack size
3. Compounds in global segment are permanent (not reclaimed)
4. Symbol table tracks top-level locals separately from function locals

## Migration Path

1. **Phase 1**: Implement root frame on return stack
2. **Phase 2**: Allow top-level `var` declarations
3. **Phase 3**: Test with simple values
4. **Phase 4**: Test with compounds (lists, capsules)
5. **Phase 5**: Update documentation and examples

## Related Specifications

- `specs/variables-and-refs.md` - Local variables in functions
- `specs/vm-architecture.md` - Memory segments
- `specs/capsules.md` - Capsule storage

---

## Open Questions

1. Should top-level variables ever be visible in functions? (Currently: No)
2. How to handle name conflicts between top-level vars and function definitions?
3. Should there be a way to explicitly "export" top-level vars to functions?
