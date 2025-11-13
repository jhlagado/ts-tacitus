# Tag.CODE X1516 Encoding Migration - COMPLETED

## Status: ✅ COMPLETED

This migration has been completed. `Tag.CODE` now uses X1516 encoding for user code addresses (>= 128), while builtin opcodes (< 128) are stored directly.

## Final Implementation

**X1516 Encoding:**
- User code addresses (128-32767) are X1516 encoded before storing in `Tag.CODE`
- Builtin opcodes (0-127) are stored directly (not X1516 encoded, invalid X1516 format)

**Functions:**
- `encodeX1516(address: number): number` - Encodes 15-bit address to X1516 format
- `decodeX1516(encoded: number): number` - Decodes X1516 format to 15-bit address
- `createCodeRef(bytecodeAddr: number): number` - Creates `Tag.CODE` with appropriate encoding

**Usage:**
- `evalOp` decodes X1516 for values >= 128 before jumping to bytecode
- `parser.ts` decodes X1516 before compiling user word calls
- `getCodeAddress()` decodes X1516 when extracting addresses

## X1516 Format

**Encoding Algorithm:**
- Input: 15-bit address (0-32767)
- Low byte: `0x80 | (address & 0x7f)` - low 7 bits with bit 7 set
- High byte: `(address >> 7) & 0xff` - high 8 bits
- Result: `(high << 8) | low` (16-bit value, 0x0080-0xFFFF)

**Decoding Algorithm:**
- Input: X1516 encoded value (0x0080-0xFFFF)
- Low byte: `encoded & 0xff`
- High byte: `(encoded >> 8) & 0xff`
- Validate: bit 7 must be set in low byte
- Result: `(high << 7) | (low & 0x7f)` (15-bit address, 0-32767)

**Examples:**
- Address `0` → X1516 `0x0080` → Address `0`
- Address `128` → X1516 `0x0180` → Address `128`
- Address `16384` → X1516 `0x8080` → Address `16384`
- Address `32767` → X1516 `0xFFFF` → Address `32767`

## Key Insight

Values 0-127 in `Tag.CODE` are **invalid X1516 format** (bit 7 not set), so they can be used to store builtin opcodes directly without encoding. This allows `Tag.CODE` to handle both builtins and user code in a unified way.

## History

This plan documented the migration to X1516 encoding, which has been completed. The encoding is now used throughout the codebase for user code addresses >= 128.
