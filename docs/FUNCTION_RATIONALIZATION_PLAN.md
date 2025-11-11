# Function Rationalization Plan

**Date:** 2025-01-XX  
**Status:** Analysis Complete, Plan Pending

## Executive Summary

This document analyzes all functions across the codebase, identifies patterns and redundancies, and proposes a rationalization plan to improve reusability and composability. **Focus: Genuine redundancies only** - functions that are truly duplicates or unnecessary wrappers, not operations that share implementation patterns but are conceptually distinct.

### Quick Reference: Genuine Redundancies

| Category                      | Current Functions                            | Issue                                                  | Solution                                          | Reduction           |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | ------------------- |
| **Deprecated Aliases**        | `readRefValue`, `writeReference`             | Already deprecated, just aliases                       | Remove aliases, update call sites                 | 2 → 0               |
| **REF Extraction**            | `decodeRef`, `getCellFromRef`                | Both extract cell index, `decodeRef` returns object    | Keep `getCellFromRef`, remove `decodeRef` wrapper | 2 → 1               |
| **Reference Area Checks**     | `isGlobalRef`, `isStackRef`, `isRStackRef`   | All duplicate `getRefArea` logic                       | Implement as one-liners using `getRefArea`        | 3 → 3 (simplified)  |
| **Dictionary Define**         | `defineBuiltin`, `defineCode`, `defineLocal` | All just call `define` with different tagged values    | Inline into call sites, keep `define`             | 3 → 0 (inlined)     |
| **List Bounds**               | `getListBounds`, `getListInfoOrFail`         | `getListInfoOrFail` just calls `getListBounds` + throw | Inline check at call sites                        | 2 → 1               |
| **Copy Operations**           | `copyListPayload`                            | Specific to lists, but pattern is generic              | Generalize to `copyCells`                         | 1 → 1 (generalized) |
| **Format Helpers**            | `formatListFromMemory`                       | Internal helper, could be inlined                      | Inline into `formatValue`                         | 1 → 0 (inlined)     |
| **Total Estimated Reduction** | **~15 redundant functions**                  |                                                        |                                                   | **~15 → ~8**        |

## Rationalization Plan

### Phase 1: Remove Deprecated Aliases ✅ COMPLETE

**Goal:** Remove deprecated function aliases that add no value.

**Functions Removed:**

- `readRefValue` (alias of `readRef`) ✅
- `writeReference` (alias of `writeRef`) ✅

**Changes Made:**

1. ✅ Replaced `readRefValue` with `readRef` in:
   - `src/test/core/refs.test.ts`
   - `src/ops/heap/global-heap-ops.ts`
2. ✅ Replaced `writeReference` with `writeRef` in:
   - `src/test/ops/local-vars/local-variables.test.ts`
3. ✅ Removed deprecated exports from `src/core/refs.ts`

**Results:**

- ✅ All tests pass
- ✅ Cleaner API (no deprecated aliases)
- ✅ No confusion about which function to use
- ✅ Reduced 2 functions

### Phase 2: Simplify REF Extraction ✅ COMPLETE

**Goal:** Remove redundant `decodeRef` wrapper.

**Issue:** `decodeRef(ref)` returns `{ cellIndex: number }` while `getCellFromRef(ref)` returns `number` directly. Most call sites destructure immediately.

**Changes Made:**

1. ✅ Replaced `decodeRef` with `getCellFromRef` in:
   - `src/test/core/refs.test.ts` (7 usages)
   - `src/core/dictionary.ts` (3 usages)
   - `src/test/ops/capsules/stubs.test.ts` (1 usage)
   - `src/test/ops/dict/dictionary-payloads.test.ts` (4 usages)
   - `src/test/ops/access/select-op.test.ts` (comment only)
2. ✅ Removed `decodeRef` function from `src/core/refs.ts`
3. ✅ Updated test expectations (error messages changed from "non-REF" to "Expected REF")
4. ✅ Fixed test that expected `decodeRef` to not validate bounds (now `getCellFromRef` properly validates)

**Results:**

- ✅ All tests pass
- ✅ Simpler API (direct return vs object destructuring)
- ✅ One less function to maintain
- ✅ Reduced 2 functions to 1

### Phase 3: Simplify Reference Area Checks ✅ COMPLETE

**Goal:** Implement area check functions as simple one-liners using `getRefArea`.

**Current:** Each function duplicated the byte address calculation and range checks.

**Changes Made:**

1. ✅ Simplified `isGlobalRef` to use `getRefArea(ref) === 'global'`
2. ✅ Simplified `isStackRef` to use `getRefArea(ref) === 'stack'`
3. ✅ Simplified `isRStackRef` to use `getRefArea(ref) === 'rstack'`

**Results:**

- ✅ All tests pass
- ✅ Single source of truth (`getRefArea`)
- ✅ Simpler implementations (one-liners)
- ✅ Easier to maintain (area classification logic in one place)
- ✅ No function count reduction (kept separate for clarity), but code simplified

### Phase 4: Inline Dictionary Define Variants ⚠️ REVISED

**Goal:** Remove `defineBuiltin`, `defineCode`, `defineLocal` wrappers.

**Issue:** These functions just call `define` with different tagged values. The tagging logic is trivial.

**⚠️ IMPORTANT LESSONS LEARNED:**

1. **Test incrementally:** Update one file at a time, run tests after each change
2. **Address semantics:** Understand that `vm.head` is stored as relative to `GLOBAL_BASE`, but `readCell` expects absolute addresses. Currently works because `GLOBAL_BASE = 0`, but code should be correct for future non-zero values.
3. **Don't break working code:** The wrapper functions work correctly. Only inline if we can maintain exact same behavior.

**Steps (REVISED - More Careful Approach):**

1. **Phase 4a:** Update test files first (one file at a time, test after each)
   - Start with isolated test files
   - Replace `defineBuiltin`/`defineCode`/`defineLocal` with direct `define` calls
   - Run tests after each file
   
2. **Phase 4b:** Update source files (one file at a time, test after each)
   - Update `src/ops/builtins-register.ts`
   - Update `src/lang/definitions.ts`
   - Update `src/lang/parser.ts`
   - Run full test suite after each file
   
3. **Phase 4c:** Remove wrapper functions only after ALL call sites updated
   - Verify no remaining usages with `grep`
   - Remove functions from `src/core/dictionary.ts`
   - Run full test suite

**Example:**

```typescript
// Before:
defineBuiltin(vm, 'dup', Op.Dup);

// After:
const tagged = toTaggedValue(Op.Dup, Tag.BUILTIN, 0);
define(vm, 'dup', tagged);
```

**Benefits:**

- Less indirection
- Clearer what's happening
- Reduces 3 functions

**Status:** ⚠️ PENDING - Requires careful incremental approach

### Phase 5: Inline List Info Helper ✅ COMPLETE

**Goal:** Remove `getListInfoOrFail` wrapper.

**Issue:** `getListInfoOrFail` just calls `getListBounds` and throws if null. This pattern is used in only a few places.

**Steps:**

1. ✅ Find all `getListInfoOrFail` usages
2. ✅ Replace with `getListBounds` + explicit null check
3. ✅ Remove `getListInfoOrFail`

**Changes Made:**

1. ✅ Removed `getListInfoOrFail` from `src/core/list.ts`
2. ✅ Updated all call sites to use `getListBounds` directly with inline error checks

**Benefits:**

- Less indirection
- Clearer error handling
- Reduces 2 functions to 1

**Status:** ✅ COMPLETE

### Phase 6: Generalize Copy Operations

**Goal:** Generalize `copyListPayload` to `copyCells`.

**Issue:** `copyListPayload` is specific to lists but the pattern is generic cell copying.

**Proposed:**

```typescript
function copyCells(vm: VM, src: number, dst: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const val = vm.memory.readCell(src + i);
    vm.memory.writeCell(dst + i, val);
  }
}

// Keep copyListPayload as convenience wrapper:
export function copyListPayload(vm: VM, src: number, dst: number, slots: number): void {
  copyCells(vm, src, dst, slots);
}
```

**Benefits:**

- More reusable utility
- Can be used for non-list copying
- Reduces duplication potential

### Phase 7: Inline Format Helper

**Goal:** Remove `formatListFromMemory` internal helper.

**Issue:** `formatListFromMemory` is only used by `formatValue` and could be inlined.

**Steps:**

1. Inline `formatListFromMemory` logic into `formatValue`
2. Remove `formatListFromMemory`

**Benefits:**

- Simpler code structure
- One less function
- Reduces 1 function

### Phase 8: Audit One-Line Functions

**Goal:** Audit all one-line functions to justify their existence vs inlining.

**Process:**

1. Identify all one-line functions across codebase
2. For each function, determine:
   - Usage count
   - Whether it provides semantic value
   - Whether it's part of a consistent API pattern
   - Whether it has validation/error handling
3. Inline trivial wrappers that add no value
4. Keep functions that provide API stability or semantic clarity

**See:** `docs/ONE_LINE_FUNCTION_AUDIT.md` for detailed analysis

**Benefits:**

- Removes unnecessary indirection
- Keeps valuable abstractions
- Improves code clarity

## API Design Principles

### 1. Avoid Unnecessary Abstraction

Don't create wrapper functions that just call another function with different parameters. If the wrapper doesn't add value, inline it.

**Bad:**

```typescript
function defineBuiltin(vm: VM, name: string, opcode: number): void {
  const tagged = toTaggedValue(opcode, Tag.BUILTIN);
  define(vm, name, tagged);
}
```

**Good:**

```typescript
// Call site:
const tagged = toTaggedValue(Op.Dup, Tag.BUILTIN);
define(vm, 'dup', tagged);
```

### 2. Single Source of Truth

If multiple functions do the same calculation, extract it to one function and have others call it.

**Example:** `isGlobalRef`, `isStackRef`, `isRStackRef` should all use `getRefArea`.

### 3. Direct Over Indirect

Prefer direct return values over wrapper objects when the wrapper adds no value.

**Bad:**

```typescript
function decodeRef(ref: number): { cellIndex: number } {
  return { cellIndex: getCellFromRef(ref) };
}
```

**Good:**

```typescript
// Just use getCellFromRef directly
const cell = getCellFromRef(ref);
```

### 4. Clarity Over Brevity

Keep function names clear. Don't unify operations that are conceptually different just because they share implementation details.

**Good:** Keep `push`, `rpush`, `gpush` separate - they operate on different regions and the distinction is important.
**Bad:** Unifying them into `stackPush(vm, region, value)` adds complexity without much benefit.

## Implementation Strategy

### Incremental Approach ⚠️ REVISED

1. **Understand the code first:** Read the code carefully, understand address semantics (absolute vs relative), understand how functions work
2. **Test incrementally:** Update one file at a time, run tests after each change
3. **Don't break working code:** If something works, understand WHY before changing it
4. **Update call sites incrementally** (file by file, test after each)
5. **Remove redundant functions** only after ALL call sites updated and ALL tests pass
6. **Run full test suite** after each phase completion

### Critical Lessons Learned

1. **Address Semantics Matter:**
   - `vm.gp` is relative to `GLOBAL_BASE`
   - `vm.head` is stored as relative to `GLOBAL_BASE` 
   - `readCell()` expects absolute cell indices
   - Currently works because `GLOBAL_BASE = 0`, but code should be correct for future non-zero values

2. **Test After Every Change:**
   - Don't make multiple changes and then test
   - Test after each file update
   - Use `grep` to verify no remaining usages before removing functions

3. **Don't Assume:**
   - Don't assume relative/absolute without checking
   - Don't assume functions work the same way without reading the code
   - Don't change working code without understanding why it works

### Testing Strategy

1. **Unit tests** for new unified functions (if any)
2. **Integration tests** to ensure behavior matches old functions
3. **Full test suite** after each phase

## Metrics

### Current State

- **Total functions:** ~200+
- **Genuine redundancies:** ~15 functions
- **Estimated reduction:** ~7-8 functions removed/inlined

### Target State

- **Total functions:** ~192-193
- **Redundant patterns:** Eliminated
- **Code duplication:** Minimal
- **API clarity:** Improved (no deprecated aliases, fewer wrappers, no misleading names)

## Risks

1. **Breaking changes:** Some functions are used in tests - need to update those too
2. **Performance:** Generic functions might be slightly slower (measure and optimize if needed)
3. **Migration effort:** Moderate time investment required

## Success Criteria

1. All tests pass
2. No performance regressions
3. Deprecated aliases removed
4. Redundant wrappers inlined
5. Single source of truth for shared logic
6. API is clearer (no confusion about which function to use)
7. Function count reduced by ~7-8 (genuine redundancies only)
