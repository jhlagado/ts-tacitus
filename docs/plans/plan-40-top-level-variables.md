# Plan 40: Heap-Backed Dictionary & Global Variable Overhaul

## Status & Context

- **Stage:** Draft (post-rationalisation with Plan 39 unified arena)
- **Priority:** High — replaces legacy slot-based globals with heap dictionary entries
- **Dependencies:** Plan 39 (unified arena), forthcoming `variables.md` spec rewrite
- **Motivation:** The root-frame global-slot model conflicts with heap residency, shadowing, and dictionary uniformity. We must migrate globals, dictionary storage, and name resolution onto the global heap and prepare for a single `DATA_REF` tag.

## Goals

1. Store all dictionary entries (functions, globals, immediates, transient locals) as first-class lists in the global heap.
2. Represent global variables via dictionary payloads, copying compound values into the heap and keeping references stable.
3. Update the parser, compiler, and runtime to operate on heap-backed dictionary entries instead of slot tables or JS linked lists.
4. Collapse `STACK_REF`, `RSTACK_REF`, and `GLOBAL_REF` into a single `DATA_REF` tag and align downstream work with that unified reference model.

## Non-Goals

- Garbage collection or heap compaction.
- Exposing heap internals directly to user code (inspection tools may arrive later).
- Changing string/code reference tags; they remain distinct segments.

---

## Phase 0 – Data Reference Unification

| Step | Description                                                                                                                 | Status |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0.1  | Audit all consumers of `STACK_REF`, `RSTACK_REF`, and `GLOBAL_REF` to capture segment semantics and edge cases              | ✅     |
| 0.2  | Define unified `DATA_REF` encoding (segment discriminant, bounds checks, mutation rules) and update tagged-value spec draft | ☐      |
| 0.3  | Prototype tagged helpers for constructing/decoding `DATA_REF`; ensure backwards-compatibility shims for legacy tags         | ☐      |
| 0.4  | Publish migration playbook covering parser, runtime, and tests so legacy tags can be retired without breaking isolation     | ☐      |

_Exit criteria:_ Signed-off encoding and migration strategy for `DATA_REF`, including updated specs and helper APIs ready for implementation.

---

### Phase 0.1 Audit Notes (STACK_REF / RSTACK_REF / GLOBAL_REF)

- **Core definitions & helpers**
  - `src/core/tagged.ts` declares the three reference tags and exposes `createLocalRef`. `createSegmentRef` / `resolveReference` in `src/core/refs.ts` are the single point of truth for constructing and decoding refs; each tag maps to a fixed segment (`SEG_STACK`, `SEG_RSTACK`, `SEG_GLOBAL`) with cell-index payloads limited to 0..65535. Bounds checks are enforced per segment before reads/writes.
  - Reference helpers expect absolute _cell indices_ (not byte offsets). All arithmetic converts to bytes via `CELL_SIZE`. Any segment other than `SEG_STACK`/`SEG_RSTACK` currently falls back to `GLOBAL_REF` in `createSegmentRef`.

- **Symbol table & compiler**
  - `src/strings/symbol-table.ts` stores locals as `Tag.LOCAL` payloads and globals as `Tag.GLOBAL_REF` payloads. `emitGlobalDecl`, `emitAssignment`, `emitRefSigil`, and top-level name resolution in `src/lang/parser.ts` emit literal `GLOBAL_REF` values, flow them through `LiteralNumber`, `Fetch`, `Store`, and bracket-path lowering.
  - Local slot access (`VarRef`, `InitVar`, `Reserve`) in `src/ops/builtins.ts` pushes `RSTACK_REF` handles when lists are stored in locals, so downstream ops must tolerate nested refs.

- **Runtime operations**
  - `src/ops/lists/query-ops.ts` is the primary polymorphic consumer. `slot`, `elem`, `walk`, and maplist traversals fabricate refs via `createSegmentRef`, while `fetch`, `load`, and `store` accept any reference tag and rely on `resolveReference`. Global compound initialisation writes a `GLOBAL_REF` back to the dictionary payload and advances `GP` when copying list payloads into `SEG_GLOBAL`.
  - `src/ops/access/select-ops.ts` seeds traversal by manufacturing `STACK_REF` handles for in-stack lists; it preserves existing refs if the target is already a ref.

- **Capsules**
  - Capsule constructors (`exitConstructorOp`) expose the capsule header via `Tag.RSTACK_REF`, and `readCapsuleLayoutFromHandle` expects an `RSTACK_REF` pointing at a LIST header on `SEG_RSTACK`.

- **Tests & diagnostics**
  - `src/test/core/unified-references.test.ts` exercises guards, construction, and `fetchOp` polymorphism for all three tags.
  - Capsule and global-variable integration tests rely on the current tag semantics (`capsule-constructor.basic`, `capsule-dispatch.global-ref`, `globals.basic`). Debug helpers like `dumpFrameOp` walk `RSTACK_REF` payloads when printing locals.

- **Edge cases / gaps**
  - `resolveReference` demands integer payloads and hard-bounds segments at their current fixed sizes (0x0100 bytes). Overflow raises `RangeError`; there is no segment rebasing yet.
  - `createSegmentRef` implicitly treats any non-STACK/return segment as GLOBAL, so a unified tag will need an explicit segment discriminator to avoid misclassification once heap segments proliferate.
  - `createLocalRef` comment still says "Global references are not yet supported" even though `GLOBAL_REF` is partially live; documentation should be updated alongside the DATA_REF spec.

These findings feed directly into Step 0.2 (encoding design) and the subsequent migration playbook.

### Phase 0.2 Encoding Draft (2025-10-18)

- **Tag allocation:** Introduce `Tag.DATA_REF = 9` as the unified runtime reference tag. Legacy `STACK_REF`, `RSTACK_REF`, and `GLOBAL_REF` remain defined temporarily but are marked legacy; new code emits `DATA_REF` only.
- **Payload contract:** Payload stores an absolute cell index across the entire data arena (0 ≤ index < `TOTAL_DATA_BYTES / CELL_SIZE`). No segment bits are embedded in the payload; segment inference occurs via arena boundary comparison.
- **Validation flow:** Updated `resolveReference` performs:
  1. Decode payload → `absoluteCellIndex`.
  2. Compute byte offset `absoluteCellIndex * CELL_SIZE`.
  3. Compare against `[GLOBAL_BASE, STACK_BASE, STACK_TOP, RSTACK_BASE, RSTACK_TOP)` to determine segment. Errors are raised when the index falls outside all data ranges.
- **Segment helpers:** Provide `getDataRefSegment(cellIndex)` returning `{ segment, offset }`, enabling ops to branch without inspecting tag subtypes.
- **Meta bit policy:** Reserve the sign bit for future state (e.g., read-only handles); currently forced to 0 for all `DATA_REF` creation.
- **Compatibility:** During transition, `isRef` treats both legacy tags and `DATA_REF` as truthy. Legacy constructors delegate to `createDataRef` but retain existing names for staged refactors.

### Phase 0.3 Migration Scaffold Outline

- **Creation helpers:**
  - Implement `createDataRef(cellIndex)` and `assertDataRefInSegment(cellIndex, segment)`.
  - Retool `createStackRef`, `createLocalRef`, `createGlobalRef`, and `createSegmentRef` to call shared helpers while emitting deprecation warnings in comments.
- **Resolution helpers:**
  - Introduce `resolveDataRef(vm, ref)` that understands both `DATA_REF` and legacy tags, returning `{ segment, address }`.
  - Update list/capsule operations (`fetch`, `store`, capsule read/write) to rely on the polymorphic resolver without assuming tag identity.
- **Type guards:**
  - Add `isDataRef` and `getRefSegment(ref)` utilities to replace `isStackRef`/`isLocalRef`/`isGlobalRef`. Legacy guards wrap the new helpers until callers migrate.
- **Testing bridge:**
  - Extend `unified-references.test.ts` with `DATA_REF` fixtures while keeping legacy assertions to verify compatibility during rollout.
- **Deprecation plan:**
  - Stage removals: mark legacy tag constants as deprecated in code comments/spec, delete after parser/runtime stop emitting them.

---

## Phase 1 – Contracts & Design Sign-off

| Step | Description                                                                                                             | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| 1.1  | Canonicalise dictionary entry layout (`[payload name prev LIST:3]`) with sign-bit metadata for `IMMEDIATE` and `HIDDEN` | ☐      |
| 1.2  | Define globals: expose `vm.dict` (initialised to `NIL`) as `DICT_HEAD`, plus `GP` bump semantics and shadowing rules    | ☐      |
| 1.3  | Document transient-local lifecycle (mark/revert of `DICT_HEAD` + `GP`)                                                  | ☐      |
| 1.4  | Publish reference taxonomy tying `DATA_REF` back to retained `STRING` / `CODE` tags                                     | ☐      |

_Exit criteria:_ Signed-off spec addendum describing heap dictionary, global payload behaviour, and ref alignment with unified `DATA_REF`.

---

## Phase 2 – Runtime Infrastructure Rewrite

| Step | Description                                                                               | Status |
| ---- | ----------------------------------------------------------------------------------------- | ------ |
| 2.1  | Replace `SymbolTable` JS list with heap-backed dictionary helpers                         | ☐      |
| 2.2  | Implement primitive to push `[payload name prev LIST:3]` into heap and update `DICT_HEAD` | ☐      |
| 2.3  | Introduce mark/revert capturing both `DICT_HEAD` and `GP` for transient entries           | ☐      |
| 2.4  | Provide introspection utility for debugging (optional)                                    | ☐      |

_Exit criteria:_ VM owns a heap-resident dictionary; no runtime relies on JS-linked nodes.

---

## Phase 3 – Locals During Function Definition

| Step | Description                                                                      | Status |
| ---- | -------------------------------------------------------------------------------- | ------ |
| 3.1  | Emit transient dictionary entries for locals (flagged `LOCAL`) during definition | ☐      |
| 3.2  | Ensure slot numbers remain BP-relative and recorded in entry payloads            | ☐      |
| 3.3  | On definition exit, revert `DICT_HEAD`/`GP` to remove transient locals           | ☐      |
| 3.4  | Backfill tests covering nested definitions, shadowing, and cleanup               | ☐      |

_Exit criteria:_ Local lookup uses heap dictionary entries; mark/revert reliably restores pre-definition state.

---

## Phase 4 – Global Variable Storage Semantics

| Step | Description                                                                                                   | Status |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------ |
| 4.1  | Create dictionary entries flagged `GLOBAL` at declaration time                                                | ☐      |
| 4.2  | Runtime initialisation: copy simple values inline; allocate compounds in heap and store `GLOBAL_REF` payloads | ☐      |
| 4.3  | Teach `store`/assignment paths to mutate dictionary payloads (respecting compatibility rules)                 | ☐      |
| 4.4  | Validate shadowing and redeclaration behaviour                                                                | ☐      |

_Exit criteria:_ Globals are heap-backed dictionary entries; no return-stack slots or global slot tables remain.

---

## Phase 5 – Parser & Bytecode Integration

| Step | Description                                                                                 | Status |
| ---- | ------------------------------------------------------------------------------------------- | ------ |
| 5.1  | Rewrite `emitGlobalDecl`, assignment, and `&name` parsing to target heap dictionary entries | ☐      |
| 5.2  | Update bracket-path lowering to operate on dictionary-backed refs                           | ☐      |
| 5.3  | Ensure runtime lookups traverse heap entries via `DICT_HEAD`                                | ☐      |
| 5.4  | Remove legacy root-frame slot machinery                                                     | ☐      |

_Exit criteria:_ All compiler and interpreter paths rely on the heap dictionary abstraction.

---

## Phase 6 – Validation & Tests

| Step | Description                                                                         | Status |
| ---- | ----------------------------------------------------------------------------------- | ------ |
| 6.1  | Add unit tests for dictionary entry creation, shadowing, and payload updates        | ☐      |
| 6.2  | Integration tests for global declarations, compound assignments, and locals cleanup | ☐      |
| 6.3  | Heap inspection tests ensuring layout correctness and `GP` bump discipline          | ☐      |
| 6.4  | Run full suite and capture baseline metrics                                         | ☐      |

_Exit criteria:_ Comprehensive test coverage for heap-backed dictionary and globals.

---

## Phase 7 – Documentation & Tooling

| Step | Description                                                                                                    | Status |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------ |
| 7.1  | Update `variables.md`, `variables-and-refs.md`, `vm-architecture.md`, `lists.md`, and `top-level-variables.md` | ☐      |
| 7.2  | Retire documentation describing return-stack root frames for globals                                           | ☐      |
| 7.3  | Document dictionary inspection workflow (if tooling added)                                                     | ☐      |

_Exit criteria:_ Specs reflect heap dictionary model and announce DATA_REF convergence plan.

---

## Key Considerations

- **Heap residency:** Dictionary entries are immutable lists in the global heap. Payload updates must preserve compatibility rules for compounds (payload copied first, then header).
- **Shadowing:** Prepend-on-redefine; lookup walks via `prev` field starting at `DICT_HEAD`.
- **Dictionary root:** VM exposes `vm.dict` (initially `NIL`) as the dictionary head pointer; all entry insertions update this cell.
- **Transient locals:** Mark/revert must rewind both the dictionary head pointer and any GP allocations performed during definition.
- **Meta flags:** `IMMEDIATE` lives in the sign bit of CODE/BUILTIN payloads; `HIDDEN` lives in the sign bit of STRING names. Dictionary payload lists no longer carry a separate flags slot.
- **Reference roadmap:** Phase 0 drives the shift to `DATA_REF`; keep clear bridge logic so legacy `STACK_REF`/`RSTACK_REF`/`GLOBAL_REF` tags remain documented until the cutover lands.
- **Tooling:** Heap inspectors/debuggers may be necessary to validate entry chain integrity during development.

## Success Criteria

- [ ] Dictionary storage fully heap-backed with no JS-linked nodes.
- [ ] Global variables stored via dictionary payloads; compounds allocated in heap without collisions.
- [ ] Parser, compiler, interpreter operate solely on heap dictionary abstraction.
- [ ] Spec suite updated; root-frame global slot story removed.
- [ ] Tests cover heap layout, shadowing, local cleanup, and global mutations.
- [ ] Unified `DATA_REF` tag implemented with documented migration bridge for legacy references.

## Future Work

- Heap compaction/GC exploration once dictionary migration stabilises.
- Developer tooling for visualising heap dictionaries and debugging reference chains.
- Post-`DATA_REF` clean-up: remove obsolete helpers and consolidate reference APIs.
