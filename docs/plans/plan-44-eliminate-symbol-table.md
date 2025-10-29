# Plan 44 — Eliminate SymbolTable Class (Forth/C‑style Proxy)

Status: Proposed (Dictionary‑Only)

Owner: Lang/Core

## Context

- The heap‑resident dictionary (linked list rooted at `vm.newDictHead`) is the only dictionary.
- All words (builtins, colon definitions, and scoped locals) are dictionary entries in flat memory.
- No parallel symbol systems, no JS containers; globals (language feature) remain disabled.

## Goals

- Remove the `SymbolTable` class and any JS state for symbol resolution.
- Provide a function‑only facade operating exclusively on the heap dictionary:
  - Entry format (LIST length 3, already used): `[prevRef, valueRef, name]`.
  - Builtins and colon definitions are inserted into the dictionary during initialization/definition.
  - Locals are Tag.LOCAL values added as dictionary entries for the scope and removed via `mark/revert`.
  - mark/revert restores only numeric state: `vm.gp` and `vm.newDictHead`.

## Non‑Goals

- Reintroducing legacy globals or changing the dictionary cell layout.
- Introducing any parallel symbol tables or fallbacks.

## Constraints

- No global state other than numbers; no JS arrays/maps/objects for runtime symbol state.
- Functions only; no classes; no closures; C/Forth‑style flows.
- Keep tests green; provide minimal compat helpers only as pure functions.

## AI Guidance & Porting Constraints (Authoritative)

These rules are mandatory for all work under this plan and future related tasks. They exist to keep the prototype directly portable to C or assembler.

- Only numeric globals
  - Long‑lived state must be numbers (e.g., `vm.gp`, `vm.newDictHead`). No arrays, objects, maps, or sets as globals.

- No GC‑managed runtime structures
  - Do not introduce JS arrays/objects for symbol/runtime state. All dictionary state lives in the heap (SEG_DATA) as numeric cells.
  - Temporary JS values are allowed inside a function body only if they do not escape (not stored globally, not returned, not captured).

- No classes, no closures
  - Prefer plain functions. Do not write closures that capture state. Avoid OO surfaces; use simple, explicit parameters.

- C/Forth‑style code
  - Use straight‑line control flow and simple loops. Avoid deep abstractions, callbacks, or higher‑order utilities.
  - Favor explicit memory operations and tagged values; treat the VM memory as the source of truth.

- Single dictionary
  - The heap‑resident list rooted at `vm.newDictHead` is the only dictionary. All words (BUILTIN, CODE, LOCAL) are entries.
  - No parallel symbol tables or mirrors. Remove any remaining fallbacks incrementally as part of this plan.

- Scope and lifetime
  - Locals are compile‑time constructs represented as Tag.LOCAL entries and scoped via `mark/revert` (numeric restores only).
  - Nothing that is GC‑managed may survive beyond the function call where it was created.

## Reporting Requirements (Process)

To prevent drift into JS‑heavy patterns, all work must follow these reporting rules:

- Pre‑change summary
  - Before non‑trivial edits, append a short note to this plan (or a linked sub‑note) describing: intent, affected files, expected side effects on `gp/newDictHead`.

- Preambles for actions
  - When running commands or changing files, include a concise preamble message describing immediate next actions and why they’re necessary.

- Test discipline
  - Use the fast summary runner by default: `yarn test --silent --coverage=false --verbose=false | egrep '^(Test Suites:|Tests:|Snapshots:|Time:)'`.
  - For focused validation, run only the impacted suites first (e.g., dict, parser, strings) before a full run.

- Progress updates
  - Provide short, high‑signal progress updates (one–two sentences) at logical checkpoints: after implementing functions, after wiring mark/revert, after removing a fallback, etc.

- Change logs in PR description
  - List: what changed, why, impacted invariants (e.g., `gp`, `newDictHead`), any deviations from plan (should be none), and test status.

- Gate on constraints
  - For each change, explicitly confirm adherence to constraints: no new arrays/objects as globals, no classes/closures, functions‑only surface, heap‑only dictionary.

- Call out violations
  - If an unavoidable violation is encountered, stop and request approval with a minimal proposal and rationale. Do not proceed without sign‑off.

## Deliverables

- `src/strings/symbols.ts` (function‑only; heap‑only):
  - `attachVM(vm)`
  - `mark(): { gp, newDictHead }`; `revert(cp)`
  - `defineBuiltin(name, opcode, impl?, isImmediate)` → create dictionary entry on heap
  - `defineCode(name, address, isImmediate)` → create dictionary entry on heap
  - `defineLocal(name)` → Tag.LOCAL entry (slot from `vm.localCount`), lives in dictionary for the scope
  - `findTaggedValue(name)` → traverse heap dictionary and return the resolved tagged value/DATA_REF
  - Minimal compat: `find`, `findCodeRef`, `findBytecodeAddress`, `findEntry`, `findWithImplementation`
- Remove `SymbolTable` class; replace with thin wrappers to functions (single PR). Optional follow‑up to import `symbols.ts` directly.

## Phases

1) Inventory (read‑only)
- Locate all `SymbolTable` method uses and dict fallbacks (e.g., in `src/ops/dict.ts`).

2) Implement function library (heap‑only)
- Create `symbols.ts` with pure functions on `vm.memory` and the dictionary chain (`vm.newDictHead`).
- Implement `define*` composing `[prevRef, valueRef, name]` entries on heap and advancing `vm.newDictHead`.
- Implement `findTaggedValue` by traversing heap only. Remove any JS‑state dependencies.
- Implement `mark/revert` by restoring `{ gp, newDictHead }` exactly.

3) Adapter swap (class removal)
- Replace class with thin wrappers delegating to functions. Remove any redundant state or flags.
- Run focused suites (dict, parser, symbol‑table, heap, capsules).

4) Remove adapter (optional)
- Update imports to function module and delete wrappers.
- Full suite, lint, format.

## Acceptance Criteria

- No JS arrays/maps/objects for runtime symbol state; heap dictionary is the sole dictionary.
- Builtins, CODE, and LOCAL entries are present in the heap dictionary chain.
- `mark/revert` restores only numeric state: `gp` and `newDictHead`.
- All tests pass with no parallel symbol paths remaining.

## Risks & Mitigations

- Immediate execution regressions → immediate builtins via opcode dispatch and tagged meta bit; compat helpers remain pure functions.
- Scoping regressions → restore `{ gp, newDictHead }` exactly; add nested mark/forget tests.
- Residual fallbacks → remove fallbacks to `SymbolTable` in dict ops and elsewhere as part of this plan.

## Test Strategy

- Focused: `yarn test --silent src/test/ops/dict src/test/strings src/test/lang/parser.test.ts`
- Full (trimmed): `yarn test --silent --coverage=false --verbose=false | egrep '^(Test Suites:|Tests:|Snapshots:|Time:)'`

## Timeline

- Phase 2 (library): 1–2 hours
- Phase 3 (adapter swap): ~1 hour
- Phase 4 (adapter removal): ~1 hour (optional)

## Rollback

- Restore the previous class implementation (via adapter) and discard `symbols.ts`. No data migration required.
