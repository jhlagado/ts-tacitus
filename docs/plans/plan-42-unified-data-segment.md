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

Immediate step (Phase C): continue removing legacy window classification by migrating remaining read paths to absolute helpers and unified `SEG_DATA`.

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
  - Lists: migrated `head`, `tail`, and `reverse` to absolute addressing for reads/materialization. Stack fast-path behavior (SP adjustments) preserved where applicable.
  - Lists: migrated `concat` materialization for referenced lists to absolute addressing using `absBaseAddrBytes`.
  - Heap ops: migrated `gpeek` and `gpop` to absolute addressing. Both validate references via absolute cell indices and read via unified `SEG_DATA`. `gmark`/`gsweep` already operate on absolute `GP`.
  - Heap: migrated `pushListToGlobalHeap` to accept/use absolute base addresses (`absBaseAddrBytes`) for source reads with fallback to segment+base; writes already used unified `SEG_DATA`.
  - Phase B status: COMPLETE — core consumers and helpers now read/write via absolute addressing; segment-derived math remains only for fallbacks and compatibility shims.
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
  - Next (Phase C - flip):
    - Collapse data windows: remove segment-classified reads/writes in remaining helpers; prefer `SEG_DATA` + absolute.
    - Refs: retire window classification (`decodeDataRef` path) and unify on absolute-only helpers once all consumers are updated; keep compatibility shim until final flip.
    - VM: remove legacy accessors/shims if any remain; rely on `sp/rsp/bp/gp` absolute properties fully.
    - Tests: remove any residual segment identity assertions; assert behavior or absolute indices.
    - Immediate next targets (post-2025-10-24):
      - Audit and migrate any remaining runtime constructions of `DATA_REF` to absolute creation helpers; tests may continue to classify refs until final flip. Current status: creators (locals/globals/capsule handles) migrated.
  - Runtime flip: COMPLETE (2025-10-24) — All runtime paths use absolute addressing and unified `SEG_DATA`; no production dependencies on legacy window classification. `decodeDataRef`/`resolveReference` marked `@deprecated` and `@internal` (test-only intent). `SEG_RSTACK` deprecated and removed from higher-level runtime usage.
  - Tests migration: IN PROGRESS — Update tests to rely on absolute helpers (`createDataRefAbs`, `decodeDataRefAbs`, `getAbsoluteByteAddressFromRef`) and observable behavior; then remove legacy classification fields from helpers like `getListBounds`. Once tests stop importing `SEG_RSTACK`, delete the constant and its switch case in `memory.ts`.
    - Audit remaining production `decodeDataRef` usages: COMPLETE (2025-10-24) — none outside definitions; tests still rely on it. Prepare removal in the final flip while keeping tests intact.
    - Audit remaining production `resolveReference` usages: COMPLETE (2025-10-24) — only referenced in tests; runtime no longer depends on it.
    - Identify and remove any remaining segment-derived base math in ops.
      - `local-vars-transfer`: segment-based API fully removed; ensure callers exclusively use absolute addresses.
      - `global-heap`: keep segment classification where semantically meaningful; ensure all reads/writes go through absolute `SEG_DATA`.
    - Once no production code depends on segment classification, plan the final flip to retire `decodeDataRef` and legacy classification fields (e.g., from `getListBounds`).
