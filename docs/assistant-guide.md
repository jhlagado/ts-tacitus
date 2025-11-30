# Tacit Assistant Guide

This document consolidates the repo guidelines, AI guardrails, and onboarding notes for anyone working inside Tacit (human or AI). Read it fully before touching the codebase.

## Quick Start Checklist

1. **Read these specs before coding:**
   - `docs/specs/core-invariants.md`
   - `docs/specs/lists.md`
   - `docs/specs/tagged.md`
   - `docs/specs/refs.md` (especially polymorphic ref handling)
   - `docs/specs/access.md`
2. **Skim the architecture overview:** `docs/specs/readme.md`
3. **Understand core files:**
   - VM: `src/core/vm.ts`, `src/core/tagged.ts`, `src/core/list.ts`, `src/core/refs.ts`, `src/core/constants.ts`
   - Ops: `src/ops/**` (list ops, select ops, builtins/opcodes)
   - Strings: `src/strings/digest.ts`
   - Tests: `src/test/utils/vm-test-utils.ts`

## Repository Workflow

- Always create/update a plan in `docs/plans/` for substantive work; update it after each step.
- Read relevant specs **before** implementing changes; specs trump code.
- After each implementation step:
  1. Run `yarn test`
  2. Run `yarn lint`
  3. Update the plan doc with the results
- Zero regression tolerance: work is incomplete until the full suite passes.

## Guardrails

- Do **not** modify files unless explicitly instructed.
- Do **not** add “helpful” files or tests without a request.
- For read-only/analysis requests, report only—no edits.
- Keep names short (≤3 syllables), camelCase for functions/vars, hyphenated lowercase for files.
- No JavaScript-heavy idioms; keep the code C-portable (simple loops, no GC assumptions, no fancy collections).

## Development Rules

### Planning & Execution

1. Specs-first execution: read specs, then write the plan, then code.
2. Reference specs in commits and plan updates.
3. Use concise pseudocode (C-style) when outlining logic; avoid recursion where iterative loops suffice.
4. Maintain stack-effect comments `( before -- after )` on exported ops.

### Testing Protocol (NaN-boxing Safe)

- Behavioral tests only—**never** inspect tag internals (`getTaggedInfo`) inside tests.
- Use `executeTacitCode` and stack comparisons for verification.
- Always `resetVM()` between tests to avoid state bleed.
- Test happy paths plus error paths (underflow, invalid refs, etc.).
- Run `yarn test` after **every** step; `yarn lint` before declaring work complete.
- Keep test output short to preserve AI context: prefer targeted files for quick checks and use quiet flags (`jest --runInBand --silent --reporters default`). Summarize results instead of pasting full logs.

### Naming & Style Essentials

- Ops: short Tacit word + `Op` suffix (`fetchOp`, `printOp`).
- Helpers: ≤3 syllable camelCase (`getListBounds`, `readRef`).
- Files: lowercase with hyphens (`branching-check.test.ts`, `style-guide.md`).
- No verbose suffixes like `FromCode` or `Pure`.

## Change Policy

- Keep files focused; no speculative refactors.
- Do not read from `docs/deprecated/**`, `docs/plans/done/**`, or `docs/specs/drafts/**` for design guidance; use `docs/specs/` and `docs/reference/`.
- Respect `.gitignore`; never commit `dist/`, `coverage/`, or secrets.

## Stack & Memory Reference

- **Lists**: header at TOS, slots are cells, elements are spans; `length` is slot count, `size` is element count.
- **Refs**: use `createSegmentRef`, `resolveReference`, and `fetch` to materialize compounds; always preserve segment correctness.
- **selectOp** pipeline: build a ref, process each path element, maintain stack neutrality per step.

## Key Ops Expectations

- `length`: O(1) slot count, returns -1 for non-lists.
- `size`: O(n) element count via traversal.
- `slot`/`elem`: return refs; NIL on out-of-bounds.
- `fetch`/`store`: ref-aware, enforce compound compatibility.
- `find`: maplist key lookup with optional default.
- `head`/`tail`/`reverse`/`concat`: structural ops preserving element units.
- `ref`/`load`: convert lists to refs and materialize when needed.

## When in Doubt

- Ask for clarification before making assumptions.
- Prefer consolidating docs into this guide rather than adding new markdown files.
- Keep this guide up to date whenever guardrails or onboarding expectations change.
- Avoid “LHS/RHS” language; use “source/destination” instead (Tacit is RPN).
- Default numeric literals to float32; only mention integers when tagging rules require it.
- Pseudocode must look like portable C (structured loops/conditionals, no JS shorthand, no recursion unless necessary).

## Implementation Rules

### Stack Discipline

- Always validate stack depth (`ensureStackSize`) before popping.
- Keep ops stack-neutral when intended; note stack effects explicitly.
- On errors, leave the stack in a predictable state.

### Memory & Tagged Values

- Respect segment boundaries (STACK/RSTACK/CODE/STRING).
- Use tagged helpers for refs and lists; never assume raw addresses.
- No heap allocations; everything lives on stacks or static segments.

### Testing Requirements (recap)
