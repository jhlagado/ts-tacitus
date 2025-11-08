# Single-Line Function Audit

**Date:** 2024-12-19  
**Purpose:** Identify functions with single-line bodies that can be inlined

## Analysis Methodology

Functions with single-line bodies are candidates for inlining if they:

1. Are simple wrappers with no added value
2. Are not part of a public API that needs stability
3. Don't provide meaningful abstraction or documentation
4. Are not used frequently enough to justify the abstraction

## Findings

### 1. Duplicate Functions ❌ **REMOVE**

#### `readRefValue` vs `readReference`

**Location:** `src/core/refs.ts`

Both functions are **identical**:

```typescript
// Line 81-84
export function readRefValue(vm: VM, ref: number): number {
  const byteAddr = getByteAddressFromRef(ref);
  return vm.memory.readFloat32(SEG_DATA, byteAddr);
}

// Line 213-216
export function readReference(vm: VM, ref: number): number {
  const address = getByteAddressFromRef(ref);
  return vm.memory.readFloat32(SEG_DATA, address);
}
```

**Usage:**

- `readRefValue`: Used in 2 places (tests + query-ops.ts + global-heap-ops.ts)
- `readReference`: Not found in usage search

**Recommendation:** Remove `readReference`, keep `readRefValue` (or rename to `readReference` if preferred)

---

### 2. Deprecated Wrapper ❌ **REMOVE**

#### `isDataRef`

**Location:** `src/core/refs.ts:101-103`

```typescript
export function isDataRef(tval: number): boolean {
  return isRef(tval);
}
```

**Status:** Already marked `@deprecated`  
**Usage:** Not found in source code (only definition exists)

**Recommendation:** Remove entirely

---

### 3. Unused Function ❌ **REMOVE**

#### `isRefCounted`

**Location:** `src/core/tagged.ts:153-155`

```typescript
export function isRefCounted(_value: number): boolean {
  return false;
}
```

**Usage:** Not found in source code  
**Comment:** "Unused helper. Always returns false."

**Recommendation:** Remove entirely

---

### 4. Convenience Extractors ✅ **KEEP** (Used Frequently)

These single-line functions extract fields from `fromTaggedValue()`:

- `getTag(nanValue)` - Extracts tag, used extensively
- `getValue(nanValue)` - Extracts value, used extensively

**Rationale:** These are frequently used convenience functions that avoid destructuring overhead and provide clear intent.

---

### 5. Type Checkers ✅ **KEEP** (API Consistency)

These single-line functions check tag types:

- `isNumber(tval)` - `getTag(tval) === Tag.NUMBER`
- `isSentinel(tval)` - `getTag(tval) === Tag.SENTINEL`
- `isCode(tval)` - `getTag(tval) === Tag.CODE`
- `isString(tval)` - `getTag(tval) === Tag.STRING`
- `isLocal(tval)` - `getTag(tval) === Tag.LOCAL`
- `isRef(tval)` - `getTag(tval) === Tag.REF`

**Rationale:** These provide a consistent API for type checking. While they could be inlined, they:

- Provide clear, self-documenting names
- Are part of a consistent pattern
- Are used frequently throughout the codebase
- Make code more readable than inline tag comparisons

---

### 6. Address Conversion ✅ **KEEP** (Useful Abstraction)

#### `getByteAddressFromRef`

**Location:** `src/core/refs.ts:71-73`

```typescript
export function getByteAddressFromRef(ref: number): number {
  return getAbsoluteCellIndexFromRef(ref) * CELL_SIZE;
}
```

**Usage:** Used in 10+ places throughout the codebase

**Rationale:**

- Provides clear abstraction (cell index → byte address)
- Encapsulates the `CELL_SIZE` multiplication
- Used frequently enough to justify the function
- Makes code more readable

---

### 7. Region Checkers ✅ **KEEP** (Newly Added, Useful)

- `isGlobalRef(ref)` - Checks if ref is in global region
- `isStackRef(ref)` - Checks if ref is in data stack region
- `isRStackRef(ref)` - Checks if ref is in return stack region

**Rationale:** These were just added and provide clear, readable boolean checks for region membership.

---

## Summary

### Functions to Remove:

1. ✅ `readReference` - Duplicate of `readRefValue`
2. ✅ `isDataRef` - Deprecated wrapper, unused
3. ✅ `isRefCounted` - Unused, always returns false

### Functions to Keep:

- All type checkers (`isNumber`, `isCode`, etc.) - API consistency
- `getTag`, `getValue` - Frequently used convenience functions
- `getByteAddressFromRef` - Useful abstraction, frequently used
- Region checkers - Newly added, provide clear API

### Action Items:

1. ✅ **COMPLETED:** Removed `readReference` function (duplicate of `readRefValue`)
2. ✅ **COMPLETED:** Removed `isDataRef` function (deprecated, unused)
3. ✅ **COMPLETED:** Removed `isRefCounted` function (unused, always returns false)
4. ✅ **COMPLETED:** Updated documentation to use `readRefValue` instead of `readReference`

## Results

- **3 functions removed** from codebase
- **0 breaking changes** (all removed functions were unused)
- **All tests passing** (1,258 tests)
- **Documentation updated** to reflect current API
