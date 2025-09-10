# RSP Migration Hotspots Report (Post-Removal)

The legacy byte-based `vm.RP` accessor and temporary `vm.RPBytes` shim have been removed. The canonical return stack pointer is `vm.RSP` (cells). Any byte computation should derive `bytes = vm.RSP * CELL_SIZE` only at memory access boundaries.

## Current State
- All code & tests reference `vm.RSP` exclusively.
- Transfer utilities (`local-vars-transfer.ts`) updated to compute header addresses from `vm.RSP`.
- Debug utilities replaced `vm.RP` with derived byte values.

## Rationale
Cell alignment removes ambiguity and eliminates redundant conversions. It also simplifies overlap checks for list fast paths and avoids mixed-unit off-by-one errors in frame handling.

## Migration Steps Completed
1. Refactored operations and tests to use `RSP` cells.
2. Removed `RP` getter/setter and `RPBytes` alias from `VM`.
3. Replaced remaining byte math with explicit `RSP * CELL_SIZE` where necessary.
4. Verified full test suite passes (ensuring no hidden dependencies remained).

## Guidelines Going Forward
- Do not reintroduce a byte-based RP accessor. If a byte value is required in a localized context, compute it inline.
- Prefer documenting stack effects in terms of cells for return stack operations.
- When adding new features touching the return stack, assert cell alignment invariants early.

## Optional Helpers (Deferred)
If repetition grows, consider utility functions:
```ts
export const cellsToBytes = (cells: number) => cells * CELL_SIZE;
export const bytesToCells = (bytes: number) => bytes / CELL_SIZE; // assume validated alignment
```

Currently not needed due to low duplication.

## Historical Note
An earlier scan enumerated 61 usages of `vm.RP`; that list is retained only in version control history for archaeology and was intentionally removed here to reduce noise.

---

End of report.
