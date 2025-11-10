# Function Rationalization Plan

**Date:** 2025-01-XX  
**Status:** Analysis Complete, Plan Pending

## Executive Summary

This document analyzes all functions across the codebase, identifies patterns and redundancies, and proposes a rationalization plan to improve reusability and composability.

### Quick Reference: Major Redundancies

| Category | Current Functions | Unified Functions | Reduction |
|----------|------------------|-------------------|-----------|
| Stack Operations | `push`, `rpush`, `gpush`, `pop`, `rpop`, `gpop`, `peek`, `gpeek`, `depth`, `rdepth`, `ensureStackSize`, `ensureRStackSize` | `stackPush`, `stackPop`, `stackPeek`, `stackDepth`, `ensureStackSize` (with region param) | ~12 → ~5 |
| Code Reading | `read8`, `readOp`, `readI16`, `readU16`, `readF32`, `next8`, `nextOpcode`, `nextInt16`, `nextUint16`, `nextFloat32` | `readCode` (with type and advance params) | ~10 → 1 |
| Reference Area Checks | `isGlobalRef`, `isStackRef`, `isRStackRef`, `getRefArea` | `getRefArea` + simple comparisons | ~4 → 1 + 3 one-liners |
| Dictionary Define | `define`, `defineBuiltin`, `defineCode`, `defineLocal` | `define` (with options) | ~4 → 1 |
| Dictionary Find | `lookup`, `findEntry`, `findBytecodeAddress` | `find` (with options) | ~3 → 1 |
| List Transfer | `rpushList`, `gpushList`, `gpushListFrom` | `transferList` (with target param) | ~3 → 1 |
| Type Checks | `isList`, `isRef`, `isNIL`, etc. | `isTag` + wrappers | ~10 → 1 + wrappers |
| **Total Estimated Reduction** | **~200+ functions** | **~120-140 functions** | **~30-40%** |

## Function Categories

### 1. Stack Operations (Data Stack)

**Location:** `src/core/vm.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `push(vm, value)` | Write + increment pointer | `rpush`, `gpush` |
| `pop(vm)` | Decrement + read | `rpop`, `gpop` |
| `peek(vm)` | Read without decrement | `gpeek`, `peekAt` |
| `getStackData(vm)` | Read range | - |
| `ensureStackSize(vm, size, op)` | Bounds check | `ensureRStackSize` |
| `popArray(vm, size)` | Batch pop | - |
| `peekAt(vm, offset)` | Offset read | - |
| `depth(vm)` | Calculate depth | `rdepth` |

**Pattern:** All follow `(vm: VM, ...args) => result` signature. Similar operations exist for return stack and global heap.

### 2. Stack Operations (Return Stack)

**Location:** `src/core/vm.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `rpush(vm, value)` | Write + increment | `push`, `gpush` |
| `rpop(vm)` | Decrement + read | `pop`, `gpop` |
| `ensureRStackSize(vm, size, op)` | Bounds check | `ensureStackSize` |
| `rdepth(vm)` | Calculate depth | `depth` |

**Pattern:** Mirror of data stack operations with `r` prefix.

### 3. Stack Operations (Global Heap)

**Location:** `src/core/vm.ts`, `src/core/global-heap.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `gpush(vm, value)` | Write + increment | `push`, `rpush` |
| `gpeek(vm)` | Read without decrement | `peek` |
| `gpop(vm)` | Decrement + read | `pop`, `rpop` |
| `gpushVal(vm, value)` | Push + return REF | `gpushList` |
| `gpushList(vm)` | Transfer list from stack | `rpushList` |
| `gpushListFrom(vm, source)` | Copy list from memory | `copyListPayload` |

**Pattern:** Similar to stack operations but with `g` prefix. Some return REFs.

### 4. List Operations

**Location:** `src/core/list.ts`, `src/ops/local-vars-transfer.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `isList(tval)` | Type check | `isRef`, `isNIL` |
| `getListLength(header)` | Extract metadata | - |
| `dropList(vm)` | Batch pop | `popArray` |
| `validateListHeader(vm)` | Validation + bounds | `ensureStackSize` |
| `getListBounds(vm, value)` | Extract info | `getListInfoOrFail` |
| `getListInfoOrFail(vm, value)` | Extract or throw | `getListBounds` |
| `getListElemCell(vm, header, cell, idx)` | Find element | - |
| `reverseSpan(vm, span)` | In-place reverse | `_reverseSpan` (test util) |
| `copyListPayload(vm, src, dst, slots)` | Copy range | - |
| `computeHeaderCell(base, slots)` | Calculate | - |
| `rpushList(vm)` | Transfer to rstack | `gpushList` |
| `loadListFromReturn(vm, cell)` | Materialize from rstack | - |
| `updateList(vm, targetCell)` | In-place update | - |

**Pattern:** Mix of pure functions (no VM) and VM-dependent operations. Many operations have similar structure but different targets.

### 5. Reference Operations

**Location:** `src/core/refs.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `createRef(cellIndex)` | Create tagged value | `createGlobalRef` |
| `decodeRef(ref)` | Extract value | `getCellFromRef` |
| `getCellFromRef(ref)` | Extract cell | `decodeRef` |
| `refToByte(ref)` | Convert units | - |
| `readRef(vm, ref)` | Read via ref | `vm.memory.readCell` |
| `writeRef(vm, ref, value)` | Write via ref | `vm.memory.writeCell` |
| `isRef(tval)` | Type check | `isList`, `isNIL` |
| `getRefArea(ref)` | Classify | `isGlobalRef`, `isStackRef`, `isRStackRef` |
| `isGlobalRef(ref)` | Area check | `isStackRef`, `isRStackRef` |
| `isStackRef(ref)` | Area check | `isGlobalRef`, `isRStackRef` |
| `isRStackRef(ref)` | Area check | `isGlobalRef`, `isStackRef` |
| `getRefSegment(ref)` | Classify (deprecated) | `getRefArea` |
| `getVarRef(vm, slot)` | Create local ref | `createGlobalRef` |
| `createGlobalRef(cellIndex)` | Create global ref | `createRef`, `getVarRef` |

**Pattern:** Many functions are variations of the same operation (create, read, write, classify). Area checks are redundant with `getRefArea`.

### 6. Memory Operations

**Location:** `src/core/memory.ts`, `src/core/vm.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `memory.readCell(cellIndex)` | Read | `readRef` |
| `memory.writeCell(cellIndex, value)` | Write | `writeRef` |
| `read8(vm)` | Read byte | `readOp`, `readI16`, `readU16`, `readF32` |
| `readOp(vm)` | Read opcode | `read8`, `readI16` |
| `readI16(vm)` | Read int16 | `readU16`, `readF32` |
| `readU16(vm)` | Read uint16 | `readI16`, `readF32` |
| `readF32(vm)` | Read float32 | `readI16`, `readU16` |
| `readAddr(vm)` | Read address | - |
| `next8(vm)` | Read + advance | `nextOpcode`, `nextInt16`, `nextFloat32`, `nextUint16` |
| `nextOpcode(vm)` | Read opcode + advance | `next8`, `nextInt16` |
| `nextInt16(vm)` | Read int16 + advance | `nextUint16`, `nextFloat32` |
| `nextUint16(vm)` | Read uint16 + advance | `nextInt16`, `nextFloat32` |
| `nextFloat32(vm)` | Read float32 + advance | `nextInt16`, `nextUint16` |

**Pattern:** Two families: `read*` (no IP advance) and `next*` (advances IP). Very similar implementations.

### 7. Dictionary Operations

**Location:** `src/core/dictionary.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `define(vm, name, value)` | Core define | `defineBuiltin`, `defineCode`, `defineLocal` |
| `defineBuiltin(vm, name, opcode)` | Define builtin | `define`, `defineCode` |
| `defineCode(vm, name, address)` | Define code | `define`, `defineBuiltin` |
| `defineLocal(vm, name)` | Define local | `define` |
| `lookup(vm, name)` | Find entry | `findEntry`, `findBytecodeAddress` |
| `findEntry(vm, name)` | Find with metadata | `lookup`, `findBytecodeAddress` |
| `findBytecodeAddress(vm, name)` | Find address | `lookup`, `findEntry` |
| `mark(vm)` | Checkpoint | `markWithLocalReset` |
| `markWithLocalReset(vm)` | Checkpoint + reset | `mark` |
| `forget(vm, cell)` | Restore checkpoint | - |
| `defineOp(vm)` | Opcode handler | `lookupOp`, `markOp`, `forgetOp` |
| `lookupOp(vm)` | Opcode handler | `defineOp` |
| `markOp(vm)` | Opcode handler | `forgetOp` |
| `forgetOp(vm)` | Opcode handler | `markOp` |

**Pattern:** Many `define*` variants that could be unified. `find*` functions overlap.

### 8. Formatting Operations

**Location:** `src/core/format-utils.ts`

| Function | Pattern | Similar To |
|----------|---------|------------|
| `formatFloat(value)` | Format number | - |
| `formatString(str)` | Format string | - |
| `formatAtomicValue(vm, value)` | Format simple | `formatValue` |
| `formatList(vm, header)` | Format list | `formatValue` |
| `formatListFromMemory(vm, cell)` | Format from memory | `formatList` |
| `formatValue(vm, value)` | Format any | `formatAtomicValue`, `formatList` |

**Pattern:** Hierarchical: `formatValue` dispatches to `formatAtomicValue` or `formatList`. `formatListFromMemory` is internal helper.

### 9. Opcode Handlers

**Location:** `src/ops/**/*.ts`

**Pattern:** All follow `*Op(vm: VM): void` signature. ~100+ opcode handlers.

**Categories:**
- List operations: `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, `fetchOp`, `loadOp`, `storeOp`, `walkOp`, `findOp`, `keysOp`, `valuesOp`, `refOp`, `headOp`, `tailOp`, `reverseOp`, `concatOp`, `openListOp`, `closeListOp`, `makeListOp`, `packOp`, `unpackOp`
- Stack operations: `dupOp`, `dropOp`, `swapOp`, `overOp`, etc.
- Arithmetic: `addOp`, `subOp`, `mulOp`, `divOp`, etc.
- Control: `ifOp`, `elseOp`, `thenOp`, `matchOp`, `withOp`, etc.
- Variables: `initVarOp`, `varRefOp`, `initGlobalOp`, `globalRefOp`
- Heap: `gpushOp`, `gpeekOp`, `gpopOp`, `markOp`, `forgetOp`
- Dictionary: `defineOp`, `lookupOp`, `markOp`, `forgetOp`

**Pattern:** All are `(vm: VM) => void`. Many share common patterns (peek, validate, transform, push).

## Identified Redundancies

### 1. Stack Operation Triplets

**Issue:** Three nearly identical sets of operations for data stack, return stack, and global heap:
- `push` / `rpush` / `gpush`
- `pop` / `rpop` / `gpop`
- `peek` / `gpeek` (no `rpeek`)
- `ensureStackSize` / `ensureRStackSize` (no global version)
- `depth` / `rdepth` (no global version)

**Rationalization:** Create generic stack operations parameterized by region:
```typescript
type StackRegion = 'stack' | 'rstack' | 'global';

function stackPush(vm: VM, region: StackRegion, value: number): void
function stackPop(vm: VM, region: StackRegion): number
function stackPeek(vm: VM, region: StackRegion): number
function stackDepth(vm: VM, region: StackRegion): number
function ensureStackSize(vm: VM, region: StackRegion, size: number, op: string): void
```

### 2. Read/Next Function Families

**Issue:** `read*` and `next*` functions are nearly identical, only difference is IP advancement.

**Rationalization:** Single function with advance flag:
```typescript
function readCode(vm: VM, type: 'u8' | 'i16' | 'u16' | 'f32' | 'op', advance = false): number
```

### 3. Reference Area Checks

**Issue:** `isGlobalRef`, `isStackRef`, `isRStackRef` all duplicate logic from `getRefArea`.

**Rationalization:** Use `getRefArea` with comparison:
```typescript
function isGlobalRef(ref: number): boolean {
  return getRefArea(ref) === 'global';
}
```

### 4. Define Function Variants

**Issue:** `define`, `defineBuiltin`, `defineCode`, `defineLocal` all do similar things with different parameters.

**Rationalization:** Unified `define` with options:
```typescript
function define(vm: VM, name: string, value: number, options?: {
  isImmediate?: boolean;
  kind?: 'value' | 'builtin' | 'code' | 'local';
  opcode?: number;
  address?: number;
}): void
```

### 5. Find Function Overlap

**Issue:** `lookup`, `findEntry`, `findBytecodeAddress` have overlapping functionality.

**Rationalization:** Single `find` function with options:
```typescript
function find(vm: VM, name: string, options?: {
  returnValue?: boolean;
  returnEntry?: boolean;
  returnAddress?: boolean;
}): number | { taggedValue: number; isImmediate: boolean } | number | undefined
```

### 6. List Transfer Operations

**Issue:** `rpushList`, `gpushList`, `gpushListFrom` all do similar list transfers with different targets.

**Rationalization:** Generic list transfer:
```typescript
function transferList(vm: VM, target: 'stack' | 'rstack' | 'global', source?: ListSource): number
```

### 7. Format Function Hierarchy

**Issue:** `formatValue` dispatches to `formatAtomicValue` or `formatList`, but `formatList` also calls `formatValue` recursively (potential circular dependency).

**Rationalization:** Flatten hierarchy, make `formatValue` handle all cases directly.

### 8. Copy Operations

**Issue:** `copyListPayload` is specific to lists, but pattern could be generalized.

**Rationalization:** Generic cell range copy:
```typescript
function copyCells(vm: VM, src: number, dst: number, count: number): void
```

## Rationalization Plan

### Phase 1: Stack Operations Unification

**Goal:** Unify stack operations across data stack, return stack, and global heap.

**Steps:**
1. Create `StackRegion` type and region accessor helpers
2. Implement generic `stackPush`, `stackPop`, `stackPeek`, `stackDepth`, `ensureStackSize`
3. Deprecate individual functions (`push`, `rpush`, `gpush`, etc.)
4. Update all call sites
5. Remove deprecated functions

**Benefits:**
- Reduces ~15 functions to ~5
- Eliminates code duplication
- Makes adding new stack regions easier

### Phase 2: Code Reading Unification

**Goal:** Unify `read*` and `next*` function families.

**Steps:**
1. Create unified `readCode` function
2. Deprecate `read8`, `readOp`, `readI16`, `readU16`, `readF32`
3. Deprecate `next8`, `nextOpcode`, `nextInt16`, `nextUint16`, `nextFloat32`
4. Update all call sites
5. Remove deprecated functions

**Benefits:**
- Reduces ~10 functions to 1
- Eliminates duplication
- Clearer API

### Phase 3: Reference Operations Simplification

**Goal:** Simplify reference operations, remove redundant area checks.

**Steps:**
1. Simplify `isGlobalRef`, `isStackRef`, `isRStackRef` to use `getRefArea`
2. Consider removing `getRefSegment` (already deprecated)
3. Unify `createRef` and `createGlobalRef` if possible
4. Consider merging `decodeRef` and `getCellFromRef` if they're truly redundant

**Benefits:**
- Reduces code duplication
- Single source of truth for area classification

### Phase 4: Dictionary Operations Unification

**Goal:** Unify `define*` and `find*` function families.

**Steps:**
1. Create unified `define` with options object
2. Create unified `find` with options object
3. Deprecate variants
4. Update call sites
5. Remove deprecated functions

**Benefits:**
- Reduces ~8 functions to 2
- More flexible API
- Easier to extend

### Phase 5: List Transfer Unification

**Goal:** Unify list transfer operations.

**Steps:**
1. Create generic `transferList` function
2. Deprecate `rpushList`, `gpushList`, `gpushListFrom`
3. Update call sites
4. Remove deprecated functions

**Benefits:**
- Reduces 3 functions to 1
- Consistent API
- Easier to add new transfer targets

### Phase 6: Memory Operations Generalization

**Goal:** Generalize copy operations.

**Steps:**
1. Create generic `copyCells` function
2. Update `copyListPayload` to use it
3. Consider if other copy operations can use it

**Benefits:**
- More reusable utilities
- Less duplication

## API Design Principles

### 1. Consistency

All similar operations should follow the same pattern:
- Stack operations: `stack<Op>(vm, region, ...args)`
- Memory operations: `memory.<op>(cellIndex, ...args)`
- Reference operations: `<action>Ref(vm?, ref, ...args)`

### 2. Composability

Functions should be composable:
- Low-level operations (read/write cells)
- Mid-level operations (stack ops, list ops)
- High-level operations (opcode handlers)

### 3. Reusability

Avoid function-specific implementations when a generic one would work:
- Generic stack operations instead of separate functions per region
- Generic read operations instead of separate functions per type
- Generic find operations instead of separate functions per return type

### 4. Clarity

Function names should be clear about what they do:
- `stackPush` is clearer than `push` (which stack?)
- `readCode` is clearer than `next8` (what does it read?)
- `transferList` is clearer than `rpushList` (where is it going?)

## Implementation Strategy

### Incremental Approach

1. **Add new unified functions** alongside existing ones
2. **Deprecate old functions** with clear migration path
3. **Update call sites incrementally** (file by file)
4. **Remove deprecated functions** after all call sites updated
5. **Run tests after each step** to ensure no regressions

### Testing Strategy

1. **Unit tests** for new unified functions
2. **Integration tests** to ensure behavior matches old functions
3. **Migration tests** to verify deprecated functions still work
4. **Full test suite** after each phase

## Metrics

### Current State
- **Total functions:** ~200+
- **Redundant patterns:** ~8 major categories
- **Estimated reduction:** ~30-40% after rationalization

### Target State
- **Total functions:** ~120-140
- **Unified patterns:** All major categories
- **Code duplication:** Minimal

## Risks

1. **Breaking changes:** Deprecation path must be clear
2. **Performance:** Generic functions might be slower (measure and optimize)
3. **Complexity:** Unified functions might be harder to understand (good docs needed)
4. **Migration effort:** Significant time investment required

## Opcode Handler Patterns

### Common Pattern Structure

Most opcode handlers follow this pattern:
1. **Validate stack size** (`ensureStackSize`)
2. **Peek/pop inputs** (`peek`, `pop`)
3. **Validate inputs** (type checks, bounds checks)
4. **Perform operation** (transform, compute, copy)
5. **Push result** (`push`)
6. **Handle errors** (return NIL, throw)

### Example Pattern Analysis

**Query Operations** (`lengthOp`, `sizeOp`, `slotOp`, `elemOp`):
```typescript
export function lengthOp(vm: VM): void {
  ensureStackSize(vm, 1, 'length');
  const value = peek(vm);
  const info = getListBounds(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    push(vm, NIL);
    return;
  }
  const slotCount = getListLength(info.header);
  dropOp(vm);
  push(vm, slotCount);
}
```

**Pattern:** Validate → Peek → Check → Transform → Drop → Push

**Rationalization Opportunity:** Extract common "query list or return NIL" pattern:
```typescript
function queryList<T>(vm: VM, op: string, fn: (info: ListInfo) => T): void {
  ensureStackSize(vm, 1, op);
  const value = peek(vm);
  const info = getListBounds(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    push(vm, NIL);
    return;
  }
  const result = fn(info);
  dropOp(vm);
  push(vm, result);
}

// Usage:
export function lengthOp(vm: VM): void {
  queryList(vm, 'length', (info) => getListLength(info.header));
}
```

### Stack Operation Handlers

**Pattern:** Simple peek/pop/swap operations:
- `dupOp`: peek + push
- `dropOp`: pop (discard)
- `swapOp`: pop two, push in reverse
- `overOp`: peek at second, push

**Rationalization Opportunity:** Generic stack manipulation:
```typescript
function stackManip(vm: VM, pattern: 'dup' | 'drop' | 'swap' | 'over'): void {
  switch (pattern) {
    case 'dup': push(vm, peek(vm)); break;
    case 'drop': pop(vm); break;
    case 'swap': {
      const a = pop(vm);
      const b = pop(vm);
      push(vm, a);
      push(vm, b);
      break;
    }
    // ...
  }
}
```

## Additional Patterns Identified

### 1. Validation Helpers

Many functions have similar validation patterns:
- `ensureStackSize` / `ensureRStackSize` - bounds checking
- `validateListHeader` - type + bounds checking
- `getListInfoOrFail` - extract or throw

**Rationalization:** Generic validation helper:
```typescript
function ensure<T>(condition: boolean, error: string): asserts condition {
  if (!condition) throw new Error(error);
}

function validateList(vm: VM): ListInfo {
  ensureStackSize(vm, 1, 'list validation');
  const value = peek(vm);
  const info = getListBounds(vm, value);
  ensure(info !== null && isList(info.header), 'Expected LIST');
  return info;
}
```

### 2. Type Checking Functions

Many `is*` functions follow the same pattern:
- `isList(tval)` - check tag
- `isRef(tval)` - check tag
- `isNIL(tval)` - check value
- `isGlobalRef(ref)` - check area

**Rationalization:** Generic type checker:
```typescript
function isTag(tval: number, tag: Tag): boolean {
  return getTag(tval) === tag;
}

// Usage:
export const isList = (tval: number) => isTag(tval, Tag.LIST);
export const isRef = (tval: number) => isTag(tval, Tag.REF);
```

### 3. Memory Access Patterns

Many functions read/write memory with similar patterns:
- `readRef` / `writeRef` - via REF
- `memory.readCell` / `memory.writeCell` - direct
- `getCellFromRef` + `readCell` - common pattern

**Rationalization:** Already well-abstracted, but could add convenience:
```typescript
function readViaRef(vm: VM, ref: number): number {
  return vm.memory.readCell(getCellFromRef(ref));
}

function writeViaRef(vm: VM, ref: number, value: number): void {
  vm.memory.writeCell(getCellFromRef(ref), value);
}
```

## Success Criteria

1. All tests pass
2. No performance regressions
3. Code duplication reduced by 30%+
4. API is more consistent and composable
5. Documentation is clear and complete
6. Function count reduced from ~200+ to ~120-140

