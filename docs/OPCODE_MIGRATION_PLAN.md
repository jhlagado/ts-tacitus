# Tag.OPCODE Migration Plan

## Goal

Introduce `Tag.OPCODE` to unify `Tag.BUILTIN` and `Tag.CODE` into a single tag that handles the exact opcode encoding format (8-bit, extendable to 16-bit) without breaking existing code.

## Current State (Before Phase 1)

**Existing tags:**
- `Tag.BUILTIN`: Builtin opcodes (0-127, 7 bits)
- `Tag.CODE`: User-defined bytecode addresses (0-65535, 15 bits)

**Current behavior:**
- `evalOp` checks tag and dispatches differently for `Tag.BUILTIN` vs `Tag.CODE`
- `parser.ts` checks tag to decide compilation strategy
- Dictionary stores different tags for builtins vs user code
- Meta files check `Tag.BUILTIN` only

**What doesn't exist:**
- `Tag.OPCODE` enum value
- Helper functions (`createOpcodeRef()`, `isOpcodeRef()`, `getOpcodeValue()`)
- `evalOp` support for `Tag.OPCODE`
- Parser support for `Tag.OPCODE`
- `useOpcodeTag` parameters in creation functions

## Encoding Format

**Builtin (0-127):** Single byte, bit 7 = 0 → builtin opcode
- Encoded as: `opcode` (single byte, 0x00-0x7F)

**User code (0-32767):** Two bytes, first byte bit 7 = 1 → user code address
- First byte: `0x80 | (address & 0x7f)` - low 7 bits with bit 7 set
- Second byte: `(address >> 7) & 0xff` - high 8 bits
- Examples:
  - Address 0x40 (64): `0xC0 0x00` → 16-bit `0x00C0`
  - Address 0x80 (128): `0x80 0x01` → 16-bit `0x0180`
  - Address 0x0100 (256): `0x80 0x02` → 16-bit `0x0280`
  - Address 0x4000 (16384): `0x80 0x80` → 16-bit `0x8080`

**Key insight**: Bit 7 in the first byte distinguishes builtins (0) from user code (1), allowing addresses 0-127 to be encoded as either single-byte builtins or two-byte user code.

## Proposed Solution: Tag.OPCODE

**New tag: `Tag.OPCODE`**

- **Payload**: Opcode value (0-32767)
- **Semantics**: Encoded value range determines behavior:
  - **0-127**: Builtin opcodes (call `executeOp` directly) - 7 bits, 1 byte
  - **128-32767**: User-defined bytecode addresses (set up call frame and jump) - 15 bits, 2 bytes
- **Encoding**: Same as current opcode encoding (bit 7 distinguishes builtin vs user code)

## Migration Strategy: Bottom-Up Approach

### Principle: Change Creation, Not Consumption

Add parallel creation paths first, update consumption code to handle both tags, then gradually migrate.

### Phase 1: Add Tag.OPCODE Infrastructure (Non-Breaking)

**Goal**: Add `Tag.OPCODE` without breaking anything.

1. **Add `Tag.OPCODE` to enum**
   - Add to `tagged.ts` enum (Tag.OPCODE = 9)
   - Add to `tagNames` record

2. **Add helper functions to `code-ref.ts`**
   - `createOpcodeRef(value: number): number` - Creates `Tag.OPCODE` with validation (0-32767)
   - `isOpcodeRef(value: number): boolean` - Checks if value is `Tag.OPCODE`
   - `getOpcodeValue(value: number): number` - Extracts opcode value

3. **Update `evalOp` to handle `Tag.OPCODE`**
   - Add case for `Tag.OPCODE` in `evalOp`
   - Uses address range to determine behavior:
     - 0-127: Builtin opcode → calls `executeOp` directly
     - 128-32767: User code → sets up call frame
   - Existing `Tag.BUILTIN` and `Tag.CODE` cases unchanged

4. **Add tests**
   - Test `createOpcodeRef()` with various values
   - Test `isOpcodeRef()` and `getOpcodeValue()`
   - Test `evalOp` with `Tag.OPCODE` for builtins (0-127)
   - Test `evalOp` with `Tag.OPCODE` for user code (128-32767)

**Result**: `Tag.OPCODE` exists and works with `evalOp`, but nothing uses it yet.

### Phase 2: Add Parallel Creation Paths (Non-Breaking)

**Goal**: Add optional `Tag.OPCODE` creation without breaking existing code.

1. **Add `useOpcodeTag` parameter to `registerBuiltins()`** (default: `false`)
   - When `true`, registers builtins with `Tag.OPCODE` instead of `Tag.BUILTIN`
   - Existing behavior unchanged (default `false`)

2. **Add `useOpcodeTag` parameter to `endDefinition()`** (default: `false`)
   - When `true`, creates user code with `Tag.OPCODE` instead of `Tag.CODE`
   - Existing behavior unchanged (default `false`)

3. **Add `useOpcodeTag` parameter to `pushSymbolRef()`** (default: `false`)
   - When `true`, converts `Tag.BUILTIN`/`Tag.CODE` to `Tag.OPCODE` before pushing
   - Existing behavior unchanged (default `false`)

4. **Update parser to handle `Tag.OPCODE`**
   - Add `Tag.OPCODE` case in `emitWord()` BEFORE `Tag.BUILTIN` check
   - Uses address range to determine compilation (builtin vs user code)

5. **Update meta files to check both tags**
   - Check `Tag.OPCODE || Tag.BUILTIN` in conditionals, case, match-with, capsules, executor
   - Backward compatible (supports both)

**Result**: All existing code works unchanged. New code can opt-in to `Tag.OPCODE`.

### Phase 3: Migrate Tests Gradually (Non-Breaking)

**Goal**: Update tests to use `Tag.OPCODE` where appropriate, without breaking test intent.

1. **Update tests individually** (not blanket replacements)
   - Find tests using `registerBuiltins(vm)` → update to `registerBuiltins(vm, true)` where testing current behavior
   - Find tests expecting `Tag.BUILTIN` → review each, update to `Tag.OPCODE` for current behavior tests
   - Keep `Tag.BUILTIN` for legacy behavior tests

2. **Update test utilities**
   - `isBuiltinRef()` should check both `Tag.OPCODE` (< 128) and `Tag.BUILTIN`

3. **Add tests for parallel support**
   - Test both `useOpcodeTag=true` and `useOpcodeTag=false` paths
   - Test mixed usage scenarios

**Key Principle**: Preserve test intent. Don't break tests that explicitly test legacy behavior.

### Phase 4: Change Defaults (Breaking - After Phase 3 Complete)

**Only after all tests are migrated to `Tag.OPCODE`:**

1. **Change `registerBuiltins()` default to `true`**
   - `registerBuiltins(vm, useOpcodeTag = true)`
   - Breaking change, but all tests should already be updated

2. **Change `endDefinition()` default to `true`**
   - `endDefinition(..., useOpcodeTag = true)`
   - Breaking change, but all tests should already be updated

3. **Change `pushSymbolRef()` default to `true`**
   - `pushSymbolRef(vm, name, useOpcodeTag = true)`
   - Breaking change, but all tests should already be updated

**Result**: New code uses `Tag.OPCODE` by default, but `useOpcodeTag=false` still works.

### Phase 5: Change `createBuiltinRef()` (Future - Last Step)

**Only after Phase 4 is complete and all code uses `Tag.OPCODE`:**

1. **Change `createBuiltinRef()` to return `Tag.OPCODE`**
   ```typescript
   export function createBuiltinRef(opcode: number): number {
     return createOpcodeRef(opcode); // Changed from Tag.BUILTIN
   }
   ```
   - Breaking change, but all code should already be using `Tag.OPCODE`
   - Update remaining tests that use `createBuiltinRef()`

2. **Mark `Tag.BUILTIN` as deprecated**
   - Add `@deprecated` tags
   - Update documentation

3. **Future: Remove `Tag.BUILTIN`**
   - Remove from enum
   - Remove all references
   - Update all code to use `Tag.OPCODE`

## Key Principles

1. **Non-breaking at each step** - Existing code continues to work
2. **Incremental** - One change at a time, test after each
3. **Reversible** - Can roll back at any point
4. **Testable** - Can test both paths in parallel
5. **Preserves intent** - Tests that test legacy behavior keep doing so

## Lessons Learned

**Problems with previous approach:**
1. **Too aggressive**: Changed `createBuiltinRef()` immediately, breaking many tests
2. **Blanket replacements**: Used `sed` to replace all `Tag.BUILTIN` in tests, breaking test intent
3. **Not incremental**: Tried to change too much at once
4. **Lost test intent**: Some tests explicitly test `Tag.BUILTIN` behavior

**What worked:**
1. `evalOp` already handles `Tag.OPCODE` correctly (when it existed)
2. Helper functions work well
3. Test utilities can be updated to support both tags

## Implementation Order

1. **Phase 1**: Add infrastructure → Run tests → All must pass
2. **Phase 2**: Add parallel paths → Run tests → All must pass
3. **Phase 3**: Migrate tests → Run tests → All must pass
4. **Phase 4**: Change defaults → Run tests → All must pass
5. **Phase 5**: Change `createBuiltinRef()` → Run tests → All must pass

## Status

- **Phase 1**: Not started
- **Phase 2**: Not started
- **Phase 3**: Not started
- **Phase 4**: Not started
- **Phase 5**: Not started

