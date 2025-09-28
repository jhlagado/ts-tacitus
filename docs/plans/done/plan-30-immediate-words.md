# Plan 30 — Immediate Word Infrastructure

## Status
- **State:** Completed
- **Owner:** Tacit control-flow initiative
- **Prerequisites:** None (carves a foundation for later control constructs)

## Goals
1. Introduce immediate-word support in the Tacit dictionary so selected words execute as soon as they are parsed. ✅
2. Reimplement colon definitions (`: … ;`) using immediate words and the shared terminator. ✅
3. Provide the generic `;` infrastructure required by colon definitions (including an `isExecutable` helper for closer validation). ✅
4. Keep draft documentation (`immediate-words-and-terminators`) aligned with the implementation. ✅

## Non-Goals
- Removing legacy brace-based combinators (kept for now).
- Adding explicit compile/interpret toggles (may be explored later with macro support).
- Enabling user-defined immediates/macros (future work beyond the current infrastructure).
- Extending loops or other control words beyond the `if` family (will piggyback once the foundation is stable).

## Deliverables
- Immediate-aware symbol entries and helpers implemented in `SymbolTable`.
- Immediate colon opener (`:`) pushes the builtin `enddef` closer and leverages the shared terminator.
- Generic terminator `;` delegates to `eval`, validating executable closers before invocation.
- `isExecutable` helper introduced so immediates can detect builtin or bytecode closures.
- Parser refactored around the new immediate execution flow; colon definitions now run entirely via immediates.
- Regression coverage in `src/test/lang/immediate-words.test.ts` plus existing parser suites.
- Draft specification updated to describe the implemented behaviour.

## Outcome
- Immediate flag now participates in parsing, enabling future macro-style words.
- Colon definitions operate solely through immediate execution, matching the Forth model while keeping Tacit's shared-terminator design.
- Shared terminator infrastructure unblocks future openers that can supply their own closers without parser wiring.

## Follow-ups
- Fold remaining legacy uppercase control words into the immediate/terminator pipeline (tracked under Plan 31).
- Monitor coverage dips around the newly split parser modules; add focused tests if future refactors expose gaps.
