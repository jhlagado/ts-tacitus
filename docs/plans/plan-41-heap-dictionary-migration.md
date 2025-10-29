# Plan 41: Heap-Backed Dictionary Migration

Status: Draft

Owner: VM/Language

Summary
- Introduce a heap-backed dictionary (single linked list on global heap) and migrate symbol resolution to it without breaking existing code. Keep SymbolTable stable for the parser/compiler while gradually inverting storage to the new dictionary.

Motivation
- Decouple dictionary management from legacy `dictionary-heap` and `symbol-table` coupling.
- Make the global heap the sole storage substrate; dictionary becomes `[prevRef, valueRef, name]`.
- Preserve language semantics (compile-time behavior, no smudge exposure).

Current State
- SymbolTable drives compile-time (builtins registration, colon defs, lookups).
- New dictionary exists as runtime ops only: `define`, `lookup`, `mark`, `forget`.
- VM includes `newDictHead` and reset clears it to `NIL`.

Scope (in-plan)
- Mirror SymbolTable writes into the heap dictionary (non-breaking).
- Add dict-first lookup behind a flag; default off; fallback to SymbolTable map.
- Integrate checkpoint/restore with heap marks; support rewinding `newDictHead`.
- Eventually make SymbolTable a thin facade over the heap dictionary.

Non-Goals
- Remove legacy `dictionary-heap` or change parser tokenization.
- Change language semantics (colon definition timing/visibility remains).

Design
- Entry layout (heap): LIST length 3 → `[prevRef, valueRef, name]`
  - `prevRef`: DATA_REF | NIL to previous entry
  - `valueRef`: DATA_REF to simple or LIST header
  - `name`: STRING (digest index)
- VM state: `vm.newDictHead: number` (DATA_REF | NIL)
- Ops (implemented):
  - `define ( value name — )` → copy if needed; push entry; update `newDictHead`
  - `lookup ( name — ref|NIL )` → traverse by `prevRef` and return `valueRef`
  - `mark ( — ref )`, `forget ( ref — )` → heap marks over `vm.gp`

Migration Phases
- Phase 0: Mirror writes
  - Update SymbolTable `defineBuiltin/define` to also create a heap entry. Source of truth remains SymbolTable.
  - Tests: ensure mirrored entries are discoverable via `lookup` and fetch to same tagged value.

- Phase 1: Dict-first lookup (flagged)
  - Feature flag in `SymbolTable.findTaggedValue(name)` to consult heap dictionary first; fallback to map.
  - Default flag off. Tests for parity with flag off and on.
  - Parser/tokenizer unchanged (still compile to opcodes/addresses).

- Phase 2: Checkpoint/Restore
  - Record a heap mark and head pointer; on restore, `forget` to mark and rewind `newDictHead` to first entry at/before mark (walk via `prevRef`).
  - Tests: checkpoint/restore suites, plus heap-dictionary cases.

- Phase 3: Invert dependency
  - SymbolTable becomes a facade: authoritative storage in heap dictionary; optional in-memory cache for compile-time speed.
  - Confirm colon-definition visibility matches today (no smudge exposure).

- Phase 4: Cleanup
  - Remove legacy coupling once green; deprecate files after confirmation.

Compatibility
- Compile-time should not use runtime `lookup`; continue translating tokens to opcodes/addresses via the SymbolTable facade.
- Redefinition/shadowing remains LIFO; compiled references remain stable.
- Performance: dictionary traversal is O(n); mitigate with a small in-memory cache during compilation if needed.

Risks & Mitigations
- O(n) lookups → cache during compilation.
- Restore consistency → ensure `newDictHead` rewind aligns with `vm.gp` forget.
- DATA_REF stability → values remain address-stable for compiled code.

Acceptance Criteria
- All existing tests pass with mirroring enabled.
- New tests for dict ops, mirroring, and checkpoint/restore pass.
- Dict-first lookup (flag enabled) produces no semantic changes.

Checkpoints
- [ ] Phase 0: mirror writes → heap entries; tests green.
- [ ] Phase 1: dict-first lookup flag; parity tests green.
- [ ] Phase 2: heap-backed checkpoint/restore; tests green.
- [ ] Phase 3: SymbolTable facade; full suite green.

Notes
- Keep `gmark/gsweep` for raw heap; use `mark/forget` for dictionary flows.
- Keep legacy dictionary-heap/symbol-table until final cutover.

Implementation Checklist (Phase 0)
- Code changes
  - Add a private mirror helper in SymbolTable: `mirrorToHeap(name: string, tval: number, vm: VM)` that:
    - Computes `valueRef` without using ops: if `isRef(tval)` keep; if `isList(tval)` deep-copy via `pushListToGlobalHeap`; else copy via `pushSimpleToGlobalHeap`.
    - Builds a 3-cell entry `[prevRef, valueRef, name]` on the data stack, pushes to global heap with `pushListToGlobalHeap`, and updates `vm.newDictHead` to the new header ref.
    - Uses only core APIs (`@core/*`), not runtime ops, to avoid circular deps.
  - Invoke `mirrorToHeap` from:
    - `SymbolTable.defineBuiltin(name, opcode, verb)` using the tagged builtin value.
    - `SymbolTable.define(name, tval)`.
    - The colon-definition completion path (same point where the symbol table inserts the word after body compilation), passing the final tagged code pointer.
  - Guard mirroring behind an internal flag if needed (default on for tests), but do not change lookups.
- Tests (non-breaking)
  - Builtin mirroring: after startup, `'dup lookup fetch` equals the tagged builtin value; dictionary chain not empty.
  - Colon definition: `: inc 1 + ;` mirrors to heap; `'inc lookup fetch` yields a `Tag.CODE` pointer matching SymbolTable’s value.
  - Shadowing: re-defining same name updates head; `lookup` returns latest while previous remains linked via `prevRef`.
  - Reset: `resetVM()` clears `vm.newDictHead` to `NIL` and leaves legacy SymbolTable intact.
  - Heap pressure (optional): ensure mirroring throws or is safely skipped when global heap is exhausted (decide policy; prefer throwing in tests).
- Safety/compat
  - Do not switch `findTaggedValue` to use the heap yet; SymbolTable remains source of truth for lookups.
  - Avoid importing `src/ops/dict.ts` from SymbolTable; keep the mirroring logic local using core helpers.
  - Keep error messages aligned with existing tests; mirroring should not alter compile-time behavior.
