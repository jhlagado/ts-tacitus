# List Semantics Design Note

## Overview

This note documents the key semantic decisions for list operations and the polymorphic `concat`, particularly around edge cases and behavior.

## Core Operations

### `concat` (simple + list) - Element Addition
- **Stack effect:** `( list value — list' )`
- **Semantics:** Always adds `value` as a single element at the front
- **Nesting:** Compounds (including lists) are preserved as single elements
- **Edge cases:** 
  - If first arg is not a list → error/NIL
  - Empty list: `x ( ) concat` → `( x )`

### `concat` (list + list) - List Combination  
- **Stack effect:** `( listA listB — listC )`
- **Primary:** Merges elements of both lists into a flat structure
- **Polymorphism:**
  - simple + list → prepend
  - list + simple → append
  - list + list → flatten

## Key Distinction

```tacit
( 1 2 ) ( 3 4 ) concat  → ( 3 4 1 2 )        // flattened
```

## Current Implementation Notes

- `concat` is polymorphic and handles all combinations: simple+list (prepend), list+simple (append), list+list (flatten), simple+simple (create 2‑element list).
- Empty list: `x ( ) concat` → `( x )` and `( ) x concat` → `( x )`.

## Proposed: Polymorphic `concat` Implementation

### Design Goal
Use a single polymorphic `concat` that chooses optimal implementation based on argument types.

### Type-Based Dispatch Table

| LHS Type | RHS Type | Operation       | Complexity | Implementation                         |
|----------|----------|------------------|------------|----------------------------------------|
| simple   | simple   | create list      | O(1)       | Push both, create `LIST:2` header      |
| list     | simple   | append           | O(1)       | Increment header count                 |
| simple   | list     | prepend          | O(n)       | Shift payload, update header           |
| list     | list     | flatten/concatenate | O(n)    | Merge payloads, combine headers        |

### Implementation Plan

#### Phase A: Argument Analysis
1. Use `findElement(vm, 0)` and `findElement(vm, rhs_size)` to determine types
2. Check if elements are simple (size=1) or compound (size>1) 
3. For compounds, verify they're lists vs other compound types

#### Phase B: Dispatch Logic
```typescript
function concatOp(vm: VM): void {
  vm.ensureStackSize(2, 'concat');
  
  // Analyze arguments without popping yet (element-aware)
  const [, rhsSize] = findElement(vm, 0);
  const [, lhsSize] = findElement(vm, rhsSize);
  
  const rhsIsSimple = (rhsSize === 1);
  const lhsIsSimple = (lhsSize === 1);
  
  // Determine structural types using tags, not just slot sizes
  const rhsIsList = !rhsIsSimple && isList(peekBySlots(0));
  const lhsIsList = !lhsIsSimple && isList(peekBySlots(rhsSize));
  
  // Dispatch to appropriate sub-function
  if (lhsIsSimple && rhsIsSimple) {
    concatSimpleSimple(vm);
  } else if (lhsIsList && rhsIsSimple) {
    concatListSimple(vm); // O(1) append!
  } else if (lhsIsSimple && rhsIsList) {
    concatSimpleList(vm);
  } else if (lhsIsList && rhsIsList) {
    concatListList(vm);
  } else {
    throw new Error('concat: unsupported compound types');
  }
}
```

#### Phase C: Sub-Operations
1. **`concatSimpleSimple`**: Create new 2-element list
2. **`concatListSimple`**: Your efficient O(1) append (increment header)
3. **`concatSimpleList`**: Prepend simple to list (shift payload)
4. **`concatListList`**: Current concatenation logic

### Migration Strategy
1. Implement new polymorphic `ccat` (temporary) alongside existing `concat`
2. Add comprehensive tests for all type combinations 
3. Verify `ccat` works correctly without breaking existing tests
4. Replace `concat` with `ccat` implementation after verification
5. Remove temporary `ccat` name and old operations
6. Update documentation and examples

### Benefits
- Single intuitive operation name
- Optimal performance per type combination
- Eliminates need to remember separate operation names
- Matches mathematical concatenation concept
