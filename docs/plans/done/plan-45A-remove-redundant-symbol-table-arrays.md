# Plan 45A: Remove Redundant Symbol Table Arrays

## Objective
Remove the redundant `localDefs` and `fallbackDefs` arrays from the symbol table and replace with a single unified array, while ensuring ALL existing tests continue to pass.

## Current State
- Symbol table has two arrays: `localDefs[]` and `fallbackDefs[]`
- `localDefs` stores local variable definitions (Tag.LOCAL)
- `fallbackDefs` stores everything else (BUILTIN, CODE, etc.)
- Lookup checks `localDefs` first, then `fallbackDefs`
- Both arrays are redundant - can be unified into single array

## Approach
1. Replace two arrays with single `defs` array
2. Update all functions to use unified array
3. Update checkpoint interface
4. Test after each change
5. Fix any failures immediately before proceeding

## Implementation Steps

### Step 1: Replace arrays in state
- Remove `localDefs` and `fallbackDefs`
- Add single `defs: []` array
- **Test immediately**

### Step 2: Update findTaggedValue()
- Search single `defs` array instead of two arrays
- **Test immediately**

### Step 3: Update defineSymbol()
- Add to single `defs` array
- **Test immediately**

### Step 4: Update defineBuiltin()
- Add to single `defs` array
- **Test immediately**

### Step 5: Update defineCode()
- Add to single `defs` array
- **Test immediately**

### Step 6: Update defineLocal()
- Add to single `defs` array
- **Test immediately**

### Step 7: Update mark()
- Track single `defsDepth` instead of `fallbackDepth` and `localDepth`
- Update `SymbolTableCheckpoint` interface
- **Test immediately**

### Step 8: Update revert()
- Restore single `defs` array depth
- **Test immediately**

### Step 9: Final verification
- Run full test suite
- Ensure all tests pass

## Success Criteria
- [ ] No `localDefs` or `fallbackDefs` arrays remain
- [ ] Single unified `defs` array used throughout
- [ ] All existing tests pass
- [ ] Symbol table behavior unchanged (locals found first, etc.)

