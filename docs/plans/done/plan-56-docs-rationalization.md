# Plan 56 – Markdown Consolidation & Deletions

## Objective
Aggressively reduce `.md` files outside `docs/specs/**` and `docs/plans/**`, collapsing redundant onboarding/guidance docs into a few maintained entry points. Unless a file is still referenced by the README or recent specs, assume it can be merged or deleted.

## Inventory & Actions

### Repo Root
1. **`readme.md`** – Keep as primary entry point; add links to consolidated guidance (below).
2. **`agents.md`, `claude.md`, `onboarding.md`** – Merge into a single `docs/rules/assistant-guide.md`; delete originals once README points at the new doc.
3. **`known-issues.md`** – Move into `docs/reference/known-issues.md` (under reference); annotate with “active issues” section and delete root copy.
4. **`test-cleanup-analysis.md`, `test-reorganization-plan.md`** – Content is stale; retire by moving salient notes into a new “Test Infra Notes” section inside `docs/testing.md`, then delete files.
5. **`unified-code-reference-design.md`** – Either migrate remaining relevant sections into `docs/reference/code-ref.md` or delete if redundant with specs/tagged docs.

### `docs/` (outside specs/plans)
1. **`style-guide.md` + `naming-guide.md`** – Combine into a single authoritative style guide (`docs/style-guide.md`). Delete `naming-guide.md` once merged.
2. **`PLAN-TEMPLATE.md`** – Move under `docs/plans/plan-template.md` or inline into README; delete from root.
3. **`UNIFY_SIGILS_PROPOSAL.md`** – Archive or delete (superseded by implemented plan). If any actionable TODOs remain, convert into a plan under `docs/plans/draft/`.
4. **`dependency-map.md`, `Tutorial/`, `analysis/`, `forth/`, `rules/`** – Audit contents:
   - Keep `dependency-map.md` only if updated this year; otherwise fold into README “Architecture” section.
   - For `Tutorial/` and `learn/` subtrees, keep only the canonical quick-start doc; delete drafts and move any evergreen content into `docs/learn/readme.md`.
   - `rules/` folder duplicates style/onboarding—merge into `docs/rules/assistant-guide.md` and delete leftovers.
5. **`docs/testing.md`** – Keep as consolidated test guide; ingest the “test cleanup” docs here.

### Scripts / Misc
- Ensure the new consolidated docs are referenced only from README and `docs/specs/readme.md`; scrub all remaining links to deleted files.

## Execution Order
1. Merge assistant/onboarding guidance → `docs/rules/assistant-guide.md`, update README links, delete `agents.md`, `claude.md`, `onboarding.md`.
2. Migrate `known-issues.md` + test cleanup notes into `docs/reference/known-issues.md` and `docs/testing.md`; delete originals.
3. Combine style/naming guides; remove `PLAN-TEMPLATE.md`, archive proposals.
4. Prune `docs/learn/**` drafts and tutorial duplicates, keeping a single curated quick-start doc.
5. Delete `unified-code-reference-design.md` after confirming specs cover the content.
6. Final pass: `rg` for old filenames to ensure no dangling references; run `yarn test`/`yarn lint`.
