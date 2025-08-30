# Plan 14: Code Cleanup and Rationalization

**Status:** ✅ COMPLETED  
**Priority:** High - Technical debt reduction  
**Context:** Comprehensive codebase audit and rationalization based on Plan 13 Phase 6 findings

## Objectives

1. **Eliminate redundant code** - Remove duplicate implementations and consolidate functionality
2. **Improve C-port readiness** - Simplify complex JavaScript-specific patterns
3. **Fix naming inconsistencies** - Standardize operation names and remove legacy artifacts
4. **Reduce technical debt** - Address code quality issues identified in audit

## Completed Tasks

### ✅ Phase 1: formatListAtImpl Elimination (COMPLETED)

### ✅ Phase 2: Critical Bug Fixes and Rationalization (COMPLETED)

**Problems Identified:** Multiple critical bugs and naming inconsistencies found during comprehensive audit.

**Solutions Implemented:**

#### 🔥 Critical Memory Safety Fix

- **Fixed hardcoded segment bug** in `src/ops/access-ops.ts`
- **Fixed segment assumption bug** - Added polymorphic reference handling for stack vs memory-based lists
- **Added proper imports** for `SEG_STACK` and `isRef`/`resolveReference`
- **Risk prevented:** Memory corruption and incorrect reads across segments

#### 🏷️ Naming Standardization

- **Renamed `mEnlistOp` → `enlistOp`** - Removed legacy "m" prefix, added compatibility alias
- **Standardized `dropHeadOp` → `tailOp`** - Canonical name matching `'tail'` registration, added compatibility alias
- **Updated all imports and registrations** to use canonical names

#### 🧹 Registry Consolidation

- **Removed duplicate `define-builtins.ts`** - Eliminated redundant registry file
- **Updated symbol-table.test.ts** to use `registerBuiltins` instead
- **Consolidated to single authoritative registry** in `builtins-register.ts`

#### 🚨 Error Handling Consistency

- **Fixed `VM.ensureStackSize`** to use `StackUnderflowError` instead of generic `Error`
- **Improved error diagnostics** - Consistent error types across VM operations
- **Better error reporting** for debugging and development

#### 📉 Code Cleanup

- **Removed unused imports** - `cellsCopy`, `cellsReverse` from list-ops.ts (confirmed unused by linter)

**Results:**

- ✅ All tests passing (649 tests total)
- ✅ Critical memory safety bugs fixed
- ✅ Naming consistency achieved
- ✅ Registry consolidation completed
- ✅ Error handling standardized
- ✅ C-port readiness improved

## Future Phase Opportunities

### 🛠️ Medium-Impact Improvements

4. **`src/ops/builtins.ts` - Large Switch Dispatcher** (Medium Impact, Medium Risk)
   - **Issue:** 200+ line switch statement hard to maintain
   - **Opportunity:** Leverage existing `symbolTable.findImplementationByOpcode`
   - **Action:** Prefer symbol table implementations, keep switch minimal

5. **Error Handling Consistency** (Medium Impact, Low Risk)
   - **Issue:** `ensureStackSize` uses generic `Error`, but `push/pop` use typed errors
   - **Action:** Use `StackUnderflowError` consistently for better diagnostics

6. **Memory Helper Optimization** (Low Impact, Medium Value)
   - **Issue:** `src/core/memory.ts` uses byte loops instead of `DataView.getFloat32/setFloat32`
   - **Action:** Use native DataView methods for better performance

### 🧹 Lower-Impact Cleanups

7. **Test utility consolidation** (High impact, low risk)
   - Multiple duplicate test files: `test-utils.ts`, `list-test-utils.ts`, `stack-test-utils.ts`
   - Opportunity: Consolidate to single `vm-test-utils.ts` (already exists)

8. **Ref API Duplication** (Medium Impact, High Risk)
   - **Issue:** Both `tagged.ts` and `refs.ts` expose overlapping ref APIs with subtle differences
   - **Risk:** API drift, confusion about authoritative implementation
   - **Action:** Make `tagged.ts` authoritative for tests/constructors, `refs.ts` for resolution only

### Items Correctly Identified as Tacit Strengths (DO NOT TOUCH)

- Element-aware stack operations (complex compound handling)
- Deep stack manipulation capabilities
- NaN-boxing tagged value system
- Polymorphic operation dispatch

## Implementation Notes

- **Zero regressions** - All changes passed full test suite
- **C-port compatibility** - No JavaScript-specific patterns introduced
- **User experience preserved** - List formatting still shows `"( 1 2 3 )"` as expected
- **Performance maintained** - Simple direct operations, no algorithmic complexity increase

## Success Metrics

- ✅ All tests passing (format-utils, reference-formatting, full suite)
- ✅ Linter warnings only (no errors)
- ✅ Code complexity reduced (50+ lines → ~20 lines)
- ✅ Human-readable output preserved
- ✅ C-port readiness improved

---

## Quick Wins (Ready for Implementation)

The following items are validated and ready for immediate implementation:

### ✅ Validated High-Priority Items

1. **Fix access-ops.ts segment bug** - Replace hardcoded `0` with `SEG_STACK`
2. **Rename mEnlistOp → enlistOp** - Remove legacy "m" prefix
3. **Standardize dropHeadOp/tailOp naming** - Choose single canonical name
4. **Remove define-builtins.ts** - Eliminate duplicate registry file
5. **Fix VM error handling** - Use `StackUnderflowError` consistently

### ❌ Audit Corrections

**Incorrect findings that should NOT be implemented:**

- **formatListFromHeader duplication**: Current implementation is intentional and working correctly

**Findings corrected during implementation:**

- **cellsCopy/cellsReverse**: Were unused imports (confirmed by linter) - successfully removed
- **Legacy "m" prefixes**: Only `mEnlistOp` remained - successfully standardized, no other "m" prefixed operations found

### 📋 Comprehensive Issues Catalog

**Parser & Control Flow:**

- `ifCurlyBranchFalseOp` → `branchIfFalseOp` naming
- `simpleIfOp` → `ifThenElseOp` naming
- `makeListOp` → `listFromBlockOp` naming
- `beginList/endList` → `beginParenList/endParenList` for clarity

**Memory & Performance:**

- Memory.ts byte loops → DataView.getFloat32/setFloat32
- Shared `peekBySlots` helper for address calculations
- Element-aware traversal consolidation in list-ops.ts

**Architecture & APIs:**

- `isCompoundData` naming (currently only handles lists)
- Ref API consolidation between `tagged.ts` and `refs.ts`
- Builtins dispatcher simplification using symbol table

**Documentation:**

- Remove corrupted JSDoc header in `builtins.ts`
- Clean up "duplicate removed" comments in `opcodes.ts`
- Remove unimplemented `mCount` opcode

---

**Next Phase Recommendations:**
Start with the **hardcoded segment bug fix** in access-ops.ts as it's critical for memory safety.
