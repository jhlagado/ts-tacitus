# Tacit Tagged Values Specification

Orientation

- Start with core invariants: docs/specs/core-invariants.md
  (See docs/specs/variables-and-refs.md for refs/load/fetch/store.)

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

Current runtime enum (see `src/core/tagged.ts`). Numeric values are implementation details but shown for completeness:

```typescript
export enum Tag {
  NUMBER = 0, // IEEE 754 float (non-NaN) – raw value, no embedded tag bits
  SENTINEL = 1, // Reserved sentinel; currently only NIL (value = 0)
  CODE = 2, // Bytecode address (direct dispatch)
  STACK_REF = 3, // Stack cell reference (address as cell index)
  STRING = 4, // String segment reference
  BUILTIN = 7, // Built-in opcode (0–127)
  LIST = 8, // Reverse list header (payload length in slots)
}
```

Active tags are listed below; this definition takes precedence.

### Tag Table

| Tag      | Payload Meaning                    | Mutable In-Place                           | Printable Form           | Notes                                  |
| -------- | ---------------------------------- | ------------------------------------------ | ------------------------ | -------------------------------------- |
| NUMBER   | Raw IEEE-754 float32 (non-NaN)     | n/a (value itself)                         | numeric literal          | Not NaN-box encoded                    |
| SENTINEL | Reserved sentinel (payload 0 only) | Yes (slot overwrite where used as NIL)     | NIL                      | Single legitimate value: NIL (0)       |
| CODE     | Bytecode address (0..8191 current) | No (structural)                            | `@name` or bytecode addr | Executed via `eval`                    |
| STRING   | String segment offset              | No                                         | string literal           | Immutable contents                     |
| BUILTIN  | Opcode (0..127)                    | No                                         | builtin name             | Dispatch via builtin table             |
| LIST     | Payload slot count (0..65535)      | Header itself no; simple payload slots yes | `( … )`                  | Reverse layout; payload beneath header |

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
VALUE = 16-bit payload (unsigned for all tags; SENTINEL uses 0 only)

Numbers (non-NaN float32) bypass the boxing and carry their IEEE representation directly.
```

## Encoding Rules

- **Numbers**: Full IEEE 754 float (no tag needed)
- **Addresses**: Tag.CODE + 16-bit bytecode address
- **Built-ins**: Tag.BUILTIN + opcode (0-127)
- **Lists**: `Tag.LIST` + payload slot count (0–65535). Reverse layout, header at top-of-stack; see `lists.md`.

### Dispatch Semantics

`@symbol` produces either:

- `Tag.BUILTIN(op)` if the symbol names a builtin opcode (0–127)
- `Tag.CODE(addr)` if the symbol names a colon definition (bytecode) or a compiled quotation

`eval` inspects the tag:

- BUILTIN → invokes native op implementation
- CODE → jumps to bytecode address

This is the unified mechanism used for dispatch.

### CODE Meta Semantics

The NaN-boxed encoding reserves the sign bit alongside `Tag.CODE`. Present Tacit bytecode does not differentiate values with this flag: colon definitions run via the standard `Exit` path, and immediate words emit branch logic inside the caller frame. The bit remains reserved in case future lexical constructs need a separate mode.

## Constraints

- Payload (non-number) is 16 bits (0–65535 unsigned). SENTINEL has a single valid payload value: 0 (NIL).
- CODE payload, BUILTIN payload, and LIST payload follow their respective ranges.

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

- `Tagged(value, tag)` / `getTaggedInfo()` implement encoding/decoding
- Reverse lists depend only on header payload count; traversal uses span rule (see `lists.md §11`)
- Parser-generated code (colon definitions, meta constructs) yields `Tag.CODE` references; there is no separate `CODE_BLOCK` tag
- Addressing operations (`elem`, `slot`, `find`) consume tagged headers uniformly

### Compile-time vs Runtime Tags

- `Tag.LOCAL` is a symbol-table/compile-time tag used during parsing to recognize local variables and emit the correct opcodes (e.g., `VarRef` + `Fetch/Store`).
- Runtime local variable addressing uses `RSTACK_REF` (absolute cell index within the return stack frame). `Tag.LOCAL` values are not part of the runtime's polymorphic reference set and should not appear on the data stack at execution time.

## Related Specifications

- `docs/specs/vm-architecture.md` – Memory segments & stack layout
- `docs/specs/lists.md` – Reverse list representation and traversal
- `docs/specs/variables-and-refs.md` – Locals/globals, references, assignment, +>

## Runtime Invariants (Normative)

1. Any NaN-boxed non-number value MUST decode to a tag in the active set {SENTINEL, CODE, STRING, BUILTIN, LIST}.
2. `Tag.BUILTIN` payload MUST be < 128; execution MUST NOT treat it as a bytecode address.
3. `Tag.CODE` payload MUST be < current CODE segment size (presently 8192) and point to the beginning of a valid instruction.
4. `Tag.LIST` payload = number of payload slots directly beneath the header; element traversal MUST use span rule from `lists.md`.
5. NIL is defined exactly as `(tag=SENTINEL, value=0)` and MUST be used for soft absence/failure (no alternate sentinel).
6. Tags MUST be valid for all newly constructed values; detection of unsupported tags constitutes a validation error.
7. Simple in-place mutation (`store`) is allowed only when target slot holds a simple (NUMBER, SENTINEL, CODE, STRING, BUILTIN) value; LIST headers and compound starts are immutable.

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

## Try it (symbols and eval)

```tacit
: square dup mul ;
@square        \ Tag.CODE for the function
5 @square eval \ -> 25

@add           \ Tag.BUILTIN for builtin add
2 3 @add eval  \ -> 5
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

| Aspect              | This Spec                   | Referenced Spec                               |
| ------------------- | --------------------------- | --------------------------------------------- |
| Reverse list layout | LIST header + payload slots | `lists.md` (§5–§11)                           |
| Address bounds      | CODE within segment bounds  | `vm-architecture.md` (implementation-defined) |
| NIL definition      | SENTINEL 0                  | `lists.md` (Maplists)                         |
| Unified dispatch    | BUILTIN/CODE via eval       | Language parser & executor                    |
