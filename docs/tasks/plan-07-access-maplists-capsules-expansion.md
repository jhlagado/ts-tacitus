# Plan 07 — Data Access, Maplists, Capsules & List Completion

Status: 🎯 **ACTIVE** (Step 1)
Owner: core
Scope: Close all currently identified spec–implementation gaps for lists, maplists, access combinators, and capsules; unify error & NIL semantics; remove dead code; prepare ground for future compound types.
Timebox: Iterative (each step individually reviewable). Tests MUST pass after every step.

---

## 0. Reference & Constraints (Quick Index for LLM)

- Specs: `docs/specs/{lists.md,maplists.md,access.md,capsules.md,capsules-implementation.md,stack-operations.md,tagged.md,vm-architecture.md}`
- Current code focal dirs: `src/core`, `src/ops`, `src/lang`, `src/stack`, `src/strings`, `src/test`
- Existing list ops implemented: `slots`, `cons`, `concat`, `tail`, `get-at`, `set-at`, `enlist` (mEnlist)
- Missing (per analysis): `length`, `head`, `tail`, `uncons`, `pack`, `unpack`, `append`, `sort`, `bfind` (list + maplist variants), `find` (polymorphic), `get`, `set`, `mapsort`, `keys`, `values`, `hindex`, `hfind`, capsule system (parser, field offsets, method maplist, with combinator, .method sigil), address-level primitives if desired.
- Dead / unregistered legacy ops in code: `listPrependOp`, `listAppendOp`, `listSkipOp` (verify & remove/rename).
- Unification: Legacy LINK & CODE_BLOCK fully removed across codebase and specs (harmonized). No further action required.
- Sentinel: NIL = `Tag.INTEGER(0)`; design choice: prefer returning NIL (or default value) over throwing for data lookups; keep structural errors (e.g. stack underflow) as exceptions.

---

## 1. Goals

1. Achieve full coverage of list specification: structural + traversal + mutation semantics + advanced algorithms (sort / binary search).
2. Implement maplist layer (key/value pairs) & associated operations with default fallback logic.
3. Implement access combinators (`find`, `bfind`, `hfind`, `get`, `set`) with path traversal semantics.
4. Implement capsules (fields, methods, with combinator, .method dispatch) on top of lists + maplists.
5. Provide hash indexing (hindex/hfind) for scalable maplist lookups.
6. Normalize errors & NIL sentinel usage; unify stack safety patterns.
7. Remove dead legacy code & update docs to eliminate LINK remnants or reclassify historically.
8. Strengthen testing (unit, integration, negative, property style where helpful) matching each spec “testing checklist”.
9. Provide comparator infrastructure (consistent numeric sign protocol) reused by sort / mapsort / bfind.
10. Future‑proof for new compound types via generic span header traversal.

---

## 2. Architecture Principles (Enforced Reminders for LLM)

- Always `vm.ensureStackSize` before reading operands.
- LIST header at TOS, payload contiguous beneath, span = slots + 1.
- Element traversal: simple = 1 slot, compound = span(header) (list currently only compound type).
- Return NIL (INTEGER 0) for soft lookup failures; throw only for structural violations (e.g. malformed header, stack underflow).
- Immutable structure: structural edits create new list except O(1) cons / tail-like head removal via header rewrite.
- In-place mutation only for single-slot simple values.
- Comparators: block returns NUMBER (float); sign of result drives ordering; stable sort expected.
- Binary search requires prior sort with identical comparator.
- Hash index: open addressing, power-of-two capacity, linear probing, NIL sentinel for empty slot.

---

## 3. Stepwise Execution Plan

(Each step: rationale, tasks, acceptance criteria, tests. Only one ACTIVE at a time; mark with 🎯.)

### Step 1 (🎯 ACTIVE) — Baseline Cleanup & Inventory

Rationale: Remove ambiguity & dead code before layering new features (doc harmonization already done; LINK artifacts purged).
Tasks:

1. Confirm which list legacy ops are unregistered (`listPrependOp`, `listAppendOp`, `listSkipOp`).
2. Delete these legacy implementations & any unused exports/imports.
3. (Optional) Add a `LIST_DEV_NOTES.md` summarizing currently exported list ops (skip if redundant with `lists.md`).
4. Insert TODO markers ONLY where functionality is intentionally deferred (sort, bfind) referencing this plan's step numbers (ensure none relate to LINK removal).
5. Add unit test asserting registry does NOT contain deprecated symbols (`prepend`, `append`, `.slot`, `.skip`).
   Acceptance Criteria:

- Build & tests green.
- Symbol table query for removed names yields undefined.
- No remaining code or spec references to LINK / CODE_BLOCK outside historical plan archives.
  Tests:
- New test file `src/test/ops/lists/list-registry-clean.test.ts`.

### Step 2 — List Core Completion (length, head, tail, uncons)

Rationale: Complete basic list algebra before advanced algorithms.
Tasks:

1. Implement ops:
   - `length ( list — n )` traversal element count.
   - `head ( list — value | nil )` returns element 0 or NIL if empty.
   - `tail ( list — list' )` similar to current `drop-head` but keep both (or alias drop-head → tail) — choose canonical name per spec; deprecate `drop-head`.
   - `uncons ( list — tail head )` — NIL head for empty yields `( ) NIL` (ensure empty list creation constant path).
2. Decide naming: Replace `drop-head` with `tail` (keep temporary alias until Step 4 cleanup).
3. Update registry & opcodes if needed (add new enum values OR reuse existing `DropHead` while aliasing name).
4. Tests for all new ops including nested compound first element span.
   Acceptance Criteria:

- O(1) tail/uncons (no full payload copy).
- Element order preserved invariants.
- All new stack effects documented in code comments.
  Tests:
- `src/test/ops/lists/list-structure-basic.test.ts` (covers length/head/tail/uncons) including empty & nested.

### Step 3 — Comparator & Sorting Infrastructure (sort for lists)

Rationale: Provide reusable comparator harness for list and maplist algorithms.
Tasks:

1. Introduce internal utility: `executeComparator(vm, addrA, addrB)` executing comparator block with A then B (stack effect `( A B — r )`).
2. Implement stable list `sort ( list { cmp } — list' )` using e.g. mergesort or insertion for small sizes (avoid recursion depth issues; use iterative bottom-up mergesort working with element spans; ensure entire element (span) moves atomically).
3. Complexity target: O(n log n) comparisons, O(n) auxiliary storage (rebuild list via cons & reverse or arrays of addresses then reconstruct).
4. Add tests for numeric ascending/descending, stability with equal keys, compound element comparisons (e.g. length-based comparator).
5. Document comparator contract & error handling (non-number result = NIL or error? Choose sentinel error – raise descriptive error; spec suggests error/sentinel). Decide consistent approach (throw structural error for invalid comparator output).
   Acceptance Criteria:

- sort stable & returns new list (original unchanged).
- Comparator always restored stack cleanliness (no leaks).
- Verified for empty, singleton, already sorted, reverse sorted, ties.
  Tests:
- `src/test/ops/lists/list-sort.test.ts`.

### Step 4 — Binary Search on Lists (bfind)

Rationale: Enable efficient lookups post-sort.
Tasks:

1. Implement `bfind ( list key bfind { cmp } — addr | nil )` respecting comparator `( key elem — r )`.
2. Key: Use element traversal building an index of element start addresses or performing on-the-fly mid selection (need element count = length; compute once).
3. Return element start address (list-relative stack address? or copy element?). Spec: returns address; since current address model not public, choose to return element value directly for now OR introduce address tagging. Prefer returning the element value (consistent with existing get-at). Document deviation until address primitives implemented (will adjust in Step 9).
4. NIL if not found.
5. Tests with sorted list; verify first-equal (lower_bound) behavior with duplicates.
   Acceptance Criteria:

- Log2 search steps (#comparisons) validated for sample sizes.
  Tests:
- `src/test/ops/lists/list-bfind.test.ts`.

### Step 5 — Maplist Core (Structure, find, keys, values)

Rationale: Provide associative semantics atop lists.
Tasks:

1. Define structural validator: even payload slots required (key/value pairs).
2. Implement linear `find ( maplist key — addr | default-addr | nil )` (first pair match) with `default` fallback.
3. Implement `keys ( maplist — listOfKeys )`, `values ( maplist — listOfValues )` preserving order.
4. Decide representation: maplist is a normal list; enforcement done at op entry (validate even slots).
5. Introduce helper to iterate pairs (span aware for compound values as values — keys MUST be single-slot simple per spec recommendation; enforce simple or allow compound? Accept simple only for performance; error otherwise).
6. Update docs if deviation.
7. Tests: missing key + default, missing key no default (NIL), duplicate key chooses first.
   Acceptance Criteria:

- All operations leave original maplist unchanged (pure reads).
  Tests:
- `src/test/ops/maplists/maplist-basic.test.ts`.

### Step 6 — Maplist Sorting (mapsort) & bfind for maplists

Rationale: Sorting & binary search of keys.
Tasks:

1. Implement `mapsort ( maplist { kcmp } — maplist' )` stable; pair = atomic unit.
2. Implement `bfind ( maplist key bfind { kcmp } — addr | nil )` returning value element address per spec; require pre-sorted order.
3. Reuse comparator infra; comparator `( k1 k2 — r )`.
4. Tests: sorted order, stability, duplicates (lower_bound), unsorted precondition (document undefined / optional validation via single pass check flag – skip for performance).
   Acceptance Criteria:

- All pairs preserved; only order changes.
  Tests:
- `src/test/ops/maplists/maplist-sort-bfind.test.ts`.

### Step 7 — Hash Index & hfind

Rationale: O(1) average lookup for larger maplists.
Tasks:

1. Define `hindex ( maplist [capacity] hindex — index )` capacity optional (default: next power-of-two ≥ 2 \* pairCount).
2. Index layout: `( LIST: ( meta? ) entries ... )` or simply a list of slots length=capacity\*2 storing `( keyId offset )` pairs with NIL for empty keyId; also store optional default offset separately (e.g., trailing two slots). Keep simple; document layout in inline comment & new spec addendum.
3. Key identity: For symbols, use interned digest index; for integers/numbers: their 16-bit value (coerce). Restrict keys to symbols & integers for hashed path first iteration.
4. `hfind ( maplist index key — addr | default-addr | nil )`: compute identity, mask, linear probe.
5. Rebuild index invalid if maplist mutated (structurally impossible) — treat index as ephemeral; no validation beyond basic shape.
6. Tests: collisions, load factor, fallback to default key, missing key.
   Acceptance Criteria:

- Probe sequence length bounded reasonably (< capacity) for test sets.
  Tests:
- `src/test/ops/maplists/maplist-hash.test.ts`.

### Step 8 — Unified Polymorphic find Wrapper

Rationale: Provide single entry aligning with Access spec.
Tasks:

1. Implement top-level `find` opcode dispatching:
   - If key is number & target list → element value (or NIL)
   - If key is symbol & target maplist → maplist find behavior
   - Else NIL.
2. Integrate into access combinators later.
3. Tests for each branch & negative types.
   Acceptance Criteria:

- Behavior consistent with underlying primitives.
  Tests:
- Extend `maplist-basic` + new `list-find-polymorphic.test.ts`.

### Step 9 — Address Model Abstraction (Optional Foundation)

Rationale: Prepare for fetch/store & future advanced path operations consistent with specs.
Tasks:

1. Introduce lightweight "address" tagged abstraction? (Option A) Add new Tag e.g. ADDRESS (requires tagged spec update). (Option B) Reuse INTEGER raw stack slot address (simpler). Choose Option B for minimal change.
2. Implement internal ops: `elem ( list idx — addr | nil )`, `slot ( list idx — addr | nil )` returning stack byte address (SP-relative) encoded as INTEGER; validate bounds.
3. Implement `fetch ( list addr — value | nil )` & `store ( list value addr — ok | nil )` with simple-only safety.
4. Adjust relevant higher-level ops (optional) to use them; keep existing direct forms for compatibility.
5. Tests verifying addresses stable while list structure unchanged.
   Acceptance Criteria:

- No structural mutation from store on compound targets.
  Tests:
- `src/test/ops/lists/list-address.test.ts`.

### Step 10 — Access Combinators get / set

Rationale: Provide path-based uniform traversal.
Tasks:

1. Parser: add `get` & `set` as words expecting a following `{ ... }` block producing path list.
2. Implement runtime ops:
   - `get ( target pathList — value | nil )` executed by combinator helper (parser pushes path list via code block exec then calls op) OR direct form `target get { ... }` compile pattern: evaluate path block (result path list on stack) then call get.
   - `set ( value target pathList — ok | nil )` similar pattern.
3. Path traversal logic using polymorphic find for each segment.
4. Edge cases: empty path returns target (`get`), `set` empty path overwrites only if simple atom (decide to disallow; return nil) — specify.
5. Tests for mixed numeric+symbol paths, failures mid-path, default fallback usage for maplist keys.
   Acceptance Criteria:

- No stack leaks (final stack effect matches spec strictly).
  Tests:
- `src/test/ops/access/access-get-set.test.ts`.

### Step 11 — Capsules: Parser & Field Offsets

Rationale: Introduce capsule definition core.
Tasks:

1. Parser additions: `capsule <name>` ... `end` similar to colon but multi-phase.
2. Track field declarations: `<value> field <symbol>`; store sequential element offset (starting at 1; element 0 reserved for method maplist).
3. Method definitions inside capsule (`: name ... ;`) compile with field symbol resolution to receiver offset operations (placeholders if get/set not yet address-based — use internal synthesized get/set ops with receiver + offset).
4. Store prototype components until `end` assembles list: `( ( method-name @code ... ) field1 field2 ... )` and registers capsule name as code reference (constructor) OR direct prototype value (decide: register colon definition that pushes a copy; Step 12 will define instantiation semantics).
5. Tests verifying offsets, field read resolution.
   Acceptance Criteria:

- Field reference inside method compiles to explicit receiver + offset load.
  Tests:
- `src/test/ops/capsules/capsule-define-basic.test.ts`.

### Step 12 — Capsules: with Combinator & .method Dispatch

Rationale: Provide ergonomic method invocation.
Tasks:

1. Implement `with` combinator: `( capsule with { ... } — capsule )` keeps receiver on stack.
2. Introduce tokenizer / parser support for `.identifier` sigil (method call) inside with-block context.
3. Dispatch algorithm: look up method name in element 0 maplist (linear search or mapsort + bfind optional; keep linear initially). Use `eval` on code reference.
4. Support default method fallback (`default` key).
5. Nested with blocks: maintain receiver stack (linked list or simple saved register + stack depth guard).
6. Tests: nested with, unknown method fallback, default method, receiver preservation.
   Acceptance Criteria:

- Receiver unchanged after block.
  Tests:
- `src/test/ops/capsules/capsule-with-dispatch.test.ts`.

### Step 13 — Capsules: Field Mutation & Assignment Operator

Rationale: In-place updates of simple fields.
Tasks:

1. Introduce `->` assignment parsing inside capsule methods (value field-name). Parser transforms into store using receiver + offset.
2. Validate simple-only mutation; compound field assignment no-op returns NIL or ignore (document consistent choice: return ok only on success else nil).
3. Tests assignment flows.
   Acceptance Criteria:

- Attempting to assign compound leaves structure unchanged.
  Tests:
- Extend previous capsule tests + new `capsule-field-assignment.test.ts`.

### Step 14 — Documentation Synchronization

Rationale: Keep specs authoritative.
Tasks:

1. Update `lists.md` removing/archiving LINK mentions & adding new ops (length, head, tail, uncons, sort, bfind).
2. Update `maplists.md` marking which advanced variants implemented (hindex/hfind) & limitations (key type constraints) + address model note.
3. Update `access.md` with any deviations (address vs value returns) & finalize semantics for empty path in set.
4. Update `capsules.md` and implementation doc reflecting actual parser & opcode names.
5. Add cross-reference tables from user words to stack effects.
   Acceptance Criteria:

- All doc changes link to plan step numbers.
  Tests: (Docs lint optional; not required.)

### Step 15 — Error & NIL Semantics Harmonization

Rationale: Consistent developer experience.
Tasks:

1. Audit new ops: ensure soft lookup failures => NIL, structural misuse => descriptive throw.
2. Add helper `softFail(vm)` returning NIL.
3. Adjust earlier ops (get-at / set-at) to match semantics if divergences.
4. Add test matrix enumerating failure modes vs expected NIL/throw.
   Acceptance Criteria:

- Matrix test passes.
  Tests:
- `src/test/ops/errors/error-semantics.test.ts`.

### Step 16 — Performance & Regression Benchmarks

Rationale: Guard against algorithmic regressions.
Tasks:

1. Add perf tests (coarse) for sort (n=1k), bfind vs linear find, hfind vs find (≥200 entries), with dispatch overhead.
2. Track timing thresholds (non-binding but printed) — ensure test asserts only functional correctness.
   Acceptance Criteria:

- Perf tests run & produce metrics; no functional failures.
  Tests:
- `src/test/performance/data-structures-perf.test.ts`.

### Step 17 — Final Cleanup & Acceptance

Rationale: Ship quality baseline.
Tasks:

1. Remove deprecated aliases (`drop-head` if replaced by tail, etc.).
2. Remove TODO markers introduced earlier.
3. Ensure opcode enum comments updated.
4. Run full test + coverage review (keep ≥ prior coverage).
5. Update `docs/reference/known-issues.md` with any deferred items.
   Acceptance Criteria:

- All steps boxes ticked; tests green; docs synchronized.

---

## 4. Tracking Table (Tick as Completed)

- [ ] 1 Cleanup & Inventory
- [ ] 2 List Core Completion
- [ ] 3 List Sorting
- [ ] 4 List Binary Search
- [ ] 5 Maplist Core
- [ ] 6 Maplist Sorting & bfind
- [ ] 7 Hash Index
- [ ] 8 Polymorphic find
- [ ] 9 Address Model
- [ ] 10 Access Combinators
- [ ] 11 Capsules Definitions
- [ ] 12 Capsules Dispatch
- [ ] 13 Capsule Field Mutation
- [ ] 14 Docs Sync
- [ ] 15 Error Semantics
- [ ] 16 Performance Benchmarks
- [ ] 17 Final Cleanup

---

## 5. Testing Strategy Summary

For each op:

- Happy path, boundary (empty / singleton / nested), error path (wrong type, OOB), stability (sort), idempotence where relevant.
- Introduce helper builders in `test/list-utils.ts` for constructing nested lists & maplists.
- Use `resetVM()` in `beforeEach` per AI guidelines.

---

## 6. Risk & Mitigation

| Risk                      | Impact                 | Mitigation                                                       |
| ------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Comparator stack leaks    | Incorrect later ops    | Strict pre/post stack depth assertion in tests                   |
| Address model confusion   | Hard to refactor later | Isolate in one module `src/core/address.ts` (if created)         |
| Capsule parser complexity | Syntax errors          | Incremental: first fields+methods, then with/.method             |
| Hash index misuse         | Incorrect lookups      | Store maplist slot count inside index for rudimentary validation |
| Performance regressions   | Slow operations        | Add simple benchmarks before & after major steps                 |

---

## 7. Deviation Log (Populate During Work)

Record any intentional deviation from spec with rationale & test references.

---

## 8. Completion Definition

Plan complete when: All tracking table items checked, tests & coverage meet prior baseline, docs synced, no dead code or obsolete symbols remain, and NIL/error semantics table passes.

---

## 9. Immediate Next Action (for LLM)

Proceed with Step 1: locate and remove dead legacy list ops, add registry cleanliness test, doc sync note placeholders. Request user approval after Step 1 diff & green tests before advancing.
