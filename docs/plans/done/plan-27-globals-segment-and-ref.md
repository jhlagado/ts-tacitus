# Plan 27 — Global Segment and GLOBAL_REF

Status: Draft (Phases 1–2 complete; no further work scheduled)
Owner: VM + Parser
Last updated: 2025-09-11

## Goals
- Introduce module-scope mutable globals accessible from any function.
- Add a dedicated global segment (SEG_GLOBAL) and implement GLOBAL_REF end-to-end.
- Provide `global` declaration at top level: `value global name`.
- Support assignment to globals: `value -> name` and `value -> name[ … ]`.
- Keep `+>` locals-only (no global increment sugar in Phase 1).

## Non-Goals (Phase 1)
- Namespaced or multi-module globals.
- Persistence across processes or files beyond current VM.
- Advanced GC/compaction of global segment.

## Design Decisions
- Storage: Add `SEG_GLOBAL` with fixed `GLOBAL_SIZE` bump-pointer allocation for compound initializations.
- References: `Tag.GLOBAL_REF` payload is the absolute cell index within `SEG_GLOBAL`.
- Symbol table: Globals are registered via `defineGlobal(name)` and persist across `mark/revert`; lifetime == functions.
- Parsing:
  - `value global name` defines a global and stores the value at runtime.
  - `name` compiles to literal `GLOBAL_REF(slot)` + `Load` (value-by-default); optional bracket path compiles `Select → Load → Nip`.
  - `value -> name` resolves to literal `GLOBAL_REF(slot)` + `Store`.
  - `value -> name[ … ]` compiles `GLOBAL_REF(slot) → Fetch → Select → Nip → Store`.
  - `&name` inside functions produces `GLOBAL_REF(slot)`.
- Compound semantics:
  - First-time compound write into a simple (uninitialized) global slot allocates payload+header in `SEG_GLOBAL`, writes a `GLOBAL_REF(headerCell)` into the slot, and advances the global pointer (`GP`).
  - Subsequent compatible compound writes are in-place, reusing list fast-paths.
  - Bracket-path updates traverse to sub-address via `Select` and then store.

## Phases

### Phase 1 — Minimal Globals (Implemented)
- [x] Add `SEG_GLOBAL`, `GLOBAL_SIZE`.
- [x] Implement `GLOBAL_REF` resolution in `refs.ts`.
- [x] Parser support:
  - [x] `global` declaration at top level.
  - [x] Resolve `name` and `&name` to GLOBAL_REF; support bracket paths.
  - [x] Allow `value -> name` (top-level and inside functions) and `value -> name[ … ]`.
- [x] Store semantics:
  - [x] Initialize compound globals via bump-pointer allocation.
  - [x] Allow in-place compatible updates and cross-segment copies.
- [x] Tests: basic declare/assign/read; GLOBAL_REF fetch; compound init sanity (length check).

### Phase 2 — Hardening, &-Sigil Semantics, and Docs
- [x] Bounds & exhaustion: error when `GP + neededCells > GLOBAL_SIZE / CELL_SIZE` (`initializeGlobalCompound` raises “Global segment exhausted…”; covered by `globals.basic.test.ts`).
- [x] Ref Sigil (&) expansion:
  - [x] Inside functions: `&global` produces `GLOBAL_REF` (implemented).
  - [x] Top level: `&global` now succeeds and is tested (`ref-sigil.test.ts`).
  - [x] Parser: still errors for undefined names / non-variables while allowing globals.
  - [x] Tests updated: coverage for top-level `&global` and rejection of `&word` without locals.
- [x] Docs:
  - [x] Globals documented in `docs/specs/variables-and-refs.md` and learner guide (`docs/learn/local-vars.md`).
  - [x] References overview (`docs/learn/refs.md`) mentions `GLOBAL_REF` behaviour.
  - [x] Explicit reminder that `+>` remains locals-only.
- [x] Tests:
  - [x] Bracket-path global store (element update).
  - [x] Compatible vs incompatible compound reassignment to globals.
  - [x] Error on global segment exhaustion.

## Success Criteria
- Access: `name` and `&name` usable inside functions; bracket paths work.
- Semantics: Compound globals behave like locals with in-place updates and compatibility checks.
- Stability: Full test suite green; new tests cover basic global flows.
- Docs: Clear spec for globals; references spec updated.

## Open Questions
- Namespacing: single global space vs per-module in multi-file future.
- Memory model: bump-pointer sufficient or need free list/compaction.
- Debug UX: user-friendly errors and inspection utilities for globals.

## References
- `src/core/constants.ts`, `src/core/memory.ts`, `src/core/refs.ts` — segment and ref support.
- `src/lang/parser.ts` — `global`, globals in assignment and access.
- `src/ops/lists/query-ops.ts` — store path; compound init for globals.
- Tests: `src/test/lang/globals.basic.test.ts`, `src/test/core/unified-references.test.ts`.
