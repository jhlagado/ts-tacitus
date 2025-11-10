# Function Naming Uniformity Analysis

**Date:** 2025-01-XX  
**Status:** Analysis Complete

## Executive Summary

This document analyzes function naming patterns across the codebase to identify inconsistencies and propose uniform naming conventions. **Key principle:** Don't merge functions that would require parameters to switch behavior - separate functions are clearer than "swiss army knife" functions.

## Naming Pattern Analysis

### 1. Reading/Extracting Values

**Current Inconsistencies:**

| Function                                  | Pattern                | Issue                            |
| ----------------------------------------- | ---------------------- | -------------------------------- |
| `readRef(vm, ref)`                        | `read` + noun          | Reads value from memory via REF  |
| `getCellFromRef(ref)`                     | `get` + noun + `From`  | Extracts cell index from REF     |
| `getListLength(header)`                   | `get` + noun           | Extracts length from header      |
| `getListBounds(vm, value)`                | `get` + noun           | Extracts bounds info             |
| `getListElemCell(...)`                    | `get` + noun           | Finds element cell               |
| `getRefArea(ref)`                         | `get` + noun           | Gets area name                   |
| `getRefSegment(ref)`                      | `get` + noun           | Gets segment number (deprecated) |
| `getStackData(vm)`                        | `get` + noun           | Gets stack data array            |
| `getTag(nanValue)`                        | `get` + noun           | Gets tag                         |
| `getValue(nanValue)`                      | `get` + noun           | Gets value                       |
| `loadListFromReturn(vm, cell)`            | `load` + noun + `From` | Loads list from return stack     |
| `readCapsuleLayoutFromHandle(vm, handle)` | `read` + noun + `From` | Reads layout from handle         |

**Pattern:** Mix of `read`, `get`, and `load` for similar operations.

**Proposed Convention:**

- **`read*`**: Read value from memory (requires VM, performs memory access)
  - `readRef(vm, ref)` ✓
  - `readCapsuleLayoutFromHandle(vm, handle)` → `readCapsuleLayout(vm, handle)`
- **`get*`**: Extract/compute value from existing data (pure function, no memory access)
  - `getCellFromRef(ref)` ✓
  - `getListLength(header)` ✓
  - `getListBounds(vm, value)` ✓ (needs VM for memory access, but extracts info)
  - `getRefArea(ref)` ✓
  - `getTag(nanValue)` ✓
  - `getValue(nanValue)` ✓
- **`load*`**: Transfer data from one location to another (stack operation)
  - `loadListFromReturn(vm, cell)` ✓ (transfers from return stack to data stack)

**Recommendations:**

1. `readCapsuleLayoutFromHandle` → `readCapsuleLayout` (remove redundant "FromHandle")
2. Keep `readRef`, `getCellFromRef`, `getListLength`, etc. as separate functions - they're conceptually different

### 2. Creating/Initializing Values

**Current Patterns:**

| Function                      | Pattern         | Issue                       |
| ----------------------------- | --------------- | --------------------------- |
| `createRef(cellIndex)`        | `create` + noun | Creates REF from cell index |
| `createGlobalRef(cellIndex)`  | `create` + noun | Creates global REF          |
| `createBuiltinRef(opcode)`    | `create` + noun | Creates builtin REF         |
| `createCodeRef(bytecodeAddr)` | `create` + noun | Creates code REF            |
| `createVM(useCache)`          | `create` + noun | Creates VM instance         |
| `createTargetRef(vm)`         | `create` + noun | Creates target REF          |
| `makeListOp(vm)`              | `make` + noun   | Makes list (opcode handler) |

**Pattern:** Mostly consistent use of `create`, except `makeListOp`.

**Proposed Convention:**

- **`create*`**: Create new instances/values
  - All current `create*` functions ✓
- **`make*`**: Reserved for opcode handlers that construct values
  - `makeListOp` ✓ (opcode handler, different context)

**Recommendations:**

1. Keep `create*` pattern for all creation functions
2. Keep `make*` for opcode handlers (they're in a different namespace)

### 3. Writing/Setting Values

**Current Patterns:**

| Function                        | Pattern        | Issue                   |
| ------------------------------- | -------------- | ----------------------- |
| `writeRef(vm, ref, value)`      | `write` + noun | Writes value via REF    |
| `memory.writeCell(cell, value)` | `write` + noun | Writes to cell (method) |

**Pattern:** Consistent use of `write`.

**Recommendations:**

1. Keep `write*` pattern ✓

### 4. Computing/Calculating Values

**Current Patterns:**

| Function                         | Pattern          | Issue                        |
| -------------------------------- | ---------------- | ---------------------------- |
| `computeHeaderCell(base, slots)` | `compute` + noun | Computes header cell index   |
| `refToByte(ref)`                 | `refTo` + noun   | Converts REF to byte address |

**Pattern:** Mix of `compute` and `*To*` conversion patterns.

**Proposed Convention:**

- **`compute*`**: Calculate derived values from inputs
  - `computeHeaderCell` ✓
- **`*To*`**: Type/unit conversions
  - `refToByte` ✓

**Recommendations:**

1. Keep both patterns - they serve different purposes
2. `compute*` for calculations, `*To*` for conversions

### 5. Checking/Validating

**Current Patterns:**

| Function                           | Pattern           | Issue                |
| ---------------------------------- | ----------------- | -------------------- |
| `isRef(tval)`                      | `is` + noun       | Type check           |
| `isList(tval)`                     | `is` + noun       | Type check           |
| `isNIL(tval)`                      | `is` + noun       | Value check          |
| `isGlobalRef(ref)`                 | `is` + noun       | Area check           |
| `isStackRef(ref)`                  | `is` + noun       | Area check           |
| `isRStackRef(ref)`                 | `is` + noun       | Area check           |
| `isCompatible(existing, newValue)` | `is` + adjective  | Compatibility check  |
| `validateListHeader(vm)`           | `validate` + noun | Validates and throws |

**Pattern:** Consistent use of `is*` for boolean checks, `validate*` for validation that throws.

**Recommendations:**

1. Keep `is*` pattern for boolean checks ✓
2. Keep `validate*` pattern for validation that throws ✓

### 6. Area/Segment Operations

**Current Inconsistencies:**

| Function             | Pattern      | Issue                               |
| -------------------- | ------------ | ----------------------------------- |
| `getRefArea(ref)`    | `get` + noun | Returns area name string            |
| `isGlobalRef(ref)`   | `is` + noun  | Returns boolean                     |
| `isStackRef(ref)`    | `is` + noun  | Returns boolean                     |
| `isRStackRef(ref)`   | `is` + noun  | Returns boolean                     |
| `getRefSegment(ref)` | `get` + noun | Returns segment number (deprecated) |

**Pattern:** Mix of `get*` (returns value) and `is*` (returns boolean) for similar concepts.

**Recommendations:**

1. Keep current pattern - `getRefArea` returns a value, `is*Ref` return booleans
2. These serve different purposes and should remain separate
3. `getRefSegment` is deprecated, will be removed

### 7. List Operations

**Current Patterns:**

| Function                         | Pattern                 | Issue                 |
| -------------------------------- | ----------------------- | --------------------- |
| `getListLength(header)`          | `get` + noun            | Extracts length       |
| `getListBounds(vm, value)`       | `get` + noun            | Extracts bounds       |
| `getListElemCell(...)`           | `get` + noun            | Finds element         |
| `getListInfoOrFail(vm, value)`   | `get` + noun + `OrFail` | Extracts or throws    |
| `dropList(vm)`                   | `drop` + noun           | Drops list from stack |
| `validateListHeader(vm)`         | `validate` + noun       | Validates header      |
| `copyListPayload(vm, ...)`       | `copy` + noun           | Copies payload        |
| `computeHeaderCell(base, slots)` | `compute` + noun        | Computes header       |

**Pattern:** Mostly consistent `get*` for extraction, `drop*` for removal, `copy*` for copying, `compute*` for calculation.

**Recommendations:**

1. Keep current patterns ✓
2. `getListInfoOrFail` should be removed (redundant wrapper)

### 8. Reference Operations

**Current Patterns:**

| Function                     | Pattern               | Issue                         |
| ---------------------------- | --------------------- | ----------------------------- |
| `createRef(cellIndex)`       | `create` + noun       | Creates REF                   |
| `createGlobalRef(cellIndex)` | `create` + noun       | Creates global REF            |
| `getCellFromRef(ref)`        | `get` + noun + `From` | Extracts cell                 |
| `getVarRef(vm, slotNumber)`  | `get` + noun          | Creates REF (misleading name) |
| `readRef(vm, ref)`           | `read` + noun         | Reads value                   |
| `writeRef(vm, ref, value)`   | `write` + noun        | Writes value                  |
| `refToByte(ref)`             | `refTo` + noun        | Converts to byte              |

**Issue:** `getVarRef` is misleading - it creates a REF, doesn't "get" an existing one.

**Recommendations:**

1. `getVarRef` → `createVarRef` (it creates a new REF, doesn't extract from existing)
2. Keep other patterns ✓

## Specific Naming Issues

### High Priority

1. **`getVarRef` → `createVarRef`**
   - **Issue:** Function creates a new REF, but name suggests extraction
   - **Fix:** Rename to `createVarRef` to match `createGlobalRef` pattern
   - **Impact:** Used in parser and tests

2. **`readCapsuleLayoutFromHandle` → `readCapsuleLayout`**
   - **Issue:** Redundant "FromHandle" - the parameter name makes it clear
   - **Fix:** Shorten to `readCapsuleLayout`
   - **Impact:** Used in capsule operations

3. **`getListInfoOrFail` → Remove**
   - **Issue:** Redundant wrapper around `getListBounds`
   - **Fix:** Inline at call sites
   - **Impact:** Used in a few places

### Medium Priority

4. **Consistency in `read*` vs `get*`**
   - **Rule:** `read*` = memory access (needs VM), `get*` = extraction/computation (may need VM for memory access but extracts info)
   - **Current:** Mostly consistent, but `readCapsuleLayoutFromHandle` could be clearer

5. **Consistency in `create*` vs `make*`**
   - **Rule:** `create*` = general creation, `make*` = opcode handlers
   - **Current:** Consistent

## Naming Convention Summary

### Verbs

| Verb        | Usage                                | Examples                                        |
| ----------- | ------------------------------------ | ----------------------------------------------- |
| `read*`     | Read value from memory (requires VM) | `readRef`, `readCapsuleLayout`                  |
| `get*`      | Extract/compute value from data      | `getCellFromRef`, `getListLength`, `getRefArea` |
| `load*`     | Transfer data between locations      | `loadListFromReturn`                            |
| `create*`   | Create new instances/values          | `createRef`, `createGlobalRef`, `createVM`      |
| `make*`     | Opcode handlers that construct       | `makeListOp`                                    |
| `write*`    | Write value to memory                | `writeRef`                                      |
| `copy*`     | Copy data                            | `copyListPayload`                               |
| `compute*`  | Calculate derived values             | `computeHeaderCell`                             |
| `*To*`      | Type/unit conversions                | `refToByte`                                     |
| `is*`       | Boolean checks                       | `isRef`, `isList`, `isGlobalRef`                |
| `validate*` | Validation that throws               | `validateListHeader`                            |
| `drop*`     | Remove from stack                    | `dropList`                                      |

### Patterns to Avoid

1. **Don't merge functions that need parameters to switch behavior**
   - Bad: `getRefInfo(ref, returnType: 'area' | 'segment' | 'cell')`
   - Good: `getRefArea(ref)`, `getRefSegment(ref)`, `getCellFromRef(ref)`

2. **Don't use generic names for specific operations**
   - Bad: `get(ref)`
   - Good: `getCellFromRef(ref)`, `getListLength(header)`

3. **Don't use misleading names**
   - Bad: `getVarRef` (creates, doesn't get)
   - Good: `createVarRef`

## Implementation Plan

### Phase 1: Fix Misleading Names

1. Rename `getVarRef` → `createVarRef`
2. Update all call sites
3. Run tests

### Phase 2: Simplify Redundant Names

1. Rename `readCapsuleLayoutFromHandle` → `readCapsuleLayout`
2. Update call sites
3. Run tests

### Phase 3: Remove Redundant Wrappers

1. Remove `getListInfoOrFail`
2. Inline at call sites
3. Run tests

## Success Criteria

1. All function names clearly indicate their purpose
2. No misleading names (e.g., `get*` that creates)
3. Consistent verb usage across similar operations
4. No redundant "From" suffixes
5. All tests pass after renaming
