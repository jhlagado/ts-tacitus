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

Tacit uses NaN-boxing to store typed values in uniform 32-bit stack cells. Each value combines a 3-bit tag with up to 19 bits of payload data, enabling efficient type dispatch and memory usage.

## Tag System

Current enum (source of truth is `src/core/tagged.ts`). Numeric values are shown for clarity and must match the implementation:

```typescript
export enum Tag {
  NUMBER = 0, // IEEE‑754 float32 (non‑NaN) — raw value, no boxing
  SENTINEL = 1, // Named sentinels (e.g., NIL=0, DEFAULT=1)
  STRING = 2, // String segment reference (sign bit encodes HIDDEN)
  CODE = 3, // Builtin opcode (<128) or bytecode address (>=128, X1516 encoded); sign bit encodes IMMEDIATE
  REF = 4, // Reference into data segment (absolute cell index; can refer to global, stack, or return stack)
  LIST = 5, // Reverse list header (payload slot count)
  RESERVED = 6, // Reserved for future expansion
  LOCAL = 7, // Compile‑time local symbol (parser/symbol table only)
}
```

Active tags are listed below; this definition takes precedence. `Tag.LOCAL` is a compile‑time tag used by the parser and symbol table and is not part of the runtime’s polymorphic reference set.

### Tag Table

| Tag      | Payload Meaning                                          | Mutable In-Place                       | Printable Form                 | Notes                                                                                                                       |
| -------- | -------------------------------------------------------- | -------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| NUMBER   | Raw IEEE‑754 float32 (non‑NaN)                           | n/a (value itself)                     | numeric literal                | Not NaN‑box encoded                                                                                                         |
| SENTINEL | Named sentinel (e.g., NIL=0, DEFAULT=1)                  | Yes (slot overwrite where used as NIL) | NIL, DEFAULT                   | Encoded as 16‑bit signed; other values reserved                                                                             |
| CODE     | Builtin opcode (0..127) or bytecode address (128..32767) | No                                     | `@name` or bytecode addr       | Value < 128: builtin opcode (stored directly); Value >= 128: bytecode address (X1516 encoded); Sign bit encodes `IMMEDIATE` |
| STRING   | String segment offset                                    | No                                     | string literal ('key or "key") | Sign bit encodes `HIDDEN`; payload indexes string table                                                                     |
| LOCAL    | Local slot number (compile‑time only)                    | n/a                                    | —                              | Parser/symbol table only; never a runtime ref                                                                               |
| LIST     | Payload slot count (0..524287)                           | Header no; simple payload slots yes    | `( … )`                        | Reverse layout; payload beneath header                                                                                      |
| REF      | Reference into data segment (absolute cell index)        | n/a                                    | `REF:<abs-idx>`                | Helper routines map the index to global/stack/return stack windows                                                          |
| RESERVED | —                                                        | n/a                                    | —                              | Reserved for future expansion                                                                                               |

## Memory Layout

```
IEEE 754 Float32 NaN-Boxing Layout:
|       | S  | EXP (all 1) | Q  | TAG    | VALUE   |
|-------|----|-------------|----|--------|---------|
| Bits  | 31 | 30..23      | 22 | 21..19 | 18..0   |
| Width | 1  | 8           | 1  | 3      | 19      |

S = Sign bit (available for extended tagging)
EXP = Exponent (0xFF for NaN)
Q = Quiet NaN bit (always 1)
TAG = 3-bit type tag (0-7 possible values)
VALUE = 19-bit payload (unsigned for most tags; SENTINEL uses signed 19-bit)

Numbers (non-NaN float32) bypass the boxing and carry their IEEE representation directly.
```

## Encoding Rules

- **Numbers**: Full IEEE 754 float (no tag needed)
- **Addresses**: Tag.CODE + 19-bit bytecode address
- **Built-ins**: Tag.CODE + opcode (0-127, stored directly, not X1516 encoded)
- **Lists**: `Tag.LIST` + payload slot count (0–524287). Reverse layout, header at top-of-stack; see `lists.md`.

### String Shorthand

Tacit supports a shorthand for simple string keys without spaces or grouping characters:

- `'key` is equivalent to `"key"` and compiles to `Tag.STRING` with the same contents.
- Use the shorthand for maplist keys and symbolic selectors; continue using double quotes for general strings (spaces, escapes, punctuation requiring grouping).

### Dispatch Semantics

`&symbol` produces a code reference by emitting two opcodes:

1. `LiteralString` — pushes the interned name (`Tag.STRING(addr)`)
2. `PushSymbolRef` — resolves the name at runtime and pushes `Tag.CODE`

`PushSymbolRef` consults the dictionary:

- If the name refers to a builtin, it returns `Tag.CODE(op)` with opcode < 128
- If it refers to a colon definition, it returns `Tag.CODE(addr)` with the X1516 bytecode address (value ≥ 128)

`eval` inspects the tag payload:

- `Tag.CODE` < 128 → invoke native builtin implementation
- `Tag.CODE` ≥ 128 → decode X1516 and jump to user bytecode

This is the unified dispatch path for code references introduced via `&symbol`.

### CODE Meta Semantics

The NaN‑boxed encoding reserves the sign bit alongside `Tag.CODE`. Tacit uses that bit as the **`IMMEDIATE`** flag: when set, the word executes during compilation. VM dispatch MUST mask the sign bit before interpreting the payload as a bytecode address or builtin opcode; compiler helpers set or clear it when registering dictionary entries.

### STRING Meta Semantics

`Tag.STRING` also reserves its sign bit. Tacit interprets this as the **`HIDDEN`** flag for dictionary names. Hidden entries remain linkable via the dictionary, but tools that enumerate, compare, or pretty-print names MUST clear the sign bit before reading from the string segment.

## Constraints

- Payload (non‑number) is 19 bits. Unless otherwise noted, values are unsigned (0–524287).
- SENTINEL payload is signed 19‑bit for convenience; named values currently used are: NIL=0 and DEFAULT=1.
- CODE payload (builtin opcodes 0-127 stored directly, bytecode addresses X1516 encoded when ≥ 128), LIST payload, and reference payloads follow their respective ranges.

## Validation

All tagged values must:

- Use a defined tag (≤ `Tag.REF`)
- Stay within payload limits
- Maintain NaN-box invariants
- Preserve type safety across operations

## Type Safety

- Runtime type checking via tag inspection
- Compile-time verification where possible
- Error on invalid tag combinations
- Preserve semantics across stack operations

## Implementation Notes

- `Tagged(value, tag)` encodes values; `getTaggedInfo(tagged)` decodes and returns `{ value, tag, meta }`
- Access tag or value via destructuring: `const { tag } = getTaggedInfo(tagged)` or `const { value } = getTaggedInfo(tagged)`
- Helper routines MUST mask sign-bit metadata when converting CODE or STRING payloads to raw addresses, opcodes, or string offsets.
- Reverse lists depend only on header payload count; traversal uses span rule (see `lists.md §11`)
- Parser-generated code (colon definitions, meta constructs) yields `Tag.CODE` references; there is no separate `CODE_BLOCK` tag
- Addressing operations (`elem`, `slot`, `find`) consume tagged headers uniformly

### Compile-time vs Runtime Tags

- `Tag.LOCAL` is a symbol‑table/compile‑time tag used during parsing to recognise local variables and emit the correct opcodes (e.g., `VarRef` + `Fetch/Store`). At runtime, locals and globals are addressed via `REF` handles whose payloads are classified into the appropriate window. `Tag.LOCAL` must not appear on the data stack during execution.

## Related Specifications

- `docs/specs/vm-architecture.md` – Memory segments & stack layout
- `docs/specs/lists.md` – Reverse list representation and traversal
- `docs/specs/variables-and-refs.md` – Locals/globals, references, assignment, +>
- `docs/specs/capsules.md` – Capsule structure built on lists

## Runtime Invariants (Normative)

1. Any NaN‑boxed non‑number value MUST decode to a tag in the active set {SENTINEL, CODE, STRING, LIST, REF}. `LOCAL` is compile‑time only; `RESERVED` is unused.
2. `Tag.CODE` payload < 128 MUST be treated as builtin opcode; payload >= 128 MUST be X1516 decoded to get bytecode address.
3. `Tag.CODE` payload MUST be < current CODE segment size (presently 8192) and point to the beginning of a valid instruction.
4. `Tag.LIST` payload = number of payload slots directly beneath the header; element traversal MUST use span rule from `lists.md`.
5. NIL is defined exactly as `(tag=SENTINEL, value=0)`; DEFAULT is `(tag=SENTINEL, value=1)` and is used as a case wildcard sentinel.
6. Tags MUST be valid for all newly constructed values; detection of unsupported tags constitutes a validation error.
7. Simple in‑place mutation (`store`) is allowed only when target slot holds a simple (NUMBER, SENTINEL, CODE, STRING) value; LIST headers and compound starts are immutable.

## Worked Examples

### Symbol & Quotation

```
: square dup mul ;       \ compiles & registers bytecode at address A
@square                  \ pushes Tag.CODE(A)
5 @square eval           \ -> 25

@add                     \ builtin (e.g., opcode 3) Tag.CODE(3) (value < 128, stored directly)
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

| Aspect              | This Spec                                                | Referenced Spec                                          |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Reverse list layout | LIST header + payload slots                              | `docs/specs/lists.md` (§5–§11)                           |
| Address bounds      | CODE within segment bounds                               | `docs/specs/vm-architecture.md` (implementation-defined) |
| NIL definition      | SENTINEL 0                                               | `docs/specs/lists.md` (Maplists)                         |
| Unified dispatch    | CODE via eval (value < 128 = builtin, >= 128 = bytecode) | Language parser & executor                               |
