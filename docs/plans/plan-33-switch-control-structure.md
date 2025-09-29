# Plan 33 — Immediate `switch/case/default`

## Status
- **State:** Draft
- **Owner:** Tacit control-flow initiative
- **Prerequisites:** Plan 31 (immediate `if/else`) and Plan 32 (brace block removal)

## Goals
1. Add a forward-only, immediate-word driven `switch … case … default … ;` construct suited for Tacit's RPN style.
2. Reuse the existing data-stack backpatch discipline so each clause emits its own jump to a shared exit without auxiliary metadata.
3. Provide documentation and tests covering guard duplication, clause ordering (no fall-through), nested switches, and compile-time error handling (`case` after `default`, missing `default`, etc.).

## Non-Goals
- Pattern matching or destructuring beyond boolean predicates.
- Fall-through semantics (each clause either runs or skips in isolation).
- Compiler optimisations such as jump tables; first version relies on chained conditional branches.

## Deliverables
- Immediate-word implementations for `switch`, `case`, `of`, `default`, and the shared closer `;` that manipulate only the data stack (`exit`, `closer`, branch placeholder, skip placeholder) using the sentinel values `0` (none), `>0` (address), `-1` (switch closed).
- Updated spec (`docs/specs/drafts/switch-control-flow.md`) describing the exact stack diagrams for each word.
- Comprehensive tests in `src/test/lang` and `src/test/ops/control` covering success paths and compile-time failures (stray `case`/`default`, missing `of`, missing `default`, duplicate `default`, missing `;`).

## Work Breakdown
1. **Design & Specification**
   - Finalise the stack protocol (`... exit closer branch skip`) and sentinel values: `0`, placeholder address, and `-1` for closed switch.
   - Document a complete bytecode example showing where each `Branch`/`IfFalseBranch` is generated and later patched.

2. **Immediate Word Implementation**
   - Implement `switch`: emit exit branch, push closer, push `0 0` placeholders.
   - Implement `case`: patch pending skip/branch, error on `-1`, emit new branch, push `0`, emit guard `Dup`.
   - Implement `of`: require branch > 0, emit `IfFalseBranch`, push skip, emit guard `Drop`.
   - Implement `default`: patch skip, patch branch, emit guard `Drop`, push `-1 0` to mark closed.
   - Implement closer `;`: verify skip == 0, branch == -1, patch exit.

3. **Parser & Runtime Wiring**
   - Register these immediates in the language initialisation sequence.
   - Ensure the runtime VM already supports the required core opcodes (`Branch`, `IfFalseBranch`, `Drop`, `Dup`).

4. **Testing**
   - Unit tests for the immediate words inspecting the data stack after each step (patches, error conditions).
   - Integration tests compiling and executing sample programs covering:
     - Switch with single clause and default.
     - Switch with multiple clauses, including match in the middle and default fallback.
     - Switch nested inside another switch.
     - Error cases: `case` outside switch, `default` outside switch, missing `of`, missing `default`, duplicate `default`, `case` after `default`, missing `;`.

5. **Documentation**
   - Publish the updated spec (`switch-control-flow.md`).
   - Update learning materials and release notes explaining the new construct.

## Dependencies
- Immediate-word infrastructure from Plan 31 (colon definitions, `;` closer).
- Existing control opcodes (`Branch`, `IfFalseBranch`) and stack ops (`Dup`, `Drop`).

## Open Questions
- Should we provide syntactic sugar for common predicates (equality cases), or postpone to a later plan?
- Do we warn users when a predicate consumes the duplicated guard (runtime behaviour) or leave this to documentation?

## Timeline (Tentative)
- Week 1: Finalise design & spec.
- Week 2: Implement immediates and parser wiring.
- Week 3: Tests and documentation sweep.
