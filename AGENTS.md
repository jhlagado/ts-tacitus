# Repository Guidelines

## Project Structure & Modules
- `src/`: TS sources — `core/` (VM), `ops/` (built-ins), `lang/` (parser/REPL), `strings/`, `utils/`, `cli.ts`.
- `src/test/`: Jest suites per domain with `setupTests.ts`.
- `docs/`: Specs, plans, reference. Specs are authoritative; do not change casually.
- `dist/`: Build output (tsc). Never edit.
- Import aliases: `@core/*`, `@lang/*`, `@ops/*`, `@src/*` (e.g., `import { VM } from '@core/vm'`).

## Dev, Build, Test
- `yarn dev`: Run CLI via ts-node. `yarn start`: run built CLI.
- `yarn build`: Compile to `dist/`. `yarn test`: full Jest run; `test:watch`, `test:coverage` available.
- `yarn lint` then `yarn format`: lint/fix with ESLint + Prettier before finishing changes.
- Policy: run `yarn test` after each implementation step; zero regressions.

## Style & C‑Port Constraints
- TypeScript strict; CommonJS target; 2-space indent; LF EOL.
- Prettier: width 100, single quotes, trailing commas.
- Prefer C-like code: simple loops, fixed-size flows; avoid JS-heavy idioms (`map/filter/reduce`), deep abstractions, and unnecessary closures.
- Keep files focused; avoid new files unless required. Favor alias imports; avoid cycles.

## Testing Guidelines
- Framework: Jest + ts-jest; tests live under `src/test/**/(... ).test.ts` or `.spec.ts`.
- Behavioral testing only for tagged values; avoid `fromTaggedValue` in tests due to NaN-boxing quirks.
- Use `resetVM()` in setup; cover error paths and edge cases.
- Coverage thresholds: 80% global; reports in `coverage/`.

## Agent Workflow (Specs-First)
- Create/update a plan in `docs/plans/` for substantive work; implement incrementally and update as you go.
- Read relevant specs before coding (e.g., `docs/specs/lists.md`, `docs/specs/tagged.md`). Do not modify specs unless asked.
- After each step: run tests, then lint; pause for review if scope is staged.

## Ignore Paths for Learning
- Do not read or learn from these non-authoritative folders:
  - `docs/deprecated/**`
  - `docs/plans/done/**`
  - `docs/specs/drafts/**`
- Current, authoritative sources live under `docs/specs/` and `docs/reference/` as linked by `docs/specs/README.md`.

### Hard Guardrails (Assistant Behavior)
- Do not modify any repository files unless explicitly instructed by the user to do so.
- Never create, edit, or delete files proactively to “help” (e.g., coverage bumps, refactors, test additions) without an explicit request.
- If a task appears to require changes, pause and ask for confirmation with a brief proposal of what you plan to change.
- For read-only or analysis requests, restrict actions to inspection and reporting only.

## Commits & PRs
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Reference specs/plan docs when relevant.
- PRs: clear description, linked issues, behavior screenshots/logs if UI/CLI output changes, and notes on tests/coverage.

## Security & Config Tips
- Don’t commit `dist/`, `coverage/`, or secrets; respect `.gitignore`.
- Tests are excluded from the TypeScript build; runtime code must compile without test-only utilities.
