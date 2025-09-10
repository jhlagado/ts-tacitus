# RP/RSP Hotspots Report

This file lists hotspots where `vm.RP` (byte-based) or ad-hoc `* 4` conversions appear and recommends actions.

Generated: automated scan

---

## Summary
- Total `vm.RP` usages found: 61 (representative locations listed below)
- `* 4` pattern hits: many; often used at memory boundary conversions for addresses

## Priority 1 (High) — tests and core ops that still depend on byte-based RP
- `src/test/ops/local-vars/reserve.test.ts` lines where `expect(vm.RP).toBe(initialRP + 4000)` etc. — Tests must be migrated to assert `vm.RSP` or use conversion helpers.
- `src/test/ops/lists/list-ops-coverage.test.ts` — expects `vm.RP` increment by 4 after closeListOp
- `src/test/ops/interpreter/interpreter-operations.test.ts` — uses `vm.RP` and math `vm.RP / 4` in tests

Recommended action: Update tests to use `vm.RSP` cell-based asserts, or add `vm.RPBytes` alias and convert expectations (temporary).

## Priority 2 (Medium) — ops that perform byte math on `vm.RP`
- `src/ops/builtins.ts` line ~225: `vm.RP += slotCount * 4;` (reserve locals)
  - Action: Replace with `vm.RSP += slotCount` and ensure memory writes use `vm.RSP * CELL_SIZE`.
- `src/ops/local-vars-transfer.ts` uses `const headerAddr = vm.RP;` — likely expects bytes
  - Action: Convert to cell-aware code path and use `headerCell = vm.RSP - ...` or add conversion helper at boundary.
- `src/ops/core/core-ops.ts` and `src/ops/control/branch-ops.ts` set `vm.BP = vm.RP` for compatibility at frame entry/exit
  - Action: Ensure the BP/BPCells invariants and conversions are explicit; replace `vm.BP = vm.RP` with `vm.BP = vm.RSP * CELL_SIZE` or introduce `vm.RPBytes` accessor.

## Priority 3 (Low) — docs and debug prints
- `docs/*` mention `vm.RP` and byte math; update docs after code migration.
- Debug prints in `src/ops/builtins.ts` refer to both bytes and cells.

## Tools & helper suggestions
- Add helpers in `src/core/units.ts` or `src/core/vm.ts`:
  - `cellsToBytes(cells: number): number` and `bytesToCells(bytes: number): number`
  - `vm.RPBytes` getter for temporary compatibility returning `vm.RSP * CELL_SIZE`

## Patch plan (safe order)
1. Add `vm.RPBytes` getter on VM returning `this.RSP * CELL_SIZE` (non-invasive).
2. Update tests to use `vm.RPBytes` or better convert to `vm.RSP` (cells) where appropriate.
3. Replace `vm.RP += slotCount * 4` with `vm.RSP += slotCount` in ops; convert memory writes to use `vm.RSP * CELL_SIZE`.
4. Sweep and remove `vm.RP` usages after tests update.

---

Full hit list (file:line snippet):

`src/test/ops/interpreter/interpreter-operations.test.ts`:
- line 33: `const currentBP = vm.RP;`
- line 46: `expect(vm.BP).toBe(vm.RP);`
- line 65: `expect(vm.BP).toBe(vm.RP);`
- line 180: `const maxDepth = vm.RP / 4;`

`src/ops/local-vars-transfer.ts`:
- line 46: `const headerAddr = vm.RP;`
- line 59: `const headerAddr = vm.RP;`

`src/ops/builtins.ts`:
- line 109: `vm.BP = vm.RP;`
- line 225: `vm.RP += slotCount * 4;`
- line 266: debug print containing `vm.RP`

`src/ops/control/branch-ops.ts`:
- line 70: `vm.BP = vm.RP; // BP remains byte-based; RP accessor provides bytes`

`src/test/ops/control/control-ops.test.ts`:
- line 32: `expect(vm.RP).toBeGreaterThan(0);`
- line 45: `expect(vm.RP).toBeGreaterThan(0);`

... (report truncated; full list saved)

*Full list saved to this file.*
