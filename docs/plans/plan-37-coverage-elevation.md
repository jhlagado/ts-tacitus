# Plan 37 — Branch Coverage Elevation to 80 %

Status: Phase 1 in progress
Owner: QA + Runtime Contributors
Last updated: 2025-09-11

## Objective
Raise global branch coverage to at least the configured 80 % threshold so `yarn test` exits cleanly. Focus on the lowest-coverage modules highlighted by the latest Jest report.

## Coverage snapshot (2025-09-11)
```
Global branch coverage: 76.59 %
Modules below 80 %:
- src/ops/broadcast.ts             24.00 %
- src/ops/print/print-ops.ts       41.66 %
- src/ops/core/core-ops.ts         41.93 %
- src/core/units.ts                46.15 %
- src/ops/stack/data-move-ops.ts   51.61 %
- src/lang/meta/conditionals.ts    58.33 %
- src/ops/lists/build-ops.ts       60.00 %
- src/ops/builtins.ts              62.50 %
- src/ops/local-vars-transfer.ts   62.50 %
- src/core/vm.ts                   64.10 %
- src/lang/interpreter.ts          64.28 %
- src/core/list.ts                 68.75 %
- src/lang/file-processor.ts       76.92 %
- src/lang/meta/case.ts            75.00 %
- src/lang/meta/when-do.ts         75.00 %
- src/strings/digest.ts            75.00 %
- src/strings/symbol-table.ts      75.00 %
```

## Phases

### Phase 0 — Target selection & instrumentation (complete)
- [x] Confirm which files offer the best branch “lift” per effort (small helpers vs. large modules).
- [x] Capture baseline Jest coverage artifacts (`coverage-summary.json`) for comparison after each phase.

### Phase 1 — Parser/runtime helpers (low-hanging fruit)
- [x] Add unit tests covering:
  - `src/lang/compiler-hooks.ts` (`setEndDefinitionHandler`, `invokeEndDefinitionHandler` happy path & missing handler).
  - `src/lang/state.ts` (`setParserState`, `getParserState`, `requireParserState` error path).
  - `src/lang/literals.ts` (`emitNumber`, `emitString`, `parseBacktickSymbol` including stop-on-whitespace case).
- [x] Validate these bump modules from 0 % to ~100 % branch coverage.

### Phase 2 — Core utilities & stack operations
- [ ] Expand tests for `src/core/units.ts` (angle conversions, error branches) via a dedicated spec.
- [ ] Extend `src/test/ops/stack` suites to cover branches in `data-move-ops` (e.g., `take`, `drop`, index guard paths).
- [ ] Cover `src/ops/local-vars-transfer.ts` (copy paths vs. passthrough) and `src/ops/builtins.ts` fallback branches with targeted unit tests using the VM harness.

### Phase 3 — Output & broadcast modules
- [ ] Introduce tests for `src/ops/print/print-ops.ts` hitting ANSI formatting / indentation branches.
- [ ] Author behavioural tests for `src/ops/broadcast.ts` covering scalar/list combinations and invalid arities.
- [ ] Ensure `src/ops/lists/build-ops.ts` creation branches (empty vs. non-empty, invalid sizes) are exercised.

### Phase 4 — High-impact core modules
- [ ] Identify untested branches in `src/ops/core/core-ops.ts` (e.g., `endWhenOp` RSP mismatch, `groupRightOp` error paths) and add focused tests.
- [ ] Add interpreter/VM integration tests to hit remaining paths in `src/core/vm.ts`, `src/lang/interpreter.ts`, and `src/core/list.ts` (error branches, guard rails).
- [ ] Re-run coverage; iterate on any modules still <80 %.

### Phase 5 — Wrap-up
- [ ] `yarn lint` and `yarn test` (expecting exit code 0 once branch coverage ≥80 %).
- [ ] Archive plan under `docs/plans/done` with the final coverage summary.

## Success Criteria
- Every module listed above reports ≥80 % branch coverage in Jest summary.
- Global branch coverage ≥80 %; pipeline no longer fails on coverage gate.
- Added tests are deterministic and live alongside existing suites (unit or integration as appropriate).

## Notes & Risks
- Large modules (`core-ops.ts`, `vm.ts`) may require focused harnesses to reach difficult error branches. Prioritise small helpers first for quick gains.
- Coverage improvements must not rely on fragile implementation details; prefer testing via public verbs / exported functions.
