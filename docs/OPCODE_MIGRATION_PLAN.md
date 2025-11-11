# Tag.CODE Encoding Fix & Future Unification Plan

## Goal

Fix `Tag.CODE` to use the 15-bit encoded format (0-32767) that matches the bytecode encoding, then later consider unifying `Tag.BUILTIN` and `Tag.CODE`.

## Current State

**Existing tags:**
- `Tag.BUILTIN`: Builtin opcodes (0-127, 7 bits) ✅ **Keep as-is**
- `Tag.CODE`: User-defined bytecode addresses (0-65535) ❌ **Needs fixing**

**Problem:**
- `Tag.CODE` currently accepts 0-65535, but bytecode encoding only supports 0-32767
- This mismatch causes confusion and potential bugs
- The encoding format uses 15 bits (0-32767), not 16 bits (0-65535)

## X1516 Format Definition

**X1516 Format**: A 15-bit address encoded over a 16-bit carrier where bit 7 is always 1.

**Encoding Rules:**
- **Two-byte sequence interpretation:**
  - If bit 7 is 0: Second byte can be ignored (builtin opcode, single byte)
  - If bit 7 is 1: Number is stored in X1516 format (user code address, two bytes)

**X1516 Encoding Algorithm:**
- Input: 15-bit address (0-32767)
- Low byte: `0x80 | (address & 0x7f)` - low 7 bits with bit 7 set
- High byte: `(address >> 7) & 0xff` - high 8 bits
- Result: 16-bit value (little-endian) where bit 7 is always 1

**Examples:**
- Address `0x0000` (0): Encoded as `0x80, 0x00` → 16-bit `0x0080`
- Address `0x4000` (16384): Encoded as `0x80, 0x80` → 16-bit `0x8080`
- Address `0x40` (64): Encoded as `0xC0, 0x00` → 16-bit `0x00C0`
- Address `0x80` (128): Encoded as `0x80, 0x01` → 16-bit `0x0180`
- Address `0x0100` (256): Encoded as `0x80, 0x02` → 16-bit `0x0280`
- Address `0x7FFF` (32767): Encoded as `0xFF, 0xFF` → 16-bit `0xFFFF`

**Key Properties:**
- The encoded 16-bit value is NOT the same as the original address
- Bit 7 in the first byte is always 1 for X1516 format
- Bit 7 in the first byte distinguishes builtins (0) from user code (1)
- The format supports 0-32767 (15 bits), not 0-65535 (16 bits)

## Encoding Format

**Builtin (0-127):** Single byte, bit 7 = 0 → builtin opcode
- Encoded as: `opcode` (single byte, 0x00-0x7F, bit 7 = 0)
- **Tag.BUILTIN**: Always 0-127 ✅

**User code (0-32767):** Two bytes, X1516 format → user code address
- Uses X1516 format when writing/reading bytecode (see definition above)
- **Tag.CODE**: Stores the **original address** (0-32767, 15 bits), NOT the X1516 encoded value ❌ Currently 0-65535
- The X1516 encoding is only used when writing/reading bytecode; tagged values store the raw address

## Revised Strategy: Two-Step Approach

### Step 1: Fix Tag.CODE Encoding (Breaking Change)

**Goal**: Change `Tag.CODE` to use 15-bit encoding format (0-32767) instead of 16-bit (0-65535).

**Why this first:**
- Isolated breaking change (only affects `Tag.CODE`)
- Aligns `Tag.CODE` with actual bytecode encoding format
- Makes future unification easier
- `Tag.BUILTIN` stays unchanged (0-127)

**Changes needed:**

1. **Update `createCodeRef()` validation**
   ```typescript
   // Current: 0-65535
   // New: 0-32767
   export function createCodeRef(bytecodeAddr: number): number {
     if (bytecodeAddr < 0 || bytecodeAddr > 32767) {
       throw new Error(`Invalid bytecode address: ${bytecodeAddr}. Must be in range 0-32767.`);
     }
     return toTaggedValue(bytecodeAddr, Tag.CODE);
   }
   ```

2. **Find all uses of `createCodeRef()` with addresses > 32767**
   - Search codebase for `createCodeRef(`
   - Update any calls using addresses > 32767
   - These will need to be fixed or use a different approach

3. **Find all uses of `Tag.CODE` with addresses > 32767**
   - Search for `toTaggedValue(..., Tag.CODE)`
   - Update validation/usage

4. **Update tests**
   - Find tests creating `Tag.CODE` with addresses > 32767
   - Fix or remove these tests
   - Update test expectations

5. **Update documentation**
   - Clarify that `Tag.CODE` is 0-32767 (15 bits), not 0-65535
   - Update any specs that mention 65535

**Result**: `Tag.CODE` now matches bytecode encoding format (0-32767). This is a breaking change, but isolated to `Tag.CODE`.

### Step 2: Consider Unification (Future)

**Only after Step 1 is complete and all tests pass:**

Once `Tag.CODE` uses 0-32767 and `Tag.BUILTIN` uses 0-127, we can consider:
- Unifying into `Tag.OPCODE` (0-32767, with 0-127 as builtins)
- Or keeping them separate but aligned

**This will be a separate decision after Step 1 is stable.**

## Implementation Plan for Step 1

### Phase 1: Update `createCodeRef()` Validation

1. **Change validation range from 0-65535 to 0-32767**
   - Update `createCodeRef()` in `code-ref.ts`
   - Update error messages

2. **Run tests**
   - Find all failures related to `createCodeRef()` with addresses > 32767
   - Fix each one individually

### Phase 2: Find and Fix All Uses

1. **Search for `createCodeRef()` calls**
   ```bash
   grep -r "createCodeRef" src/
   ```
   - Review each usage
   - Fix addresses > 32767

2. **Search for `Tag.CODE` creation**
   ```bash
   grep -r "toTaggedValue.*Tag\.CODE" src/
   ```
   - Review each usage
   - Fix addresses > 32767

3. **Search for tests**
   ```bash
   grep -r "Tag\.CODE\|createCodeRef" src/test/
   ```
   - Update test expectations
   - Fix or remove tests using addresses > 32767

### Phase 3: Update Documentation

1. **Update specs**
   - Clarify `Tag.CODE` range is 0-32767 (15 bits)
   - Update any mentions of 65535

2. **Update comments**
   - Fix any comments that say 0-65535

### Phase 4: Verify

1. **Run all tests** - All must pass
2. **Verify encoding** - Ensure all `Tag.CODE` values are 0-32767
3. **Check bytecode** - Ensure encoding matches format

## Key Principles

1. **Isolated change** - Only affects `Tag.CODE`, `Tag.BUILTIN` unchanged
2. **Incremental** - One change at a time, test after each
3. **Fix all uses** - Don't leave any addresses > 32767
4. **Update tests** - Fix or remove tests that break
5. **Document** - Update all references to clarify 0-32767 range

## Why This Approach

**Previous problems:**
- Too many tests breaking at once
- Trying to change both tags simultaneously
- Not isolating the breaking change

**This approach:**
- Isolates the breaking change to `Tag.CODE` only
- Keeps `Tag.BUILTIN` stable (0-127)
- Makes the change manageable
- Sets up for future unification if desired

## Status

- **Step 1 (Fix Tag.CODE)**: Not started
- **Step 2 (Consider Unification)**: Future, after Step 1 is complete
