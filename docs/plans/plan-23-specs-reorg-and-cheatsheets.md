# Plan 23 — Specs Reorg and Memory/Refs Cheatsheets

## Summary

Refocus and streamline the documentation for fast onboarding and LLM-friendly absorption. Add a prominent, authoritative cheatsheet for memory access, refs, load/fetch/store, and locals, and reorganize specs to surface core invariants up front, consolidate overlaps, and remove deprecated patterns.

## Goals

- Provide a compact, canonical entry point for memory/refs/assignment semantics.
- Reduce duplication across specs; move shared invariants into a single “Core Invariants” section linked by all specs.
- Remove or correct outdated references (e.g., LINK metadata; tagged-values.md vs tagged.md) and inconsistencies.
- Make “value-by-default” and “compound compatibility” rules obvious and discoverable.

## Non-Goals

- No semantic changes to the language/VM in this plan.
- No code changes; docs-only reorganization and clarifications.
- No new features; only surfacing and aligning existing behavior.

## Deliverables

1) New cheatsheet (added):
   - docs/reference/memory-refs-and-assignment-cheatsheet.md (done in this PR)

2) Specs reorg (proposed structure):
   - docs/specs/core-invariants.md (new):
     - Reverse list layout and traversal by span.
     - Ref kinds and absolute addressing; value-by-default via load; write materializes source refs.
     - Compound compatibility rule for in-place mutation.
     - Error/sentinel conventions (NIL vs errors).
   - docs/specs/tagged.md (keep):
     - Ensure it references core-invariants.md.
     - Remove lingering mentions of LINK anywhere else; keep runtime tag table authoritative.
   - docs/specs/lists.md (slim/point to core-invariants.md):
     - Keep representation, addressing, traversal, structural ops.
     - Move general mutation rules to core-invariants.md and link back.
   - docs/specs/refs.md (tighten):
     - Emphasize value-by-default model, two-level deref in load, and assignment materialization.
     - Add a short “locals quick guide” and link to cheatsheet.
   - docs/specs/access.md (clarify):
     - Make clear `get`/`set` build on elem/find + fetch/store; `set` only writes simple cells; failure is silent or error per current behavior, documented consistently.
   - docs/specs/local-vars.md (clarify):
     - Surface frame layout diagram and assignment compatibility earlier.
     - Reference cheatsheet for everyday patterns.

3) Deprecated/Outdated cleanup:
   - README.md: remove “LINK metadata” mention; align to current tag set and list invariants.
   - References to docs/specs/tagged-values.md → update to docs/specs/tagged.md.
   - Audit for any residual “resolve” vs “load” naming; standardize on “load”.

## Execution Plan

Phase 1 — Add cheatsheet (complete)
- Created `docs/reference/memory-refs-and-assignment-cheatsheet.md` with stack effects and patterns.

Phase 2 — Introduce core-invariants.md (small new doc)
- Extract common invariants from lists.md, refs.md, tagged.md into a concise landing doc; link from each spec.

Phase 3 — Slim and point
- In lists.md, move high-level mutation invariants to core-invariants.md and link them; keep representation and ops.
- In refs.md, emphasize value-by-default and store materialization; remove verbose repetition.
- In access.md, tighten `get`/`set` semantics to stress address-returning traversal + store rules.
- In local-vars.md, pull assignment compatibility to the top; add short “locals patterns” and link cheatsheet.

Phase 4 — Cleanup inconsistencies
- README.md: remove LINK reference; correct spec filenames.
- Sweep for “resolve” wording; use “load” consistently.

Phase 5 — Index and navigation
- Add a brief Docs Index section to README or docs/ with entry points:
  - Start here: core-invariants.md, cheatsheet.
  - Deep dives: tagged.md, lists.md, refs.md, access.md, local-vars.md.

## Acceptance Criteria

- Cheatsheet present and linked from refs.md and local-vars.md.
- Core invariants consolidated; each spec references it near the top.
- README free of LINK references; points to tagged.md (correct filename).
- Any “resolve” → “load” wording standardized in specs.
- No semantic changes; test suite remains guidance-only for these docs changes.

## Risks & Mitigations

- Risk: Over-consolidation hides necessary details.
  - Mitigation: Keep deep-dive sections intact; only move repeated invariants.
- Risk: Drifts between docs and implementation.
  - Mitigation: Treat cheatsheet and core-invariants.md as canonical and keep them updated when behavior changes.

## References

- docs/specs/lists.md — reverse list representation and traversal
- docs/specs/refs.md — reference kinds and value-by-default model
- docs/specs/access.md — `get`/`set` over elem/find + fetch/store
- docs/specs/local-vars.md — frame, VarRef, assignment compatibility
- docs/specs/tagged.md — runtime tag table and encoding

