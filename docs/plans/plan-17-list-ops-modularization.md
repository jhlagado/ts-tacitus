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

### Phase 2 — Split queries (COMPLETED)
1. Created `query-ops.ts` and moved: `lengthOp`, `sizeOp`, `slotOp`, `elemOp`, `fetchOp`, `storeOp`, `findOp`, plus later migrated `keysOp`, `valuesOp`, `refOp`, `resolveOp` for consolidation.
2. Updated `builtins.ts` to import query ops from `@ops/lists`.
3. Kept export names intact to avoid opcode mapping churn.
4. Tests: list + access suites passed.
5. Paused and reviewed.

### Phase 3 — Split builders (COMPLETED)
1. Moved `openListOp`, `closeListOp`, `packOp`, `unpackOp`, `makeListOp`, `enlistOp` into `build-ops.ts`.
2. Ensured `reverseSpan` remains in `src/core/list.ts` and only imported/used.
3. Tests: parser/close/open list tests + list suites passed.
4. Paused and reviewed.

### Phase 4 — Split structure ops (COMPLETED)
1. Moved `headOp`, `tailOp` (with alias `dropHeadOp`), `reverseOp`, `concatOp` into `structure-ops.ts`.
2. Ensured shared helper usage stays consistent; removed file-local duplicates.
3. Tests: list-structure tests and concat scenarios passed.
4. Paused and reviewed.

### Phase 5 — Consolidate exports (COMPLETED)
1. Added `src/ops/lists/index.ts` to re-export ops from build/query/structure modules.
2. Updated `src/ops/builtins.ts` and `src/ops/select-ops.ts` to import all list ops from `@ops/lists`.
3. Removed legacy `src/ops/list-ops.ts` after verifying parity and updating tests to reference `@ops/lists`.
4. Tests: targeted suites passed (global coverage gate remains intentionally unmet).
5. Paused and reviewed.

### Phase 6 — Test Reorganization (COMPLETED)
Goal: group tests thematically to mirror the new module layout while keeping suites < ~300 LOC each.

Completed:
- Created themed folders: `src/test/ops/lists/{build,query,structure}/`.
- Moved and renamed for clarity:
  - Structure: `concat-scenarios.test.ts` → `structure/concat-basic.test.ts`
  - Structure: `concat-polymorphic.test.ts` → `structure/concat-polymorphic.test.ts`
  - Structure: `list-reverse.test.ts` → `structure/reverse.test.ts`
  - Query: `maplist-basic.test.ts` → `query/find-maplist-basic.test.ts`
  - Build: `list-creation.test.ts` → `build/list-creation.test.ts`
- Fixed relative imports after moves; targeted suites pass.
- Added new thematic suites:
  - Build: `build/pack-unpack.test.ts`, `build/open-close-parser-integration.test.ts`
  - Query: `query/length-size.test.ts`, `query/addressing-slot-elem.test.ts`, `query/fetch-store.test.ts`
- All new and moved suites pass locally (global coverage gate remains intentionally unmet).

Final state:
- Structure: added `head-tail-uncons.test.ts` (uncons omitted by scope)
- Integration: moved `list-operations.test.ts` and `list-integration.test.ts` to `integration/` with clearer names
- Kept `src/test/ops/lists/list-spec-compliance.test.ts` as a high-level spec suite
- All themed and integration suites pass locally

### Phase 7 — Cleanups & Docs (PENDING)
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
