# Plan 39: Unified Memory Arena Migration

## Status & Context

- **Stage:** Draft (awaiting review)
- **Priority:** High — prerequisite for segment-agnostic BP and capsule support across globals, data stack, and return stack.
- **Spec References:** `docs/specs/vm-architecture.md`, `docs/specs/capsules.md`, `docs/specs/lists.md`.
- **Background:** Current architecture hard-partitions memory into `SEG_STACK`, `SEG_RSTACK`, and `SEG_GLOBAL`. BP is treated as a plain cell index into `SEG_RSTACK`, which prevents capsules (and other compounds) from living outside that segment without extensive rewrites.

## Goals

1. Collapse the stack/global memory into a single linear arena defined by three adjustable ranges: Globals → Data Stack → Return Stack.
2. Preserve NaN-boxed reference semantics (`STACK_REF`, `RSTACK_REF`, `GLOBAL_REF`) while mapping them onto the unified arena.
3. Keep BP as a simple cell index that remains valid regardless of where capsule payloads reside.
4. Maintain configurability so region boundaries can grow or shrink without invasive code changes.

## Deliverables

- Updated memory constants defining `GLOBAL_BASE/TOP`, `STACK_BASE/TOP`, `RSTACK_BASE/TOP`, and total cell count.
- Refactored `Memory` helpers that resolve addresses against the unified arena.
- Revised reference utilities, VM invariants, and stack/local opcodes that operate on absolute cell indices.
- Updated tests and documentation reflecting the new layout.

---

## Phase 0 – Inventory & Design

| Step | Description | Status |
| ---- | ----------- | ------ |
| 0.1  | Catalogue all usages of `SEG_STACK`, `SEG_RSTACK`, `SEG_GLOBAL`, and any direct segment math. | ✅ |
| 0.2  | Confirm reference tag consumers (lists, buffers, locals, capsules) that will need boundary-aware logic. | ✅ |
| 0.3  | Finalise boundary constants and initial sizing strategy (defaults from existing segment sizes). | ✅ |

_Exit criteria:_ Complete map of affected code paths and agreed boundary definitions.

---

## Phase 1 – Constants & Memory Layer

| Step | Description | Status |
| ---- | ----------- | ------ |
| 1.1  | Introduce `GLOBAL_BASE/TOP`, `STACK_BASE/TOP`, `RSTACK_BASE/TOP`, `TOTAL_CELLS` in `src/core/constants.ts`. | ✅ |
| 1.2  | Rewrite `Memory.resolveAddress` and read/write helpers to use unified boundaries. | ✅ |
| 1.3  | Remove legacy `SEGMENT_TABLE`; keep enum values only as logical labels. | ✅ |

_Exit criteria:_ Memory operations accept absolute cell indices and validate against configurable region bounds.

---

## Phase 2 – Reference Utilities

| Step | Description | Status |
| ---- | ----------- | ------ |
| 2.1  | Update `resolveReference` to translate tag payloads into absolute byte offsets via new bases. | ✅ |
| 2.2  | Adjust `createStackRef` / `createSegmentRef` / `getVarRef` to encode payloads relative to unified ranges. | ✅ |
| 2.3  | Audit list helpers (`getListBounds`, etc.) to ensure boundary-aware resolution. | ✅ |

_Exit criteria:_ All reference helpers return correct addresses regardless of region.

---

## Phase 3 – VM & Runtime Adjustments

| Step | Description | Status |
| ---- | ----------- | ------ |
| 3.1  | Initialise SP, RSP, and GP to their respective bases; update invariants to guard `[BASE, TOP)` ranges. | ☐ |
| 3.2  | Refactor prologue/epilogue sites (`callOp`, `exitOp`, `evalOp`, interpreter, immediate executor) to rely on absolute indices. | ☐ |
| 3.3  | Update locals (`initVarOp`, `dumpFrameOp`, `getVarRef`) and capsule ops to use the new address calculations. | ☐ |

_Exit criteria:_ All stack executions remain correct under unified addressing; BP never leaves the arena.

---

## Phase 4 – Globals & Allocation Utilities

| Step | Description | Status |
| ---- | ----------- | ------ |
| 4.1  | Ensure global allocation helpers respect `GLOBAL_TOP` and adjust bump pointers accordingly. | ☐ |
| 4.2  | Verify capsule copying / list duplication functions operate correctly across the unified ranges. | ☐ |

_Exit criteria:_ Globals and compound allocations coexist safely with the new layout.

---

## Phase 5 – Validation & Documentation

| Step | Description | Status |
| ---- | ----------- | ------ |
| 5.1  | Update unit/integration tests to align with new boundary constants. | ☐ |
| 5.2  | Refresh docs (`vm-architecture`, `capsules`, `lists`) to describe the unified arena. | ☐ |
| 5.3  | Execute full test suite; capture baseline for future regressions. | ☐ |

_Exit criteria:_ Tests green, docs current, ready for downstream BP work.

---

## Risks & Mitigations

- **Boundary misconfiguration:** Introduce assertion helpers validating that bases/tops remain ordered (`GLOBAL_TOP ≤ STACK_BASE ≤ STACK_TOP ≤ RSTACK_BASE ≤ RSTACK_TOP`).
- **Legacy segment assumptions lingering:** Grep-based inventory in Phase 0 must be exhaustive; add temporary lint/test guards to detect old `SEG_*` usage paths.
- **Reference decoding errors:** Add targeted tests for each tag type across region boundaries to catch incorrect base offsets early.

---

## Follow-Up Work

- Revisit BP handling for capsules once the unified arena is in place (expected to be a no-op aside from removing segment juggling).
- Explore dynamic resizing APIs if future plans require runtime-controlled region growth.
