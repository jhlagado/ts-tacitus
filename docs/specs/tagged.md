# TACIT Tagged Values Specification

## Overview

TACIT uses NaN-boxing to store typed values in uniform 32-bit stack cells. Each value combines a 6-bit tag with up to 16 bits of payload data, enabling efficient type dispatch and memory usage.

## Tag System

```typescript
enum Tag {
  NUMBER = 0,      // IEEE 754 float
  INTEGER = 1,     // 16-bit signed integer  
  CODE = 2,        // Bytecode address
  CODE_BLOCK = 3,  // Standalone code block
  STRING = 4,      // String segment reference
  LIST = 5,        // List length header
  LINK = 6,        // Stack-only backward pointer
  BUILTIN = 7,     // Built-in operation opcode
}
```

## Memory Layout

```
NaN-boxed 32-bit value:
[31-26: tag] [25-16: reserved] [15-0: payload]

Total: 6-bit tag + 16-bit value = 22 bits used
```

## Encoding Rules

- **Numbers**: Full IEEE 754 float (no tag needed)
- **Integers**: Tag.INTEGER + 16-bit signed value
- **Addresses**: Tag.CODE + 16-bit bytecode address  
- **Built-ins**: Tag.BUILTIN + opcode (0-127)
- **Lists**: Tag.LIST + element count (0-65535)
- **Links**: Tag.LINK + backward offset

## Constraints

- Maximum tagged value: 65535 (16-bit limit)
- Code addresses: 0-32767 (15-bit due to encoding)
- Built-in opcodes: 0-127 (7-bit single-byte encoding)
- List counts: 0-65535 (full 16-bit range)

## Validation

All tagged values must:
- Use valid tag (0-7)
- Stay within payload limits
- Maintain NaN-box invariants
- Preserve type safety across operations

## Type Safety

- Runtime type checking via tag inspection
- Compile-time verification where possible
- Error on invalid tag combinations
- Preserve semantics across stack operations

## Implementation Notes

- `toTaggedValue(value, tag)` for encoding
- `fromTaggedValue(tagged)` for decoding  
- Tag-based dispatch in VM operations
- Efficient storage with type information

## Related Specifications

- `specs/vm-architecture.md` - Memory segments and addressing
- `specs/stack-operations.md` - Type-safe stack manipulation
- `specs/bytecode.md` - Code reference encoding
