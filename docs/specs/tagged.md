# TACIT Tagged Values Specification

> Status: Harmonised with current implementation (reverse list only; LINK & CODE_BLOCK removed).

## Normative Scope

This document is the canonical source of truth for:

- The complete set of active runtime tags and their numeric identifiers.
- Payload bit widths and interpretation rules.
- Validity / invariants each tag MUST satisfy at runtime.
- Dispatch semantics for `@symbol` + `eval`.

Implementations (VM, parser, symbol table, printers) MUST conform. Legacy tags listed as removed MUST NOT appear in new bytecode, tests, or runtime values (a runtime sighting is a defect).

## Overview

TACIT uses NaN-boxing to store typed values in uniform 32-bit stack cells. Each value combines a 6-bit tag with up to 16 bits of payload data, enabling efficient type dispatch and memory usage. This document supersedes any older references that still include `LINK` or `CODE_BLOCK` tags.

## Tag System

Current runtime enum (see `src/core/tagged.ts`). Numeric values are implementation details but shown for completeness:

```typescript
export enum Tag {
  NUMBER = 0, // IEEE 754 float (non-NaN) – raw value, no embedded tag bits
  INTEGER = 1, // 16-bit signed integer payload
  CODE = 2, // Bytecode address (direct dispatch)
  STRING = 4, // String segment reference
  BUILTIN = 7, // Built-in opcode (0–127)
  LIST = 8, // Reverse list header (payload length in slots)
}
```

Removed legacy / historical tags (no longer produced by the system):

- `CODE_BLOCK` (inline block quotations now compile to `CODE` references directly)
- `LINK` (legacy forward list backlink; traversal now uses header span only)

When older documents conflict, this definition takes precedence.

### Tag Table

| Tag     | Payload Meaning                    | Mutable In-Place                           | Printable Form                         | Notes                                  |
| ------- | ---------------------------------- | ------------------------------------------ | -------------------------------------- | -------------------------------------- |
| NUMBER  | Raw IEEE-754 float32 (non-NaN)     | n/a (value itself)                         | numeric literal                        | Not NaN-box encoded                    |
| INTEGER | 16-bit signed (-32768..32767)      | Yes (slot overwrite)                       | integer literal                        | Used for NIL sentinel (0)              |
| CODE    | Bytecode address (0..8191 current) | No (structural)                            | `@name` or `{ … }` when printed as ref | Executed via `eval`                    |
| STRING  | String segment offset              | No                                         | string literal                         | Immutable contents                     |
| BUILTIN | Opcode (0..127)                    | No                                         | builtin name                           | Dispatch via builtin table             |
| LIST    | Payload slot count (0..65535)      | Header itself no; simple payload slots yes | `( … )`                                | Reverse layout; payload beneath header |

Removed (MUST NOT appear): `CODE_BLOCK`, `LINK`.

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

### Dispatch Semantics

`@symbol` produces either:

- `Tag.BUILTIN(op)` if the symbol names a builtin opcode (0–127)
- `Tag.CODE(addr)` if the symbol names a colon definition (bytecode) or a compiled quotation

`eval` inspects the tag:

- BUILTIN → invokes native op implementation
- CODE → jumps to bytecode address

This unified mechanism eliminates function table indirection present in earlier designs.

## Constraints

- Payload (non-number) is 16 bits (0–65535 unsigned or signed for INTEGER)
- CODE segment currently: 8KB ⇒ valid bytecode addresses 0–8191 (13-bit). The encoding _capacity_ (payload width) allows growth to larger segments (up to 16-bit minus any reserved high bits) without changing tag format.
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

## Runtime Invariants (Normative)

1. Any NaN-boxed non-number value MUST decode to a tag in the active set {INTEGER, CODE, STRING, BUILTIN, LIST}.
2. `Tag.BUILTIN` payload MUST be < 128; execution MUST NOT treat it as a bytecode address.
3. `Tag.CODE` payload MUST be < current CODE segment size (presently 8192) and point to the beginning of a valid instruction.
4. `Tag.LIST` payload = number of payload slots directly beneath the header; element traversal MUST use span rule from `lists.md`.
5. NIL is defined exactly as `(tag=INTEGER, value=0)` and MUST be used for soft absence/failure (no alternate sentinel).
6. Removed tags (`CODE_BLOCK`, `LINK`) MUST NOT appear in newly constructed values; detection constitutes a validation error.
7. Simple in-place mutation (`store`) is allowed only when target slot holds a simple (NUMBER, INTEGER, CODE, STRING, BUILTIN) value; LIST headers and compound starts are immutable.

## Worked Examples

### Symbol & Quotation

```
: square dup mul ;       \ compiles & registers bytecode at address A
@square                  \ pushes Tag.CODE(A)
5 @square eval           \ -> 25

@add                     \ builtin (e.g., opcode 3) Tag.BUILTIN(3)
2 3 @add eval            \ -> 5

{ dup mul }              \ quotation compiled to bytecode at address B → Tag.CODE(B)
6 { dup mul } eval       \ -> 36
```

### List Slots vs Elements

```
( 1 ( 2 3 ) 4 )
\ Outer LIST payload slots = 1 (for 1) + 3 (inner list span) + 1 (for 4) = 5 ⇒ header LIST:5
\ Elements (by traversal) = 3
slots                      \ -> 5
length                     \ -> 3
```

## Future Expansion (Informative)

- Increasing CODE segment size requires no tag format change; only address range validation updates.
- Additional compound types must adopt the same “header encodes span” contract to remain traversal-compatible with existing list algorithms.

## Consistency Cross-Check

| Aspect              | This Spec                   | Referenced Spec                              |
| ------------------- | --------------------------- | -------------------------------------------- |
| Reverse list layout | LIST header + payload slots | `lists.md` (§5–§11)                          |
| Address bounds      | CODE < 8192                 | `vm-architecture.md` (8KB CODE)              |
| NIL definition      | INTEGER 0                   | `access.md`, `maplists.md` (lookup failures) |
| Unified dispatch    | BUILTIN/CODE via eval       | Language parser & executor                   |
