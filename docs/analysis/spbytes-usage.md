# `SPBytes` Usage Audit (Phase 5)

_Date:_ 2025-02-14

## Summary
`SPBytes` has been removed from the VM API. All stack manipulation now relies on cell counts (`vm.SP`) with ad-hoc byte arithmetic performed via `CELL_SIZE` where necessary. No source files reference the legacy accessor.

## Next Steps
- None. Future byte-level diagnostics should derive addresses from `vm.SP * CELL_SIZE` directly.
