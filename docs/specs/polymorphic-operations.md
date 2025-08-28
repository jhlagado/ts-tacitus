# Polymorphic Operations Specification

> **Status:** draft specification for polymorphic reference semantics  
> **Scope:** stack operations, list operations, and reference handling  
> **Audience:** implementers and language designers

## Overview

This specification defines the expected behavior of TACIT operations when they encounter reference values (`STACK_REF`, `RSTACK_REF`, `GLOBAL_REF`) instead of direct values. It establishes consistent semantics across all operations and defines missing reference operations.

## Reference Types

- **STACK_REF**: Points to data in the data stack segment (SEG_STACK)
- **RSTACK_REF**: Points to data in the return stack segment (SEG_RSTACK)
- **GLOBAL_REF**: Points to data in the global segment (not yet implemented)

## Current Implementation Status

### ✅ Fully Polymorphic (Implemented)

These operations correctly handle all reference types:

- `length` - Returns slot count from LIST header via any reference
- `size` - Returns element count by traversal via any reference
- `slot` - Returns address of payload slot via any reference
- `elem` - Returns address of element start via any reference
- `fetch` - Materializes value from any reference type
- `store` - Writes to memory via any reference type
- `find` - Searches maplist via any reference

### 🔍 Value-Only Operations (Stack Operations)

These operations currently treat references as opaque values:

**Current Behavior**: Operations like `dup`, `drop`, `swap` copy/move reference values themselves, not the referenced data.

**Operations**: `dup`, `drop`, `swap`, `rot`, `revrot`, `over`, `nip`, `tuck`, `pick`

**Question**: Should these be reference-aware?

### 🔍 Partially Polymorphic (List Structure Operations)

These operations expect LIST values and may need reference support:

**Operations**: `cons`, `head`, `uncons`, `concat`, `pack`, `unpack`, `reverse`, `keys`, `values`

**Current Status**: Unknown - needs audit

### ❌ Missing Operations

These reference operations don't exist but are needed:

- `ref` - Convert list on data stack to STACK_REF
- `unref` - Materialize any reference to data stack

## Proposed Polymorphic Semantics

### Stack Operations: Reference-Transparent Model

**Principle**: Stack operations should treat references as transparent - they manipulate the reference values, not the referenced data.

**Rationale**:

- Maintains performance (no automatic dereferencing)
- Preserves reference identity
- Allows reference manipulation as first-class values
- Consistent with pointer semantics in low-level languages

**Examples**:

```tacit
RSTACK_REF(5) dup         → RSTACK_REF(5) RSTACK_REF(5)
STACK_REF(10) drop       → (removes the reference, not the referenced data)
RSTACK_REF(3) STACK_REF(8) swap → STACK_REF(8) RSTACK_REF(3)
```

### List Structure Operations: Automatic Polymorphism

**Principle**: Operations that logically operate on list structure should automatically handle references by dereferencing when needed.

**Implementation**: Use `resolveReference()` pattern established in `length`/`size` operations.

**Examples**:

```tacit
RSTACK_REF→[1,2,3] cons 4     → RSTACK_REF→[4,1,2,3] (modifies referenced list)
STACK_REF→[1,2,3] head       → 1 (returns first element)
RSTACK_REF→[] uncons          → RSTACK_REF→[] NIL
```

### Missing Reference Operations

#### `ref` Operation

**Stack Effect**: `( list -- STACK_REF )`
**Semantics**: Converts a list on the data stack to a STACK_REF pointing to its location
**Use Case**: Create references to stack data for later indirect access

```tacit
( 1 2 3 ) ref    → STACK_REF→[1,2,3] (list remains on stack, ref points to it)
```

#### `unref` Operation

**Stack Effect**: `( ref -- value )`
**Semantics**: Materializes the referenced data onto the data stack
**Polymorphic**: Works with STACK_REF, RSTACK_REF, GLOBAL_REF
**Use Case**: Convert any reference back to direct value

```tacit
RSTACK_REF→42     unref → 42
STACK_REF→[1,2,3] unref → ( 1 2 3 )
RSTACK_REF→[x,y]   unref → ( x y )
```

## Implementation Guidelines

### For Stack Operations

- Continue current behavior (reference-transparent)
- No changes needed

### For List Structure Operations

- Audit each operation for reference handling
- Apply polymorphic pattern:
  ```typescript
  if (tag === Tag.LIST) {
    // Direct list handling
  } else if (isRef(value)) {
    // Use resolveReference() or readReference()
  } else {
    // Error handling
  }
  ```

### For Missing Operations

- Implement `ref` operation to create STACK_REFs
- Implement `unref` operation with polymorphic reference resolution
- Add to opcode table and register in builtins

## Testing Requirements

- Test all polymorphic operations with each reference type
- Verify reference transparency in stack operations
- Test `ref`/`unref` round-trip behavior
- Test mixed reference types in complex expressions

## Future Considerations

- **GLOBAL_REF support**: All polymorphic operations will automatically support GLOBAL_REF when implemented
- **Nested references**: Should STACK_REF→RSTACK_REF be supported?
- **Reference arithmetic**: Operations on reference addresses themselves
- **Reference validation**: Runtime checks for valid references

## Summary

This specification establishes a clean two-tier approach:

1. **Stack operations**: Reference-transparent (manipulate references as values)
2. **List operations**: Automatically polymorphic (dereference when needed)

This provides both low-level control (via references) and high-level convenience (via automatic dereferencing) while maintaining consistent semantics across the entire operation set.
