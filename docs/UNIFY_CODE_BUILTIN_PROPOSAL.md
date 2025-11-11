# Proposal: Unify Tag.CODE and Tag.BUILTIN

## Current State

**Two separate tags:**

- `Tag.CODE`: User-defined bytecode addresses (0-32767, 15 bits)
- `Tag.BUILTIN`: Builtin opcodes (0-127, 7 bits)

**Encoding format (bit 7 distinguishes them):**

- Builtin (0-127): Single byte, bit 7 = 0 → builtin opcode
- User code (0-32767): Two bytes, first byte bit 7 = 1 → user code address
- The ranges overlap in 0-127, but bit 7 in encoding makes them unambiguous

**Current behavior:**

- `evalOp` checks tag and dispatches differently
- `parser.ts` checks tag to decide compilation strategy
- Dictionary stores different tags for builtins vs user code

## Proposed Unification

**Single tag: `Tag.CODE`**

- Address range determines behavior:
  - **0-127**: Builtin opcodes (call `executeOp` directly) - 7 bits
  - **0-32767**: User-defined bytecode addresses (set up call frame and jump) - 15 bits

**Safe Overlap:**

- These ranges overlap in 0-127, but it's safe because bit 7 in the encoding distinguishes them:
  - Builtin (0-127): Encoded as single byte with bit 7 = 0
  - User code (0-32767): Encoded as two bytes with bit 7 = 1 in first byte
- The encoding format resolves the ambiguity: bit 7 = 0 → builtin, bit 7 = 1 → user code
- Both can have the same numeric value (e.g., 42), but the encoding format makes them unambiguous

## Benefits

1. **Simpler type system**: One tag instead of two
2. **Natural address space**: Unified 0-32767 range
3. **Consistent semantics**: All executable code uses same tag
4. **Easier to extend**: Future code types can use same tag with different address ranges
5. **Simpler `&symbol` implementation**: Only need `LiteralCode`, no `LiteralBuiltin`

## Implementation Plan

### Phase 1: Update `evalOp`

- Remove `Tag.BUILTIN` case
- Check address range: `if (addr < MIN_USER_OPCODE)` → builtin, else → user code
- Builtin: call `executeOp(vm, addr)` directly
- User code: existing call frame setup logic

### Phase 2: Update Dictionary Registration

- `builtins-register.ts`: Change `Tag.BUILTIN` → `Tag.CODE`
- All builtin registrations use `Tag.CODE` with opcode as address (0-127)

### Phase 3: Update Parser

- `parser.ts`: Check address range instead of tag
- `if (tagValue < MIN_USER_OPCODE)` → `compileOpcode` (builtin)
- `else` → `compileUserWordCall` (user code)

### Phase 4: Update Code Reference Utilities

- `code-ref.ts`:
  - Keep both `createBuiltinRef` and `createCodeRef` as helper functions
  - Both create `Tag.CODE` values (unified tag)
- `createBuiltinRef(opcode)`: Creates `Tag.CODE` with opcode (0-127, 7 bits)
- `createCodeRef(addr)`: Creates `Tag.CODE` with address (0-32767, 15 bits)
  - Both validate their respective ranges but produce same tag type

### Phase 5: Update All Tests

- Replace all `Tag.BUILTIN` checks with `Tag.CODE`
- Update assertions to check address range if needed
- Update `toTaggedValue(..., Tag.BUILTIN, ...)` → `toTaggedValue(..., Tag.CODE, ...)`

### Phase 6: Remove Tag.BUILTIN

- Remove `Tag.BUILTIN` from `tagged.ts` enum
- Remove from all type definitions
- Update documentation

## Technical Details

### Address Range Semantics

```typescript
const MIN_USER_OPCODE = 128;

// Builtin (0-127, 7 bits): Direct execution
// Bit 7 = 0 in encoding → builtin opcode
if (addr < MIN_USER_OPCODE) {
  executeOp(vm, addr);
}
// User code (0-32767, 15 bits): Call frame setup
// Bit 7 = 1 in encoding → user code address
// Note: Overlaps with builtin range 0-127, but encoding distinguishes them
else {
  rpush(vm, vm.IP);
  rpush(vm, vm.bp - RSTACK_BASE);
  vm.bp = vm.rsp;
  vm.IP = addr;
}
```

### Compile-Time Distinction

- Compiler still needs to know which opcode format to emit
- Builtin (0-127): Single byte opcode (bit 7 = 0)
- User code (0-32767): Two-byte extended opcode (bit 7 = 1 in first byte)
- This is determined by address value, not tag
- Encoding format: bit 7 = 0 → single byte (builtin), bit 7 = 1 → two bytes (user code)
- The ranges overlap in 0-127, but bit 7 in encoding distinguishes them safely

### LiteralCode Opcode

- `LiteralCode` can handle both ranges
- Reads 16-bit address (0-32767)
- Pushes `Tag.CODE` with address
- `evalOp` determines behavior at runtime based on address range:
  - 0-127: Builtin (7 bits, bit 7 = 0 in encoding)
  - 0-32767: User code (15 bits, bit 7 = 1 in encoding)
- The overlap is safe: bit 7 in encoding distinguishes them

## Edge Cases

1. **Invalid addresses**: Validation for full range (0-32767)
   - Builtin opcodes: 0-127 (7 bits, bit 7 = 0 in encoding)
   - User code addresses: 0-32767 (15 bits, bit 7 = 1 in encoding)
   - Helper functions (`createBuiltinRef`, `createCodeRef`) validate their specific ranges
   - Runtime behavior is determined by address value
   - Safe overlap: bit 7 in encoding distinguishes them (0 = builtin, 1 = user code)
2. **Meta bit**: Still used for immediate vs function distinction (user code only)
3. **Backward compatibility**: All existing `Tag.BUILTIN` values become `Tag.CODE`

## Migration Strategy

1. Update all code to use `Tag.CODE` directly (no alias)
2. Remove `Tag.BUILTIN` from enum and all references
3. Run full test suite to verify

## Helper Functions

Both helper functions create `Tag.CODE` values:

```typescript
// Creates Tag.CODE for builtin opcodes (0-127)
export function createBuiltinRef(opcode: number): number {
  if (opcode < 0 || opcode > MAX_BUILTIN_OPCODE) {
    throw new Error(`Invalid builtin opcode: ${opcode}`);
  }
  return toTaggedValue(opcode, Tag.CODE);
}

// Creates Tag.CODE for user bytecode addresses (0-32767, 15 bits)
// Note: Overlaps with builtin range 0-127, but bit 7 in encoding distinguishes them
export function createCodeRef(bytecodeAddr: number): number {
  if (bytecodeAddr < 0 || bytecodeAddr > 32767) {
    throw new Error(`Invalid bytecode address: ${bytecodeAddr}. Must be in range 0-32767.`);
  }
  return toTaggedValue(bytecodeAddr, Tag.CODE);
}
```

**Why separate functions?**

- Semantic clarity: `createBuiltinRef` clearly indicates builtin opcode
- Range validation: Each validates its specific range
- Same tag type: Both produce `Tag.CODE`, runtime behavior determined by address value

## Future Address Space Expansion

See `docs/specs/drafts/code-address-space-expansion.md` for detailed discussion of expanding code address space to 18-19 bits by:

- Reducing tag encoding from 6 bits to 3 bits (8 tag types)
- Expanding value payload from 16 bits to 19 bits
- Moving from absolute to relative branching to keep opcode encoding at 2 bytes
- Using alignment strategies to maximize code segment size
