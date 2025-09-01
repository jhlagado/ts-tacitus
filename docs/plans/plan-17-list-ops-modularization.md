# Plan 17: List Ops Modularization and Thematic Reorganization

## Objective
Refactor `src/ops/list-ops.ts` into thematically cohesive modules to improve readability, maintainability, and C-port readiness. Keep file sizes under ~500 lines when reasonable, while grouping related operations and shared helpers. Execute in small, verified stages with tests after each step.

## Current State (Audit)
- `src/ops/list-ops.ts` contains many ops and helper logic in one file.
- Mixed concerns:
  - Parsing/building: `openListOp`, `closeListOp`, `packOp`, `unpackOp`, `makeListOp`, `reverseSpan` usage
  - Queries: `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, `fetchOp`, `storeOp`, `findOp`
  - Structure ops: `headOp`, `tailOp`, `unconsOp`, `concatOp`, `reverseOp`, `enlistOp`
  - Ref polymorphism scattered; some ops recently normalized via `getListHeaderAndBase`
- File length large and growing; helpers duplicated across functions before normalization.

## Target Structure (Proposed Modules)

```
src/ops/lists/
  core-helpers.ts           # Shared list helpers (pure, segment-aware)
  build-ops.ts              # Construction & building ops: open/close, pack, unpack, makeList, enlist
  query-ops.ts              # Read-only queries: length, size, slot, elem, fetch, store, find, (future: bfind)
  structure-ops.ts          # Structural transforms: head, tail, uncons, concat, reverse
  index.ts                  # Re-exports for builtins binding
```

### core-helpers.ts
- `getListHeaderAndBase(vm, value)` (moved from list-ops.ts)
- `pushRefForAddress(segment, cellIndex)` small helper (segment→ref type)
- `computeHeaderAddr(baseAddr, slotCount)`
- Strictly no VM mutation beyond safe memory reads/writes when needed
- Kept lean to avoid circular deps; only helpers used by ops

### build-ops.ts
- `openListOp`, `closeListOp` (parser integration)
- `packOp`, `unpackOp`, `makeListOp`, `enlistOp`
- Any micro-helpers specific to building

### query-ops.ts
- `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, `fetchOp`, `storeOp`, `findOp`
- All ref-aware via `core-helpers`
- Future: `bfindOp` co-located here

### structure-ops.ts
- `headOp`, `tailOp`, `unconsOp`, `concatOp`, `reverseOp`
- Polymorphism centralized using helpers; avoid duplication

### index.ts
- Re-export all verbs so `builtins.ts` imports from `@ops/lists`

## Staging Plan

### Phase 1 — Establish scaffolding & central helpers
1. Create directory `src/ops/lists/` with empty files: `core-helpers.ts`, `build-ops.ts`, `query-ops.ts`, `structure-ops.ts`, `index.ts`.
2. Move `getListHeaderAndBase` to `core-helpers.ts` and export it. Add `pushRefForAddress()` and `computeHeaderAddr()`.
3. Update imports in current `list-ops.ts` to use helpers from `core-helpers.ts`.
4. Tests: run full list/maplist suites.
5. Pause for review.

### Phase 2 — Split queries
1. Create `query-ops.ts` and move: `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, `fetchOp`, `storeOp`, `findOp`.
2. Update `builtins.ts` imports to reference `@ops/lists` index aggregating from new module.
3. Keep `export` names intact to avoid opcode mapping churn.
4. Tests: list + access suites.
5. Pause for review.

### Phase 3 — Split builders
1. Move `openListOp`, `closeListOp`, `packOp`, `unpackOp`, `makeListOp`, `enlistOp` into `build-ops.ts`.
2. Ensure `reverseSpan` stays in core (existing location `src/core/list.ts`) — only import/use.
3. Tests: parser/close/open list tests + list suites.
4. Pause for review.

### Phase 4 — Split structure ops
1. Move `headOp`, `tailOp`, `unconsOp`, `reverseOp`, `concatOp` into `structure-ops.ts`.
2. Ensure shared helper usage stays consistent; remove any file-local duplicates.
3. Tests: list-structure tests, concat scenarios, algebraic laws.
4. Pause for review.

### Phase 5 — Consolidate exports
1. Add `src/ops/lists/index.ts` to re-export ops from build/query/structure modules.
2. Update `src/ops/builtins.ts` to import all list ops from `@ops/lists`.
3. Remove legacy `src/ops/list-ops.ts` once parity is verified.
4. Tests: full suite.
5. Pause for review.

### Phase 6 — Test Reorganization (this task)
Goal: group tests thematically to mirror the new module layout while keeping suites < ~300 LOC each.

- Create `src/test/ops/lists/build/`:
  - `pack-unpack.test.ts` (pack, unpack, enlist, makeList)
  - `open-close-parser-integration.test.ts` (openList/closeList basic integration)
- Create `src/test/ops/lists/query/`:
  - `length-size.test.ts`
  - `addressing-slot-elem.test.ts`
  - `fetch-store.test.ts`
  - `find-maplist-basic.test.ts` (move from `maplist-basic.test.ts`)
- Create `src/test/ops/lists/structure/`:
  - `head-tail-uncons.test.ts`
  - `reverse.test.ts` (move from `list-reverse.test.ts`)
  - `concat-basic.test.ts` (move from `concat-scenarios.test.ts`)
  - `concat-polymorphic.test.ts` (move from existing)
- Keep `src/test/ops/lists/list-spec-compliance.test.ts` as a high-level spec suite.
- Update imports to use `@ops/lists` re-exports after Phase 5.
- Ensure no behavioral changes; only file moves/renames.
- Tests: run each folder group incrementally, then full suite.

### Phase 7 — Cleanups & Docs
1. Remove redundant or overlapping tests after consolidation (avoid double coverage of identical paths).
2. Update any README or contributor docs referencing old test locations.
3. Tests: full suite.

## Risk Management
- Move tests without changing content first; only split/rename.
- Preserve filenames and suite names where possible to keep history meaningful.
- Run tests after each group move.

## Acceptance Criteria
- Ops split across themed files under `src/ops/lists/`, each ~100–400 LOC.
- Tests grouped under `src/test/ops/lists/{build,query,structure}/` mirroring ops.
- `builtins.ts` imports from `@ops/lists` only (after Phase 5).
- All tests pass at each phase; zero semantic regressions.

## Rollback Strategy
- Revert the last move commit if tests fail; since moves are staged, blast radius remains small.
