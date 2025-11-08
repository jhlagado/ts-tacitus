# Tacit Tagged Values Specification

Orientation

- Start with core invariants: docs/specs/core-invariants.md
  (See variables-and-refs.md for refs/load/fetch/store.)

> Status: Authoritative.

## Normative Scope

This document is the canonical source of truth for:

- The complete set of active runtime tags and their numeric identifiers.
- Payload bit widths and interpretation rules.
- Validity / invariants each tag MUST satisfy at runtime.
- Dispatch semantics for `@symbol` + `eval`.

Implementations (VM, parser, symbol table, printers) MUST conform.

## Overview

Tacit uses NaN-boxing to store typed values in uniform 32-bit stack cells. Each value combines a 6-bit tag with up to 16 bits of payload data, enabling efficient type dispatch and memory usage.

## Tag System

Current enum (source of truth is `src/core/tagged.ts`). Numeric values are shown for clarity and must match the implementation:

```typescript
export enum Tag {
  NUMBER = 0, // IEEE‑754 float32 (non‑NaN) — raw value, no boxing
  SENTINEL = 1, // Named sentinels (e.g., NIL=0, DEFAULT=1)
  CODE = 2, // Bytecode address (direct dispatch)
  STRING = 4, // String segment reference
  LOCAL = 6, // Compile‑time local symbol (parser only)
  BUILTIN = 7, // Built‑in opcode (0–127)
  LIST = 8, // Reverse list header (payload slot count)
  DATA_REF = 12, // Unified data-arena reference (absolute cell index)
}
```

Active tags are listed below; this definition takes precedence. `Tag.LOCAL` is a compile‑time tag used by the parser and symbol table and is not part of the runtime’s polymorphic reference set.

### Tag Table

| Tag        | Payload Meaning                                             | Mutable In-Place                       | Printable Form                 | Notes                                                                 |
| ---------- | ----------------------------------------------------------- | -------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| NUMBER     | Raw IEEE‑754 float32 (non‑NaN)                              | n/a (value itself)                     | numeric literal                | Not NaN‑box encoded                                                   |
| SENTINEL   | Named sentinel (e.g., NIL=0, DEFAULT=1)                     | Yes (slot overwrite where used as NIL) | NIL, DEFAULT                   | Encoded as 16‑bit signed; other values reserved                       |
| CODE       | Bytecode address (0..8191 current)                          | No (structural)                        | `@name` or bytecode addr       | Sign bit encodes `IMMEDIATE`; executed via `eval`                     |
| STRING     | String segment offset                                       | No                                     | string literal ('key or "key") | Sign bit encodes `HIDDEN`; payload indexes string table               |
| LOCAL      | Local slot number (compile‑time only)                       | n/a                                    | —                              | Parser/symbol table only; never a runtime ref                         |
| BUILTIN    | Opcode (0..127)                                             | No                                     | builtin name                   | Sign bit encodes `IMMEDIATE`; dispatch via builtin table              |
| LIST       | Payload slot count (0..65535)                               | Header no; simple payload slots yes    | `( … )`                        | Reverse layout; payload beneath header                                |
| DATA_REF   | Unified data-arena absolute cell index                       | n/a                                    | `DATA_REF:<abs-idx>`           | Helper routines map the index to global/data/return windows           |

## Memory Layout

```
IEEE 754 Float32 NaN-Boxing Layout:
┌─┬───────────┬─┬──────┬────────────────┐
│S│EXP (all 1)│Q│ TAG  │     VALUE      │
├─┼───────────┼─┼──────┼────────────────┤
│31│  30..23   │22│21..16│     15..0      │
├─┼───────────┼─┼──────┼────────────────┤
│ │    8      │1│  6   │       16       │
└─┴───────────┴─┴──────┴────────────────┘

S = Sign bit (available for extended tagging)
EXP = Exponent (0xFF for NaN)
Q = Quiet NaN bit (always 1)
TAG = 6-bit type tag (0-63 possible values)
VALUE = 16-bit payload (unsigned for most tags; SENTINEL uses signed 16-bit)

Numbers (non-NaN float32) bypass the boxing and carry their IEEE representation directly.
```

## Encoding Rules

- **Numbers**: Full IEEE 754 float (no tag needed)
- **Addresses**: Tag.CODE + 16-bit bytecode address
- **Built-ins**: Tag.BUILTIN + opcode (0-127)
- **Lists**: `Tag.LIST` + payload slot count (0–65535). Reverse layout, header at top-of-stack; see `lists.md`.

### String Shorthand

Tacit supports a shorthand for simple string keys without spaces or grouping characters:

- `'key` is equivalent to `"key"` and compiles to `Tag.STRING` with the same contents.
- Use the shorthand for maplist keys and symbolic selectors; continue using double quotes for general strings (spaces, escapes, punctuation requiring grouping).

### Dispatch Semantics

`@symbol` produces either:

- `Tag.BUILTIN(op)` if the symbol names a builtin opcode (0–127)
- `Tag.CODE(addr)` if the symbol names a colon definition (bytecode) or a compiled quotation

`eval` inspects the tag:

- BUILTIN → invokes native op implementation
- CODE → jumps to bytecode address

This is the unified mechanism used for dispatch.

### CODE Meta Semantics

The NaN‑boxed encoding reserves the sign bit alongside `Tag.CODE` and `Tag.BUILTIN`. Tacit uses that bit as the **`IMMEDIATE`** flag: when set, the word executes during compilation. VM dispatch MUST mask the sign bit before interpreting the payload as a bytecode address or builtin opcode; compiler helpers set or clear it when registering dictionary entries.

### STRING Meta Semantics

`Tag.STRING` also reserves its sign bit. Tacit interprets this as the **`HIDDEN`** flag for dictionary names. Hidden entries remain linkable via the dictionary, but tools that enumerate, compare, or pretty-print names MUST clear the sign bit before reading from the string segment.

## Constraints

- Payload (non‑number) is 16 bits. Unless otherwise noted, values are unsigned (0–65535).
- SENTINEL payload is signed 16‑bit for convenience; named values currently used are: NIL=0 and DEFAULT=1.
- CODE payload, BUILTIN payload, LIST payload, and reference payloads follow their respective ranges.

## Validation

All tagged values must:

- Use a defined tag (≤ `Tag.DATA_REF`)
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
- Helper routines MUST mask sign-bit metadata when converting CODE, BUILTIN, or STRING payloads to raw addresses, opcodes, or string offsets.
- Reverse lists depend only on header payload count; traversal uses span rule (see `lists.md §11`)
- Parser-generated code (colon definitions, meta constructs) yields `Tag.CODE` references; there is no separate `CODE_BLOCK` tag
- Addressing operations (`elem`, `slot`, `find`) consume tagged headers uniformly

### Compile-time vs Runtime Tags

- `Tag.LOCAL` is a symbol‑table/compile‑time tag used during parsing to recognise local variables and emit the correct opcodes (e.g., `VarRef` + `Fetch/Store`). At runtime, locals and globals are addressed via `DATA_REF` handles whose payloads are classified into the appropriate window. `Tag.LOCAL` must not appear on the data stack during execution.

## Related Specifications

- `docs/specs/vm-architecture.md` – Memory segments & stack layout
- `docs/specs/lists.md` – Reverse list representation and traversal
- `docs/specs/variables-and-refs.md` – Locals/globals, references, assignment, +>
- `docs/specs/capsules.md` – Capsule structure built on lists

## Runtime Invariants (Normative)

1. Any NaN‑boxed non‑number value MUST decode to a tag in the active set {SENTINEL, CODE, STRING, BUILTIN, LIST, DATA_REF}. `LOCAL` is compile‑time only.
2. `Tag.BUILTIN` payload MUST be < 128; execution MUST NOT treat it as a bytecode address.
3. `Tag.CODE` payload MUST be < current CODE segment size (presently 8192) and point to the beginning of a valid instruction.
4. `Tag.LIST` payload = number of payload slots directly beneath the header; element traversal MUST use span rule from `lists.md`.
5. NIL is defined exactly as `(tag=SENTINEL, value=0)`; DEFAULT is `(tag=SENTINEL, value=1)` and is used as a case wildcard sentinel.
6. Tags MUST be valid for all newly constructed values; detection of unsupported tags constitutes a validation error.
7. Simple in‑place mutation (`store`) is allowed only when target slot holds a simple (NUMBER, SENTINEL, CODE, STRING, BUILTIN) value; LIST headers and compound starts are immutable.

## Worked Examples

### Symbol & Quotation

```
: square dup mul ;       \ compiles & registers bytecode at address A
@square                  \ pushes Tag.CODE(A)
5 @square eval           \ -> 25

@add                     \ builtin (e.g., opcode 3) Tag.BUILTIN(3)
2 3 @add eval            \ -> 5

: abs dup 0 lt if neg ; ;
-6 abs                   \ -> 6
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
- Future expansions may partition the data arena into additional windows (e.g., readonly snapshots). Any extension must continue to encode absolute cell indices and respect arena bounds.

## Consistency Cross-Check

| Aspect              | This Spec                   | Referenced Spec                                    |
| ------------------- | --------------------------- | -------------------------------------------------- |
| Reverse list layout | LIST header + payload slots | `docs/specs/lists.md` (§5–§11)                     |
| Address bounds      | CODE within segment bounds  | `docs/specs/vm-architecture.md` (implementation-defined) |
| NIL definition      | SENTINEL 0                  | `docs/specs/lists.md` (Maplists)                   |
| Unified dispatch    | BUILTIN/CODE via eval       | Language parser & executor                    |
