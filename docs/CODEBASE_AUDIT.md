# Comprehensive Codebase Audit

**Date:** 2025-01-XX  
**Focus:** Core and Lang folders - Redundancy, Repetition, Inconsistency  
**Goal:** Identify fluff and awkward code for C/Zig port

## Executive Summary

This audit identifies redundant code, inconsistent APIs, and opportunities for simplification in `src/core` and `src/lang`. The codebase needs to be lean and portable for eventual C/Zig migration.

## Critical Issues

### 1. Inconsistent Function Name Usage

**Problem:** New shorter names exist but old names still used in core files.

**Files:**
- `src/core/format-utils.ts:7` - imports `getAbsoluteCellIndexFromRef` (should use `getCellFromRef`)
- `src/core/list.ts:10` - imports `getAbsoluteCellIndexFromRef` (should use `getCellFromRef`)

**Fix:** Update imports to use new names. Old names are deprecated aliases.

---

### 2. Redundant List Copying Logic

**Problem:** Three different functions copy list payloads with nearly identical logic.

**Functions:**
1. `gpushList` (global-heap.ts:88) - copies from data stack to global heap
2. `rpushList` (local-vars-transfer.ts:41) - copies from data stack to return stack  
3. `pushListToGlobalHeap` (global-heap.ts:48) - copies from memory source to global heap

**Pattern:** All three:
- Get header and slot count
- Handle empty list case
- Loop copying payload slots
- Write header
- Update pointer (gp or rsp)

**Recommendation:** Extract common `copyListPayload(vm, srcBase, destBase, slots)` helper.

```typescript
// Proposed helper
function copyListPayload(
  vm: VM,
  srcBase: number,  // absolute cell index
  destBase: number, // absolute cell index
  slots: number
): void {
  for (let i = 0; i < slots; i++) {
    const val = vm.memory.readCell(srcBase + i);
    vm.memory.writeCell(destBase + i, val);
  }
}
```

---

### 3. Inconsistent Global Heap API

**Problem:** Three different ways to push to global heap with inconsistent naming.

**Functions:**
- `pushSimpleToGlobalHeap` (22 chars) - pushes simple value
- `pushListToGlobalHeap` (20 chars) - pushes list from memory source
- `gpushList` (9 chars) - pushes list from data stack

**Issues:**
- `gpushList` is shorter and follows `gpush` pattern, but others use verbose names
- `pushListToGlobalHeap` and `gpushList` do similar things but different sources
- `pushSimpleToGlobalHeap` could be `gpush` (but `gpush` already exists for raw push)

**Recommendation:**
- Keep `gpushList` (already terse)
- Rename `pushSimpleToGlobalHeap` → `gpushVal` or just use `gpush` + `createGlobalRef`
- Consider if `pushListToGlobalHeap` is needed or can be replaced by `gpushList` pattern

---

### 4. Trivial Helper Functions

**Problem:** One-line helpers that add no value.

**In `local-vars-transfer.ts`:**
```typescript
function headerAddrToHeaderCell(headerAddrBytes: number): number {
  return headerAddrBytes / CELL_SIZE;
}

function computeBaseCellFromHeader(headerCell: number, slotCount: number): number {
  return headerCell - slotCount;
}
```

**Recommendation:** Inline these. They're used 2-3 times each and add no abstraction value.

**In `global-heap.ts`:**
```typescript
export function getGlobalHeapSpan(_vm: VM, headerValue: number): number {
  return getListLength(headerValue) + 1;
}
```

**Recommendation:** Remove. Callers can do `getListLength(header) + 1` directly.

---

### 5. Format Utils Complexity

**Problem:** `formatValue` has complex branching and three separate format functions.

**Functions:**
- `formatValue` - main dispatcher with complex branching
- `formatListFromStack` - formats list from stack array
- `formatListFromMemory` - formats list from memory address
- `formatList` - formats list by consuming from stack

**Issues:**
- `formatListFromStack` and `formatListFromMemory` have similar logic
- `formatValue` checks `isRef`, then `getTag(value) === Tag.LIST` (redundant check)
- Materialization logic duplicated

**Recommendation:**
- Consolidate `formatListFromStack` and `formatListFromMemory` into one helper
- Simplify `formatValue` branching
- Consider if all three are needed

---

### 6. Redundant List Bounds Checking

**Problem:** Pattern repeated in many ops: `getListBounds` → check null → use info.

**Found in:**
- `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, `fetchOp`, `storeOp` (query-ops.ts)
- `headOp`, `tailOp`, `reverseOp` (structure-ops.ts)
- Multiple other ops

**Pattern:**
```typescript
const info = getListBounds(vm, value);
if (!info || !isList(info.header)) {
  // handle error
  return;
}
// use info.header, info.baseAddrBytes, etc.
```

**Recommendation:** Extract to `getListInfoOrFail(vm, value)` that throws on invalid input.

---

### 7. Inconsistent Error Messages

**Problem:** Similar errors use different wording.

**Examples:**
- "Expected LIST header at TOS" vs "Value is not an LIST header"
- "store expects REF address" vs "fetch expects REF address"
- "Cannot assign simple to compound or compound to simple" (repeated verbatim)

**Recommendation:** Standardize error message format and wording.

---

### 8. Unused/Deprecated Code

**Problem:** Comments and code referencing removed features.

**Found:**
- `src/core/list.ts:182` - comment about deprecated wrapper
- `src/core/format-utils.ts:198` - "old alias removed"
- `src/ops/local-vars-transfer.ts:103` - comment about removed function
- `src/ops/local-vars-transfer.ts:146` - comment about legacy function
- `src/ops/local-vars-transfer.ts:195` - comment about removed API

**Recommendation:** Remove all comments about removed code. They add no value.

---

### 9. Verbose Variable Names

**Problem:** Long variable names that could be shorter.

**Examples:**
- `absoluteCellIndex` → `absCell` or `cell` (in context)
- `headerCellIndex` → `headerCell` or `hdr`
- `destinationBaseCellIndex` → `destBase` or `base`
- `sourceBaseAddressBytes` → `srcBase` or `base`

**Recommendation:** Use shorter names per style guide (1-3 syllables max).

---

### 10. Redundant Type Checks

**Problem:** Multiple checks for same condition.

**In `format-utils.ts:166-182`:**
```typescript
if (isRef(value)) {
  // ...
  if (getTag(header) === Tag.LIST) {  // already checked isRef
    return formatListFromMemory(...);
  }
}
// ...
if (getTag(value) === Tag.LIST) {  // redundant with isRef check above
  // ...
}
```

**Recommendation:** Simplify branching logic.

---

## File-by-File Issues

### `src/core/format-utils.ts`
- Line 7: Use `getCellFromRef` instead of deprecated name
- Line 168: Use `getCellFromRef` instead of deprecated name
- Lines 109-131: `formatListFromStack` - could merge with `formatListFromMemory`
- Line 198: Remove "old alias removed" comment

### `src/core/list.ts`
- Line 10: Use `getCellFromRef` instead of deprecated name
- Lines 161, 164: Use `getCellFromRef` instead of deprecated name
- Line 182: Remove deprecated comment

### `src/core/global-heap.ts`
- Line 11: `GLOBAL_CELL_CAPACITY = GLOBAL_SIZE` - redundant constant
- Line 74-76: `getGlobalHeapSpan` - trivial wrapper, remove
- Lines 33-39: `pushSimpleToGlobalHeap` - consider renaming or inlining
- Lines 48-66: `pushListToGlobalHeap` - consider if needed vs `gpushList`

### `src/ops/local-vars-transfer.ts`
- Lines 21-27: Trivial helpers - inline
- Line 103: Remove comment about removed function
- Line 146: Remove comment about legacy function
- Line 195: Remove comment about removed API

### `src/core/utils.ts`
- All good - simple utilities, well-structured

### `src/core/refs.ts`
- All good - already refactored with shorter names

### `src/core/dictionary.ts`
- Lines 29, 33, 39: Comments are useful (explain why), keep

---

## Recommendations by Priority

### Priority 1: High Impact, Low Risk
1. ✅ **Update deprecated function names** in `format-utils.ts` and `list.ts` - COMPLETE
2. ✅ **Remove trivial helpers**: `getGlobalHeapSpan`, inline `headerAddrToHeaderCell`, `computeBaseCellFromHeader` - COMPLETE
3. ✅ **Remove dead comments** about removed code - COMPLETE
4. ✅ **Extract `copyListPayload` helper** to reduce duplication - COMPLETE

### Priority 2: Medium Impact, Medium Risk
1. ✅ **Consolidate list formatting** functions - COMPLETE (merged formatListFromStack into formatValue, simplified formatListFromMemory)
2. ✅ **Extract `getListInfoOrFail`** helper for common pattern - COMPLETE (added to list.ts, available for use)
3. ✅ **Standardize error messages** - COMPLETE (all LIST errors now use "Expected LIST header")
4. ✅ **Simplify `formatValue` branching** - COMPLETE (removed redundant checks, cleaner flow)

### Priority 3: Low Impact, High Risk
1. **Rename `pushSimpleToGlobalHeap`** to shorter name
2. **Consider consolidating** `pushListToGlobalHeap` and `gpushList`
3. **Shorten variable names** throughout (do incrementally)

---

## Code Patterns to Watch

### Good Patterns (Keep)
- Simple, focused functions
- Clear naming (after refactoring)
- Minimal abstraction layers
- Direct memory access patterns

### Bad Patterns (Fix)
- Trivial one-line wrappers
- Duplicate copying logic
- Complex branching in formatters
- Comments about removed code
- Inconsistent naming conventions

---

## Success Criteria

After cleanup:
- ✅ No deprecated function names in core/lang
- ✅ No trivial one-line wrappers
- ✅ No duplicate list copying logic
- ✅ No comments about removed code
- ✅ Consistent error messages
- ✅ All functions follow style guide (1-3 syllables)
- ✅ Code is lean and C-portable

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 hours)
1. Update deprecated function names
2. Remove trivial helpers
3. Remove dead comments
4. Extract `copyListPayload` helper

### Phase 2: Consolidation (2-3 hours)
1. Consolidate list formatting
2. Extract `getListInfoOrFail`
3. Standardize error messages

### Phase 3: Polish (1-2 hours)
1. Simplify `formatValue`
2. Review and shorten variable names
3. Final review for C-portability

---

## Notes for C/Zig Port

- Keep memory access patterns simple (direct cell reads/writes)
- Avoid complex abstractions
- Prefer explicit loops over functional patterns
- Keep function signatures simple
- Minimize heap allocations
- Use fixed-size buffers where possible

