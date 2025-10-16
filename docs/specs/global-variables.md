# Global Variables and Top-Level Execution Specification

> Status: Draft - Proposed Architecture

## Overview

This document specifies how global variables and top-level code execution work in Tacit. The design separates concerns between ephemeral top-level locals and promoted persistent globals.

## Current Issues (Pre-Refactor)

The existing implementation has critical design flaws:

1. **Storage Collision**: Global variable slots and compound storage (GP) both start at offset 0 in the global segment
2. **No Top-Level Locals**: Variables can only be declared inside function definitions
3. **Static Slot Allocation**: All global slots must be known at compile time
4. **Compound Overwrite**: Storing a compound in a global overwrites the slot itself

## Proposed Architecture

### Top-Level Frame

Top-level code execution occurs within a persistent root frame on the return stack:

- **Frame Location**: Return stack (SEG_RSTACK)
- **Lifetime**: Exists for entire program execution
- **Scope**: Top-level code only (not visible inside function definitions)
- **Storage**: Local variable slots on return stack

### Local Variables at Top-Level

Syntax:
```tacit
10 var x           # Creates top-level local x = 10
( 1 2 3 ) var y   # Creates top-level local y = reference to list on return stack
```

**Properties:**
- Declared with `var` keyword (same as function-local vars)
- Stored on return stack in root frame
- Dynamic allocation (slots grow as vars declared)
- Simple values stored directly
- Compounds stored on return stack, slot holds RSTACK_REF

**Lifetime:**
- Exist until explicitly destroyed or program ends
- Not automatically reclaimed like function locals

### Global Variables (Promoted)

Syntax:
```tacit
10 var x
x global          # Promotes x to global (permanent)
```

Or combined:
```tacit
10 var x global   # Declare and immediately promote
```

**Properties:**
- Created via `global` keyword operating on top-level local
- Stored in dedicated global segment (SEG_GLOBAL)
- Registered in symbol table as permanent entry
- Simple values stored directly at GP bump pointer
- Compounds copied to global segment, GP holds reference

**Lifetime:**
- Permanent for program duration
- Visible in all scopes (top-level and function definitions)

### Storage Layout

#### Return Stack (Top-Level Frame)
```
┌─────────────────────────┐
│ Top-level BP (saved)    │ ← Root frame starts here
├─────────────────────────┤
│ Slot 0: x (simple)      │ Top-level local
├─────────────────────────┤
│ Slot 1: y (RSTACK_REF)  │ Points to list below
├─────────────────────────┤
│ List payload [1, 2, 3]  │
├─────────────────────────┤
│ List header LIST:3      │
└─────────────────────────┘
```

#### Global Segment (Promoted Globals)
```
┌─────────────────────────┐
│ Global: x = 10          │ ← GP=0 (simple value)
├─────────────────────────┤
│ List payload [1, 2, 3]  │ ← GP=1..3
├─────────────────────────┤
│ List header LIST:3      │ ← GP=4
├─────────────────────────┤
│ Global: y = GLOBAL_REF(4)│ ← GP=5 (reference to list)
└─────────────────────────┘
```

### Symbol Table Integration

**Top-Level Locals:**
- Tag: `Tag.LOCAL`
- Payload: Slot number in root frame
- Lifetime: Program duration (but not in symbol table permanently)
- Scope: Top-level only

**Globals:**
- Tag: `Tag.GLOBAL_REF`
- Payload: Cell index in global segment
- Lifetime: Permanent
- Scope: All scopes
- Symbol table entry persists

### Promotion Semantics

When `global` is executed on a top-level local:

1. **Resolve local**: Read value from root frame slot
2. **Copy if compound**: If value is RSTACK_REF to compound, copy entire compound to global segment
3. **Allocate global space**: 
   - Simple: Store at GP, increment by 1
   - Compound: Copy to GP, store reference, increment by compound size
4. **Update symbol table**: Change entry from LOCAL to GLOBAL_REF with new payload
5. **Optional**: Reclaim root frame slot (or leave for reuse)

### Access Patterns

**Top-Level:**
```tacit
10 var x          # x = LOCAL(slot 0)
x                 # Load from root frame slot 0
20 -> x           # Store to root frame slot 0

x global          # Promote: x = GLOBAL_REF(0)
x                 # Load from global segment
30 -> x           # Store to global segment
```

**Inside Function:**
```tacit
: foo
  x               # Load from global (if x promoted)
  10 var y        # Local to function
;
```

## Opcode Modifications

### New Opcodes

None required - existing opcodes handle both cases via symbol table tags.

### Modified Behavior

**Parser `emitVarDecl`:**
- Allow at top-level (stores in root frame)
- Track root frame slot count

**Parser `emitGlobalDecl`:**
- Renamed to `emitPromoteGlobal`
- Expects top-level local on stack
- Copies to global segment
- Updates symbol table entry

## Migration Path

1. **Phase 1**: Implement root frame on return stack
2. **Phase 2**: Allow top-level `var` declarations
3. **Phase 3**: Implement `global` promotion keyword
4. **Phase 4**: Migrate existing global declarations to new syntax
5. **Phase 5**: Remove old global declaration syntax

## Examples

### Simple Value
```tacit
10 var x
x global          # Promotes to global
x .               # Prints: 10

: foo x 2 mul ; 
foo .             # Prints: 20 (global visible in function)
```

### Compound Value
```tacit
( 1 2 3 ) var mylist
mylist global                # Copies list to global segment
mylist length .              # Prints: 3
```

### Capsule
```tacit
: make-counter
  0 var count
  capsule case
    'inc of 1 +> count ;
    'get of count ;
  ;
;

make-counter var counter     # Top-level local
counter global               # Promote (copies capsule to global)
'inc counter dispatch
'get counter dispatch .      # Prints: 1
```

## Constraints

1. `global` can only promote top-level locals, not function-local vars
2. Compounds in global segment are immutable (no in-place modification of payload)
3. Global symbol table entries are permanent (no deletion)
4. Root frame size limited by return stack size

## Related Specifications

- `specs/variables-and-refs.md` - Local variables
- `specs/vm-architecture.md` - Memory segments
- `specs/capsules.md` - Capsule storage

---

## Open Questions

1. Should we allow deletion of globals?
2. Should top-level locals be automatically promoted at program end?
3. How to handle shadowing between top-level locals and globals?
4. Should we have a separate keyword for declare-and-promote?
