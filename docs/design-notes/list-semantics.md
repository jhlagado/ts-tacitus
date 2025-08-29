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

## Test Coverage Needed

- `concat` with non-list LHS and RHS
- `concat` with mixed list/non-list arguments  
- `cons` with non-list first argument
- Empty list handling in both operations
- Nested vs flattened behavior verification