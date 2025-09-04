# Plan 18: Ops and Tests Thematic Reorganization (beyond lists)

## Objective
Bring the rest of the ops and their tests up to the same standard as the lists work: group operations thematically by domain, reduce file bloat, remove duplication, and align tests with the new structure. Maintain C-port readiness and behavioral tests.

## Rationale
- Current ops are mixed and sometimes monolithic (e.g., access-ops, stack-ops). Thematic grouping improves navigability and long-term maintainability.
- Tests are scattered and sometimes overlap or assert internals; bring them to behavioral assertions and themed layout.
- Prepare for future C/assembly port by simplifying module interfaces and avoiding JS-heavy idioms.

## Scope
Non-list ops and tests only. Lists have been completed under Plan 17.

## Target Structure
```
src/ops/
  access/               # get/set/select and helpers (split from access-ops)
    index.ts
    get-set-ops.ts
    select-ops.ts       # keep specialized but colocated under access
  stack/                # stack manipulation ops
    index.ts
    data-move-ops.ts    # dup, drop, swap, rot, over, nip, tuck, pick, revrot
    segment-ops.ts      # future: segment-based stack operations
  math/                 # arithmetic & comparison
    index.ts
    arithmetic-ops.ts   # add, sub, mul, div, mod, etc.
    comparison-ops.ts   # eq, lt, gt, etc.
  control/              # control flow
    index.ts
    branch-ops.ts       # if, ifFalseBranch, do, repeat
  core/                 # core runtime ops
    index.ts
    core-ops.ts         # literals, eval, save/restore temp, address/code literals
  print/                # printing & formatting
    index.ts
    print-ops.ts
```

Test layout mirrors ops:
```
src/test/ops/
  access/
    get-set.test.ts
    select-op.test.ts
  stack/
    data-move-basic.test.ts
    data-move-edgecases.test.ts
  math/
    arithmetic.test.ts
    comparison.test.ts
  control/
    control-flow.test.ts
  core/
    core-ops-coverage.test.ts
  print/
    print-operations.test.ts
  integration/
    language-integration.test.ts
    stack-interactions.test.ts
```

## Staging Plan

### Phase 1 — Discovery and mapping
- Inventory all ops and tests; map each to a target module and test suite.
- Identify shared helpers that should be moved into small, reusable files to avoid cycles.

### Phase 2 — Access ops consolidation
- Split `access-ops.ts` into `get-set-ops.ts` and keep `select-ops.ts` colocated under `ops/access/`.
- Create `ops/access/index.ts` and update `ops/builtins.ts` to import via `@ops/access`.
- Update tests under `src/test/ops/access/` to import from `@ops/access`.
- Tests: run access suites.

### Phase 3 — Stack ops consolidation
- Split `stack-ops.ts` into `data-move-ops.ts` (dup, drop, swap, rot, over, nip, tuck, pick, revrot) and reserve space for future segment ops.
- Create `ops/stack/index.ts`; update `ops/builtins.ts` imports.
- Update stack tests to import via `@ops/stack`.
- Tests: run stack suites.

### Phase 4 — Math ops split
- Move arithmetic and comparison into separate files under `ops/math/` with an index re-export.
- Update `ops/builtins.ts` and math tests.
- Tests: arithmetic and comparison suites.

### Phase 5 — Control ops grouping
- Consolidate control flow ops (if, ifFalseBranch/do/repeat) into `ops/control/` with index.
- Update builtins and tests.

### Phase 6 — Core/Print ops cleanup
- Keep core/print in their directories with small files and a clean index.
- Ensure formatting helpers live in `core/format-utils` and `print-ops` only triggers side effects.
- Tests: print & core suites.

### Phase 7 — Test rationalization
- Remove redundant or overlapping tests; convert internal-structure assertions to behavioral checks.
- Ensure all tests import from thematic indices (`@ops/<domain>`), not monoliths.
- Run full suite.

## Acceptance Criteria
- Ops organized by domain under `src/ops/<domain>/` with concise files and `index.ts` re-exports per domain.
- `ops/builtins.ts` imports only via domain indices (e.g., `@ops/lists`, `@ops/stack`, `@ops/access`).
- Tests reorganized under `src/test/ops/<domain>/`; integration kept in `integration/`.
- All tests green at each phase; no behavior regressions.

## Risks & Mitigations
- Import cycles: keep helpers small, avoid cross-domain reach-through; colocate helpers where used.
- Wide changes in imports: stage per domain and run tests per phase.
- Hidden coupling: use the dependency map to drive and validate refactors after each phase.
