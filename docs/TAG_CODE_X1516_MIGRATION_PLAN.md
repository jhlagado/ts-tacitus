# Tag.CODE X1516 Encoding Migration Plan

## Goal

Migrate `Tag.CODE` to store X1516 encoded values instead of raw addresses. This means:
- **Before**: `Tag.CODE` stores raw address (0-32767)
- **After**: `Tag.CODE` stores X1516 encoded value (0x0080-0xFFFF)

## X1516 Encoding/Decoding Functions

**Encoding (address → X1516 value):**
- Input: 15-bit address (0-32767)
- Low byte: `0x80 | (address & 0x7f)`
- High byte: `(address >> 7) & 0xff`
- Result: `(high << 8) | low` (16-bit value)

**Decoding (X1516 value → address):**
- Input: X1516 encoded value (0x0080-0xFFFF)
- Low byte: `value & 0xff`
- High byte: `(value >> 8) & 0xff`
- Remove bit 7 from low: `low & 0x7f`
- Result: `(high << 7) | (low & 0x7f)`

**Examples:**
- Address `0` → X1516 `0x0080` → Address `0`
- Address `16384` → X1516 `0x8080` → Address `16384`
- Address `64` → X1516 `0x00C0` → Address `64`
- Address `128` → X1516 `0x0180` → Address `128`

## Migration Strategy

### Phase 1: Add Encoding/Decoding Functions (Non-Breaking)

**Goal**: Add helper functions without changing behavior.

1. **Add `encodeX1516(address: number): number` to `code-ref.ts`**
   - Takes address (0-32767), returns X1516 encoded value
   - Validates input range
   - Returns 16-bit encoded value

2. **Add `decodeX1516(encoded: number): number` to `code-ref.ts`**
   - Takes X1516 encoded value, returns address
   - Validates input is valid X1516 format (bit 7 must be set in low byte)
   - Returns decoded address

3. **Add tests for encoding/decoding**
   - Test all examples from X1516 definition
   - Test edge cases (0, 32767, 128, etc.)
   - Test invalid inputs

**Result**: Encoding/decoding functions exist and are tested, but nothing uses them yet.

### Phase 2: Update `createCodeRef()` to Encode (Breaking)

**Goal**: Make `createCodeRef()` encode addresses to X1516.

1. **Update `createCodeRef()` in `code-ref.ts`**
   ```typescript
   export function createCodeRef(bytecodeAddr: number): number {
     if (bytecodeAddr < 0 || bytecodeAddr > 32767) {
       throw new Error(`Invalid bytecode address: ${bytecodeAddr}. Must be in range 0-32767.`);
     }
     const encoded = encodeX1516(bytecodeAddr);
     return toTaggedValue(encoded, Tag.CODE);
   }
   ```

2. **Update `getCodeAddress()` in `core-test-utils.ts`**
   ```typescript
   export function getCodeAddress(codeRef: number): number {
     if (!isFuncRef(codeRef)) {
       throw new Error('Value is not a code reference');
     }
     const { value } = fromTaggedValue(codeRef);
     return decodeX1516(value); // Decode X1516 back to address
   }
   ```

3. **Run tests** - Many will fail because they expect raw addresses
   - Don't fix tests yet, just identify failures

**Result**: `createCodeRef()` encodes, `getCodeAddress()` decodes, but tests fail.

### Phase 3: Update `evalOp` to Decode (Breaking)

**Goal**: Make `evalOp` decode X1516 before using as `vm.IP`.

1. **Update `evalOp` in `core-ops.ts`**
   ```typescript
   case Tag.CODE:
     const decodedAddr = decodeX1516(addr); // Decode X1516
     if (meta === 1) {
       rpush(vm, vm.IP);
       vm.IP = decodedAddr;
     } else {
       rpush(vm, vm.IP);
       rpush(vm, vm.bp - RSTACK_BASE);
       vm.bp = vm.rsp;
       vm.IP = decodedAddr;
     }
     break;
   ```

2. **Run tests** - More failures expected
   - Don't fix tests yet, just identify failures

**Result**: `evalOp` decodes X1516, but tests still fail.

### Phase 4: Update Direct `Tag.CODE` Creation (Breaking)

**Goal**: Find all places that create `Tag.CODE` directly and update them.

1. **Search for direct `Tag.CODE` creation**
   ```bash
   grep -r "toTaggedValue.*Tag\.CODE" src/
   ```

2. **Update each location:**
   - `src/lang/compiler.ts`: `compileAddress()` - encode before storing
   - `src/test/ops/dict/dictionary-payloads.test.ts`: encode test addresses
   - Any other direct creations

3. **Update `findBytecodeAddress()` in `dictionary.ts`** (if it returns raw address)
   - Check if it needs to decode X1516

4. **Run tests** - More failures expected

**Result**: All `Tag.CODE` creation uses X1516 encoding.

### Phase 5: Update All Tests (Breaking)

**Goal**: Fix all tests to expect X1516 encoded values.

1. **Update `code-ref.test.ts`**
   - Change expectations: `expect(value).toBe(0x0080)` instead of `expect(value).toBe(0)`
   - Keep `getCodeAddress()` tests expecting decoded addresses

2. **Update `dictionary-payloads.test.ts`**
   - Change expectations for `Tag.CODE` values
   - Keep `getCodeAddress()` tests expecting decoded addresses

3. **Update all other test files**
   - Search for `Tag.CODE` or `createCodeRef` in tests
   - Update expectations for encoded values
   - Keep `getCodeAddress()` tests expecting decoded addresses

4. **Run all tests** - Should all pass now

**Result**: All tests pass with X1516 encoding.

### Phase 6: Update Documentation

**Goal**: Document that `Tag.CODE` stores X1516 encoded values.

1. **Update `code-ref.ts` JSDoc**
   - Clarify that `createCodeRef()` encodes to X1516
   - Document the encoding format

2. **Update `core-test-utils.ts` JSDoc**
   - Clarify that `getCodeAddress()` decodes from X1516

3. **Update `OPCODE_MIGRATION_PLAN.md`**
   - Change description to say `Tag.CODE` stores X1516 encoded values

4. **Update `vm-architecture.md`**
   - Clarify that `Tag.CODE` stores X1516, not raw addresses

**Result**: Documentation reflects X1516 encoding.

## Key Principles

1. **Encoding/decoding functions first** - Add helpers before using them
2. **One change at a time** - Update creation, then reading, then tests
3. **Test after each phase** - Don't move on until current phase works
4. **Preserve semantics** - `getCodeAddress()` still returns raw address (decoded)
5. **Clear separation** - Encoding happens on creation, decoding on use

## Files to Modify

**Core files:**
- `src/core/code-ref.ts` - Add encode/decode, update `createCodeRef()`
- `src/ops/core/core-ops.ts` - Update `evalOp` to decode
- `src/test/utils/core-test-utils.ts` - Update `getCodeAddress()` to decode
- `src/lang/compiler.ts` - Update `compileAddress()` to encode

**Test files (update expectations):**
- `src/test/core/code-ref.test.ts`
- `src/test/ops/dict/dictionary-payloads.test.ts`
- `src/test/integration/symbol-table-integration.test.ts`
- `src/test/core/vm-symbol-resolution.test.ts`
- `src/test/core/vm-push-symbol-ref.test.ts`
- All other tests using `Tag.CODE` or `createCodeRef()`

**Documentation:**
- `docs/OPCODE_MIGRATION_PLAN.md`
- `docs/specs/vm-architecture.md`
- `src/core/code-ref.ts` JSDoc
- `src/test/utils/core-test-utils.ts` JSDoc

## Status

- **Phase 1**: Not started
- **Phase 2**: Not started
- **Phase 3**: Not started
- **Phase 4**: Not started
- **Phase 5**: Not started
- **Phase 6**: Not started

