# One-Line Function Audit

**Date:** 2025-01-XX  
**Status:** In Progress

## Purpose

Audit all one-line functions across the codebase to determine if they should be:
1. **Kept** - Provide meaningful abstraction, API stability, or are used frequently
2. **Inlined** - Trivial wrappers that add no value

## Criteria for Keeping vs Inlining

### Keep if:
- Provides API stability (public interface)
- Used in many places (reduces duplication at call sites)
- Adds meaningful semantic value (clearer intent)
- Part of a consistent API pattern (e.g., all `is*` functions)
- Has validation/error handling that would be duplicated if inlined

### Inline if:
- Trivial wrapper around another function
- Only used in 1-2 places
- No validation or error handling
- Just parameter reordering or simple transformation
- Adds indirection without benefit

## Audit Results

### Core Functions

#### `src/core/refs.ts`

| Function | Lines | Usage | Decision | Reason |
|----------|-------|-------|----------|--------|
| `refToByte(ref)` | 1 | Used in `getRefArea`, `isGlobalRef`, etc. | **KEEP** | Provides unit conversion abstraction, used in multiple places |
| `readRef(vm, ref)` | 2 | Used in heap ops, tests | **KEEP** | Provides semantic clarity (read via ref vs direct), used in multiple places |
| `writeRef(vm, ref, value)` | 2 | Used in tests | **KEEP** | Provides semantic clarity, symmetric with `readRef` |
| `isGlobalRef(ref)` | 1 | Used in tests | **KEEP** | Part of consistent `is*` API pattern, clearer than `getRefArea(ref) === 'global'` |
| `isStackRef(ref)` | 1 | Used rarely | **KEEP** | Part of consistent `is*` API pattern |
| `isRStackRef(ref)` | 1 | Used in tests | **KEEP** | Part of consistent `is*` API pattern |

#### `src/core/tagged.ts`

| Function | Lines | Usage | Decision | Reason |
|----------|-------|-------|----------|--------|
| `getTag(nanValue)` | 1 | Used everywhere | **KEEP** | Core API, used in hundreds of places |
| `getValue(nanValue)` | 1 | Used frequently | **KEEP** | Core API, provides convenience over `fromTaggedValue().value` |
| `isNIL(tval)` | 1 | Used frequently | **KEEP** | Part of consistent `is*` API pattern, clearer than `tval === 0` |
| `isNumber(tval)` | 1 | Used frequently | **KEEP** | Part of consistent `is*` API pattern |
| `isSentinel(tval)` | 1 | Used rarely | **KEEP** | Part of consistent `is*` API pattern |
| `isCode(tval)` | 1 | Used frequently | **KEEP** | Part of consistent `is*` API pattern |
| `isString(tval)` | 1 | Used frequently | **KEEP** | Part of consistent `is*` API pattern |
| `isLocal(tval)` | 1 | Used frequently | **KEEP** | Part of consistent `is*` API pattern |

#### `src/core/list.ts`

| Function | Lines | Usage | Decision | Reason |
|----------|-------|-------|----------|--------|
| `isList(tval)` | 3 | Used everywhere | **KEEP** | Core API, used in hundreds of places |
| `getListLength(header)` | 5 | Used everywhere | **KEEP** | Core API with validation, used in hundreds of places |
| `computeHeaderCell(base, slots)` | 1 | Used in multiple places | **KEEP** | Provides semantic clarity, used in multiple places |

#### `src/core/utils.ts`

| Function | Lines | Usage | Decision | Reason |
|----------|-------|-------|----------|--------|
| `isDigit(char)` | 1 | Used in parser | **KEEP** | Provides semantic clarity, used in multiple places |
| `isWhitespace(char)` | 1 | Used in parser | **KEEP** | Provides semantic clarity, used in multiple places |
| `isGroupingChar(char)` | 1 | Used in parser | **KEEP** | Provides semantic clarity, used in multiple places |
| `isSpecialChar(char)` | 1 | Used in parser | **KEEP** | Provides semantic clarity, used in multiple places |
| `toUnsigned16(num)` | 1 | Used in code reading | **KEEP** | Provides semantic clarity, used in multiple places |
| `toBoolean(value)` | 1 | Used in conditionals | **KEEP** | Provides semantic clarity, used in multiple places |
| `toNumber(value)` | 1 | Used in conditionals | **KEEP** | Provides semantic clarity, used in multiple places |
| `not(value)` | 1 | Used in conditionals | **KEEP** | Provides semantic clarity, used in multiple places |
| `and(a, b)` | 1 | Used in conditionals | **KEEP** | Provides semantic clarity, used in multiple places |
| `or(a, b)` | 1 | Used in conditionals | **KEEP** | Provides semantic clarity, used in multiple places |
| `xor(a, b)` | 1 | Used in conditionals | **KEEP** | Provides semantic clarity, used in multiple places |

#### `src/core/code-ref.ts`

| Function | Lines | Usage | Decision | Reason |
|----------|-------|-------|----------|--------|
| `createBuiltinRef(opcode)` | 5 | Used in tests | **KEEP** | Has validation, provides semantic clarity |
| `createCodeRef(bytecodeAddr)` | 5 | Used in tests | **KEEP** | Has validation, provides semantic clarity |

#### `src/core/dictionary.ts`

| Function | Lines | Usage | Decision | Reason |
|----------|-------|-------|----------|--------|
| `defineBuiltin(vm, name, opcode, isImmediate)` | 3 | Used in 100+ places | **INLINE** | Trivial wrapper, just calls `define` with tagged value |
| `defineCode(vm, name, address, isImmediate)` | 3 | Used in 50+ places | **INLINE** | Trivial wrapper, just calls `define` with tagged value |
| `defineLocal(vm, name)` | 4 | Used in parser, tests | **INLINE** | Trivial wrapper, increments counter and calls `define` |

### Summary

**Functions to Inline:**
- `defineBuiltin` - 100+ usages, but trivial wrapper
- `defineCode` - 50+ usages, but trivial wrapper  
- `defineLocal` - Used in parser and tests, but trivial wrapper

**Functions to Keep:**
- All `is*` functions - Part of consistent API pattern
- All `get*` functions - Core API, used frequently
- All `to*` functions - Provide semantic clarity
- `refToByte`, `readRef`, `writeRef` - Provide semantic clarity and abstraction
- `computeHeaderCell` - Provides semantic clarity

## Implementation Plan ✅ COMPLETE

### Phase 1: Inline Dictionary Define Variants ✅ COMPLETE

**Status:** ✅ COMPLETE - Completed as Phase 4 of FUNCTION_RATIONALIZATION_PLAN.md

**Results:**
- ✅ Updated 10 test files incrementally
- ✅ Updated 3 source files (builtins-register.ts, definitions.ts, parser.ts)
- ✅ Removed `defineBuiltin`, `defineCode`, `defineLocal` wrapper functions
- ✅ All tests pass (1280/1280)

**See:** `FUNCTION_RATIONALIZATION_PLAN.md` Phase 4 for complete details

### Phase 2: Review Other One-Liners
After Phase 1, review remaining one-liners to see if any others should be inlined based on usage patterns.

## Notes

- Type checking functions (`is*`) should generally be kept for API consistency
- Conversion functions (`to*`, `*To*`) should generally be kept for semantic clarity
- Wrapper functions that just call another function with different parameters should be inlined
- Functions with validation should generally be kept even if one-line


