# TACIT Tagged Values Specification

> Status: Harmonised with current implementation (reverse list only; LINK & CODE_BLOCK removed).

## Overview

TACIT uses NaN-boxing to store typed values in uniform 32-bit stack cells. Each value combines a 6-bit tag with up to 16 bits of payload data, enabling efficient type dispatch and memory usage. This document supersedes any older references that still include `LINK` or `CODE_BLOCK` tags.

## Tag System

Current runtime enum (see `src/core/tagged.ts`). Numeric values are implementation details but shown for completeness:

```typescript
export enum Tag {
  NUMBER = 0,      // IEEE 754 float (non-NaN) – raw value, no embedded tag bits
  INTEGER = 1,     // 16-bit signed integer payload
  CODE = 2,        // Bytecode address (direct dispatch)
  STRING = 4,      // String segment reference
  BUILTIN = 7,     // Built-in opcode (0–127)
  LIST = 8,        // Reverse list header (payload length in slots)
}
```

Removed legacy / historical tags (no longer produced by the system):

- `CODE_BLOCK` (inline block quotations now compile to `CODE` references directly)
- `LINK` (legacy forward list backlink; traversal now uses header span only)

When older documents conflict, this definition takes precedence.

## Memory Layout

```
NaN-boxed 32-bit value (quiet NaN pattern used for tagged non-number values):
[31-26: tag] [25-16: reserved/impl] [15-0: payload]

Numbers (non-NaN float32) bypass the boxing and carry their IEEE representation directly.
```

## Encoding Rules

- **Numbers**: Full IEEE 754 float (no tag needed)
- **Integers**: Tag.INTEGER + 16-bit signed value
- **Addresses**: Tag.CODE + 16-bit bytecode address  
- **Built-ins**: Tag.BUILTIN + opcode (0-127)
- **Lists**: `Tag.LIST` + payload slot count (0–65535). Reverse layout, header at top-of-stack; see `lists.md`.
- (Removed) **Links**: superseded by span-based traversal; any residual docs mentioning them are historical.

## Constraints

- Payload (non-number) is 16 bits (0–65535 unsigned or signed for INTEGER)
- Code addresses: 0–32767 (15-bit currently used; upper bit reserved)
- Built-in opcodes: 0–127 (fits in payload)
- List payload slot count: 0–65535 (practical limits smaller due to 64KB memory)

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

- `toTaggedValue(value, tag)` / `fromTaggedValue()` implement encoding/decoding
- Reverse lists depend only on header payload count; traversal uses span rule (see `lists.md §11`)
- Quotation parsing yields a bytecode block; references are encoded with `Tag.CODE` (no distinct `CODE_BLOCK`)
- Addressing operations (`elem`, `slot`, `find`) consume tagged headers uniformly

## Related Specifications

- `specs/vm-architecture.md` – Memory segments & stack layout
- `specs/lists.md` – Reverse list representation and traversal
- `specs/access.md` – Address-returning find family & high-level get/set
- `specs/capsules.md` – Capsule structure built on lists

Historical references mentioning `LINK` or `CODE_BLOCK` are intentionally unresolved; they should be treated as archival context only.
