# Plan 42: Unified Data Segment (Cautious Migration)

Status: Draft-agreed. Priority: High. Scope: Unify data windows under a single data address space without breaking existing behaviour; migrate consumers incrementally.

Goals

- Single logical data space for globals, data stack, and return stack.
- DATA_REF payloads treated as absolute cell indices (authoritative).
- No behaviour changes in Phase A; introduce new APIs alongside old.

Phases

- Phase A (compat layer, zero-break)
  - Add `SEG_DATA` constant (not yet used by existing codepaths).
  - Add absolute helpers in `refs.ts`:
    - `createDataRefAbs(absoluteCellIndex)`
    - `decodeDataRefAbs(ref)` → returns `{ absoluteCellIndex }`
  - Keep existing `createDataRef(segment, cellIndex)` and `decodeDataRef(ref)` intact.
  - No call-site changes. No test changes.

- Phase B (incremental consumers + registers)
  - New features (e.g., dictionary threading) use absolute helpers only.
  - Gradually migrate gpush/global-heap/list bounds/parser to absolute helpers; update tests to assert observable behaviour or absolute indices, not segment IDs.
  - VM registers migration (absolute cells, single address space):
    - Introduce public fields: `sp`, `rsp`, `bp`, `gp` (all absolute cell indices). Keep existing internal storage in sync initially.
    - Keep legacy accessors `SP/RSP/BP/GP` temporarily as shims (depth↔abs), delegating to fields.
    - Migrate VM ops and call sites to use fields directly; bounds checks live inside push/pop/rpush/rpop.
    - Flip tests off accessors; then remove getters/setters and depth semantics.

- Phase C (flip)
  - Memory: collapse `SEG_GLOBAL/SEG_STACK/SEG_RSTACK` into `SEG_DATA` in `memory.ts` I/O. Keep `SEG_CODE/SEG_STRING` as-is.
  - Refs: retire window classification. `createDataRef(cellIndex)` and `decodeDataRef(ref)` operate on absolute indices only.
  - VM: push/pop/rpush/rpop use absolute `sp/rsp` fields and `SEG_DATA` for reads/writes.
  - Call sites: replace any residual segment constants with `SEG_DATA` (lists, heap ops, parser checks, tests).
  - Tests: remove segment equality assertions; assert observable behaviour or absolute indices where needed.

Exit criteria

- Phase A: Builds green, tests green; new helpers available.
- Phase B: Critical consumers migrated; fields `sp/rsp/bp/gp` in use; tests updated; no segment assertions remain in migrated areas.
- Phase C: Old segment notions removed from runtime paths (except `SEG_CODE/SEG_STRING`).

Risk control

- Migrate one area at a time, run full suite after each.
- Keep old helpers until last consumer is migrated.

---

Immediate step (Phase A): add `SEG_DATA` and absolute ref helpers only.

Progress

- Phase A: COMPLETE
  - Added `SEG_DATA` constant and absolute DATA_REF helpers (`createDataRefAbs`, `decodeDataRefAbs`).
  - Tests added for absolute helpers; full suite remains green.
- Phase B: IN PROGRESS
  - Exposed VM absolute register fields `sp/rsp/bp/gp` (mapped to internal storage). No behaviour change.
  - VM unified reads/writes for stacks: `push/pop/peek/peekAt`, `rpush/rpop`, and `getStackData` operate via `SEG_DATA` with byte offsets. Tests green.
  - Lists: introduced absolute addressing surface in `getListBounds` (`absBaseAddrBytes`) and migrated `unpack` materialization path to use absolute SEG_DATA reads (no segment-derived base).
  - Select: migrated `createTargetRef` to produce absolute `DATA_REF`s using `vm.sp` and absolute `SEG_DATA` reads; removed segment-derived base math. Existing tests continue to pass (segment classification via decode remains `SEG_STACK` for stack-resident lists).
  - Lists: migrated `elem` to absolute addressing. It now scans using `absBaseAddrBytes` and pushes absolute refs via `createDataRefAbs`. No reliance on segment-derived math.
  - Lists: migrated `slot` to absolute addressing. It computes element absolute address from `absBaseAddrBytes` and returns absolute refs via `createDataRefAbs`.
  - Lists: migrated `fetch` to absolute addressing. It dereferences via absolute byte address and materializes list payload using unified `SEG_DATA` reads.
  - Lists: migrated `store` to absolute addressing in core paths. Simple value writes and compound copy from references now use absolute `SEG_DATA` reads/writes; in-place mutation remains compatible with segment-aware helper.
  - Next: migrate remaining list helpers/ops (`head/tail/reverse/concat`) to absolute addressing; then convert heap ops (`gpush/gpeek/gpop/gmark/gsweep`) to absolute-only and update tests to assert behaviour/absolute indices (not segment IDs).
