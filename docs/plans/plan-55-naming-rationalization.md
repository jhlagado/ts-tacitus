# Plan 55 – Naming & Structure Rationalization

## Goals
- Align all documentation, code files, and helper scripts with the style guide’s naming rules (lowercase file names with hyphens, short camelCase identifiers ≤3 syllables, consistent `*Op` suffix for ops).
- Reduce confusion by consolidating tiny single-export files where names no longer reflect their content.
- Eliminate legacy snake_case scripts/tests and ensure all file names match the repo conventions.

## Phase 1 – Documentation & Scripts
1. **Rename top-level markdown/docs**
   - `README.md` → `docs/readme.md` or `readme.md` (lowercase).
   - `STYLE_GUIDE.md` → `docs/style-guide.md` and update all references.
   - `AGENTS.md`, `KNOWN_ISSUES.md`, `ONBOARDING.md`, etc., to lowercase hyphenated forms.
2. **Script cleanup**
   - Move `verify_branch.ts` into `scripts/verify-branch.ts` (hyphenated) or delete if obsolete.
   - Ensure all script names follow lowercase-hyphen pattern.

## Phase 2 – Compiler Factory Rename
1. Rename `createCompilerState` → `makeCompiler` (shortened per guide).
   - Update exports in `src/lang/compiler.ts`.
   - Adjust imports in `src/core/vm.ts`, tests, and helper scripts (e.g., `scripts/verify-branch.ts`).
   - Verify `CompilerState` type exports remain unchanged.

## Phase 3 – Test File Naming
1. Rename snake_case tests to hyphenated names:
   - `src/test/ops/branching_check.test.ts` → `branching-check.test.ts`.
   - Scan for remaining `_` in filenames under `src/test`.
2. Update any `jest` or `ts-jest` references if necessary (most tests glob automatically).

## Phase 4 – Meta/Helper Consolidation
1. Audit `src/lang/meta/*` files that export only one or two verbs (e.g., `case.ts`, `match-with.ts`, `variables.ts`).
   - Merge closely-related files into combined modules (`case-match.ts`, `variables.ts` vs. `stack-vars.ts`) to reduce scattering.
2. Check for lingering `installLangBridgeHandlers`-style names; shorten them to ≤3 syllables (`linkLangBridge`, `setLangBridge`).

## Phase 5 – Follow-Up & Verification
1. Run `yarn lint` and `yarn test` after each phase.
2. Update documentation references (e.g., README hyperlinks) as file names move.
3. Communicate any cross-repo impacts if external scripts depend on renamed files.
