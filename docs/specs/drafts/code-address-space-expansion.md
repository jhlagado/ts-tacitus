# Code Address Space Expansion to 18-19 Bits

**Status:** Draft  
**Date:** 2025-01-XX  
**Related:** `OPCODE_MIGRATION_PLAN.md`, `vm-architecture.md`

## Current State

- **Function addresses in `Tag.CODE`**: 15-bit (0-32767)
- **IP (Instruction Pointer)**: 16-bit byte address (0-65535)
- **Tag encoding**: 6 bits in mantissa (but only 4 bits used, max tag = 12)
- **Value payload**: 16 bits (0-65535)
- **Encoding in opcodes**: 2 bytes (16 bits)
- **Branching**: Absolute addresses in `Call` opcode

## Goal

Expand code address space to 18-19 bits while:

1. Keeping opcode encoding at 2 bytes (16 bits)
2. Maintaining NaN-boxing compatibility
3. Supporting larger code segments

## Bit Allocation Strategy

### Current NaN-Boxing Layout (32-bit float)

```
Sign (1 bit) | Exponent (8 bits) | NaN bit (1 bit) | Tag (6 bits) | Value (16 bits)
```

- **Tag**: Currently uses 6 bits (`0x3f` mask), but only 4 bits needed (max tag = 12)
- **Value**: 16 bits (0-65535)

### Proposed Layout

**Reduce tags to 3 bits (8 tag types)** to free up 3 bits for value:

```
Sign (1 bit) | Exponent (8 bits) | NaN bit (1 bit) | Tag (3 bits) | Value (19 bits)
```

**Bit sources for 19-bit value:**

1. Current value bits: 16 bits
2. Two unused bits above 16 bits (bits 16-17)
3. One bit borrowed from tags (reduce from 6 to 3 bits)

**Total**: 16 + 2 + 1 = 19 bits for value payload

### Tag Reduction

**Current tags** (sparse numbering, 7 NaN tags):

- `SENTINEL = 1`
- `CODE = 2`
- `STRING = 4`
- `LOCAL = 6`
- `BUILTIN = 7` (will be removed after unification with `CODE`)
- `LIST = 8`
- `REF = 12`

**Note**: `NUMBER` doesn't need a tag - non-NaN values are raw IEEE 754 floats, not NaN-boxed.

**After unification and with 3-bit tags** (compact numbering 0-7):

After `Tag.CODE` and `Tag.BUILTIN` unification, we'll have 8 tag values (0-7):

- `0` = `NaN` (canonical NaN needs to be valid as a tagged value)
- `1` = `SENTINEL` (remapped from 1)
- `2` = `STRING` (remapped from 4)
- `3` = `CODE` (unified, includes builtins, remapped from 2)
- `4` = `REF` (remapped from 12)
- `5` = `LIST` (remapped from 8)
- `6` = `reserved1` (reserved for future expansion)
- `7` = `LOCAL` (remapped from 6)

## Address Space Expansion

### Function Addresses in `Tag.CODE`

- **Current**: 15-bit (0-32767) - stored as byte address
- **Proposed**: 19-bit (0-524287) - stored as aligned index or byte address

### IP Register Expansion

- **Current**: 16-bit byte address (0-65535) → 64KB code segment
- **Proposed**: 18-19 bit byte address
  - 18-bit: 0-262143 → 256KB code segment
  - 19-bit: 0-524287 → 512KB code segment

### Alignment Strategy

Function addresses don't have to be byte addresses - they can be aligned indices:

- **With 4-byte alignment**:
  - Function address 0 → byte address 0
  - Function address 1 → byte address 4
  - Function address 131071 → byte address 524284
  - Allows 131072 function slots with 19-bit addresses

- **With 8-byte alignment**:
  - Function address 0 → byte address 0
  - Function address 1 → byte address 8
  - Function address 65535 → byte address 524280
  - Allows 65536 function slots with 19-bit addresses

## Opcode Encoding Strategy

### Problem

If we expand to 18-19 bit addresses, encoding them in opcodes would require 3 bytes instead of 2.

### Solution: Relative Branching

**Current**: Absolute addresses in `Call` opcode

- `Call` reads 16-bit absolute address
- Sets `vm.IP = address` directly

**Proposed**: Relative offsets in `Call` opcode

- `Call` reads 16-bit signed offset (-32768 to +32767)
- Sets `vm.IP = vm.IP + offset`
- Offsets can stay 16-bit even with 18-19 bit address space

**Benefits**:

1. Encoding stays at 2 bytes (16-bit signed offset)
2. ±128KB range covers most function calls
3. Enables larger code segments without opcode size increase

**Trade-offs**:

- Requires calculating offset at compile time
- Slightly more complex compilation
- Classic Forth uses relative branches (proven approach)

## Implementation Plan

### Phase 1: Tag Reduction

1. Reduce tag encoding from 6 bits to 3 bits
2. Remap existing tags to 0-7 range
3. Update `toTaggedValue` and `fromTaggedValue` to use 3-bit tags
4. Verify all 8 tag types fit in 3 bits

### Phase 2: Value Payload Expansion

1. Expand value payload from 16 to 19 bits
2. Update value masks and validation
3. Test with 19-bit addresses in `Tag.CODE`

### Phase 3: IP Register Expansion

1. Expand `vm.IP` from 16-bit to 18-19 bit
2. Update all IP operations to handle larger addresses
3. Expand code segment size accordingly

### Phase 4: Relative Branching

1. Change `Call` opcode from absolute to relative
2. Update compiler to calculate relative offsets
3. Update `callOp` to use `vm.IP + offset`
4. Update `Branch` opcode if needed (already relative)

### Phase 5: Alignment (Optional)

1. Implement function address alignment
2. Convert aligned indices to byte addresses when setting `vm.IP`
3. Update function definition to use aligned addresses

## Example: 19-bit Addresses with 4-byte Alignment

**Configuration**:

- Function addresses: 19-bit (0-524287) - aligned indices
- IP: 19-bit (0-524287) - byte addresses
- Alignment: 4 bytes
- Branch offsets: 16-bit signed (-32768 to +32767)

**Capacities**:

- Function slots: 524288 (19-bit)
- Code segment: 524288 × 4 = 2MB (but IP limited to 524287 bytes)
- Branch range: ±128KB from current IP
- Opcode encoding: Still 2 bytes

## Considerations

### Tag Type Limit

With 3-bit tags, we're limited to 8 tag types (0-7). After unifying `Tag.CODE` and `Tag.BUILTIN` (removing `BUILTIN`), we'll have 8 tag values:

- `0` = `NaN` (canonical NaN needs to be valid as a tagged value)
- `1` = `SENTINEL` (remapped from 1)
- `2` = `STRING` (remapped from 4)
- `3` = `CODE` (unified, includes builtins, remapped from 2)
- `4` = `REF` (remapped from 12)
- `5` = `LIST` (remapped from 8)
- `6` = `reserved1` (reserved for future expansion)
- `7` = `LOCAL` (remapped from 6)

**Note**: `NUMBER` doesn't need a tag - non-NaN values are raw IEEE 754 floats, not NaN-boxed.

### Backward Compatibility

This is a breaking change:

- Tag encoding changes (6 bits → 3 bits)
- Value payload changes (16 bits → 19 bits)
- IP register size changes
- `Call` opcode semantics change (absolute → relative)

Would require migration strategy or version bump.

### Testing

Need to verify:

- NaN-boxing still works correctly with 3-bit tags
- 19-bit values don't cause precision issues in float32
- Relative branching works correctly across large address ranges
- Alignment conversion is correct

## References

- Current tag system: `src/core/tagged.ts`
- Current IP usage: `src/core/vm.ts`
- Current branching: `src/ops/core/core-ops.ts`
- Related proposal: `OPCODE_MIGRATION_PLAN.md` (uses `Tag.OPCODE` instead of unifying into `Tag.CODE`)
