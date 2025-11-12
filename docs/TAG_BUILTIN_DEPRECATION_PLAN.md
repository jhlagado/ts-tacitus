# Tag.BUILTIN Deprecation Plan

## Current State Analysis

### Can Tag.CODE Do Everything Tag.BUILTIN Can?

**Yes!** After the extension, `Tag.CODE` can handle all `Tag.BUILTIN` functionality:

| Feature                       | Tag.BUILTIN | Tag.CODE < 128 | Tag.CODE ≥ 128          |
| ----------------------------- | ----------- | -------------- | ----------------------- |
| Dispatch to builtins (evalOp) | ✅          | ✅             | ❌ (jumps to bytecode)  |
| Compile as single-byte opcode | ✅          | ✅             | ❌ (two-byte user call) |
| Dispatch immediate words      | ✅          | ✅             | ❌ (runs code block)    |
| Store opcodes 0-127           | ✅          | ✅             | ❌ (X1516 encoded)      |
| Store user code addresses     | ❌          | ❌             | ✅                      |

**Conclusion:** `Tag.CODE` is now a **superset** of `Tag.BUILTIN` functionality.

---

## Deprecation Strategy

### Phase 1: Update Creation Sites (Use Tag.CODE Instead)

**Goal:** Replace all `Tag.BUILTIN` creation with `Tag.CODE`.

#### 1.1 Update `createBuiltinRef()` to return `Tag.CODE`

**File:** `src/core/code-ref.ts`

```typescript
/**
 * Creates a tagged reference to a built-in operation.
 * @deprecated Use createCodeRef() or toTaggedValue(opcode, Tag.CODE) instead.
 * This function now returns Tag.CODE for backward compatibility.
 * @param opcode The opcode of the built-in operation (0-127)
 * @returns A Tag.CODE tagged value (stored directly, not X1516 encoded)
 * @throws {Error} If opcode is out of range
 */
export function createBuiltinRef(opcode: number): number {
  if (opcode < 0 || opcode > MAX_BUILTIN_OPCODE) {
    throw new Error(`Invalid builtin opcode: ${opcode}. Must be in range 0-${MAX_BUILTIN_OPCODE}.`);
  }
  // Return Tag.CODE instead of Tag.BUILTIN
  return toTaggedValue(opcode, Tag.CODE);
}
```

**Impact:**

- ✅ All existing code using `createBuiltinRef()` continues to work
- ✅ Returns `Tag.CODE` which dispatches correctly
- ⚠️ Tests expecting `Tag.BUILTIN` will need updates

#### 1.2 Update `registerBuiltins()` to use `Tag.CODE`

**File:** `src/ops/builtins-register.ts`

```typescript
function reg(name: string, opcode: number, _implementation?: Verb, isImmediate = false): void {
  // Use Tag.CODE instead of Tag.BUILTIN
  define(vm, name, toTaggedValue(opcode, Tag.CODE, isImmediate ? 1 : 0));
}
```

**Impact:**

- ✅ All builtin registrations now use `Tag.CODE`
- ✅ Symbols resolve to `Tag.CODE` instead of `Tag.BUILTIN`
- ⚠️ Tests expecting `Tag.BUILTIN` from symbol resolution will need updates

#### 1.3 Update Test Files

**Files:** All test files using `toTaggedValue(..., Tag.BUILTIN)`

**Strategy:**

- Replace `toTaggedValue(opcode, Tag.BUILTIN)` with `toTaggedValue(opcode, Tag.CODE)`
- Update expectations from `Tag.BUILTIN` to `Tag.CODE`
- Keep test logic the same (both dispatch identically)

**Estimated files:** ~35 test files

---

### Phase 2: Update Check Sites (Handle Both Tags)

**Goal:** Ensure all code that checks `Tag.BUILTIN` also handles `Tag.CODE < 128`.

#### 2.1 evalOp - Already Handles Both

**File:** `src/ops/core/core-ops.ts`

**Status:** ✅ Already updated - handles `Tag.CODE < 128` and `Tag.BUILTIN` separately

#### 2.2 Parser - Already Handles Both

**File:** `src/lang/parser.ts`

**Status:** ✅ Already updated - handles `Tag.CODE < 128` and `Tag.BUILTIN` separately

#### 2.3 Immediate Words - Already Handles Both

**File:** `src/lang/meta/executor.ts`

**Status:** ✅ Already updated - handles `Tag.CODE < 128` and `Tag.BUILTIN` separately

#### 2.4 Helper Functions - Update to Check Both

**File:** `src/test/utils/core-test-utils.ts`

```typescript
export function isBuiltinRef(ref: number): boolean {
  if (!isFuncRef(ref)) {
    return false;
  }
  const { tag, value } = fromTaggedValue(ref);
  // Check both Tag.BUILTIN and Tag.CODE < 128
  return tag === Tag.BUILTIN || (tag === Tag.CODE && value < 128);
}
```

**Files that check `Tag.BUILTIN` explicitly:**

- `src/lang/meta/conditionals.ts:55` - Check for `Op.EndIf`
- `src/lang/meta/match-with.ts:33` - Check for `Op.EndMatch`
- `src/lang/meta/case.ts:18` - Check for `Op.EndCase`
- `src/lang/meta/capsules.ts:26` - Check for `Op.EndDefinition`
- `src/ops/core/core-ops.ts:370` - Check for `Op.EndCase`

**Strategy:** Update these to check both `Tag.BUILTIN` and `Tag.CODE < 128`:

```typescript
// Before:
if (tag !== Tag.BUILTIN || value !== Op.EndIf) {
  throw new Error('...');
}

// After:
const isBuiltin = tag === Tag.BUILTIN || (tag === Tag.CODE && value < 128);
if (!isBuiltin || value !== Op.EndIf) {
  throw new Error('...');
}
```

---

### Phase 3: Remove Tag.BUILTIN Support

**Goal:** Remove `Tag.BUILTIN` from the enum and all code paths.

#### 3.1 Remove from Enum

**File:** `src/core/tagged.ts`

```typescript
export enum Tag {
  NUMBER = 0,
  SENTINEL = 1,
  CODE = 2,
  STRING = 4,
  LOCAL = 6,
  // BUILTIN = 7, // REMOVED - use Tag.CODE < 128 instead
  LIST = 8,
  REF = 12,
}
```

#### 3.2 Remove Tag.BUILTIN Cases

**Files:**

- `src/ops/core/core-ops.ts` - Remove `case Tag.BUILTIN:`
- `src/lang/parser.ts` - Remove `if (tag === Tag.BUILTIN)`
- `src/lang/meta/executor.ts` - Remove `if (tag === Tag.BUILTIN)`

#### 3.3 Update All Tests

**Strategy:** Replace all `Tag.BUILTIN` references with `Tag.CODE` in tests.

---

## Migration Checklist

### Phase 1: Update Creation Sites

- [ ] Update `createBuiltinRef()` to return `Tag.CODE`
- [ ] Update `registerBuiltins()` to use `Tag.CODE`
- [ ] Update all test files using `toTaggedValue(..., Tag.BUILTIN)`
- [ ] Run full test suite - verify all tests pass
- [ ] Update `isBuiltinRef()` helper to check both tags

### Phase 2: Update Check Sites

- [ ] Update `src/lang/meta/conditionals.ts` to check both tags
- [ ] Update `src/lang/meta/match-with.ts` to check both tags
- [ ] Update `src/lang/meta/case.ts` to check both tags
- [ ] Update `src/lang/meta/capsules.ts` to check both tags
- [ ] Update `src/ops/core/core-ops.ts:370` to check both tags
- [ ] Run full test suite - verify all tests pass

### Phase 3: Remove Tag.BUILTIN

- [ ] Remove `Tag.BUILTIN` from enum
- [ ] Remove `Tag.BUILTIN` cases from `evalOp`
- [ ] Remove `Tag.BUILTIN` cases from parser
- [ ] Remove `Tag.BUILTIN` cases from executor
- [ ] Remove `Tag.BUILTIN` from `tagNames` record
- [ ] Update all remaining test references
- [ ] Run full test suite - verify all tests pass
- [ ] Update documentation

---

## Backward Compatibility

### During Phase 1 & 2

- ✅ `Tag.BUILTIN` values continue to work
- ✅ `Tag.CODE < 128` values work identically
- ✅ Both dispatch to builtins correctly
- ✅ No breaking changes

### After Phase 3

- ❌ `Tag.BUILTIN` no longer exists
- ✅ All functionality moved to `Tag.CODE`
- ⚠️ **Breaking change:** Code using `Tag.BUILTIN` will fail

---

## Benefits of Deprecation

1. **Simplification:** One tag instead of two for executable code
2. **Unified:** `Tag.CODE` handles both builtins and user code
3. **Consistency:** All executable code uses the same tag
4. **Flexibility:** Symbols can be stored as `Tag.CODE` regardless of type

---

## Risks

1. **Breaking changes:** Phase 3 removes `Tag.BUILTIN` entirely
2. **Test updates:** Many tests need updates
3. **Migration effort:** ~35 files need changes
4. **Performance:** `Tag.CODE < 128` requires one extra comparison (negligible)

---

## Recommendation

**Incremental approach:**

1. **Phase 1:** Update creation sites (low risk, backward compatible)
2. **Phase 2:** Update check sites (medium risk, backward compatible)
3. **Phase 3:** Remove `Tag.BUILTIN` (high risk, breaking change)

**Timeline:**

- Phase 1: 1-2 days
- Phase 2: 1 day
- Phase 3: 1 day (after Phase 1 & 2 are stable)

**Alternative:** Keep `Tag.BUILTIN` for now, but encourage new code to use `Tag.CODE`. This provides backward compatibility while allowing gradual migration.
