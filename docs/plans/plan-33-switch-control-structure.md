# Plan 33 — Immediate `switch/case/default`

## Status
- **State:** Draft
- **Owner:** Tacit control-flow initiative
- **Prerequisites:** Plan 31 (immediate `if/else`) and Plan 32 (brace block removal)

## Goals
1. Add a forward-only, immediate-word driven `switch … case … default … ;` construct suited for Tacit's RPN style.
2. Reuse the existing branch/placeholder discipline (stack-based backpatching) while ensuring each successful case jumps to a common exit target.
3. Provide documentation and tests that cover guard reuse, fall-through prevention, nested switches, and error handling (e.g., stray `case`, missing/duplicate `default`).

## Non-Goals
- Pattern matching or destructuring beyond boolean predicates.
- Fall-through semantics (every case either executes or skips in isolation).
- Compiler optimisations such as jump tables; initial version relies on chained conditional branches.

## Deliverables
- Immediate-word implementations for `switch`, `case`, `of`, `default`, and the shared closer executed by `;`.
- Immediate logic that automatically duplicates the guard for each predicate and drops it once a branch succeeds or the default path executes (no additional VM helpers expected).
- Parser/spec documentation (`docs/specs/drafts/switch-control-flow.md`) describing syntax, lowering, and backpatch strategy.
- Comprehensive test coverage in `src/test/lang` and `src/test/ops/control` validating runtime behaviour and compile-time errors.

## Work Breakdown
1. **Design & Specification**
   - Lock in guard handling via automatic `Dup`/`Drop` insertion, and spell out the meta-context bookkeeping required (`pendingBranch`, `pendingSkip`, `defaultSeen`).
   - Document the expected bytecode sequence for `switch`, each `case`, `default`, and the terminating `;`.

2. **Immediate Word Implementation**
   - Extend `src/lang/meta` with switch-specific immediates, using the stack to carry the exit placeholder, closer, branch placeholders, and skip placeholders while tracking `pendingBranch`/`pendingSkip`/`defaultSeen` in a lightweight meta structure.
   - Ensure `switch` prepares a single exit placeholder patched by the closer; each `case/of` pushes its own skip placeholder that must be patched by the next clause.
   - Ensure `case/of/default` emit the required `Dup`/`Drop` opcodes so the guard lifecycle matches the spec, and raise errors for stray/duplicate/missing clauses by consulting both the stack discipline and the meta context.

3. **Parser & Runtime Wiring**
   - Register the new immediates in `builtins-register` (or equivalent registration point).
   - Add VM/compiler support if new opcodes or helper verbs are required.

4. **Testing**
   - Unit tests for compilation scaffolding (placeholder stack discipline).
   - Integration tests exercising successful case selection, predicate failures cascading to later cases, `default` fallback, nested switches, and error cases (missing `of`, missing `default`, multiple `default`, `case` after `default`, stray `case`, missing `;`).

5. **Documentation**
   - Publish `switch-control-flow` spec and update existing learn/spec guides where conditional control structures are described.
   - Provide migration notes encouraging `switch` usage where multiple `if/else` chains were formerly required.

## Dependencies
- Immediate-word infrastructure from Plan 31.
- Meta stack discipline for conditionals (reused for switch placeholders).

## Open Questions
- Should nested switches share the same guard slot rules, or should we introduce diagnostics when the guard is mutated inside a case body?
- How should diagnostics behave if user code mutates the guard before `default` runs (e.g., should we surface a warning)?

## Timeline (Tentative)
- Week 1: Finalise design + spec.
- Week 2: Implement immediates and helper routines.
- Week 3: Tests + documentation sweep.
