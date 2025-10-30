# Plan 44A — Dictionary‑Only Symbol System Cutover (Execution Roadmap)

Status: Proposed (complements Plan 44)

Owner: Lang/Core

## Summary

Replace the legacy `SymbolTable` with a function‑only, heap‑backed dictionary API modeled after Forth. The heap list rooted at `vm.newDictHead` is the sole dictionary. All resolution/definition operations become simple functions that read/write entries on the global heap — no JS objects/arrays, no mirrors, no fallbacks.

Relationship to Plan 44: this document is the execution roadmap. Keep Plan 44 for context; Plan 44A supersedes it for day‑to‑day changes and sequencing.

Target behaviors preserved:
- Define builtins and code definitions.
- Define global values via dictionary entries.
- Define locals with a numeric slot counter, scoped via `mark/revert`.
- Look up names for dispatch (BUILTIN/CODE) or values (globals/locals).

Non‑goals: any resurrection of array mirrors, fallback layers, or non‑heap mutation paths.

## Context & Rationale

- Forth‑style dictionary: a singly‑linked list of entries in a bump‑allocated heap; shadowing by prepending; no GC; no parallel state.
- Current repo already has the correct primitives and shapes:
  - Entry layout: `[ prevRef, valueRef, name ] LIST:3` (global heap)
  - Global heap ops: `gpush/gpop/gpeek/gmark/gsweep`
  - Dictionary ops: `define`/`lookup` in `src/ops/dict.ts`
  - Function‑only facade: `src/strings/symbols.ts` (heap‑only)
- The legacy `SymbolTable` adds arrays/fallbacks and local mirrors that we want to remove.

## API Surface Inventory (Current Consumers)

SymbolTable methods used by the app and tests:
- Lookup:
  - `findTaggedValue(name)`
  - `find(name)`
  - `findCodeRef(name)`
  - `findBytecodeAddress(name)`
  - `findEntry(name)` / `findWithImplementation(name)`
- Define:
  - `defineBuiltin(name, opcode, impl?, isImmediate?)`
  - `defineCode(name, addr, isImmediate?)`
  - `defineLocal(name)`
  - `defineSymbol(name, taggedOrRawValue)` (legacy convenience)
- Scope:
  - `mark()` / `revert(cp)`
  - `getLocalCount()` (compile‑time slot tracking)
- Flags (to be removed):
  - `setDictFirstLookup(bool)`
  - `setFallbackEnabled(bool)`

## Replacement Mapping (Dictionary‑Only)

Back end: `src/strings/symbols.ts` (heap‑only, functions‑only) provides or will provide:
- Define builtins: `defineBuiltin(vm, name, opcode, isImmediate?)`
- Define code: `defineCode(vm, name, address, isImmediate?)`
- Define locals: `defineLocal(vm, name)` (uses and advances `vm.localCount`)
- Lookup:
  - `findTaggedValue(vm, name)`
  - `find(vm, name)`
  - `findCodeRef(vm, name)`
  - `findBytecodeAddress(vm, name)`
  - `findEntry(vm, name)` / `findWithImplementation(vm, name)`
- Scoping:
  - `mark(vm): { gp, newDictHead }`
  - `revert(vm, cp)`

Unified define model (single entry point):
- Prefer a single `defineEntry(vm, name, payloadTagged)` for internal callers. `payloadTagged` is the truth:
  - BUILTIN → `Tag.BUILTIN(op[, immediate=1|0])`
  - CODE → `Tag.CODE(address[, immediate=1|0])`
  - LOCAL → `Tag.LOCAL(slot)` (compile‑time only)
  - DATA_REF → points at a cell/header (e.g., global variable)
- Storage rule: entry’s `valueRef` is always a `DATA_REF`. If `payloadTagged` is not a ref, copy it into the heap (one cell for simples, payload+header for lists) and store the resulting ref.

Global values are defined at the language level via `define` and traversed via `lookup` in `src/ops/dict.ts` (kept as is). For programmatic use, callers can store a value by constructing a `[prevRef, valueRef, name]` entry (same as `defineOp`).

Implementation notes:
- Names are interned `STRING` values (digest pointer equality).
- `valueRef` stores a `DATA_REF` to either a simple cell or a LIST header.
- Locals: store `Tag.LOCAL(slot)` as the value at definition time; scope ends on `revert(vm, cp)` which restores `{ gp, newDictHead }` and leaves `vm.localCount` to be reset by the compiler flow.

Immediates (builtins/code):
- Immediate status is encoded via the tag meta bit on `Tag.BUILTIN` and `Tag.CODE`.
- The parser/VM must mask the sign/meta bit when dispatching; helpers construct tags with meta=1 for immediate words.

## Phased Cutover Plan

1) Freeze facade (no new GC state)
- Make `SymbolTable` a thin delegate over `symbols.ts` only.
- Disable fallbacks (`vm.symbolTable.setFallbackEnabled(false)` already done).
- Treat `setDictFirstLookup` as a no‑op and plan removal.

2) Migrate call sites to dictionary‑only functions
- `registerBuiltins` → call `symbols.defineBuiltin(vm, …)`
- Compiler/Parser:
  - Function defs: `symbols.defineCode(vm, name, addr, isImmediate)`
  - Locals (compile‑time only): `symbols.defineLocal(vm, name)`; use `vm.localCount` for slots
  - Scope boundaries: on function start, `const m = symbols.mark(vm)`; on function end (success/fail), `symbols.forget(vm, m)`; compiler resets `vm.localCount` to 0 for the next function.
  - VM symbol resolution:
    - Replace `symbolTable.findTaggedValue(name)` with `symbols.findTaggedValue(vm, name)`

3) Remove facade
- Delete `src/strings/symbol-table.ts` and adjust imports to `symbols.ts`.
- Remove dead flags/toggles and tests referencing them.

4) Clean ups
- Purge any lingering array mirrors or “fallbackDefs/localDefs”.
- Keep dictionary traversal and heap ops as the only source of truth.

## Acceptance Criteria
- No arrays/maps/objects used for runtime symbol state; dictionary chain is the only dictionary.
- Builtins, user code, and locals are present as dictionary entries on the global heap.
- Mark/forget restores only `vm.gp` and `vm.newDictHead` (numeric‑only). We assume mark is taken when the heap top (gp-1) is a dictionary header; forget restores gp and sets head to `gp-1` (or NIL when empty). Compiler resets `vm.localCount` at scope boundaries. Local entries do not outlive the compile scope.
- All lookups resolve by walking the heap chain.
- All tests pass; no toggles/fallbacks remain in the symbol path.

## Tests (Add/Adjust)
- Dictionary traversal: shadowing, malformed entry stop, NIL termination.
- Locals scope: nested `mark/revert`, slot assignment, resolution precedence (locals > globals/builtins where applicable).
- Builtins/code presence in dictionary after registration/definition.
- Global define/lookup via ops (`define`, `lookup`, `fetch`).

Bootstrapping tests:
- Builtins must be loaded early (VM init) via dictionary entries; immediate builtins carry meta=1. Verify presence and dispatch without relying on any SymbolTable arrays or toggles.

## Risks & Mitigations
- Scope regressions → centralize on `{ gp, newDictHead }` checkpoint; add nested scope tests.
- Immediate words → rely on `Tag` meta bit; dispatch remains unchanged.
- Legacy toggle dependencies → remove or replace with deterministic dictionary traversal.

## Open Questions for Owner
- Confirm: we will delete `setDictFirstLookup` and `setFallbackEnabled` rather than re‑implement.
- Confirm: locals are only compile‑time entries and never appear at runtime lookups outside the active compile scope.
- Confirm: VM should expose a simple `resolveSymbol(name)` that delegates to `symbols.findTaggedValue(vm, name)` (or remove this convenience and have callers use `symbols` directly).
- Confirm: any remaining “defineSymbol” convenience is unnecessary; we will use explicit `defineBuiltin/defineCode` and language‑level `define` for globals.

## Timeline (rough)
- Freeze facade: ~0.5–1h
- Caller migration: ~1–2h
- Removal + cleanup: ~1h
