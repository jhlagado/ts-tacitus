# Plan 22 — Load Opcode Introduction and Fetch Simplification

## Summary

Replace the resolve step with a single, efficient Load opcode that performs the combined logic of “fetch then tolerant fetch” in one operation. Simplify fetch to a strict, raw address read (with list materialization), remove the tolerant-fetch flag, and update the compiler to use the new opcode for value-by-default local access. Preserve a temporary alias so the public word `resolve` maps to the new Load behavior during migration.

## Goals

- Introduce `Op.Load` that implements “value-by-default” dereference in a single step.
- Simplify `fetch` to a strict ref-only memory read (with list materialization if the cell is a LIST header).
- Remove `vm.tolerantFetch` and any test or code paths depending on it.
- Update compiler: local `x` compiles to `VarRef + Load` (instead of `VarRef + Fetch + Resolve`).
- Keep user-level `resolve` as an alias to `Load` during a deprecation window.
- Zero regressions; behavior remains consistent for existing user programs.

## Non-Goals

- No change to address-returning list ops semantics (`slot/elem/find`).
- No change to `&x` parsing behavior (still returns slot content path).
- No multi-level reference chasing beyond one level.

## Terminology

- `fetch` (strict): raw memory load via reference. If the cell read is a LIST header, materialize payload+header; otherwise push cell content as-is. Errors on non-reference input.
- `load` (new): value-by-default dereference. Identity on non-refs; for refs, read once; if the value is a ref, dereference one more level; if the final value is a LIST header, materialize payload+header; else push the simple value.

## Migration Phases

Phase 1 — Introduce Load Opcode
1) Add `Op.Load` and its implementation (`loadOp`).
2) Register user words: `load` (primary) and `resolve` (compatibility alias) → `Op.Load`.
3) Unit tests for `load` covering: identity on non-refs; single-level deref; LIST materialization; STACK_REF and RSTACK_REF cases; GLOBAL_REF error path.

Phase 2 — Simplify Fetch (strict)
1) Remove tolerant branch and flag logic from `fetch`; ensure it throws on non-refs.
2) Keep current behavior that materializes lists when the read cell is a LIST header.
3) Update fetch tests to expect identity no longer applies to non-refs (strict error), and keep list materialization assertions.

Phase 3 — Parser/Compiler Update
1) Change bare local access `x` to compile to `VarRef + Load`.
2) Keep `&x` unchanged (still compiles to `VarRef + Fetch`).
3) Ensure `->` (assignment) remains `VarRef + Store`.

Phase 4 — Test Suite Adjustments
1) Remove usage of `vm.tolerantFetch` in tests; delete the flag.
2) Convert any lingering “fetch then resolve” tests to use `load` where they assert value-by-default materialization.
3) Add behavioral tests validating `x` vs `&x fetch` and `&x fetch load` equivalences for simple and compound locals.

Phase 5 — Documentation & Deprecation
1) Update specs to document `load` (and that `resolve` is an alias during migration).
2) Update `fetch` spec to explicitly state strict ref-only behavior + list materialization if the cell is a LIST header.
3) Add a short migration note: “Replace `resolve` with `load`, and patterns `fetch resolve` → `load` or `fetch load` as applicable.”
4) After a deprecation window, remove the `resolve` alias (separate plan).

## Acceptance Criteria

- All tests green after each phase (zero regressions policy).
- `x` (value-by-default) returns the same results using `VarRef + Load` as the previous `VarRef + Fetch + Resolve`.
- `&x` remains a ref-capable path; `&x fetch` yields slot content; `&x fetch load` yields materialized value.
- `fetch` errors on non-reference input and still materializes LISTs when the cell read is a header.

## Risks & Mitigations

- Risk: Hidden dependencies on tolerant `fetch` identity behavior.
  - Mitigation: Update tests to use `load` for value-by-default paths, maintain `fetch` only for raw address reads.
- Risk: Naming confusion between `load` and `resolve`.
  - Mitigation: Keep both names pointing to `Op.Load` during migration; prefer `load` in docs/examples.
- Risk: Behavior drift in address-returning list ops.
  - Mitigation: Add tests using `slot/elem/find` with `fetch` and `load`, covering both simple and compound cells.

## File-Level Changes (Outline)

- `src/ops/opcodes.ts`: Add `Op.Load`.
- `src/ops/builtins.ts`: Wire `Op.Load` to `loadOp`.
- `src/ops/builtins-register.ts`: Register `load` and alias `resolve` → `Op.Load`.
- `src/ops/lists/query-ops.ts`: 
  - Implement `loadOp`.
  - Simplify `fetchOp` (remove tolerant branch; ensure non-ref error).
- `src/lang/parser.ts`: Compile bare local `x` as `VarRef + Load`.
- `src/core/vm.ts`: Remove `tolerantFetch` flag.
- Tests:
  - Update or replace tolerant-fetch tests with `load`-based tests.
  - Ensure `fetch` strictness tests match new behavior.

## Test Plan (High Value Cases)

- Locals:
  - `: f 42 var x x ; f` → 42 via `Load`.
  - `: f (1 2) var xs xs ; f` → materialized list via `Load`.
  - `: f (1 2) var xs &xs fetch ; f` → RSTACK_REF (slot content), `&xs fetch load` → materialized list.
- Address ops:
  - `( 10 20 ) 0 elem fetch` → 20 (materialized via header-at-cell rule).
  - `( 10 20 ) 0 elem load` → 20 (equivalent to `fetch` then tolerant resolve).
- Strictness:
  - `fetch` on non-ref → throws.
  - `load` on non-ref → identity.
- GLOBAL_REF path remains error-unimplemented.

## Timeline & Rollback

- Phases 1–4 can be staged and validated independently; rollback is straightforward by reverting to previous parser op sequence and keeping `fetch` tolerant (if needed).
- Specs updates come after code and tests are green; `resolve` remains available as an alias until the follow-up deprecation/removal plan.

## Progress

- Phase 1 — Introduce Load Opcode: COMPLETED
  - Added `Op.Load`, wired dispatch, and registered `load` (kept `resolve` as separate for now).
  - Implemented `loadOp` with identity on non-refs, one-level deref, and LIST materialization.
- Phase 2 — Simplify Fetch (strict): COMPLETED
  - Removed tolerant branch and the `vm.tolerantFetch` flag.
  - `fetch` now errors on non-refs; retains list materialization when the cell is a header.
- Phase 3 — Parser/Compiler Update: PENDING
  - Next: compile bare local `x` as `VarRef + Load`.
- Phase 4 — Test Suite Adjustments: COMPLETED (initial set)
  - Replaced tolerant-fetch tests with `load`-based tests; validated address-returning ops with `load`.
  - Existing fetch/store tests remain valid under strict fetch.
- Phase 5 — Documentation & Deprecation: PENDING
  - Next: update specs to describe `load` and fetch strictness; mark `resolve` as an alias during migration.
