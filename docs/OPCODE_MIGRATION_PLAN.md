# Tag.CODE Encoding Fix - COMPLETED

## Status: ✅ COMPLETED

This migration has been completed. `Tag.CODE` now:
- Stores builtin opcodes (0-127) directly (not X1516 encoded)
- Stores user code addresses (128-32767) using X1516 encoding
- `Tag.BUILTIN` has been removed and unified into `Tag.CODE`

## Final State

**Tag.CODE value ranges:**
- `0-127`: Builtin opcodes (stored directly, invalid X1516 format)
- `128-65535`: User code addresses (X1516 encoded, decodes to 0-32767)

**Encoding:**
- Builtins: Stored directly as opcode value (0-127)
- User code: X1516 encoded (address 128-32767 → encoded 0x0180-0xFFFF)

**Dispatch:**
- `evalOp` checks if `Tag.CODE` value < 128 → dispatches to builtin
- `evalOp` checks if `Tag.CODE` value >= 128 → decodes X1516 and jumps to bytecode

## Implementation

See:
- `src/core/code-ref.ts` - `encodeX1516()`, `decodeX1516()`, `createCodeRef()`
- `src/ops/core/core-ops.ts` - `evalOp` dispatch logic
- `src/lang/parser.ts` - Compilation logic
- `docs/specs/vm-architecture.md` - Updated architecture spec

## History

This plan originally proposed:
1. Fix `Tag.CODE` to use 15-bit encoding (0-32767) - ✅ COMPLETED
2. Consider unifying `Tag.BUILTIN` and `Tag.CODE` - ✅ COMPLETED (Tag.BUILTIN removed)

Both goals have been achieved.
