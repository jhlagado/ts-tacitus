# Plan 42: Unified Data Segment (Cautious Migration)

Status: ARCHIVED — moved to docs/plans/done/plan-42-unified-data-segment.md (2025-10-25). Priority: High. Scope: Unify data windows under a single data address space without breaking existing behaviour; migrate consumers incrementally.
Note: This file is a legacy copy kept temporarily for discoverability. The canonical archived version lives under docs/plans/done/.

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

Phase C completion — 2025-10-25

- Runtime and ops now use absolute-only addressing over `SEG_DATA`; legacy window math removed from production paths.
- Lists: legacy wrappers (`getListBounds`, `getListElemAddr`, `computeHeaderAddr`) removed; absolute-only APIs are canonical: `getListBoundsAbs`, `getListElemAddrAbs`, `computeHeaderAddrAbs`.
- Refs: deprecated helpers (`createDataRef`, `decodeDataRef`, `createSegmentRef`, `resolveReference`) removed from runtime; absolute-only helpers retained; `getRefRegionAbs` used for guards.
- Parser guards rely on region strings; no numeric segment checks remain.
- Capsules/global heap: migrated to absolute addresses; compatibility objects kept only where signatures still accept legacy shapes.
- Tests updated to assert behavior or absolute addressing; no segment equality assertions remain. Full suite: 145 passed, 2 skipped; 1350 tests passed, 2 skipped; 1 snapshot passed (macOS, 2025-10-25).

Update 2025-10-25 — Absolute-first list APIs + region strings

- Lists: introduced absolute-first APIs and migrated internals
  - Added `getListBoundsAbs(vm, value)` → `{ header, absBaseAddrBytes, headerAbsAddrBytes }` (no segment/base fields)
  - Added `getListElemAddrAbs(vm, header, headerAbsAddr, logicalIndex)` (returns absolute byte address or -1)
  - Added `computeHeaderAddrAbs(absBaseAddrBytes, slotCount)` for pure-absolute math
  - Kept legacy wrappers for compatibility:
    - `getListBounds` now calls `getListBoundsAbs` and derives `{ segment, baseAddr }` only for legacy callers
    - `getListElemAddr` now converts segment-relative header address → absolute, delegates to `getListElemAddrAbs`, then maps back to segment-relative
  - Outcome: all list traversal/materialization uses `SEG_DATA` + absolute addresses internally; segment math exists only in wrappers (to be removed later)

- Refs: added string-based region classifier for guards, not addressing
  - New: `getRefRegionAbs(ref): 'global' | 'stack' | 'rstack'` (classifies by absolute byte address)
  - Existing: numeric `getRefSegment(ref)` retained for compatibility; now implemented via absolute classification

- Parser: guard checks switched to region strings
  - Replaced numeric segment comparisons with `getRefRegionAbs(ref) === 'global'` for: unknown word DATA_REF handling, `&var` inside functions, and `->` assignment checks
  - No behavior change; readability improved and segment constants fully avoided in parser

- Constants: removed legacy data-window segment constants from runtime
  - Deleted `SEG_STACK`, `SEG_RSTACK`, `SEG_GLOBAL` exports from `constants.ts` (data I/O is `SEG_DATA` only)
  - Memory model (`memory.ts`) already unified on `SEG_DATA` for data I/O; `SEG_CODE/SEG_STRING` remain

- Tests: suite remains green
  - Full compact run: 145 passed, 2 skipped; 1350 tests passed, 2 skipped; 1 snapshot passed (macOS, 2025-10-25)

Post-Phase-C cleanups

- Modernize `pushListToGlobalHeap` to accept an absolute-only source shape (e.g., `{ absBaseAddrBytes, headerAbsAddrBytes, slotCount }`) and remove temporary compatibility objects at call sites.
- Consider removing any remaining legacy classification helpers from public surfaces where not required (keep `getRefRegionAbs` for guards).
- Documentation sweep to remove stale references to `SEG_GLOBAL/SEG_STACK/SEG_RSTACK` outside historical notes.

Progress

- Phase A: COMPLETE
  - Added `SEG_DATA` constant and absolute DATA_REF helpers (`createDataRefAbs`, `decodeDataRefAbs`).
  - Tests added for absolute helpers; full suite remains green.
- Phase B: COMPLETE
  - Exposed VM absolute register fields `sp/rsp/bp/gp` (mapped to internal storage). No behaviour change.
  - VM unified reads/writes for stacks: `push/pop/peek/peekAt`, `rpush/rpop`, and `getStackData` operate via `SEG_DATA` with byte offsets. Tests green.
  - Lists: introduced absolute addressing surface in `getListBounds` (`absBaseAddrBytes`) and migrated `unpack` materialization path to use absolute SEG_DATA reads (no segment-derived base).
  - Select: migrated `createTargetRef` to produce absolute `DATA_REF`s using `vm.sp` and absolute `SEG_DATA` reads; removed segment-derived base math. Existing tests continue to pass (segment classification via decode remains `SEG_STACK` for stack-resident lists).
  - Lists: migrated `elem` to absolute addressing. It now scans using `absBaseAddrBytes` and pushes absolute refs via `createDataRefAbs`. No reliance on segment-derived math.
  - Lists: migrated `slot` to absolute addressing. It computes element absolute address from `absBaseAddrBytes` and returns absolute refs via `createDataRefAbs`.
  - Lists: migrated `fetch` to absolute addressing. It dereferences via absolute byte address and materializes list payload using unified `SEG_DATA` reads.
  - Lists: migrated `store` to absolute addressing in core paths. Simple value writes and compound copy from references now use absolute `SEG_DATA` reads/writes; in-place mutation remains compatible with segment-aware helper.
  - Lists: migrated `head`, `tail`, and `reverse` to absolute addressing for reads/materialization. Stack fast-path behavior (SP adjustments) preserved where applicable.
  - Lists: migrated `concat` materialization for referenced lists to absolute addressing using `absBaseAddrBytes`.
  - Heap ops: migrated `gpeek` and `gpop` to absolute addressing. Both validate references via absolute cell indices and read via unified `SEG_DATA`. `gmark`/`gsweep` already operate on absolute `GP`.
  - Heap: migrated `pushListToGlobalHeap` to accept/use absolute base addresses (`absBaseAddrBytes`) for source reads with fallback to segment+base; writes already used unified `SEG_DATA`.
  - Phase B status: COMPLETE — core consumers and helpers now read/write via absolute addressing; segment-derived math removed from production paths.
  - Phase C kickoff:
    - `load` now dereferences and materializes via absolute addressing (no `resolveReference` or segment-derived bases).
    - Ongoing: progressively replace any remaining uses of `resolveReference` with absolute helpers where feasible.
    - `getListBounds` now dereferences list references via absolute addressing and provides `absBaseAddrBytes`. Legacy `segment/baseAddr` are retained for compatibility but derived from absolute classification.
    - `resolveSlot` (list query path) migrated to absolute-only addressing; it computes absolute addresses and classifies only when returning legacy segment+address pairs.
    - `formatValue` (format-utils) migrated to absolute-only reference resolution: uses `getAbsoluteByteAddressFromRef` and reads via unified `SEG_DATA`. List formatting from memory (`formatListFromMemory`) is now unified as well: it reads list payloads via absolute byte addresses on `SEG_DATA`.
    - `readReference`/`writeReference` migrated to absolute-only addressing: both compute the absolute byte address via `getAbsoluteByteAddressFromRef(ref)` and perform I/O on `SEG_DATA`. `resolveReference` is retained for compatibility and tests that assert segment-address pairs.
    - List query ops: migrated remaining read paths to absolute-only addressing.
      - `walk` now computes element addresses using `absBaseAddrBytes` and reads from `SEG_DATA`; returns absolute refs via `createDataRefAbs` for list cells.
      - `find` reads keys/values via absolute addresses on `SEG_DATA` and returns value references via `createDataRefAbs` (including default branch).
      - `keys`/`values` traverse payload via `SEG_DATA` with absolute addressing.
      - `ref` forms absolute `DATA_REF` handles using `vm.sp` (absolute cell index) and `createDataRefAbs`.
      - `size` traverses payload via absolute addressing using `absBaseAddrBytes` and unified `SEG_DATA` reads. Tests green (2025-10-24).
    - Store path (list refs): migrated write paths to absolute-only addressing.
      - `resolveSlot` now exposes `rootAbsAddr` and `resolvedAbsAddr` for direct writes.
      - Simple value store writes the value to `slot.rootAbsAddr` via `SEG_DATA`.
      - Compound copy targets the absolute header address (`resolvedAbsAddr`) and writes payload+header via `SEG_DATA`.
      - Introduced `updateListInPlaceAbs(vm, targetAbsHeaderAddr)` in `local-vars-transfer.ts` and switched in-place mutation to absolute writes.
      - Legacy `updateListInPlace(vm, targetAddr, segment)` has been removed after migrating tests to the absolute API.
      - Full compact suite green after change (2025-10-24).
    - Capsules: handle creation migrated to absolute references.
      - Constructor exit now pushes an absolute `DATA_REF` handle to the capsule header using `createDataRefAbs(RSTACK_BASE/CELL_SIZE + headerCellIndex)`.
      - Local variable initialization now forms absolute `DATA_REF` for RSTACK-resident lists (compat preserved via `decodeDataRef` classification in tests).
      - All capsule tests green post-migration (2025-10-24).
    - Core ref creators: locals and globals now produce absolute refs.
      - `getVarRef(vm, slot)` creates absolute `DATA_REF` for local slots using `RSTACK_BASE/CELL_SIZE + (BP+slot)`.
      - `createGlobalRef(cellIndex)` creates absolute `DATA_REF` using `GLOBAL_BASE/CELL_SIZE + cellIndex` and validates bounds.
      - Tests that decode and classify still pass (classification maps absolute indices back to expected segments).
    - Builtins (debug): `dumpFrameOp` dereference path migrated to absolute-only addressing for referenced slots (`getAbsoluteByteAddressFromRef` + `SEG_DATA`). Purely affects debug output; no behavior changes.
    - Reference classification helpers migrated to absolute-only logic (2025-10-24):
      - `getRefSegment(ref)` now classifies by absolute byte address ranges (GLOBAL/STACK/RSTACK windows), not by decoding windowed refs.
      - `resolveReference(vm, ref)` now computes absolute byte address and derives segment-relative indices only for legacy callers/tests.
      - Full compact test run green after this change (145 passed, 2 skipped).
    - Parser guards migrated to absolute classification (2025-10-24):
      - Replaced decode-based SEG_GLOBAL checks with `getRefSegment(...) === SEG_GLOBAL` in three sites: unknown word DATA_REF handling, `&var` inside functions, and `->` assignments to globals.
      - No behaviour change; compile-time validation only. Tests remain green.
    - Legacy helper deprecations annotated (2025-10-24):
      - Added `@deprecated` JSDoc on `createDataRef`, `decodeDataRef`, `createSegmentRef`, and `resolveReference` to signal upcoming removal post-flip.
      - No runtime behavior changes; tests continue to use legacy helpers as needed.
    - List ops (structure) segment-branch removal (2025-10-24):
      - `structure-ops` fast paths no longer depend on `SEG_STACK`; they detect direct stack lists via `Tag.LIST` and otherwise materialize via absolute addressing (`SEG_DATA`).
      - Keeps same behavior with simpler absolute logic; prepares for removing legacy segment notions.
    - List ops (builders) segment-branch removal (2025-10-24):
      - `build-ops` (`unpack`) now detects direct stack lists via `Tag.LIST`; reference case materializes via absolute addressing.
      - Removed dependency on `SEG_STACK` in builder path; no behavior change.
    - Ops audit (2025-10-24):
      - Searched for segment-derived branches in ops. Remaining segment checks are semantically required (e.g., global slot handling) and classification for legacy return shapes; all reads/writes use absolute `SEG_DATA`.
      - No further runtime dependencies on segment-derived base math identified.
    - List query ops refinement (2025-10-24):
      - `store` path now uses absolute address window checks for global detection (rootAbsAddr in GLOBAL window) instead of legacy segment labels.
      - Compound copy source now uses `absBaseAddrBytes` exclusively where available; legacy fallback treated as already-absolute.
    - Global heap fallback simplified (2025-10-24):
      - `pushListToGlobalHeap` now uses `absBaseAddrBytes` when provided; fallback treats `baseAddr` as absolute rather than re-deriving from segments.
      - Eliminates segment-derived math in the heap copy source; behavior unchanged for current callers.
    - SEG_RSTACK runtime removal (2025-10-25):
      - Removed `SEG_RSTACK` symbol usage from higher-level runtime modules (`refs`, `list`, `lists/query-ops`); classification uses absolute windows and literal segment id where legacy shapes are required.
      - Comments referencing `SEG_RSTACK` scrubbed; constant remains in `constants.ts` and is used by `memory.ts` and tests only.
      - Marked `SEG_RSTACK` as `@deprecated` in `constants.ts` to signal upcoming removal post test migration.
  - Final flip notes:
    - VM and ops rely exclusively on `sp/rsp/bp/gp` absolute properties and `SEG_DATA` I/O for data.
    - All runtime constructions of `DATA_REF` use absolute creation helpers; tests classify via `getRefRegionAbs` where necessary.
  - Runtime flip: COMPLETE (2025-10-25) — All runtime paths use absolute addressing and unified `SEG_DATA`; no production dependencies on legacy window classification. Deprecated helpers removed from runtime.
  - Tests migration: COMPLETE — Tests rely on absolute helpers (`createDataRefAbs`, `decodeDataRefAbs`, `getAbsoluteByteAddressFromRef`) and behavior-based assertions. No numeric-segment assertions remain; classification uses `getRefRegionAbs` only where required. Full suite green (145 passed, 2 skipped; 1350 tests passed, 2 skipped; 1 snapshot passed on macOS).
