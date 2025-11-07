# Plan 47: Remove Symbol Table, Use Dictionary Directly

## Current State Analysis

The symbol table (`src/strings/symbol-table.ts`) is now minimal:

**State maintained:**
- `state.localSlotCount` - Fallback counter (rarely used, only when VM not attached)
- `state.dictLookupPreferred` - Unused flag (API compatibility)
- `state.fallbackEnabled` - Unused flag (API compatibility)
- `state.vmRef` - Just needed to call dictionary functions

**Current behavior:**
- All `define*` functions delegate directly to dictionary
- All `find*` functions delegate directly to dictionary (using `lookup()`)
- `mark()` delegates to dictionary and resets `localCount`
- `revert()` delegates to dictionary
- **`defs` array removed** - dictionary is the single source of truth

**Actual code usage (only 4 methods):**
- `getLocalCount()` - 3 places (parser, compiler, builtins)
- `defineLocal()` - 1 place (parser)
- `mark()` - 1 place (definitions)
- `defineCode()` - 1 place (definitions)

**Find methods:** Only used in tests, not in actual Tacit code. Parser uses `lookup()` directly.

**Conclusion:** Symbol table is a thin wrapper for 4 methods. Can be removed by replacing these 4 calls with dictionary calls.

## Migration Strategy

### Phase 1: Rationalize Find Methods ✅ COMPLETED

**Status:** All find methods now use dictionary `lookup()` as single source of truth.

**Changes made:**
- Removed `defs` array from symbol table state
- All `find*` methods now call `lookup(vm, name)` directly
- All `define*` methods now call dictionary functions directly
- Symbol table is now a thin wrapper that delegates everything to dictionary

**Find methods:** Only kept for test compatibility. Not used in actual Tacit code (parser uses `lookup()` directly).

### Phase 2: Update Core Code to Use Dictionary Directly

**Remaining work (4 method calls to replace):**

**2.1 Update `src/lang/definitions.ts`:**
- Replace `vm.symbolTable.mark()` → `markWithLocalReset(vm)` (create helper in dictionary.ts)
- Replace `vm.symbolTable.defineCode()` → `defineCode(vm, ...)`
- Change `checkpoint` type from `SymbolTableCheckpoint` to `number` (heap position)
- Update `ActiveDefinition` interface in `src/lang/state.ts`

**2.2 Update `src/lang/parser.ts`:**
- Replace `vm.symbolTable.defineLocal()` → `defineLocal(vm, ...)`
- Replace `vm.symbolTable.getLocalCount()` → `vm.localCount`

**2.3 Update `src/lang/compiler.ts`:**
- Replace `vm.symbolTable.getLocalCount()` → `vm.localCount`

**2.4 Update `src/ops/builtins.ts`:**
- Replace `vm.symbolTable.getLocalCount()` → `vm.localCount`

**2.5 Update `src/core/vm.ts`:**
- Remove `symbolTable` property
- `resolveSymbol()` already uses dictionary (no change needed)
- `pushSymbolRef()` already uses dictionary (no change needed)

**2.6 Update `src/ops/builtins-register.ts`:**
- Remove `symbolTable` parameter
- Use `defineBuiltin(vm, ...)` directly

### Phase 3: Update Tests

**Status: COMPLETED**
- Deleted all symbol table find method tests (they don't test actual Tacit code)
- Fixed integration test to use `vm.resolveSymbol()` instead of find methods
- Remaining tests use actual code paths (parser, definitions, etc.)

**Test cleanup:**
- Deleted `symbol-table.test.ts` - pure find method tests
- Deleted `symbol-table-shadowing.test.ts` - pure find method tests
- Deleted `symbol-table-local.test.ts` - pure find method tests
- Deleted `symbol-table-direct-addressing.test.ts` - pure find method tests

### Phase 4: Remove Symbol Table

1. Delete `src/strings/symbol-table.ts`
2. Remove `createSymbolTable` import from `src/core/vm.ts`
3. Remove `symbolTable` property from VM
4. Clean up any remaining references

## Implementation Order

1. **Phase 1** - Add helper functions, test they work
2. **Phase 2** - Update core code incrementally, test after each change
3. **Phase 3** - Update tests to use dictionary directly
4. **Phase 4** - Remove symbol table file

## Key Considerations

1. **localCount reset**: Dictionary `mark()` doesn't reset `localCount`, but `markWithLocalReset()` does
2. **Checkpoint format**: Change from object to number (heap position)
3. **Test compatibility**: Many tests use symbol table API - need to update all
4. **No state loss**: Dictionary already has all the state, symbol table is redundant

## Success Criteria

- [ ] All tests pass
- [ ] Parser works correctly
- [ ] Local variables work
- [ ] Function definitions work
- [ ] Builtin registration works
- [ ] Symbol table file deleted
- [ ] No regressions

