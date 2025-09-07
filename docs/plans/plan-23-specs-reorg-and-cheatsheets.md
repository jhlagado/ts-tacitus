# Plan 23 — Specs Reorg and Memory/Refs Cheatsheets

## Summary

Refocus and streamline the documentation for fast onboarding and LLM-friendly absorption. Add a prominent, authoritative cheatsheet for memory access, refs, load/fetch/store, and locals, and reorganize specs to surface core invariants up front, consolidate overlaps, and remove deprecated patterns. This plan is restart‑safe and contains a concrete change map and phase checklist.

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

## Audit and Target Set

Current core docs:
- vm-architecture.md, tagged.md, lists.md, maplists.md, access.md, refs.md, local-vars.md, stack-operations.md, polymorphic-operations.md, capsules-reified.md, removed-ops.md.
- Orientation: specs/README.md, core-invariants.md.
- Reference: memory-refs-and-assignment-cheatsheet.md, future-enhancements.md.

Target consolidated set:
- Orientation: specs/README.md, core-invariants.md, cheatsheet.
- Deep dives: tagged.md; lists.md (with Maplists folded in); refs.md (with polymorphism folded in); access.md; local-vars.md; vm-architecture.md; stack-operations.md (trimmed) ; removed-ops.md.
- Deprecated: capsules-reified.md moved under docs/deprecated/.

Change map (source → target):
- maplists.md → Fold into lists.md#Maplists; then delete maplists.md.
- polymorphic-operations.md → Fold guidance into refs.md (reference transparency + auto-deref expectations) and core-invariants.md (summary rules); then delete polymorphic-operations.md.
- capsules-reified.md → Move to docs/deprecated/capsules-reified.md with a status preface.
- stack-operations.md → Keep, trim, and link prominently to core-invariants.md.
- Any “tagged-values.md” mentions → tagged.md.

Link update matrix:
- Replace references to maplists.md with lists.md#Maplists.
- Replace references to polymorphic-operations.md with refs.md and/or core-invariants.md.
- Ensure no references to tagged-values.md remain (use tagged.md).
- Prefer “load” over historical “resolve” in normative text; if mentioned, mark as historical.

## Execution Plan

Phase 1 — Add cheatsheet (complete)
- Created `docs/reference/memory-refs-and-assignment-cheatsheet.md` with stack effects and patterns.

Phase 2 — Introduce core-invariants.md (small new doc)
- Extract common invariants from lists.md, refs.md, tagged.md into a concise landing doc; link from each spec.

Phase 3 — Slim and point
- lists.md: move high-level mutation invariants to core-invariants.md and link them; keep representation and ops.
- refs.md: emphasize value-by-default and store materialization; remove verbose repetition; fold polymorphism guidance.
- access.md: tighten `get`/`set` semantics to stress address-returning traversal + store rules; centralize find/bfind/hfind.
- local-vars.md: pull assignment compatibility to the top; add short “locals patterns” and link cheatsheet.

Phase 4 — Cleanup inconsistencies
- README.md: remove LINK reference; correct spec filenames.
- Sweep for “resolve” wording; use “load” consistently.

Phase 5 — Index and navigation
- Add a brief Docs Index section to README or docs/ with entry points:
  - Start here: core-invariants.md, cheatsheet.
  - Deep dives: tagged.md, lists.md, refs.md, access.md, local-vars.md.

Phase 6 — Consolidations (structural changes)
- Fold Maplists into Lists; delete maplists.md; update links (matrix above).
- Fold Polymorphism into Refs; delete polymorphic-operations.md; update links.
- Move Capsules doc to docs/deprecated/ with status note.
- Trim stack-operations.md to a concise primer that defers core rules to core-invariants.md.

Phase 7 — Final link sweep and validation
- Ripgrep for stale links/keywords and fix.
- Ensure specs/README.md + cheatsheet + core-invariants.md form a sufficient onboarding path.

## Acceptance Criteria

- Cheatsheet present and linked from refs.md and local-vars.md.
- Core invariants consolidated; each spec references it near the top.
- README free of LINK references; points to tagged.md (correct filename).
- Any “resolve” → “load” wording standardized in specs.
- No semantic changes; test suite remains guidance-only for these docs changes.

## Guardrails Against Information Loss

- Migrate content first, then delete deprecated files (no content loss).
- Preserve contextual examples where they add clarity; if moved, keep links.
- Experimental/forward-looking material (capsules) preserved under docs/deprecated/.

## Status (checkpoint)

- Completed: cheatsheet, core-invariants, orientation links, initial README cleanup.
- Pending (this plan): Maplists→Lists merge; Polymorphism→Refs merge; Capsules move; Stack-ops trim; final sweep.

## Restart-Safe Checklist

1) Fold Maplists into Lists; delete specs/maplists.md; update links.
2) Fold Polymorphic Operations into Refs; delete specs/polymorphic-operations.md; update links.
3) Move specs/capsules-reified.md → docs/deprecated/ with status note.
4) Trim specs/stack-operations.md and link to core-invariants.md.
5) Ripgrep and fix: `tagged-values.md`, `polymorphic-operations.md`, `maplists.md`, `resolve` (normative) → `load`.
6) Re-check specs/README.md and README.md for a clean “Start here” path.

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
