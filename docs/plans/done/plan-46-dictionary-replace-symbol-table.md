# Plan: Replace Symbol Table with Dictionary

## Executive Summary

The heap-backed dictionary is now feature-complete and can replace the in-memory symbol table. This plan outlines the feature comparison, gaps, and migration strategy.

## Feature Comparison

### Symbol Table Features

| Feature                                          | Symbol Table                                | Dictionary                                     | Status                       |
| ------------------------------------------------ | ------------------------------------------- | ---------------------------------------------- | ---------------------------- |
| **Lookup**                                       |                                             |                                                |                              |
| `findTaggedValue(name)`                          | Returns tagged value or undefined           | `lookup(vm, name)` returns tagged value or NIL | ✅ Equivalent                |
| `find(name)`                                     | Returns opcode/address for BUILTIN/CODE     | Can decode from tagged value                   | ⚠️ Needs wrapper             |
| `findCodeRef(name)`                              | Returns tagged value if BUILTIN/CODE        | Can check tag after lookup                     | ⚠️ Needs wrapper             |
| `findBytecodeAddress(name)`                      | Returns address if CODE                     | Can decode from tagged value                   | ⚠️ Needs wrapper             |
| `findEntry(name)`                                | Returns entry with taggedValue, isImmediate | Can decode from tagged value                   | ⚠️ Needs wrapper             |
| `findWithImplementation(name)`                   | Returns index, implementation, isImmediate  | Implementation not stored                      | ❌ Missing                   |
| **Definition**                                   |                                             |                                                |                              |
| `defineSymbol(name, taggedValue)`                | Stores in localDefs or fallbackDefs         | `define(vm, name, taggedValue)`                | ✅ Equivalent                |
| `defineBuiltin(name, opcode, impl?, immediate?)` | Stores BUILTIN                              | `defineBuiltin(vm, name, opcode, immediate?)`  | ⚠️ Implementation not stored |
| `defineCode(name, addr, immediate?)`             | Stores CODE                                 | `defineCode(vm, name, addr, immediate?)`       | ✅ Equivalent                |
| `defineLocal(name)`                              | Stores LOCAL, increments localCount         | `defineLocal(vm, name)`                        | ✅ Equivalent                |
| **Scope Management**                             |                                             |                                                |                              |
| `mark()`                                         | Creates checkpoint, resets localCount       | Returns heap position (gp)                     | ⚠️ Doesn't reset localCount  |
| `revert(cp)`                                     | Removes entries from arrays                 | `forget(vm, markCellIndex)` reverts heap       | ✅ Equivalent                |
| **Metadata**                                     |                                             |                                                |                              |
| `getLocalCount()`                                | Returns localCount                          | `vm.localCount`                                | ✅ Equivalent                |
| `getGlobalCount()`                               | Returns 0 (unused)                          | N/A                                            | ✅ Not needed                |
| **Storage Model**                                |                                             |                                                |                              |
| Separate arrays                                  | `localDefs[]` and `fallbackDefs[]`          | Single linked list                             | ⚠️ Different model           |
| Lookup order                                     | Locals first, then fallback                 | LIFO (most recent first)                       | ⚠️ Different order           |
| Shadowing                                        | Unshift to add duplicates                   | LIFO naturally shadows                         | ✅ Works differently         |

## Key Differences

### 1. Storage Model

**Symbol Table:**

- Two separate arrays: `localDefs` and `fallbackDefs`
- Locals checked first, then fallback
- In-memory JavaScript arrays

**Dictionary:**

- Single linked list in global heap
- LIFO order (most recent entry found first)
- Persistent heap-backed storage

### 2. Scope Management

**Symbol Table:**

- `mark()` resets `localCount` to 0
- `revert()` removes entries from arrays
- Separate tracking of local vs fallback depth

**Dictionary:**

- `mark()` only returns heap position (doesn't reset `localCount`)
- `forget()` reverts heap and updates head
- `localCount` managed separately (by symbol table currently)

### 3. Implementation Storage

**Symbol Table:**

- Can store `implementation` function pointer (currently unused)
- `findWithImplementation()` returns implementation

**Dictionary:**

- No storage for implementation functions
- Implementation lookup not supported

## Gaps Analysis

### Critical Gaps

1. **Local Count Reset on Mark**
   - Dictionary `mark()` doesn't reset `localCount`
   - Need to reset `vm.localCount = 0` when marking function start
   - **Solution**: Reset `localCount` in `beginDefinition()` or create wrapper

2. **Lookup Helper Functions**
   - Dictionary only has `lookup()` returning tagged value
   - Need wrappers for `find()`, `findCodeRef()`, `findBytecodeAddress()`, `findEntry()`
   - **Solution**: Create helper functions that decode from `lookup()` result

3. **Implementation Storage**
   - Dictionary doesn't store implementation functions
   - Currently unused in symbol table, but API exists
   - **Solution**: Remove from API or store separately if needed

### Non-Critical Differences

1. **Lookup Order**
   - Symbol table: locals first, then fallback
   - Dictionary: LIFO (most recent first)
   - **Impact**: Since locals are defined during function and removed with `forget()`, they naturally appear first in the chain
   - **Solution**: This should work correctly with proper mark/revert

2. **Separate Arrays vs Linked List**
   - Different storage model, but functionally equivalent
   - Dictionary is more memory-efficient and persistent

## Migration Plan

### Phase 1: Create Dictionary Wrapper Functions

Create helper functions in `src/core/dictionary.ts` to match symbol table API:

```typescript
// Wrapper functions matching symbol table API
export function findTaggedValue(vm: VM, name: string): number | undefined {
  const result = lookup(vm, name);
  return isNIL(result) ? undefined : result;
}

export function find(vm: VM, name: string): number | undefined {
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = getTaggedInfo(t);
  if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return info.value;
  return undefined;
}

export function findCodeRef(vm: VM, name: string): number | undefined {
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = getTaggedInfo(t);
  if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return t;
  return undefined;
}

export function findBytecodeAddress(vm: VM, name: string): number | undefined {
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = getTaggedInfo(t);
  if (info.tag === Tag.CODE) return info.value;
  return undefined;
}

export function findEntry(
  vm: VM,
  name: string,
): { taggedValue: number; isImmediate: boolean } | undefined {
  const t = findTaggedValue(vm, name);
  if (t === undefined) return undefined;
  const info = getTaggedInfo(t);
  return { taggedValue: t, isImmediate: info.meta === 1 };
}

// Enhanced mark that resets localCount
export function markWithLocalReset(vm: VM): number {
  vm.localCount = 0;
  return mark(vm);
}
```

### Phase 2: Update Parser to Use Dictionary

1. **Replace symbol table calls in `src/lang/parser.ts`:**
   - `vm.symbolTable.findEntry()` → `findEntry(vm, ...)`
   - `vm.symbolTable.findTaggedValue()` → `findTaggedValue(vm, ...)`
   - `vm.symbolTable.defineLocal()` → `defineLocal(vm, ...)`
   - `vm.symbolTable.getLocalCount()` → `vm.localCount`

2. **Update `src/lang/definitions.ts`:**
   - `vm.symbolTable.mark()` → `markWithLocalReset(vm)`
   - `vm.symbolTable.defineCode()` → `defineCode(vm, ...)`
   - Store checkpoint as heap position (number) instead of SymbolTableCheckpoint

3. **Update `src/lang/meta/definitions.ts` (if exists):**
   - Replace symbol table revert with dictionary forget

### Phase 3: Update VM Integration

1. **Update `src/core/vm.ts`:**
   - Remove `symbolTable` property
   - Update `resolveSymbol()` to use dictionary
   - Update `pushSymbolRef()` to use dictionary

2. **Update `src/ops/builtins-register.ts`:**
   - Remove `symbolTable` parameter
   - Use dictionary directly via `defineBuiltin()`

### Phase 4: Remove Symbol Table

1. Delete `src/strings/symbol-table.ts`
2. Remove all imports and references
3. Update tests to use dictionary directly

### Phase 5: Testing and Validation

1. Run full test suite
2. Verify local variable scoping works correctly
3. Verify mark/revert works for function definitions
4. Verify builtin registration works
5. Verify immediate words work

## Implementation Notes

### Local Count Management

The dictionary's `mark()` doesn't reset `localCount`, but this is needed for function definitions. Options:

1. **Create wrapper function** `markWithLocalReset(vm)` that resets `localCount` before marking
2. **Update `beginDefinition()`** to reset `localCount` explicitly
3. **Enhance dictionary `mark()`** to accept optional reset flag

Recommendation: Option 1 (wrapper function) for backward compatibility.

### Checkpoint Format

**Current (Symbol Table):**

```typescript
interface SymbolTableCheckpoint {
  head: null;
  localSlotCount: number;
  fallbackDepth?: number;
  localDepth?: number;
}
```

**New (Dictionary):**

```typescript
// Just a number (heap position)
type DictionaryCheckpoint = number;
```

Need to update `ActiveDefinition` in `src/lang/state.ts` to use `number` instead of `SymbolTableCheckpoint`.

### Implementation Functions

The symbol table API includes `implementation` storage, but it's currently unused. Options:

1. **Remove from API** - Simplest, since it's unused
2. **Store separately** - If needed in future, could use a Map
3. **Extend dictionary** - Add implementation field (not recommended, adds complexity)

Recommendation: Remove from API since unused.

## Benefits of Migration

1. **Unified Storage**: Single source of truth in heap
2. **Persistence**: Dictionary entries survive across VM resets (if desired)
3. **Memory Efficiency**: Heap-backed vs in-memory arrays
4. **Simpler Model**: One linked list vs two arrays
5. **Test Coverage**: Dictionary already has comprehensive tests
6. **Spec Compliance**: Dictionary matches spec design

## Risks and Mitigation

1. **Lookup Order Change**: LIFO vs locals-first
   - **Risk**: Low - locals are naturally first due to mark/revert
   - **Mitigation**: Test thoroughly with nested functions

2. **Performance**: Linked list traversal vs array lookup
   - **Risk**: Low - dictionary is small, linear search is fast
   - **Mitigation**: Profile if needed, consider caching

3. **Scope Management**: Different mark/revert semantics
   - **Risk**: Medium - need to ensure localCount reset
   - **Mitigation**: Create wrapper function, test extensively

## Success Criteria

- [ ] All existing tests pass
- [ ] Parser correctly resolves symbols
- [ ] Local variables work correctly
- [ ] Function definitions work correctly
- [ ] Builtin registration works
- [ ] Immediate words work
- [ ] Mark/revert works for scoping
- [ ] No regressions in functionality

## Timeline Estimate

- **Phase 1**: 1-2 hours (wrapper functions)
- **Phase 2**: 2-3 hours (parser updates)
- **Phase 3**: 1-2 hours (VM integration)
- **Phase 4**: 1 hour (cleanup)
- **Phase 5**: 2-3 hours (testing)

**Total**: ~7-11 hours

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 (wrapper functions)
3. Test wrapper functions
4. Proceed with Phase 2-5 incrementally
5. Monitor for regressions
