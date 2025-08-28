# Plan 12 — Spec/Implementation Gap Closure

## Executive Summary

Align runtime and language behavior with the specs (tags, access, printing), finish linear address‑returning search and path operations, and add guardrails around locals. This plan uses small, verifiable steps with tests and marks completed items inline.

## Architecture Overview

- Tags: SENTINEL replaces INTEGER; NIL = SENTINEL(0). CODE meta flag distinguishes blocks (lexical) vs functions (new frame).
- Locals: Tag.LOCAL is a symbol‑table (compile‑time) tag; runtime addressing uses RSTACK_REF.
- Access: Provide linear address‑returning find; build get/set atop it. Default key honored. No sorting/indexing in this plan.
- Printing: Normalize to double‑quoted strings; backtick is input shorthand only.

## Implementation Phases

### Phase 1: Tag & Docs Harmonization

#### 1.1 SENTINEL Consolidation (Docs) ✅ COMPLETED
Goal: Replace INTEGER with SENTINEL across specs; NIL = SENTINEL(0); numeric offsets/counters use float32.
Files: docs/specs/tagged.md, docs/specs/maplists.md

#### 1.2 CODE Meta Semantics (Docs) ✅ COMPLETED
Goal: Document meta=1 (block; lexical frame) vs meta=0 (function; new frame) for Tag.CODE.
Files: docs/specs/tagged.md

#### 1.3 Tag.LOCAL Clarification (Docs) ✅ COMPLETED
Goal: Specify Tag.LOCAL is compile‑time only; runtime locals use RSTACK_REF; Tag.LOCAL should not appear at runtime.
Files: docs/specs/tagged.md, docs/specs/local-vars.md

#### 1.4 Memory Sizes in Docs (Docs) ⭕ PENDING
Goal: Remove fixed sizes from specs; describe segment layout generically, implementation‑defined. Keep runtime hardwired for now.
Files: docs/specs/*.md (as applicable)

### Phase 2: Guardrails for Locals ✅ COMPLETED (Scoped Decision)
Decision: Non‑critical at this time. No runtime guardrails added; Tag.LOCAL clarified as compile‑time tag only. Revisit if usage patterns change.

### Phase 3: Linear Address‑Returning Search

#### 3.1 find for Lists (Code+Tests) ⭕ PENDING
Goal: `( list idx — addr|NIL )` return element start address via span‑aware traversal; return STACK_REF/RSTACK_REF accordingly.
Files: src/ops/access-ops.ts or list‑ops additions; tests

#### 3.2 find for Maplists (Code+Tests) ⭕ PENDING
Goal: `( maplist key — value-addr | default-addr | NIL )` linear scan by interned symbol identity; honor `default` key.
Files: src/ops/access-ops.ts; tests

#### 3.3 Conformance Tests (Tests) ⭕ PENDING
Goal: Happy paths, misses, OOB, mixed value types; ensure returned addresses compose with fetch/store.

### Phase 4: get/set on Top of find

#### 4.1 get Traversal (Code+Tests) ⭕ PENDING
Goal: `( target get { path } — value|NIL )` Mixed number/symbol paths; fetch values; NIL on mismatch.

#### 4.2 set Traversal (Code+Tests) ⭕ PENDING
Goal: `( value target set { path } — · )` Store simple values; compound writes require compatibility; silent on mismatch.

#### 4.3 Error/Edge Handling (Tests) ⭕ PENDING
Goal: Default semantics; NIL/silent behavior verified; no throws on misses.

### Phase 5: Printer Normalization

#### 5.1 Double‑Quoted Strings (Code+Tests) ⭕ PENDING
Goal: Print all strings with double quotes. Backtick is input shorthand only, not an output format.

#### 5.2 Nested Lists/Refs (Code+Tests) ⭕ PENDING
Goal: Ensure traversal for printing always drives off LIST headers/spans; verify nested and referenced structures.

#### 5.3 Escapes Coverage (Tests) ⭕ PENDING
Goal: Verify escaping of quotes, backslashes, and control characters.

## Testing Protocol (MANDATORY)

1. Run `yarn test` after every change; block on red.
2. Behavioral tests only for tagged values; do not inspect NaN‑boxing internals in Jest.
3. Use `resetVM()` for isolation; cover NIL/default and error paths.
4. Maintain ≥80% global coverage.

## Risks & Non‑Goals

- No sorting/indexed search in this plan (`mapsort`, `bfind`, `hindex`/`hfind`) — defer to a future plan.
- Keep runtime memory sizes hardwired; only remove fixed sizes from docs.
- Avoid JS‑idioms; use loop‑based, C‑friendly code; no heap structures.
- `GLOBAL_REF` runtime behavior remains unimplemented; must error cleanly.

## Acceptance Criteria

- Tags/docs harmonized (SENTINEL, CODE meta, Tag.LOCAL) — DONE for 1.1–1.3; memory sizes removed from docs.
- Linear `find` for lists and maplists with default semantics; address‑returning and fetch/store composition verified.
- `get`/`set` traverse mixed paths; respect simple/compound + compatibility; NIL/silent rules honored.
- Printers emit quoted strings; nested lists/refs printed correctly with escapes.

## Deferred (Future Plan)

- Sorted‑data features: `mapsort`, `bfind` (binary search), `hindex`/`hfind` (hash lookups).
- Configurable memory layout (design retained; not executed now).

## References

- Specs: lists.md §9–§12, access.md §3–§7, maplists.md §5, §7, §16, polymorphic‑operations.md, tagged.md invariants, stack‑operations.md
- Code hotspots: ops/list-ops.ts, ops/access-ops.ts, ops/print-ops.ts, core/refs.ts, core/tagged.ts, strings/symbol-table.ts
