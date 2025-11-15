# Plan 55 — Relative Branch Offsets

## Context
- Current branch opcodes (`Op.Branch`, `Op.IfFalseBranch`, etc.) encode absolute 16-bit addresses into bytecode.
- Immediate words (`beginDefinition`, `beginIf`, `beginElse`, `endDefinition`) emit those absolute targets and rely on helper routines that patch them post-emit.
- Moving to signed 16-bit relative offsets would ease code relocation, simplify self-hosting, and align with common VM conventions.
- Work must respect existing specs (`docs/specs/vm-architecture.md`, `docs/specs/tagged.md`) and avoid disrupting other refactors in flight (e.g., Plan 54).

## Objectives
1. Define a relative-branch encoding (signed int16 offset from the instruction following the operand).
2. Update compiler emitters and patch helpers to produce/patch relative offsets.
3. Adjust runtime execution loop to interpret relative offsets correctly.
4. Maintain compatibility with existing bytecode or provide a clear migration path (tests + tooling).

## Current State Snapshot
- `Compiler.compileOpcode` / `compile16` emit absolute branch targets; placeholder patching writes absolute byte addresses.
- VM `executeOp` expects absolute addresses and sets `vm.IP` directly.
- Tests encode expected bytecode assuming absolute addresses.
- Specs mention absolute addressing; no relative variant is described.

## Proposed Phases

### Phase 0 — Design & Spec Update
- Draft the exact definition of the signed offset (e.g., PC-relative with origin at `IP+2` after reading operand).
- Update `docs/specs/vm-architecture.md` to document the new encoding, noting backward incompatibility.
- Decide on migration strategy for existing bytecode snapshots (regenerate vs dual-mode support).

### Phase 1 — Compiler Adjustments
- Introduce helper(s) to compute relative offsets when emitting branch placeholders.
- Update `patchBranchOffset` / `patchPlaceholder` to calculate signed deltas instead of absolute addresses.
- Guard for offset overflow (ensure target within ±32767 bytes of reference).

### Phase 2 — VM Execution Changes
- Modify VM branch handlers to add signed offset to current `IP` rather than overwrite with absolute address.
- Add runtime assertions in debug mode verifying `IP` remains within code segment.
- Ensure `Op.Branch`, `Op.IfFalseBranch`, and any other jump-like opcodes are updated consistently.

### Phase 3 — Test & Tooling Migration
- Regenerate bytecode expectations in tests (Jest suites referencing explicit byte sequences).
- Add targeted tests validating positive/negative offsets and boundary scenarios.
- Provide migration guidance (e.g., script or instructions) for regenerating existing Tacit code images.

### Phase 4 — Cleanup & Compatibility
- Remove obsolete helpers or code paths tied to absolute addressing.
- Update docs/tooling references to highlight the new format.
- Monitor downstream projects for regressions; roll back feature flag if needed.

## Risks & Mitigations
- **Backward incompatibility**: old bytecode becomes invalid. Mitigate by scheduling change after self-hosting groundwork and offering regeneration instructions.
- **Offset overflow**: long functions could exceed ±32KB range. Mitigate with compile-time validation and potential future escape hatch (e.g., long-branch pseudo op).
- **Refactor collision**: avoid landing during immediate-word migration (Plan 54); coordinate sequencing to reduce churn.

## Immediate Next Steps
1. Review specs to ensure relative addressing terminology is clear; prepare draft updates.
2. Inventory all opcodes that jump (`Branch`, `IfFalseBranch`, `Case`, etc.) and confirm they can share the same relative logic.
3. Prototype offset calculation in a scratch branch to validate sign/endianness expectations before widespread changes.

## References
- `docs/specs/vm-architecture.md`
- `src/lang/definitions.ts`, `src/lang/meta/conditionals.ts`
- `src/core/vm.ts` (opcode dispatch)

