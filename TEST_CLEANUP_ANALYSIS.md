# Test Suite Cleanup Analysis

## Executive Summary

**Current State:**
- 1,337 tests passing
- 59.47 seconds total runtime
- 88.37% statement coverage, 77.28% branch coverage (below 80% threshold)
- 150 test files

**Issues Identified:**
1. **Slow tests** consuming ~2.3 seconds (4% of total time)
2. **Redundant tests** - same functionality tested multiple ways
3. **Over-granular tests** - testing every edge case separately
4. **Duplicate integration tests** - testing same ops as unit tests
5. **Coverage test files** that could be consolidated

## Slow Tests to Optimize or Remove

### 1. `vm-comprehensive-testing.test.ts` - Stress Tests (2.2 seconds)
**Location:** `src/test/core/vm-comprehensive-testing.test.ts`

**Slow tests:**
- "should handle large numbers of sequential symbol references" (1488ms) - 10,000 iterations
- "should handle rapid symbol resolution without memory leaks" (712ms) - 5,000 iterations

**Recommendation:** 
- Reduce iterations to 100-500 for basic smoke tests
- OR move to separate performance test suite (not run in CI)
- OR remove entirely - these are stress tests, not functional tests

### 2. `tagged-value-roundtrip.test.ts` (92ms)
**Location:** `src/test/core/tagged-value-roundtrip.test.ts`

**Issue:** Tests 0-1000 range (1001 iterations) - excessive for a simple roundtrip test

**Recommendation:**
- Reduce to 10-20 edge cases (0, 1, 255, 256, 65535, -32768, -1, etc.)
- OR remove - basic roundtrip is already tested in `tagged.test.ts`

## Redundant Test Files to Consolidate

### 1. Arithmetic Operations - Massive Redundancy

**Files:**
- `src/test/ops/arithmetic/arithmetic.test.ts` (63 tests)
- `src/test/integration/basic-operations.test.ts` (duplicates arithmetic)
- `src/test/ops/arithmetic/unary-operations.test.ts` (25 tests)

**Issues:**
- `arithmetic.test.ts` tests every operation with positive, negative, zero cases separately
- Integration tests duplicate the same operations
- Many tests are trivial (e.g., "should add zero values")

**Recommendation:**
- **Consolidate to 15-20 tests total:**
  - 1-2 tests per operation (happy path + one edge case)
  - Remove redundant positive/negative/zero variations
  - Remove duplicate integration tests
  - Keep error cases (stack underflow) - but test once, not per operation

**Estimated reduction:** ~40-45 tests removed

### 2. Comparison Operations - Similar Redundancy

**Files:**
- `src/test/ops/comparison/comparison.test.ts` (27 tests)
- `src/test/integration/basic-operations.test.ts` (duplicates comparisons)

**Issues:**
- Tests every comparison operator separately with multiple cases
- Integration tests duplicate functionality

**Recommendation:**
- **Consolidate to 8-10 tests:**
  - One test per operator (happy path)
  - One combined error case test
  - Remove duplicate integration tests

**Estimated reduction:** ~15-17 tests removed

### 3. Stack Operations - Over-tested

**Files:**
- `src/test/ops/stack/dup.test.ts` (11 tests)
- `src/test/ops/stack/drop.test.ts` (10 tests)
- `src/test/ops/stack/swap.test.ts` (12 tests)
- `src/test/ops/stack/over.test.ts` (10 tests)
- `src/test/ops/stack/rot.test.ts` (11 tests)
- `src/test/ops/stack/revrot.test.ts` (11 tests)
- `src/test/ops/stack/pick.test.ts` (13 tests)
- `src/test/ops/stack/tuck.test.ts` (16 tests)
- `src/test/ops/stack/nip.test.ts` (16 tests)
- `src/test/integration/basic-operations.test.ts` (duplicates)

**Issues:**
- Each operation tested with simple values, lists, nested lists, error cases
- Many tests are variations of the same pattern
- Integration tests duplicate basic functionality

**Recommendation:**
- **Consolidate each operation to 3-4 tests:**
  - 1 happy path (simple values)
  - 1 list case (if applicable)
  - 1 error case (stack underflow)
  - Remove redundant nested list tests (covered by list operations)

**Estimated reduction:** ~60-70 tests removed

### 4. Format Utils - Coverage Overlap

**Files:**
- `src/test/core/format-utils.test.ts` (30 tests)
- `src/test/core/format-utils.coverage.test.ts` (10 tests)

**Recommendation:**
- Merge coverage tests into main file
- Remove redundant edge case tests

**Estimated reduction:** ~5-8 tests removed

### 5. List Operations - Multiple Coverage Files

**Files:**
- `src/test/core/list.test.ts` (37 tests)
- `src/test/core/list.coverage.test.ts` (9 tests)
- `src/test/core/list-memory.test.ts` (3 tests)

**Recommendation:**
- Merge coverage and memory tests into main file
- Remove redundant tests

**Estimated reduction:** ~5-7 tests removed

### 6. Compiler Coverage - Over-granular

**Files:**
- `src/test/lang/compiler.test.ts` (7 tests)
- `src/test/lang/compiler-coverage.test.ts` (31 tests)

**Issues:**
- Coverage file tests every boundary condition separately
- Many tests are testing the same error path with different values

**Recommendation:**
- Consolidate boundary tests into parameterized tests
- Keep essential error cases, remove redundant variations

**Estimated reduction:** ~15-20 tests removed

### 7. Interpreter Coverage - Redundant

**Files:**
- `src/test/lang/interpreter.test.ts` (26 tests)
- `src/test/lang/interpreter-coverage.test.ts` (11 tests)

**Recommendation:**
- Merge coverage tests into main file
- Remove redundant edge case tests

**Estimated reduction:** ~5-7 tests removed

### 8. REPL Coverage - Minimal Value

**Files:**
- `src/test/lang/repl.test.ts` (16 tests)
- `src/test/lang/repl.coverage.test.ts` (4 tests)

**Recommendation:**
- Merge or remove coverage file (REPL is mostly integration)

**Estimated reduction:** ~2-4 tests removed

## Test Organization Issues

### 1. Integration Tests Duplicating Unit Tests

**Files:**
- `src/test/integration/basic-operations.test.ts`
- `src/test/integration/advanced-operations.test.ts`

**Issue:** These test operations already covered by unit tests

**Recommendation:**
- Keep only tests that verify **integration** (e.g., multiple operations together)
- Remove tests that just call single operations (already tested in unit tests)

**Estimated reduction:** ~8-10 tests removed

### 2. Parser Tests - Some Redundancy

**Files:**
- `src/test/lang/parser.test.ts` (41 tests)
- `src/test/lang/parser.comprehensive.test.ts` (20 tests)

**Recommendation:**
- Merge comprehensive tests into main file
- Remove duplicate test cases

**Estimated reduction:** ~5-8 tests removed

### 3. Tokenizer Tests - Good Coverage, Some Redundancy

**Files:**
- `src/test/lang/tokenizer.test.ts` (41 tests)
- `src/test/lang/tokenizer-symbol.test.ts` (22 tests)

**Recommendation:**
- Merge symbol tests into main file
- Remove redundant test cases

**Estimated reduction:** ~5-8 tests removed

## Specific Files to Consider Removing

### Low-Value Tests

1. **`src/test/core/tagged-value-roundtrip.test.ts`**
   - 1001 iterations for simple roundtrip
   - Already covered by `tagged.test.ts`
   - **Action:** Remove or drastically reduce

2. **`src/test/core/vm-comprehensive-testing.test.ts`**
   - Stress tests (2.2 seconds)
   - Most tests are redundant with other test files
   - **Action:** Remove stress tests, keep only unique integration tests

3. **`src/test/integration/basic-operations.test.ts`**
   - Duplicates unit tests
   - **Action:** Remove or keep only multi-operation integration tests

4. **`src/test/integration/advanced-operations.test.ts`**
   - Minimal value
   - **Action:** Review and consolidate

## Recommended Actions

### Phase 1: Quick Wins (Remove ~150-200 tests)

1. **Remove slow stress tests:**
   - Reduce `vm-comprehensive-testing.test.ts` stress test iterations
   - Remove or reduce `tagged-value-roundtrip.test.ts`

2. **Consolidate coverage files:**
   - Merge all `*.coverage.test.ts` files into main test files
   - Remove redundant edge case tests

3. **Remove duplicate integration tests:**
   - Remove single-operation tests from integration files
   - Keep only multi-operation integration tests

### Phase 2: Consolidation (Remove ~100-150 tests)

1. **Consolidate arithmetic tests:**
   - Reduce from 63 to ~15-20 tests
   - Remove redundant positive/negative/zero variations

2. **Consolidate stack operation tests:**
   - Reduce each operation from 10-16 tests to 3-4 tests
   - Remove redundant list/nested list variations

3. **Consolidate comparison tests:**
   - Reduce from 27 to ~8-10 tests

### Phase 3: Organization (Remove ~50-100 tests)

1. **Merge related test files:**
   - Merge parser comprehensive into parser.test.ts
   - Merge tokenizer-symbol into tokenizer.test.ts
   - Merge list coverage/memory into list.test.ts

2. **Remove redundant error case tests:**
   - Test error cases once per category, not per operation

## Expected Results

**Before:**
- 1,337 tests
- 59.47 seconds
- 77.28% branch coverage

**After (estimated):**
- ~900-1,000 tests (25-30% reduction)
- ~40-45 seconds (25-30% faster)
- Similar or better coverage (removing redundant tests, not unique coverage)

## Implementation Priority

### High Priority (Do First)
1. Remove/reduce slow stress tests
2. Consolidate coverage test files
3. Remove duplicate integration tests

### Medium Priority
1. Consolidate arithmetic tests
2. Consolidate stack operation tests
3. Consolidate comparison tests

### Low Priority
1. Merge related test files
2. Remove redundant error case tests

## Notes

- **Keep all unique coverage** - only remove redundant tests
- **Focus on code coverage** - ensure removed tests don't reduce coverage
- **Maintain test quality** - keep tests that catch real bugs
- **Document** - why tests were removed/consolidated

