# List Semantics Design Note

## Overview

This note documents the key semantic decisions for list operations `concat` and `cons`, particularly around edge cases and fallback behavior.

## Core Operations

### `cons` - Element Addition
- **Stack effect:** `( list value — list' )`
- **Semantics:** Always adds `value` as a single element at the front
- **Nesting:** Compounds (including lists) are preserved as single elements
- **Edge cases:** 
  - If first arg is not a list → error/NIL
  - Empty list: `( ) x cons` → `( x )`

### `concat` - List Combination  
- **Stack effect:** `( listA listB — listC )`
- **Primary:** Merges elements of both lists into a flat structure
- **Fallback:** If `listB` is not a list → behaves as `cons listA listB`
- **Flattening:** Unlike `cons`, `concat` merges list contents, not list structures

## Key Distinction

```tacit
( 1 2 ) ( 3 4 ) cons    → ( ( 3 4 ) 1 2 )    // nested
( 1 2 ) ( 3 4 ) concat  → ( 3 4 1 2 )        // flattened
```

## Current Implementation Issues

### 1. `concat` Fallback Logic
- **Spec requirement:** "If `ys` is not a list, treat as `cons xs ys`"
- **Current implementation:** ✅ Correctly calls `consOp(vm)` when RHS is not a list
- **Edge case:** What if LHS is also not a list? (spec unclear)

### 2. Error Handling Consistency
- **`cons`:** Returns NIL if first arg is not a list
- **`concat`:** Falls back to cons behavior rather than erroring
- **Question:** Should non-list LHS in concat return NIL or error?

### 3. Empty List Handling
- **Current:** Both operations handle `LIST:0` correctly
- **Behavior:** Well-defined in specs

## Recommendations

1. **Keep current fallback:** `concat` fallback to `cons` is spec-compliant
2. **Document edge case:** When LHS is not a list in `concat`, current behavior returns NIL (via cons failure)
3. **Add tests:** Lock current fallback behavior with comprehensive edge case tests
4. **No semantic changes needed:** Implementation matches spec requirements

## Proposed: Polymorphic `concat` Implementation

### Design Goal
Replace separate `cons`/`append`/`concat` operations with a single polymorphic `concat` that chooses optimal implementation based on argument types.

### Type-Based Dispatch Table

| LHS Type | RHS Type | Operation | Complexity | Implementation |
|----------|----------|-----------|------------|----------------|
| simple   | simple   | create list | O(1) | Push both, create `LIST:2` header |
| list     | simple   | append | O(1) | Increment header count (efficient!) |
| simple   | list     | prepend | O(n) | Shift list payload, update header |
| list     | list     | concatenate | O(n) | Merge payloads, combine headers |

### Implementation Plan

#### Phase A: Argument Analysis
1. Use `findElement(vm, 0)` and `findElement(vm, rhs_size)` to determine types
2. Check if elements are simple (size=1) or compound (size>1) 
3. For compounds, verify they're lists vs other compound types

#### Phase B: Dispatch Logic
```typescript
function concatOp(vm: VM): void {
  vm.ensureStackSize(2, 'concat');
  
  // Analyze arguments without popping yet
  const [rhsNextSlot, rhsSize] = findElement(vm, 0);
  const [lhsNextSlot, lhsSize] = findElement(vm, rhsSize);
  
  const rhsIsSimple = (rhsSize === 1);
  const lhsIsSimple = (lhsSize === 1);
  
  // Peek to check if compounds are lists
  const rhsHeader = vm.peekAt(0);
  const lhsHeader = vm.peekAt(rhsSize);
  const rhsIsList = !rhsIsSimple && isList(rhsHeader);
  const lhsIsList = !lhsIsSimple && isList(lhsHeader);
  
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
    // Error: unsupported compound types
    vm.push(NIL);
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