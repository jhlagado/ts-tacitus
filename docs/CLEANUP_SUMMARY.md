# Codebase Cleanup Summary

**Date:** 2025-01-XX  
**Status:** Priority 1 & 2 Complete

## Completed Work

### Priority 1: Quick Wins ✅

1. **Updated Deprecated Function Names**
   - `src/core/format-utils.ts`: Now uses `getCellFromRef`
   - `src/core/list.ts`: Now uses `getCellFromRef`
   - All core files now use new shorter names

2. **Removed Trivial Helpers**
   - Removed `getGlobalHeapSpan` (unused wrapper)
   - Inlined `headerAddrToHeaderCell` in `local-vars-transfer.ts`
   - Inlined `computeBaseCellFromHeader` in `local-vars-transfer.ts`
   - Removed redundant `GLOBAL_CELL_CAPACITY` constant

3. **Removed Dead Comments**
   - Cleaned up comments about removed/deprecated code
   - Removed "old alias removed" comments
   - Fixed duplicate JSDoc comments

4. **Extracted `copyListPayload` Helper**
   - Added to `src/core/list.ts`
   - Replaced duplicate copying logic in:
     - `global-heap.ts` (2 places)
     - `local-vars-transfer.ts` (1 place)
     - `query-ops.ts` (1 place)
   - Reduced code duplication significantly

### Priority 2: Consolidation ✅

1. **Consolidated List Formatting**
   - Merged `formatListFromStack` logic into `formatValue`
   - Simplified `formatListFromMemory` (now takes cell address directly)
   - Removed redundant `formatListFromStack` function
   - Cleaner, more maintainable formatting code

2. **Extracted `getListInfoOrFail` Helper**
   - Added to `src/core/list.ts`
   - Available for operations that should throw on invalid input
   - Note: Most query ops correctly return NIL, so this is for internal use

3. **Standardized Error Messages**
   - All LIST-related errors now use: `"Expected LIST header"`
   - Updated error messages in:
     - `getListLength`: "Value is not an LIST header" → "Expected LIST header"
     - `getListElemAddr`: "Invalid LIST header..." → "Expected LIST header"
     - `loadListFromReturn`: "Expected LIST header at return stack address" → "Expected LIST header"
   - Updated test expectations to match

4. **Simplified `formatValue` Branching**
   - Removed redundant `getTag(value)` check (already checked `isRef`)
   - Cleaner control flow
   - More efficient (fewer redundant checks)

## Code Quality Improvements

### Reduced Duplication
- **Before:** 4 separate list copying implementations
- **After:** 1 shared `copyListPayload` helper
- **Impact:** ~40 lines of duplicate code eliminated

### Cleaner APIs
- **Before:** Mixed use of deprecated and new function names
- **After:** Consistent use of shorter names throughout core
- **Impact:** Better adherence to style guide

### Better Error Messages
- **Before:** 4 different error message formats for LIST errors
- **After:** Single consistent format: "Expected LIST header"
- **Impact:** Easier debugging, more predictable errors

### Simplified Formatting
- **Before:** 3 separate list formatting functions with overlapping logic
- **After:** 2 functions with clear separation of concerns
- **Impact:** Easier to maintain, less code to test

## Files Modified

### Core Files
- `src/core/list.ts` - Added helpers, standardized errors
- `src/core/format-utils.ts` - Consolidated formatting, updated imports
- `src/core/global-heap.ts` - Uses `copyListPayload`, removed trivial helpers
- `src/core/refs.ts` - Already refactored (from previous work)

### Operations Files
- `src/ops/lists/query-ops.ts` - Uses `copyListPayload`, updated imports
- `src/ops/local-vars-transfer.ts` - Uses `copyListPayload`, inlined helpers, standardized errors

### Test Files
- `src/test/core/list.test.ts` - Updated error message expectations

## Test Results

✅ **All 1282 tests pass**

No regressions introduced. All changes are backward compatible (deprecated aliases still work).

## Remaining Work (Priority 3)

From the audit, these are lower priority but could be done incrementally:

1. **Rename `pushSimpleToGlobalHeap`** to shorter name (e.g., `gpushVal`)
2. **Consider consolidating** `pushListToGlobalHeap` and `gpushList` if possible
3. **Shorten variable names** throughout (do incrementally when touching code)
4. **Review and optimize** hot paths for C-portability

## Metrics

- **Lines of code removed:** ~60 (helpers, comments, duplication)
- **Functions extracted:** 2 (`copyListPayload`, `getListInfoOrFail`)
- **Error messages standardized:** 4 → 1 format
- **Formatting functions:** 3 → 2 (consolidated)
- **Test updates:** 3 test expectations updated

## Next Steps

The codebase is now cleaner and more maintainable. The remaining Priority 3 items can be done incrementally as code is touched. The foundation is solid for eventual C/Zig port.

