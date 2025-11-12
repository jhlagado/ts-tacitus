# Proposal: Unify @ and & Sigils

## Current State

### `@symbol` (Code References)
- **Purpose:** Returns a code reference (`Tag.CODE`) to a named function
- **Implementation:** `emitAtSymbol` → compiles `LiteralString` + `PushSymbolRef`
- **Usage:** `@add eval` → executes the `add` builtin
- **Returns:** `Tag.CODE(address)` where address is:
  - 0-127: Builtin opcode (executed via `executeOp`) - 7 bits
  - 0-32767: User bytecode address (executed via call frame setup) - 15 bits
  - **Safe overlap:** Ranges overlap in 0-127, but bit 7 in encoding distinguishes them (0 = builtin, 1 = user code)

### `&variable` (Variable References)
- **Purpose:** Returns a `Tag.REF` to a local or global variable slot
- **Implementation:** `emitRefSigil` → compiles `VarRef`/`GlobalRef` + `Fetch`
- **Usage:** `&x` → returns REF to local variable `x`
- **Returns:** `Tag.REF(cell_index)` pointing to variable slot

## Proposed Unification

### Extend `&` to Handle Code References

**New Behavior:**
- `&name` looks up `name` in dictionary
- If `Tag.LOCAL` or `Tag.REF` (global) → return address (current behavior)
- If `Tag.CODE` → return the code reference directly (new behavior)

**Semantics:**
- `&` means "reference to" or "address of"
- For variables: returns memory address (`Tag.REF`)
- For functions: returns code reference (`Tag.CODE`)
- Address range determines behavior:
  - 0-127: Builtin opcode (executed via `executeOp`) - 7 bits
  - 0-32767: User bytecode address (executed via call frame setup) - 15 bits
  - **Safe overlap:** Ranges overlap in 0-127, but bit 7 in encoding distinguishes them (0 = builtin, 1 = user code)

## Benefits

1. **Reduces sigil count:** One sigil (`&`) instead of two (`@` and `&`)
2. **Frees up `@`:** Can be used for other purposes (e.g., module imports, namespaces)
3. **Consistent semantics:** `&` always means "get a reference to this thing"
4. **Simpler mental model:** One operator for all references

## Edge Cases

### Symbol Shadowing
- Dictionary lookup returns the most recent definition (shadowing)
- If `x` is defined as both a variable and a function, `&x` returns whichever was defined last
- This is consistent with current behavior: most recent definition wins

### Type Checking
- `&function` returns `Tag.CODE` (not `Tag.REF`)
- `&variable` returns `Tag.REF`
- Both can be used with `eval` (code refs) or `fetch`/`load` (variable refs)
- Runtime type checking ensures correct usage
- Address range determines execution behavior in `evalOp`:
  - 0-127: Builtin opcode (7 bits)
  - 0-32767: User code address (15 bits)
  - Safe overlap: bit 7 in encoding distinguishes them

## Implementation Plan

**Note:** This proposal assumes `Tag.CODE` and `Tag.BUILTIN` have been unified (completed). `Tag.CODE` now handles both builtins (value < 128) and user code (value >= 128, X1516 encoded).

### Phase 1: Extend `emitRefSigil`
1. After `lookup`, check if result is `Tag.CODE`
2. If `Tag.CODE`: compile `LiteralCode` + 16-bit address
3. Keep existing variable reference logic for `Tag.LOCAL` and `Tag.REF` (global)

**Code Changes:**
```typescript
// In parser.ts emitRefSigil:
export function emitRefSigil(...) {
  const tval = lookup(vm, varName);
  if (isNIL(tval)) {
    throw new UndefinedWordError(varName, getStackData(vm));
  }

  const { tag, value } = fromTaggedValue(tval);

  // NEW: Handle code references (unified Tag.CODE)
  if (tag === Tag.CODE) {
    vm.compiler.compileOpcode(Op.LiteralCode);
    vm.compiler.compile16(value);  // 16-bit address (0-32767)
    // Address range determines behavior:
    // - 0-127: Builtin (executed via executeOp) - 7 bits
    // - 0-32767: User code (executed via call frame setup) - 15 bits
    // Safe overlap: bit 7 in encoding distinguishes them (0 = builtin, 1 = user code)
    return;
  }

  // Existing variable reference logic...
  if (tag === Tag.LOCAL) { ... }
  if (tag === Tag.REF && getRefArea(tval) === 'global') { ... }
  
  throw new Error(`${varName} is not a variable or function`);
}
```

### Phase 2: Update Tests
1. Add tests for `&function` returning code references
2. Verify `&function eval` works
3. Test shadowing behavior (function vs variable)
4. Update existing `@symbol` tests to also test `&symbol`

### Phase 3: Update Error Messages
1. Change error message from "is not a local variable" to "is not a variable or function"
2. Update error messages to be more generic

### Phase 4: Deprecate `@` (Optional)
1. Keep `@` working for backward compatibility initially
2. Update documentation to prefer `&`
3. Eventually remove `@` support (can be done later)

## Example Usage

```tacit
# Current (two sigils):
@add eval          # Execute builtin
&x fetch           # Get variable address

# Proposed (unified):
&add eval          # Execute builtin (new)
&x fetch           # Get variable address (unchanged)

# Both work the same way:
&square eval       # Execute user function
&myGlobal load     # Load global variable
```

## Questions to Consider

1. **Backward compatibility:** Should `@` continue to work, or be removed immediately?
2. **Error messages:** Should `&undefined` error message change to mention both variables and functions?
3. **Documentation:** Update all examples to use `&` for code references?
4. **Migration:** Create a plan for updating existing code that uses `@`?

## Technical Details

### Why This Works
- After unification, `eval` expects `Tag.CODE` on the stack
- `LiteralCode` already exists: reads 16-bit address (0-32767), pushes `Tag.CODE`
- Both builtin (0-127) and user code (0-32767) can use same address value, but encoding distinguishes them
- Address range determines behavior in `evalOp`:
  - 0-127: Builtin opcode (calls `executeOp` directly) - 7 bits
  - 0-32767: User bytecode address (sets up call frame and jumps) - 15 bits
  - **Safe overlap:** Ranges overlap in 0-127, but bit 7 in encoding distinguishes them (0 = builtin, 1 = user code)
- `@symbol` currently uses `LiteralString` + `PushSymbolRef` (runtime lookup)
- `&symbol` would use `LiteralCode` (compile-time constant, more efficient!)

### Performance Consideration
- `@symbol`: Runtime lookup (string → dictionary → tagged value)
- `&symbol`: Compile-time constant (direct address in bytecode)
- `&symbol` is more efficient (no runtime lookup needed)
- Type safety: `eval` can verify it receives `Tag.CODE`
- Address range check in `evalOp` is trivial (`addr < MIN_USER_OPCODE`)

### Implementation Notes
- **No new opcode needed!** `LiteralCode` handles both builtins and user code
- `LiteralCode` reads 16-bit address (0-32767), pushes `Tag.CODE` with meta=1
- `evalOp` checks address range to determine execution behavior
- Error message should be generic: "is not a variable or function"
- This is semantically correct: `eval` expects `Tag.CODE`, address determines behavior
- Simpler than original proposal: one opcode (`LiteralCode`) instead of two

### Dependencies
- **Requires:** `Tag.CODE` and `Tag.BUILTIN` unification (see `OPCODE_MIGRATION_PLAN.md` - uses `Tag.OPCODE`)
- After unification, all code references use `Tag.CODE`
- Helper functions `createBuiltinRef` and `createCodeRef` both create `Tag.CODE` values

