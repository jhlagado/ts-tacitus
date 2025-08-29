# Removed or Consolidated Operations (Plan 13)

This document tracks VM opcodes removed or consolidated during Plan 13 (Naming & Refactor Alignment). The goal is to keep the opcode surface aligned with TACIT vocabulary, remove unused placeholders, and avoid duplicate names. If any of these should be (re)introduced later, this list provides context and suggested replacements.

## Canonical Replacements

- Power → Pow
  - Status: Removed `Power`; use `Pow` (canonical) everywhere.
  - Rationale: Duplicate naming; single canonical verb is `pow`.

- mNegate → Neg
  - Status: Removed legacy alias; canonical is `neg`.
  - Rationale: Drop "m" prefixes; align with TACIT words.

- mSignum → Sign
  - Status: Removed legacy alias; canonical is `sign`.
  - Rationale: Drop "m" prefixes; align with TACIT words.

- mReciprocal → Recip
  - Status: Removed legacy alias; canonical opcode `Recip`. Vocabulary maps `recip` → `Recip`.
  - Rationale: Drop "m" prefixes; align with TACIT words.

- mFloor → Floor
  - Status: Removed legacy alias; canonical opcode `Floor`. Vocabulary maps `floor` → `Floor`.
  - Rationale: Drop "m" prefixes; align with TACIT words.

- mNot → Not
  - Status: Removed legacy alias; canonical opcode `Not`. Vocabulary maps `not` → `Not`.
  - Rationale: Drop "m" prefixes; align with TACIT words.

- mEnlist → Enlist
  - Status: Removed legacy alias; canonical opcode `Enlist`. Existing implementation function `mEnlistOp` retained internally.
  - Rationale: Drop "m" prefixes; align with TACIT words.

## Dropped Placeholders (Unimplemented / Not in Spec)

These opcodes had no implementations, registrations, or tests. They were declared in the enum only and never used.

- Bitwise: And, Or, Xor, Nand
  - Status: Removed from opcode surface.
  - Rationale: Not part of current TACIT core; no implementation/tests.

- Vector/Meta utilities: mWhere, mReverse, mType, mString, mGroup, mDistinct, mCount
  - Status: Removed from opcode surface.
  - Rationale: Not part of current TACIT core; no implementation/tests.

- Collection/dict placeholders: Join, mIn, mKey
  - Status: Removed from opcode surface.
  - Rationale: Not part of current TACIT core; no implementation/tests.

- Aggregates: Avg, Prod
  - Status: Removed from opcode surface.
  - Rationale: Not part of current TACIT core; no implementation/tests.

## Other Removals

- Match (structural equality)
  - Status: Removed dispatch and opcode; not registered anywhere.
  - Rationale: Overlaps with `eq` for value equality; structural matching semantics are undefined in current spec.

## Notes

- All canonical math ops remain: add, sub, mul, div, pow, mod, min, max, abs, neg, sign, exp, ln, log, sqrt.
- List ops remain per `lists.md`: length, size, slot, elem, fetch, store, concat, tail, head, uncons, pack, unpack, reverse.
- If any removed operation is needed in the future, we should:
  1) Add a minimal spec stub (stack effect + semantics),
  2) Implement the opcode and register vocabulary name(s),
  3) Add focused tests (unit + integration where applicable).
