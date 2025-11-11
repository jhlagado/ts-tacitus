# Function Rationalization - Lessons Learned

**Date:** 2025-01-XX  
**Status:** Documenting lessons from initial attempt

## Summary

An initial attempt to inline dictionary define variants (`defineBuiltin`, `defineCode`, `defineLocal`) caused test failures and required reverting. This document captures lessons learned to guide future work.

## Key Lessons

### 1. Test Incrementally

**Problem:** Made multiple changes across many files, then tested. When tests failed, hard to identify which change caused the issue.

**Solution:**
- Update one file at a time
- Run tests after each file: `yarn test <specific-file> --no-coverage`
- Only proceed to next file if tests pass
- Use `grep` to find all usages before starting

### 2. Understand Address Semantics

**Problem:** Confusion about absolute vs relative addresses:
- `vm.gp` is relative to `GLOBAL_BASE`
- `vm.head` is stored as relative to `GLOBAL_BASE` (`vm.gp - 1`)
- `readCell()` expects absolute cell indices
- Currently works because `GLOBAL_BASE = 0` (relative = absolute)

**Solution:**
- Read the code carefully before changing
- Understand what each variable represents
- Check function signatures and comments
- Don't assume - verify

### 3. Don't Break Working Code

**Problem:** Changed working code without fully understanding why it worked.

**Solution:**
- If code works, understand WHY before changing
- Preserve exact behavior when refactoring
- Test that behavior is preserved

### 4. Verify Before Removing

**Problem:** Removed functions before verifying all call sites were updated.

**Solution:**
- Use `grep` to find ALL usages: `grep -r "defineBuiltin\|defineCode\|defineLocal" src/`
- Update ALL call sites first
- Only remove functions after ALL tests pass
- Double-check with another grep after removal

### 5. Read Function Implementations

**Problem:** Assumed functions worked a certain way without reading the code.

**Solution:**
- Read the actual function implementation
- Understand what it does
- Check how it's used in tests
- Verify your understanding matches reality

## Current Working State

### Dictionary Functions

- `define(vm, name, payloadTagged)` - Core function, works correctly
- `defineBuiltin(vm, name, opcode, isImmediate)` - Wrapper, works correctly
- `defineCode(vm, name, address, isImmediate)` - Wrapper, works correctly  
- `defineLocal(vm, name)` - Wrapper, works correctly
- `lookup(vm, name)` - Works correctly

### Address Semantics

- `vm.gp`: Relative to `GLOBAL_BASE` (currently 0)
- `vm.head`: Stored as relative (`vm.gp - 1`)
- `readCell(cellIndex)`: Expects absolute cell index
- `createGlobalRef(cellIndex)`: Expects relative cell index, returns REF with absolute

**Note:** Currently works because `GLOBAL_BASE = 0`, so relative = absolute. Code should be correct for future non-zero `GLOBAL_BASE` values.

## Revised Approach for Phase 4

1. **Preparation:**
   - Find all usages: `grep -r "defineBuiltin\|defineCode\|defineLocal" src/`
   - Count call sites
   - Identify test files vs source files

2. **Test Files First (One at a time):**
   - Start with isolated test files
   - Update calls to use `define` directly
   - Run tests: `yarn test <file> --no-coverage`
   - Fix any issues before proceeding

3. **Source Files (One at a time):**
   - Update `src/ops/builtins-register.ts`
   - Test: `yarn test --no-coverage`
   - Update `src/lang/definitions.ts`
   - Test: `yarn test --no-coverage`
   - Update `src/lang/parser.ts`
   - Test: `yarn test --no-coverage`

4. **Remove Functions (Only after all pass):**
   - Verify no remaining usages: `grep -r "defineBuiltin\|defineCode\|defineLocal" src/`
   - Remove from `src/core/dictionary.ts`
   - Run full test suite: `yarn test --no-coverage`
   - All 1280 tests must pass

## Success Criteria

- ✅ All tests pass (1280/1280)
- ✅ No regressions
- ✅ Code is cleaner (no wrappers)
- ✅ Behavior is identical

## Checklist for Future Work

Before starting any rationalization:
- [ ] Read the code you're changing
- [ ] Understand address semantics
- [ ] Find all usages with grep
- [ ] Test incrementally (one file at a time)
- [ ] Verify behavior is preserved
- [ ] Run full test suite before removing functions
- [ ] Document any assumptions or gotchas

