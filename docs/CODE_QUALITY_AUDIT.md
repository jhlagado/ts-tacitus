# Code Quality Audit

**Date:** 2025-01-XX  
**Purpose:** Identify code quality issues, repetition, and areas for improvement

## Summary

This audit identifies:
1. Long verbose function/variable names that violate style guide
2. Repetitive code patterns that could be consolidated
3. Missing or inadequate JSDoc documentation
4. Excessive inline comments (AI-generated noise)
5. Opportunities for utility extraction

## Issues Found

### 1. Long Function Names

#### `src/core/refs.ts`
- `getAbsoluteCellIndexFromRef` (28 chars) → `getCellFromRef` or `refToCell`
- `getByteAddressFromRef` (22 chars) → `refToByte` or `getByteAddr`
- `createGlobalRef` (16 chars) → OK (3 syllables, acceptable)

#### `src/core/global-heap.ts`
- `pushSimpleToGlobalHeap` (22 chars) → `gpush` or `gpushVal`
- `pushListToGlobalHeap` (20 chars) → Already has `gpushList` alias ✅
- `getGlobalHeapSpan` (17 chars) → `getSpan` (in context) or `gspan`

#### `src/ops/lists/query-ops.ts`
- `getAbsoluteCellIndexFromRef` (used, but from core) → See refs.ts

#### `src/core/vm.ts`
- `ensureStackSize` (16 chars) → `ensureStack` or `checkStack`
- `ensureRStackSize` (17 chars) → `ensureRStack` or `checkRStack`
- `unsafeSetBPBytes` (16 chars) → OK (internal, marked unsafe)

#### `src/lang/meta/executor.ts`
- `executeImmediateWord` (21 chars) → `execImmediate` or `execWord`
- `runImmediateCode` (17 chars) → `runCode` (in context)

#### `src/test/utils/vm-test-utils.ts`
- `executeTacitCode` (18 chars) → `execTacit` or `runTacit`
- `executeTacitWithState` (23 chars) → `execTacitState` or `runTacitState`
- `getFormattedStack` (18 chars) → `fmtStack` or `getStackFmt`
- `captureTacitOutput` (19 chars) → `captureOutput` or `getOutput`
- `pushTaggedValue` (16 chars) → `pushTagged` or `pushVal`
- `getStackWithTags` (17 chars) → `getStackTags` or `stackTags`
- `extractListFromStack` (20 chars) → `extractList` or `getList`
- `countListsOnStack` (17 chars) → `countLists` or `listCount`
- `runOperationTests` (18 chars) → `runOpTests` or `testOps`
- `verifyTaggedValue` (18 chars) → `verifyTagged` or `checkVal`
- `verifyStackContains` (20 chars) → `verifyStack` or `checkStack`
- `expectStackUnderflow` (21 chars) → `expectUnderflow` or `checkUnderflow`
- `verifyStackDepth` (17 chars) → `verifyDepth` or `checkDepth`
- `assertNoUnderflow` (18 chars) → `assertNoUnder` or `checkNoUnder`

### 2. Long Variable Names

#### Common Patterns
- `absoluteCellIndex` → `absCell` or `cell` (in context)
- `relativeCellIndex` → `relCell` or `cell`
- `numberOfSlots` → `slots` or `n`
- `destinationBaseCellIndex` → `base` or `dest`
- `sourceBaseAddressBytes` → `srcBase` or `base`
- `headerCellIndex` → `headerCell` or `hdr`
- `targetHeaderCell` → `targetCell` or `tgt`
- `currentDefinition` → `def` (in context)
- `fallthroughOffset` → `fallOffset` or `offset`

### 3. Repetitive Code Patterns

#### List Bounds Checking
- Pattern: Check if value is list, get bounds, validate
- Found in: `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, `fetchOp`, `storeOp`
- Opportunity: Extract to helper `getListInfo(vm, value)` that returns bounds or null

#### REF Validation
- Pattern: `getAbsoluteCellIndexFromRef(ref)` with error handling
- Found in: Multiple files
- Opportunity: Already extracted, but name is too long

#### Stack Size Checking
- Pattern: `ensureStackSize(vm, n, op)` before operations
- Found in: Most op functions
- Opportunity: Already extracted ✅

#### List Copying Logic
- Pattern: Copy payload slots from source to destination
- Found in: `gpushList`, `rpushList`, `pushListToGlobalHeap`
- Opportunity: Extract common copy logic to `copyListPayload(vm, src, dest, slots)`

### 4. Missing JSDoc

#### `src/core/utils.ts`
- ✅ Has JSDoc for most functions
- ⚠️ Some arrow functions missing JSDoc (but they're simple)

#### `src/core/refs.ts`
- ✅ Has JSDoc for all exported functions

#### `src/ops/lists/query-ops.ts`
- ✅ Has JSDoc for op functions
- ⚠️ Helper functions like `storeGlobal`, `storeLocal` need JSDoc

#### `src/core/global-heap.ts`
- ✅ Has JSDoc for exported functions
- ⚠️ Internal `ensureGlobalCapacity` needs JSDoc

### 5. Excessive Inline Comments

#### `src/ops/builtins.ts`
- Lines 127, 297-299, 379-380: Comments that restate code
- Line 392: Comment about removed feature (can be removed)
- Lines 395-437: Debug console.log comments (can be simplified)

#### `src/ops/core/core-ops.ts`
- Lines 138, 194, 199-200, 206, 251: Comments explaining byte/cell conversion
- Some are useful (explain why), but could be more concise

#### `src/ops/heap/global-heap-ops.ts`
- Lines 24, 26, 28-29, 38, 43, 49, 54, 56: Comments explaining logic
- Some are useful, but some restate the obvious

#### `src/ops/lists/query-ops.ts`
- Line 33: Comment about removed feature (can be removed)
- Line 76: Comment explaining traversal (useful, keep)

### 6. Duplicate Functions

#### `src/core/refs.ts`
- `readRefValue` and `readReference` (if it exists) - see SINGLE_LINE_FUNCTION_AUDIT.md
- `isDataRef` (deprecated) - should be removed

#### `src/core/tagged.ts`
- `isRefCounted` (unused) - should be removed

## Recommendations

### Priority 1: High Impact, Low Risk
1. **Rename long function names** in `src/core/refs.ts`:
   - `getAbsoluteCellIndexFromRef` → `getCellFromRef`
   - `getByteAddressFromRef` → `refToByte`

2. **Add JSDoc** to helper functions in `src/ops/lists/query-ops.ts`:
   - `storeGlobal`, `storeLocal`, `resolveSlot`

3. **Remove deprecated/unused functions**:
   - `isDataRef` from `src/core/refs.ts`
   - `isRefCounted` from `src/core/tagged.ts`

### Priority 2: Medium Impact, Medium Risk
1. **Extract common list bounds pattern**:
   - Create `getListInfo(vm, value)` helper
   - Use in `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, etc.

2. **Extract list copy logic**:
   - Create `copyListPayload(vm, src, dest, slots)` helper
   - Use in `gpushList`, `rpushList`, etc.

3. **Clean up inline comments**:
   - Remove obvious comments
   - Consolidate useful comments into JSDoc

### Priority 3: Low Impact, High Risk
1. **Rename test utility functions**:
   - Update `src/test/utils/vm-test-utils.ts` function names
   - Update all test files that use them

2. **Rename long variable names**:
   - Update throughout codebase
   - Do incrementally when touching code

## Implementation Plan

### Phase 1: Core Utilities (Low Risk)
1. Rename functions in `src/core/refs.ts`
2. Add JSDoc to missing helpers
3. Remove deprecated functions
4. Update imports across codebase

### Phase 2: List Operations (Medium Risk)
1. Extract `getListInfo` helper
2. Extract `copyListPayload` helper
3. Refactor list ops to use helpers
4. Add JSDoc to new helpers

### Phase 3: Cleanup (Low Risk)
1. Remove excessive inline comments
2. Consolidate useful comments into JSDoc
3. Update style guide with examples

### Phase 4: Test Utilities (High Risk)
1. Rename test utility functions
2. Update all test files
3. Verify all tests pass

## Success Criteria

- ✅ All public functions have JSDoc
- ✅ No function names exceed 20 characters (except where necessary)
- ✅ No variable names exceed 15 characters (except where necessary)
- ✅ No duplicate functions
- ✅ Common patterns extracted to helpers
- ✅ Inline comments reduced by 50%
- ✅ All tests pass

