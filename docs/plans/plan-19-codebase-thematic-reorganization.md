# Plan 19: Codebase Thematic Reorganization and Clarity Improvements

## Objective
Strengthen the overall structure, naming, and clarity of the codebase (beyond ops), while preserving behavior and keeping every step test‑green. Build on Plans 17 and 18 by adding stable facades, tightening boundaries, standardizing naming, and consolidating diagnostics/formatting — executed in small, verifiable phases.

## Rationale
- Improve navigability and long‑term maintainability with stable module facades and thematic grouping.
- Make boundaries explicit: VM/runtime primitives in core; language pipeline in lang; data operations in ops; string intern/infrastructure in strings.
- Reduce cross‑domain reach‑through; keep public surfaces small and C‑port friendly.
- Standardize naming and diagnostics for consistency and readability.

## Scope
- In scope: `src/core/**`, `src/lang/**`, `src/strings/**`, formatting/printing boundaries, error/diagnostics standardization, import surfaces (facades/barrels).
- Out of scope: Functional changes to ops semantics (ops already reorganized under Plans 17/18). No behavior changes.

## Target Structure (Additive, then incremental migration)
```
src/
  core/
    index.ts            # NEW facade: export stable core surface (VM, tagged, refs, constants, errors, utils)
  strings/
    index.ts            # NEW facade: export digest, symbol-table, string
  lang/                 # tokenizer, parser, compiler, interpreter, executor, repl (unchanged layout)
  ops/                  # already thematically organized (Plan 17/18)
  ...
```

Public imports should prefer facades (`@src/core`, `@src/strings`) and domain indices (e.g., `@ops/lists`). Internal files remain reachable for special cases during migration, but the end state minimizes direct deep imports.

## Naming & Documentation Conventions (no behavior change)
- Ops: verbs with `Op` suffix (e.g., `fetchOp`, `resolveOp`).
- Helpers: descriptive nouns/phrases (e.g., `getListHeaderAndBase`, `computeHeaderAddr`).
- Tagged/refs helpers: clear prefixes (`is<Tag>`, `make<Tag>`, `tagOf`, `valueOf`).
- Formatting vs printing:
  - `core/format-utils.ts`: pure formatting helpers (no side effects).
  - `ops/print/print-ops.ts`: console I/O; delegates to format-utils.
- Errors: consistent, segment/tag‑aware messages in `core/errors.ts`.

## Staging Plan
Each phase is independently shippable and should keep the full test suite green. After each phase: run `yarn test` and pause for review.

### Phase 1 — Introduce facades (no consumer changes)
1. Add `src/core/index.ts` that re‑exports the stable public surface (VM, Memory, constants, tagged, refs, errors, utils). Keep exports minimal.
2. Add `src/strings/index.ts` that re‑exports `digest`, `symbol-table`, and `string`.
3. Documentation: add a short note in `docs/dependency-map.md` (or companion doc) describing the intended import surfaces.
Validation: run tests; no import sites updated yet.

### Phase 2 — Migrate low‑blast consumers to facades (print/core ops)
1. Update `ops/print/*` and `ops/core/*` imports to use `@src/core` and (if needed) `@src/strings` facades.
2. Ensure no import cycles introduced; if cycles appear, narrow the facade export list (do not widen internals).
Validation: run tests; confirm no behavioral changes.

### Phase 3 — Migrate math/control ops to facades
1. Update `ops/math/*` and `ops/control/*` imports to use `@src/core` and `@src/strings` as applicable.
2. Keep domain barrel imports for ops (e.g., `@ops/math`, `@ops/control`).
Validation: run tests; confirm no behavioral changes.

### Phase 4 — Migrate lists/access ops to facades (careful with helpers)
1. Update `ops/lists/*` and `ops/access/*` imports to use `@src/core` facades where feasible.
2. Keep list‑specific helpers in `ops/lists/core-helpers.ts`; do not move list logic into core.
Validation: run tests; confirm no behavioral changes.

### Phase 5 — Lang surface cleanup (compiler/interpreter/executor)
1. Review imports in `src/lang/**` and migrate to `@src/core`/`@src/strings` facades where it reduces deep coupling.
2. Ensure no circular dependencies with `VM` and `Compiler`; retain direct imports if needed to avoid cycles.
Validation: run tests; confirm no behavioral changes.

### Phase 6 — Standardize diagnostics and error messages
1. Audit thrown error messages in ops/lang/core for consistency (operation name, required stack depth, segment/tag context when helpful).
2. Normalize wordings via `core/errors.ts` where appropriate (no new dependencies; keep hot paths lean).
Validation: run tests; confirm messages remain covered by existing behavioral tests (where assertions exist).

### Phase 7 — Clarify formatting vs printing boundaries (docs + safe refactor)
1. Document the roles of `core/format-utils.ts` vs `ops/print/print-ops.ts` (pure vs side‑effectful).
2. If any formatting logic lives in `print-ops.ts` that has no I/O, move it to `format-utils` and re‑use (no signature changes).
Validation: run tests; confirm printed output tests pass unchanged.

### Phase 8 — Naming guide and focused renames (optional, staged)
1. Add a short naming guide doc (1 page) under `docs/` capturing conventions above.
2. Apply safe, localized renames (e.g., `tagOf`/`valueOf` aliases) in core modules only, updating import sites in one module at a time.
3. Skip broad renames if they introduce churn; prioritize clarity wins with minimal blast radius.
Validation: run tests after each small rename; zero behavior changes.

## Acceptance Criteria
- New facades exist (`src/core/index.ts`, `src/strings/index.ts`) and are used by ops/lang progressively without introducing cycles.
- All phases keep tests green; no behavioral changes.
- Reduced cross‑domain imports; most external imports go through facades or domain barrels.
- Clear separation of formatting (pure) vs printing (I/O), documented.
- Error messages standardized where covered.

## Risk Management
- Import cycles when introducing facades: mitigate by limiting facade exports; fall back to direct imports for special cases.
- Wide import changes: execute per domain (print/core → math/control → lists/access → lang), with tests after each step.
- Renames churn: keep optional and localized; prioritize readability over breadth.

## Rollback Strategy
- Each phase is small; revert the last phase commit if tests fail.
- Facades are additive; if issues arise, remove consumers first, then the facade files.

## Execution Notes
- Use `docs/dependency-map.md` to validate import changes after each phase.
- Maintain C‑port constraints (simple loops, no deep abstractions, no new closures in hot paths).
- No code changes beyond structure/imports/renames specified; no semantic changes.

---

When ready, proceed with Phase 1. After completing each phase, run the full suite (`yarn test`) and pause for review before the next phase.

