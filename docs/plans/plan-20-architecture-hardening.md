# Plan 20: Core/Lang Boundary & Architecture Hardening

## Objective
Strengthen layering, maintainability, and C‑port readiness by: eliminating Core→Lang coupling, finishing the facade migration, consolidating generic list primitives, and simplifying builtin dispatch. Execute in small, verifiable phases with zero behavior change.

## Current State (Audit)
- Core↔Lang boundary leak: runtime wiring historically lived under Core. This risks import‑time side effects and inverted dependencies.
- Mixed import styles: relative deep imports into Core internals from Lang/Ops create fragility and cycles risk.
- Strings→VM coupling: `strings/symbol-table.ts` uses `VM` where a type‑only `Verb` suffices.
- List helpers duplicated: segment-aware list primitives exist both in Core and Ops (`core/list.ts` vs `ops/lists/core-helpers.ts`).
- Dispatcher bloat: `ops/builtins.ts` uses a large switch despite symbol-table and registration infrastructure.

## Constraints & Guardrails
- No semantic changes; refactors only. Preserve opcodes, names, and behavior.
- No import-time side effects. Runtime is explicitly initialized from Lang.
- Core must not import from Lang or Ops.
- After each phase: run full tests, update this plan’s Status, and stop for review.
- Favor C-like implementations and domain barrels; avoid JS-heavy patterns.

## Target Structure (High-Level)
```
src/
  core/                # VM, Memory, tagged, refs, list, format-utils (no Lang/Ops imports)
    index.ts           # Facade (stable surface)
  lang/                # tokenizer, parser, compiler, interpreter, runtime wiring
    runtime.ts         # Singleton VM + setupRuntime()/initializeInterpreter()
  ops/                 # Builtins and combinators (consumes @src/core)
    access/ stack/ lists/ math/ control/ core/ print/
  strings/             # digest, symbol-table, string (type-only core dependencies)
    index.ts           # Facade (exists)
```

## Execution Protocol (Mandatory)
- Phase-by-phase edits; after each phase: `yarn test` (full) and `yarn lint`.
- Update the Status for that phase in this document.
- Return control to the reviewer before proceeding.
- Zero regressions tolerance.

## Staging Plan
Each phase is independently shippable. Status starts as Pending.

### Phase 1 — Move runtime wiring to Lang (no behavior change)
1. Introduce `src/lang/runtime.ts` exporting `vm` and `setupRuntime()`; add alias `initializeInterpreter` for back‑compat.
2. Replace imports of Core global state in Lang with `./runtime`.
3. Keep `src/core/globalState.ts` as a shim that re‑exports from `lang/runtime` (tests/back‑compat only).
4. Update entrypoints to call `initializeInterpreter()` explicitly (CLI/REPL as applicable).
5. Verify: full tests green; no Core→Lang imports remain.

Status: COMPLETED (runtime moved to Lang; shim left for tests; executor/CLI updated; tests green)

### Phase 2 — Finish facade migration (imports consistency)
1. Prefer barrels and aliases over deep Core internals: use `@src/core` and domain indices in Ops/Lang.
2. Remove mixed alias/relative imports in same file; normalize per file.
3. Update `docs/dependency-map.md` and confirm no deep imports remain.
4. Verify: full tests green; no cycles.

Status: COMPLETED (aliases via @src/core adopted across Lang/Ops; no deep core imports in Ops; tests green)

### Phase 3 — Decouple Strings from VM (type-only)
1. In `strings/symbol-table.ts`, replace `VM` usage with `Verb` type where possible.
2. Ensure `strings/**` has no direct runtime coupling (type-only Core usage allowed).
3. Verify: full tests green.

Status: COMPLETED (Strings now uses Verb type; no VM import; tests green)

### Phase 4 — Consolidate generic list primitives in Core
1. Promote generic, segment-aware helpers from `ops/lists/core-helpers.ts` to `src/core/list.ts` (e.g., `getListHeaderAndBase`, `computeHeaderAddr`).
2. Re-export via `@src/core`; keep ops-specific glue in Ops.
3. Update list ops to consume Core helpers uniformly.
4. Verify: full tests green; no duplicated traversal/addressing logic.

Status: COMPLETED (getListHeaderAndBase/computeHeaderAddr moved to Core; ops re-export; list suites green)

### Phase 5 — Table-driven builtin dispatch (internal to ops)
1. Introduce a single source of truth for builtin opcode → Verb mapping (e.g., `ops/dispatch.ts` or extend `builtins-register.ts`).
2. Update builtin dispatch to consult the table (or `symbolTable` lookup) instead of the big switch in `ops/builtins.ts`.
3. User-defined calls (>=128) unchanged.
4. Verify: full tests green.

Status: COMPLETED (centralized opcode→Verb mapping inside builtins; behavior unchanged; interpreter tests pass)

### Phase 6 — Hygiene and naming consistency
1. Fix file headers with accurate `@file` paths; remove duplicates.
2. Normalize imports: prefer aliases (`@src/core`, `@src/strings`) and domain barrels.
3. Verify: `yarn lint` and full tests green.

Status: COMPLETED (imports normalized; stray unused import fixed; remaining test warnings deferred to separate test cleanup)

### Phase 7 — Enforce layering via ESLint
1. Add import restrictions:
   - Core must not import from Lang or Ops.
   - Strings must not import `VM` (type-only `Verb` allowed).
   - Ops must not import from Lang.
2. Configure `import/no-restricted-paths` or module boundaries.
3. Verify: `yarn lint` and full tests green.

Status: Pending

### Phase 8 — Public runtime surface (optional)
1. Add `src/lang/runtime/index.ts` that re-exports `vm`, `setupRuntime`, and high-level execution helpers.
2. Optional: `src/index.ts` for embedders; keep internal imports on `@src/*`.
3. Verify: full tests green.

Status: Pending

## Acceptance Criteria
- No Core→Lang or Core→Ops imports; runtime wiring lives in Lang without import-time side effects.
- Facade-first imports across Lang/Ops; reduced deep imports as shown in `docs/dependency-map.md`.
- Strings depends on `Verb` type only; no `VM` import in `strings/**`.
- Generic list helpers live in Core; no duplicated traversal/addressing logic.
- Builtin dispatch is table-driven; behavior unchanged.
- Full test suite remains green at the end of each phase.

## Risks & Mitigations
- Import cycles: mitigate by consolidating runtime under Lang and using barrels; validate with dependency map and ESLint boundaries.
- Dispatch refactor regressions: prefer symbol-table backed lookup first; add targeted tests.
- Hidden deep imports: rely on `docs/dependency-map.md` and linter restrictions to catch stragglers.

## Test Strategy
- Behavioral tests only for tagged values; avoid direct tag inspection in Jest.
- After each phase: run full test suite and key domain suites (core, lang, ops/lists, access, stack, math, print).
- Use targeted integration tests for runtime initialization and dispatch changes.

## Rollback Strategy
- Each phase is small and localized. If tests fail, revert the last phase’s edits and pause. Facade/import changes can be reverted file-by-file with minimal blast radius.

## Tracking Checklist
- [x] Phase 1 — Runtime wiring moved to Lang
- [x] Phase 2 — Facade migration complete (aliases/barrels)
- [x] Phase 3 — Strings decoupled from VM (type-only)
- [x] Phase 4 — List primitives consolidated in Core
- [ ] Phase 5 — Table-driven builtin dispatch
- [ ] Phase 6 — Hygiene and naming consistency
- [ ] Phase 7 — ESLint boundaries enforced
- [ ] Phase 8 — Public runtime surface (optional)
