# Tacit List Unification & Migration Plan

## 🎯 ACTIVE — Goal

Remove legacy forward `LIST`/`LINK` completely and unify on a single reverse list structure with header-at-TOS and reversed payload. Syntax uses `(` `)` to construct this structure. Rename RLIST to LIST everywhere (types, tags, ops, formatting, tests, docs). Final state: the only list form in Tacit is "LIST" with reverse layout, built via `(` `)`.

---

## Overview

- Replace all usages of legacy `LIST`/`LINK` with the reverse-list implementation
- Make `(` `)` the constructor for the reverse list (current `[ ]`)
- Remove `[` `]` as syntax (or optionally keep as temporary alias during migration)
- Eliminate `LINK` entirely
- Eliminate `RLIST` tag and rename to `LIST`
- Keep the reverse layout and header-at-TOS semantics
- Preserve stack safety, performance, and memory layout constraints from the existing RLIST spec

---

## Phase 0: Discovery & Impact Analysis

- Status: Planned
- Files to scan
  - `src/core/tagged.ts` — tags, helpers (isList/isRList)
  - `src/ops/*` — list/rlist ops, opcodes, registrations
  - `src/lang/*` — tokenizer, parser, compiler codegen
  - `src/core/format-utils.ts` and `src/ops/builtins-print.ts` — display & printing
  - `src/test/**` — all list/rlist tests, REPL tests
- Outputs
  - Inventory of all references to Tag.LIST, Tag.LINK, Tag.RLIST
  - Inventory of parser/tokenizer handling for `(`, `)`, `[`, `]`
  - Inventory of opcodes and builtins exposed for list/rlist

---

## Phase 1: Syntax Migration (Parser/Tokenizer)

### Step 1.1: Retarget parentheses to reverse list

- Status: Completed
- Parser: map `(` → OpenRList (new OpenList), `)` → CloseRList (new CloseList)
- Tokenizer: ensure `(` and `)` tokens remain unchanged
- Parser: remove/disable `[` and `]` handling
- Update `vm.listDepth` logic to track only the new list boundaries

### Step 1.2: Opcode alignment

- Status: Planned
- Consolidate opcodes so that `Op.OpenList/Op.CloseList` now implement the reverse list construction
- Remove `Op.OpenRList/Op.CloseRList`
- Ensure symbol table defines `(` and `)` to the consolidated builtins

---

## Phase 2: Type/Tag Migration

### Step 2.1: Tag renaming/elimination

- Status: Planned
- Remove `Tag.RLIST`
- Remove `Tag.LINK`
- Make `Tag.LIST` represent the reverse-list header (header-at-TOS)
- Update `MAX_TAG`, `tagNames`, helpers (e.g., `isList`, remove `isRList`)

### Step 2.2: Core utilities rename

- Status: Planned
- `src/core/rlist.ts` → merge content into a new/updated `src/core/list.ts` (or rename file)
- Keep APIs: `createList`, `getListSlotCount`, `skipList`, `getListElementAddress`, `reverseSpan`
- Ensure span traversal correctly interprets nested lists without needing LINK

---

## Phase 3: Builtins & Ops Consolidation

### Step 3.1: Remove legacy forward list ops

- Status: Planned
- Delete/retire `builtins-list.ts` forward list construction
- Remove all LINK-relative behaviors

### Step 3.2: Promote RLIST builtins to LIST builtins

- Status: Planned
- `builtins-rlist.ts` → `builtins-list.ts`
- Expose operations as list operations: `.slot`, `.skip`, `prepend`, `append`, `get-at`, `set-at`
- Ensure names and registrations under `src/ops/builtins-register.ts` point to consolidated ops and `(` `)`

### Step 3.3: VM dispatch updates

- Status: Planned
- Remove dispatch branches for removed opcodes
- Ensure consolidated `OpenList/CloseList` use the reverse-list code path

---

## Phase 4: Display/Printing

### Step 4.1: Formatters

- Status: Completed (RLIST printing path returns `( … )`)
- Update `src/core/format-utils.ts` to treat Tag.LIST as reverse-list header (no LINK handling)
- Remove LINK formatting logic
- Ensure nested lists render with `(` `)`

### Step 4.2: Print ops

- Status: Completed (high-level print shows `( … )` for RLIST)
- Update `src/ops/builtins-print.ts` to only handle the unified list
- Remove LINK-specific pop/skip logic

---

## Phase 5: Tests Migration (NOW)

### Step 5.1: Parser/Compilation tests

- Status: Completed (parentheses construct reverse list)
- Update `[ 1 2 ]` cases to `( 1 2 )`
- Remove tests that assert LINK tag behavior
- Ensure nested cases now reflect header-at-TOS reverse layout

### Step 5.2: Ops/Integration tests

- Status: In Progress
- Convert still-relevant LIST/LINK tests to RLIST semantics:
  - Replace LINK presence checks with RLIST header assertions
  - Update stack layout expectations to RLIST layout (header at TOS; payload below in logical order)
  - Update print expectations to `( … )`
- Skip/Delete LINK-only tests (pointer offsets, mandatory trailing LINK)
- Validate layout invariants (top is header; payload contiguous below header)

### Step 5.3: REPL tests

- Status: Completed (RLIST prints `( … )`)
- Ensure printed output shows `(` `)` for lists
- Remove `[` `]` expectations

### Step 5.4: Performance tests

- Status: Planned
- Keep prepend O(1), append O(s) benchmarks
- Remove forward/list-specific comparisons (now baseline is the unified list)

---

## Phase 6: Code Cleanup

### Step 6.1: Remove dead code

- Status: Planned
- Delete `LINK` logic paths, legacy helpers, unused constants
- Delete `[ ]` parser handling and related symbol registrations

### Step 6.2: Rename files and APIs

- Status: Planned
- Ensure file names and exported identifiers consistently use LIST (not RLIST)
- Update import paths across repo

---

## Phase 7: Documentation & Specs

### Step 7.1: User docs

- Status: Planned
- Update language docs to show `(` `)` for lists
- Remove references to `[ ]`, forward lists, and LINK

### Step 7.2: Architecture/specs

- Status: Planned
- Update list layout spec to header-at-TOS with reversed payload
- Remove LINK sections
- Note performance characteristics

---

## Phase 8: Final Validation & Rollback

### Step 8.1: Validation

- Status: Planned
- `yarn test` full suite
- `yarn lint` and type checks
- Validate memory layout, stack safety, and error messages per spec

### Step 8.2: Rollback Plan

- Status: Planned
- Keep a branch/tag before unification
- Provide a small shim patch to restore `[ ]` parser handling if needed

---

## Stepwise Execution Checklist

- [ ] Phase 0: Discovery completed
- [x] Phase 1: `(` `)` mapped to reverse list; `[` `]` removed
- [ ] Phase 2: Tags consolidated (LIST only), LINK removed
- [ ] Phase 3: Ops unified; VM dispatch updated
- [x] Phase 4: Display/print updated
- [ ] Phase 5: Tests migrated and green (In Progress)
- [ ] Phase 6: Cleanup done
- [ ] Phase 7: Docs/specs updated
- [ ] Phase 8: Final validation green

---

## Risk Notes

- Tag migration can break any code/tests that assume forward LIST+LINK; a complete sweep is required
- Parser changes are user-visible; keep a short-lived alias window for `[` `]` if necessary
- Ensure no hidden dependencies rely on LINK

---

## Next Action

Begin Phase 0: Discovery & Impact Analysis and prepare sweeping edits for Phase 1 & 2 with comprehensive test updates.
