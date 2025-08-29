# Plan 13 — Naming & Refactor Alignment

## Executive Summary

Systematically align naming with TACIT language words, remove duplication, and clarify hard‑to‑read areas. Work one library at a time with small, verifiable changes. No behavior drift; prioritize clarity and consistency.

## Phase 0: Audit Findings (Snapshot)

- ops/math-ops
  - Redundancy: `multiplyOp` vs `prodOp`; `negOp` vs `mNegateOp`; `signOp` vs `mSignumOp`; `powOp` vs `powerOp`.
  - Naming: `minOp`/`maxOp` use ensure messages "&"/"|" — inconsistent; prefer operation name.
  - Recommendation: Consolidate duplicates under canonical names: `add`, `sub`, `mul`, `div`, `pow`, `mod`, `min`, `max`, `abs`, `neg`, `sign`, `exp`, `ln`, `log`, `sqrt`, `avg` (optional: keep only one of `pow*` forms; consider removing `avg` if not in TACIT core).

- ops/print-ops & core/format-utils vs core/utils
  - Duplication: `formatValue` exists in both `core/utils.ts` and `core/format-utils.ts` with different behaviors (quotes, ref deref strategy).
  - Naming: `formatAndConsumeListFromHeaderValue` is long; consider `formatListFromHeader`.
  - Recommendation: Single source of formatting truth in `core/format-utils`; make `core/utils` delegate or remove its formatter. Normalize to double‑quoted strings (Plan 12, Phase 5).

- ops/list-ops
  - Naming: `lengthOp` returns slot count; `sizeOp` returns element count — aligns with spec but add docstrings explicitly referencing specs to prevent confusion.
  - Implementation oddity: `concatOp` assumes payload already correctly arranged then pushes a combined header only (fragile); should compose lists explicitly (or document the assumption with tests).
  - Recommendation: Add in‑file spec references; tighten `concat` to explicit construction or add tests locking current behavior.

- ops/stack-ops
  - Internal helpers: `slotsCopy`, `slotsReverse`, `slotsRoll`, `findElementAtIndex` — consistent internally but consider renaming to “cells” or “elements” per TACIT wording. Add brief docstrings (stack‑effect intent) for each public op.

- core/refs.ts vs core/tagged.ts
  - Overlap: `isRef`/`isStackRef`/`isLocalRef`/`isGlobalRef` appear in both; prefer `core/refs` as the runtime reference hub; keep tag constants in `tagged` only.
  - Recommendation: Deprecate duplicate guards in `tagged` (or re‑export from `refs`) to avoid drift.

- ops/access-ops
  - Status: `getOp` partial; `setOp` stub; not spec‑compliant; slated in Plan 12, Phases 3–4.
  - Recommendation: No naming action yet; complete implementation first.

## Phase 1: Math Ops Consolidation 

1.5 ✅ Remove legacy "m" prefixes from remaining unary ops (rename to canonical: `recip`, `floor`, `not`), update imports/dispatch/tests.  
 

1.1 ✅ Canonical verbs decided: `add`, `sub`, `mul`, `div`, `pow`, `mod`, `min`, `max`, `abs`, `neg`, `sign`, `exp`, `ln`, `log`, `sqrt`.  
1.2 ✅ Remove duplicates: drop `prodOp`, `mNegateOp`, `mSignumOp`, `powerOp` (prefer `powOp`).  
1.3 ✅ Ensure ensureStackSize messages match op names (e.g., `min`, `max`).  
1.4 ✅ Update `builtins-register.ts` imports/exports accordingly; run tests.  
1.5 ✅ Remove legacy "m" prefixes from remaining unary ops (rename to canonical: `recip`, `floor`, `not`), update imports/dispatch/tests.  

Status: ✅ COMPLETED

## Phase 2: Formatting Single‑Source of Truth 

2.1 ✅ Make `core/utils` formatter delegate to `core/format-utils` or remove duplicate.  
2.2 ✅ Rename `formatAndConsumeListFromHeaderValue` → `formatListFromHeader` (internal).  
2.3 ✅ Enforce quoted strings per Plan 12 (D1) and add tests for escapes.  
2.4 ✅ Rename debug builtin from `print` → `raw` (keep human `.` unchanged). Update registration and docs; adjust any tests invoking `print`.  

Status: ✅ COMPLETED

## Phase 3: List Ops Clarity & Safety 

3.1 ✅ Add spec references to `lengthOp`/`sizeOp` docstrings (slots vs elements).  
3.2 ✅ Document `concat` invariant: requires two contiguous lists; if either input is not a list, fall back semantics (e.g., `cons`) may apply. Add tests that lock current invariant.  

Status: ✅ COMPLETED

## Phase 6: List Semantics Discussion (Low Priority)

6.1 Write a short design note on list semantics for `concat` and `cons` (edge cases, fallback behavior).  
6.2 Align ops after discussion (if needed); add/adjust tests accordingly.

Status: ⭕ PENDING

## Phase 4: Stack Ops Naming Polish 

4.1 Consider `slotsCopy` → `cellsCopy` or `elementsCopy` for clarity; similarly for `slotsReverse`/`slotsRoll`.  
4.2 Add succinct docstrings for user‑facing ops (`dup`, `swap`, `rot`, etc.) referencing stack‑effects.  

Status: ⭕ PENDING

## Phase 5: Refs/Tagged Separation 

5.1 Move/refactor reference type guards to `core/refs` and re‑export if needed; deprecate duplicates in `tagged`.  
5.2 Add small tests verifying guards’ single source and behavior parity.  

Status: ⭕ PENDING

## Non‑Goals

- Do not change op semantics.  
- Do not implement access ops here (covered in Plan 12).  
- No API churn beyond renames/refactors above.

## Testing Protocol

- Update or add focused unit tests after each rename/consolidation.  
- Run full suite (`yarn test`) after every step.  
- Behavioral tests only for tagged values (NaN‑boxing caveat).

## Acceptance Criteria

- No duplicate math ops remain; canonical naming matches TACIT words.  
- One formatter source with consistent string quoting.  
- List ops documented and `concat` behavior locked by tests.  
- Stack ops helpers/names clarified without behavior drift.  
- Reference guards live in one place.
