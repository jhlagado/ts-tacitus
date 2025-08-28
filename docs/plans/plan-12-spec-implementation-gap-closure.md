# Plan 12 — Spec/Implementation Gap Closure

Status: 🚧 DRAFT — execution pending approval  
Owner: core  
Scope: Align runtime + language behavior with specs (lists, access, tags, refs)

---

## 0. Context & Audit Findings

Deep‑read of `docs/specs/*` and `src/**` identified targeted gaps between the normative specs and current implementation. This plan enumerates those gaps and sequences safe, test‑driven closure steps consistent with C‑port constraints.

---

## 1. Critical Gaps (Spec ⇄ Impl)

- Tags/invariants:
  - Spec defines INTEGER/NIL; code uses Tag.SENTINEL (NIL=0) and Tag.LOCAL. Confirm canonical tag set and migrate names or add adapter constants.
  - `Tag.CODE` meta bit used to distinguish code blocks vs functions; document as spec rule (lexical vs dynamic frames).
- Memory model:
  - Spec: 64KB segmented; impl uses reduced sizes (STACK/RSTACK/STRING/CODE). Validate tests assume small sizes; document prototype deviation and enforce bounds.
- Access combinators (`get`/`set`) and find‑family:
  - `get` supports only single key on maplist; `set` is stub. Missing full path traversal, mixed index/key traversal, and address‑returning `find`/`bfind`/`hfind` behaviors.
  - `mapsort` not exposed; needed to enable `bfind` on sorted maplists.
- Polymorphism & refs:
  - Stack ops are reference‑transparent (as desired). Need audit for all list/capsule ops to dereference via `resolveReference` consistently.
  - `GLOBAL_REF` unimplemented path; ensure graceful errors and future‑proof hooks.
- List invariants:
  - Reverse layout implemented; ensure compatibility rule (type + slot‑count) is enforced everywhere mutating compounds (store, capsule fields).
- Printing/format:
  - Pretty printer relies on nearest LIST header heuristics; verify against spec traversal for nested lists and refs.

---

## 2. Implementation Plan (Phased)

### Phase A — Tags, invariants, and bounds
1. Replace all spec references to INTEGER with SENTINEL; state NIL = SENTINEL(0) and that numeric offsets/counters use float32, not SENTINEL. [Docs-only]
2. Remove fixed memory sizes from specs; document segment layout generically and mark sizes as implementation-defined/configurable. Keep runtime bounds checks. [Docs-only]
3. Document CODE meta semantics (meta=1 block retains frame; meta=0 function creates new frame) in tagged.md. [Docs-only]

Success: tests pass; docs note deviations without behavior change.

### Phase B — Address‑returning search + path traversal (baseline)
1. Implement `find` (lists: elem addr; maplists: key→value addr with default handling) using linear traversal only.
2. Finish `get`/`set`: compile path as list, traverse mixed indices/keys via `find`; `set` writes simple values; compound writes follow compatibility rule; silent failures as specified.

Success: New tests for happy paths, OOB, defaults, and mixed traversal pass.

### Phase C — Polymorphic deref audit
1. Audit list ops for consistent `LIST|REF` handling (slot, elem, fetch, store, head, uncons, concat, reverse, pack/unpack).
2. Ensure `ref`/`unref` round‑trip and nested refs behave per spec; add tests.

Success: Reference matrix tests (STACK_REF/RSTACK_REF) pass; no regressions.

### Phase D — Printing/format alignment
1. Verify pretty printer matches spec traversal on nested lists and refs; adjust heuristics to always drive off LIST headers and spans.
2. Standardize string rendering to double quotes for all Tag.STRING values; treat backtick as input shorthand only, not an output format.
3. Add tests for complex nested/compound structures (including quoted strings with spaces and escapes).

Success: Printer tests stable and spec‑accurate.

### Phase E — Documentation + guardrails
1. Cross‑reference spec sections in code where behavior is normative (no inline prose beyond pointers).
2. Update `AGENTS.md` and `ONBOARDING` references if tag aliasing or command surface expands.

---

## 7. Approved TODO Queue (additions from clarifications)
- A1: SENTINEL consolidation — remove INTEGER from specs; define NIL as SENTINEL(0); note numeric fields use float32. [Docs-only]
- A2: CODE meta documentation — clarify meta semantics in tagged.md (block vs function frames). [Docs-only]
- B1: Maplist key equality — use interned symbol identity (digest address) for symbols and numeric equality for numbers; never compare string content. [Code+Docs]
- B2: Reserve `default` key — implement fallback semantics exactly as spec (return default value address on miss). [Code+Docs]
- D1: Printer normalization — print all strings with double quotes; symbols are strings; backtick is an input shorthand for no-space strings only (do not emit backticks in printers). [Code+Docs+Tests]
- L1: Document Tag.LOCAL as symbol-table/compile-time tag; runtime locals use RSTACK_REF. [Docs-only]
- L2: Disallow @localName — vm.pushSymbolRef on Tag.LOCAL should throw a clear error (locals are not resolvable via @). [Code+Docs+Tests]
- L3: Add tests to ensure @localName is rejected; keep Tag.LOCAL out of runtime polymorphic refs. [Tests]

---

## Deferred (Future Plan)
- Sorted-data features: `mapsort`, `bfind` (binary search), `hindex`/`hfind` (hash index lookups). Capture in a separate plan later.

---

## Phase F — Configurable Memory Layout
Goal: Make segment sizes/layout configurable per hardware/platform; remove hardcoded sizes from runtime API surface.

1. Define `MemoryConfig` interface (segment sizes/order) with sane defaults for tests. [Code]
2. Refactor `constants.ts`/`memory.ts` to consume `MemoryConfig`; replace fixed sizes with config-derived values while preserving segment IDs. [Code]
3. Thread config via VM constructor and CLI (flags/env/file) without breaking existing usage. [Code]
4. Add tests for multiple configs (small/medium/large) verifying bounds, address resolution, and op behavior. [Tests]
5. Update specs/README to describe configuration knobs; remove concrete sizes from docs. [Docs]

Success: Repo docs reflect final behavior; lint/tests green.

---

## 3. Testing Protocol (MANDATORY)
- Run `yarn test` after every step; block on red.
- Behavioral testing only for tagged values (NaN‑boxing caveat); never inspect tags directly in Jest.
- Use `resetVM()` in setup; cover error paths and NIL/default semantics.
- Maintain ≥80% global coverage.

---

## 4. Risks & Non‑Goals
- Do not enlarge segments to 64KB in this pass; keep prototype sizes, enforce bounds, and document.
- Avoid JS‑idioms; use loop‑based, C‑friendly code. No heap‑style structures.
- `GLOBAL_REF` execution is out of scope; ensure graceful errors only.

---

## 5. Acceptance Criteria
- Address‑returning `find`/`bfind`/`hfind` implemented with tests; `mapsort` present.
- `get`/`set` support mixed index/key paths; `set` respects simple/compound rules and compatibility.
- Reference polymorphism audited; `ref`/`unref` round‑trip verified.
- Printer matches spec traversal for nested lists and refs.
- Docs clarify tag naming, meta bit behavior, and prototype memory sizes.

---

## 6. References
- specs: lists.md §9–§12, access.md §3–§7, maplists.md §5, §15–§16, polymorphic‑operations.md, tagged.md invariants, stack‑operations.md
- src hotspots: `ops/list-ops.ts`, `ops/access-ops.ts`, `ops/print-ops.ts`, `core/refs.ts`, `core/tagged.ts`, `strings/symbol-table.ts`
