# Plan 27 — Global Segment and GLOBAL_REF

Status: Draft (Phase 1 implemented)
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
- [ ] Bounds & exhaustion: error if `GP + needed > GLOBAL_SIZE/CELL_SIZE`.
- [ ] Reset behavior: ensure `resetVM()` resets `GP` and clears global data if desired.
- [ ] Ref Sigil (&) expansion:
  - [x] Inside functions: `&global` produces `GLOBAL_REF` (implemented).
  - [ ] Top level: allow `&global` (no local frame) to produce `GLOBAL_REF`.
  - [ ] Parser: remove function-only restriction for `&` where applicable; keep error for non-variable names (builtins/code).
  - [ ] Tests: replace “reject &x for non-local variables” with cases asserting `&global` works (function + top-level) and `&word` errors.
- [ ] Docs:
  - [ ] New `globals.md` or section in `local-vars.md` describing syntax, semantics, lifetime, and examples.
  - [ ] Update `refs.md` to reflect implemented GLOBAL_REF.
  - [ ] Note: `+>` remains locals-only; use `value name add -> name` for globals.
- [ ] Tests:
  - [ ] Bracket-path global store (element update).
  - [ ] Compatible vs incompatible compound reassign to global.
  - [ ] Error on global segment exhaustion.

### Phase 3 — Ergonomics & Tooling
- [ ] REPL: globals persist across input lines; add command to list/reset globals.
- [ ] Introspection: print/dump of global segment for debugging.
- [ ] Optional: `const` for immutable top-level bindings (literal folding).

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
