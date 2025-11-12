tio# Tag.BUILTIN Validation Audit

## Summary

This audit examines all uses of `Tag.BUILTIN` to identify where validation ensures values are below 128 (0-127).

## Current Validation Status

### ✅ **VALIDATED** - `createBuiltinRef()` function

**Location:** `src/core/code-ref.ts:53-58`

```53:58:src/core/code-ref.ts
export function createBuiltinRef(opcode: number): number {
  if (opcode < 0 || opcode > MAX_BUILTIN_OPCODE) {
    throw new Error(`Invalid builtin opcode: ${opcode}. Must be in range 0-${MAX_BUILTIN_OPCODE}.`);
  }
  return toTaggedValue(opcode, Tag.BUILTIN);
}
```

**Validation:** ✅ Checks `opcode < 0 || opcode > 127` (MAX_BUILTIN_OPCODE = 127)

**Usage:** Only used in `src/test/core/code-ref.test.ts` (test file)

---

### ❌ **NOT VALIDATED** - `toTaggedValue()` function

**Location:** `src/core/tagged.ts:59-97`

```59:97:src/core/tagged.ts
export function toTaggedValue(value: number, tag: Tag, meta = 0): number {
  if (tag < Tag.NUMBER || tag > MAX_TAG) {
    throw new Error(`Invalid tag: ${tag}`);
  }

  if (meta !== 0 && meta !== 1) {
    throw new Error(`Meta bit must be 0 or 1, got: ${meta}`);
  }

  if (tag === Tag.NUMBER) {
    if (meta !== 0) {
      throw new Error('Meta bit must be 0 for NUMBER tag (stored as raw IEEE 754)');
    }
    return value;
  }

  let encodedValue: number;
  if (tag === Tag.SENTINEL) {
    if (value < -32768 || value > 32767) {
      throw new Error('Value must be 16-bit signed integer (-32768 to 32767) for SENTINEL tag');
    }
    // Explicitly truncate to integer to avoid precision loss from bitwise operations
    encodedValue = Math.trunc(value) & 0xffff;
  } else {
    if (value < 0 || value > 65535) {
      throw new Error('Value must be 16-bit unsigned integer (0 to 65535)');
    }
    // Explicitly truncate to integer to avoid precision loss from bitwise operations
    encodedValue = Math.trunc(value) & 0xffff;
  }

  const mantissaTagBits = (tag & 0x3f) << 16;
  const signBit = meta ? 1 << 31 : 0;
  const bits = signBit | EXPONENT_MASK | NAN_BIT | mantissaTagBits | encodedValue;
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}
```

**Validation:** ❌ Only checks `value < 0 || value > 65535` (16-bit unsigned range)
- **Does NOT check** that `Tag.BUILTIN` values are ≤ 127
- Accepts values 0-65535 for `Tag.BUILTIN`, but semantically should only accept 0-127

**Test Evidence:** `src/test/core/builtin-tag.test.ts:25-34` shows this:
```25:34:src/test/core/builtin-tag.test.ts
  test('should validate BUILTIN value ranges', () => {
    expect(() => toTaggedValue(0, Tag.BUILTIN)).not.toThrow();
    expect(() => toTaggedValue(127, Tag.BUILTIN)).not.toThrow();

    expect(() => toTaggedValue(1000, Tag.BUILTIN)).not.toThrow();
    expect(() => toTaggedValue(65535, Tag.BUILTIN)).not.toThrow();

    expect(() => toTaggedValue(-1, Tag.BUILTIN)).toThrow();

    expect(() => toTaggedValue(65536, Tag.BUILTIN)).toThrow();
  });
```

**Problem:** The test explicitly expects `toTaggedValue(1000, Tag.BUILTIN)` and `toTaggedValue(65535, Tag.BUILTIN)` to **NOT throw**, meaning validation is intentionally missing.

---

## Direct Uses of `toTaggedValue(..., Tag.BUILTIN)`

All of these bypass validation and can create invalid `Tag.BUILTIN` values ≥ 128:

### Production Code

1. **`src/ops/builtins-register.ts:59`** - Main registration function
   ```typescript
   define(vm, name, toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0));
   ```
   - **Risk:** Low - Uses `Op` enum values which should all be < 128
   - **Validation:** None - relies on `Op` enum correctness

### Test Files (76 occurrences)

All test files use `toTaggedValue(..., Tag.BUILTIN)` directly without validation:

- `src/test/core/vm-push-symbol-ref.test.ts` (8 uses)
- `src/test/lang/immediate-words.test.ts` (1 use)
- `src/test/core/vm-symbol-resolution.test.ts` (7 uses)
- `src/test/ops/interpreter/interpreter-operations.test.ts` (3 uses)
- `src/test/core/vm-comprehensive-testing.test.ts` (5 uses)
- `src/test/core/tagged.test.ts` (3 uses)
- `src/test/ops/dict/dictionary-payloads.test.ts` (15 uses) - **⚠️ Some use values > 127:**
  - Line 333: `toTaggedValue(99, Tag.BUILTIN, 0)` ✅
  - Line 375: `toTaggedValue(100, Tag.BUILTIN, 0)` ✅
  - Line 237: `toTaggedValue(42, Tag.BUILTIN, 0)` ✅
- `src/test/integration/symbol-table-integration.test.ts` (15 uses)
- `src/test/ops/builtins-register.test.ts` (if exists)
- `src/test/ops/dict/dictionary-builtins.test.ts` (5 uses)
- `src/test/ops/dict/define-and-lookup-builtin.test.ts` (1 use)
- `src/test/lang/parser-variables.test.ts` (1 use)
- `src/test/lang/local-vars-error-handling.test.ts` (1 use)
- `src/test/lang/end-to-end-local-vars.test.ts` (1 use)
- `src/test/core/vm-unified-dispatch.test.ts` (1 use) - **⚠️ Uses invalid value:**
  - Line 82: `toTaggedValue(200, Tag.BUILTIN)` ❌ **200 > 127**
- `src/test/core/builtin-tag.test.ts` (4 uses) - **⚠️ Explicitly tests invalid values:**
  - Lines 29-30: Tests `toTaggedValue(1000, Tag.BUILTIN)` and `toTaggedValue(65535, Tag.BUILTIN)` expecting them NOT to throw

---

## Places That Check Tag.BUILTIN Values

### Runtime Checks (not validation, but usage)

1. **`src/ops/core/core-ops.ts:260`** - `evalOp` dispatches builtins
   ```typescript
   case Tag.BUILTIN:
     // Uses value directly as opcode index
   ```
   - **Risk:** If value ≥ 128, will index out of bounds in opcode table

2. **`src/lang/meta/conditionals.ts:55`** - Checks for `Op.EndIf`
   ```typescript
   if (closerInfo.tag !== Tag.BUILTIN || closerInfo.value !== Op.EndIf) {
   ```

3. **`src/lang/meta/match-with.ts:33`** - Checks for `Op.EndMatch`
   ```typescript
   if (tag !== Tag.BUILTIN || value !== Op.EndMatch) {
   ```

4. **`src/lang/meta/case.ts:18`** - Checks for `Op.EndCase`
   ```typescript
   if (tag !== Tag.BUILTIN || value !== Op.EndCase) {
   ```

5. **`src/lang/meta/capsules.ts:26`** - Checks for `Op.EndDefinition`
   ```typescript
   if (tag !== Tag.BUILTIN || value !== Op.EndDefinition) {
   ```

6. **`src/ops/core/core-ops.ts:370`** - Checks for `Op.EndCase`
   ```typescript
   if (tag !== Tag.BUILTIN || value !== Op.EndCase) {
   ```

**Note:** These check for specific opcode values but don't validate the range.

---

## Recommendations

### Option 1: Add Validation to `toTaggedValue()` (Recommended)

Add tag-specific validation in `toTaggedValue()`:

```typescript
export function toTaggedValue(value: number, tag: Tag, meta = 0): number {
  // ... existing validation ...

  if (tag === Tag.BUILTIN) {
    if (value < 0 || value > MAX_BUILTIN_OPCODE) {
      throw new Error(`Invalid builtin opcode: ${value}. Must be in range 0-${MAX_BUILTIN_OPCODE}.`);
    }
  }

  // ... rest of function ...
}
```

**Impact:**
- ✅ Prevents invalid `Tag.BUILTIN` values at creation time
- ⚠️ **BREAKING:** Will break `src/test/core/builtin-tag.test.ts:29-30` (expects invalid values to not throw)
- ⚠️ **BREAKING:** Will break `src/test/core/vm-unified-dispatch.test.ts:82` (uses value 200)

### Option 2: Use `createBuiltinRef()` Everywhere

Replace all `toTaggedValue(..., Tag.BUILTIN)` with `createBuiltinRef()`.

**Impact:**
- ✅ Centralized validation
- ⚠️ Requires updating ~76 test locations
- ⚠️ Requires updating `src/ops/builtins-register.ts:59`

### Option 3: Add Runtime Validation in `evalOp`

Add validation when dispatching builtins:

```typescript
case Tag.BUILTIN:
  if (addr < 0 || addr > MAX_BUILTIN_OPCODE) {
    throw new Error(`Invalid builtin opcode: ${addr}. Must be in range 0-${MAX_BUILTIN_OPCODE}.`);
  }
  // ... dispatch logic ...
```

**Impact:**
- ✅ Catches invalid values at runtime
- ❌ Doesn't prevent creation of invalid values
- ❌ Runtime errors instead of creation-time errors

---

## Current State Summary

| Location | Validation | Risk Level |
|----------|-----------|-----------|
| `createBuiltinRef()` | ✅ Validates 0-127 | ✅ Safe |
| `toTaggedValue()` | ❌ No validation | ⚠️ Medium |
| `builtins-register.ts` | ❌ None (relies on Op enum) | ✅ Low (Op enum should be safe) |
| Test files | ❌ None | ⚠️ Medium (some use invalid values) |
| `evalOp` dispatch | ❌ None | ⚠️ High (could index out of bounds) |

---

## Files Requiring Updates (if adding validation)

1. **`src/core/tagged.ts`** - Add `Tag.BUILTIN` validation to `toTaggedValue()`
2. **`src/test/core/builtin-tag.test.ts`** - Update test expectations
3. **`src/test/core/vm-unified-dispatch.test.ts`** - Fix invalid value (200 → valid opcode)
4. **`src/ops/builtins-register.ts`** - Consider using `createBuiltinRef()` or add validation

---

## Constants Reference

- `MAX_BUILTIN_OPCODE = 127` (defined in `src/core/constants.ts:77`)
- `MIN_USER_OPCODE = 128` (defined in `src/core/constants.ts:80`)

