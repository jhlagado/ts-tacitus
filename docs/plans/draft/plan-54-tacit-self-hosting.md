# Plan 54 — Tacit Self-Hosting Roadmap

## Context

- Tacit currently relies on a TypeScript parser/compiler layer to turn source into bytecode.
- Immediate words (`beginDefinition`, `beginIf`, etc.) are hardwired in TS; Tacit code triggers them indirectly.
- Goal: move compilation, macro expansion, and REPL execution into Tacit itself, using the existing VM as a minimal kernel.
- Inspiration: classic Forth self-hosting pattern (interpret vs compile modes, meta words built from primitives).

## Objectives

1. Expose a “kernel” set of VM/compiler primitives as builtins callable from Tacit.
2. Re-implement immediate words and compiler control flow as Tacit definitions flagged with the meta bit.
3. Introduce an explicit compile-mode toggle (`beginCompile`/`endCompile`) managed entirely in Tacit.
4. Run the REPL compile→execute loop from Tacit, with line preservation logic (`preserve`) handled there.
5. Reach a stage where TypeScript just provides IO/tokenization and launches the Tacit compiler.

## Current State Snapshot

- VM (`src/core`) already exposes stack, refs, dictionary, bytecode segments.
- Compiler class provides emit helpers (`compileOpcode`, `compile16`, etc.) only callable inside TS.
- Parser recognizes immediate words via switch statements; execution happens via TS functions.
- Meta flag on `Tag.CODE` already differentiates immediate vs normal execution.
- `preserve` flag in `Compiler` controls whether compiled code survives after execution.

## Proposed Phases

### Phase 0 — Kernel Surfacing & VM Plumbing

- Enumerate the minimal helper operations that current JS immediates rely on (emit opcode/number, branch patch, mark/forget, preserve toggles, locals bookkeeping).
- Restructure existing helpers so these services live behind narrow, VM-scoped APIs and keep the single `VM` instance authoritative.
- Defer broader Tacit exposure; only the builtin layer needs access during this phase.

### Phase 1 — Immediate Word Surfacing (JS Builtins)

- Target the critical function/conditional immediates first (`beginDefinition`, `endDefinition`, `beginIf`, `beginElse`, `endIf`) while keeping their logic in TypeScript.
- Register them as dictionary entries with meta-bit set so the parser can dispatch through lookup/eval instead of hardcoded branches.
- Keep existing behavior operational during migration so the interpreter continues to pass regression tests.

### Phase 2 — Immediate Word Integration & Regression

- Expand to the remaining immediate handlers once the initial set is stable, documenting stack effects and VM state usage for each.
- Build incremental regression coverage that exercises the dictionary-driven immediates and catches behavior drift.
- Verify dictionary snapshots/preserve handling remain unchanged after each refactor.
- Maintain debug assertions to surface state mismatches early while JS implementations stay authoritative.

### Phase 3 — Compiler Struct Refactor

- Convert the existing `Compiler` class into a plain data struct (no methods); functions operate on it by taking `(compiler, vm, …)` parameters.
- Expose VM-scoped helper functions (`emitOpcode`, `emitU16`, `beginDefinitionCompile`, etc.) that wrap the new compiler functions and keep all state access centralized.
- Ensure parser/immediate code paths use only these helpers, eliminating direct field mutations on the compiler object.
- Document the public helper set so both JS builtins and future Tacit code share the same contract.

### Phase 5 — Tacit Compile Loop

- Identify the exact TS routines currently orchestrating "tokenize → emit → execute" and document the minimal surface Tacit must own.
  - `parse(vm, tokenizer)`, `parseProgram`, `processToken`, `executeImmediateWord` for compilation.
  - `execute(vm, start)` for evaluation plus its error paths/reset semantics.
- Specify kernel hooks that Tacit code will call:
  - Token acquisition (stepper over `Tokenizer.nextToken()` or an equivalent callback).
  - Dictionary lookup (`lookup`, `define`) and emit helpers (already VM-scoped) for bytecode generation.
  - Control for `vm.currentDefinition`, list depth, and compiler reset/preserve toggles.
- Introduce a TS bridge that seeds a Tacit word with the structures it needs but otherwise yields control:
  - Provide a `beginCompileLoop(vm, tokenizer, entryWord)` helper that sets up the tokenizer and hands off.
  - Expose callable kernels (`nextTokenBuiltin`, `emitOpcode`, `setPreserve`, etc.) so the Tacit loop manipulates state without touching TS internals directly.
- Prototype the Tacit compile loop as a colon definition that mirrors the current TS logic:
  - Read token → dispatch immediate vs literal vs word.
  - Terminate on EOF by routing through `finalize-compile` (which runs validation + emits `Abort`). On unrecoverable errors, invoke the kernel error helpers so TS unwinds exactly as today.
  - Ensure partial colon definitions / control structures trigger the same `UnclosedDefinitionError` paths before the loop returns.
- Define the execution hand-off contract so the host still calls `execute(vm, vm.compiler.BCP)` once the Tacit loop exits, keeping runtime semantics identical.
- Plan incremental bring-up:
  1. Implement a Tacit stub that loops over `token-next`, then immediately returns to TS (feature flagged).
  2. Migrate literal emission (`emit-number`, `emit-string`, specials) into Tacit while leaving word dispatch in TS; compare bytecode snapshots.
  3. Move word dispatch + immediate evaluation into Tacit, using dictionary lookup/eval; extend tests to cover meta words.
  4. Flip the feature flag branch so `parse` invokes Tacit `compile-loop` end-to-end; fallback to TS loop on failure.
- Extend regression coverage: Tacit-driven loop must pass existing parser/compiler suites plus targeted cases for error recovery, nested conditionals, and dictionary mutations mid-compile.
- Launch behind a feature flag (TS fallback) so we can switch between TS/Tacit loops during bring-up.

### Phase 6 — Bootstrapping & Reduction

- Validate by compiling the Tacit compiler with itself (stage-1 parity).
- Gradually retire TS implementations, leaving only tokenizer + kernel builtins.
- Explore Tacit tokenizer replacement to remove residual JS dependencies (stretch goal).

## Open Questions

- Which compiler internals must become mutable from Tacit (e.g., list depth, local count) vs remain encapsulated?
- Do we expose branch patching as primitive (`branch>` / `resolve-branch`) or higher-level helpers?
- How to structure token delivery: keep TS tokenizer or stream tokens via VM memory?
- Error handling strategy when Tacit immediate words fail—how does TypeScript host recover?

## Risks & Mitigations

- **Parity drift**: Tacit compiler may emit bytecode diverging from TS version. Mitigate with golden-file comparisons and shared tests.
- **State corruption**: exposing compiler internals might let Tacit code break invariants. Provide guarded builtins and runtime asserts when `vm.debug` is true.
- **Bootstrapping lock-in**: need staged migration so Tacit compiler can evolve while TS fallback exists.

## Immediate Next Steps

1. Finalize the helper API contract required by `beginDefinition`, `endDefinition`, `beginIf`, `beginElse`, and `endIf`.
2. Document their stack effects plus VM state interactions, making sure the shared `VM` instance exposes the needed hooks.
3. Restructure parser/compiler glue so those helpers are accessible without duplicating VM state.
4. Migrate parser dispatch for the targeted immediates to dictionary lookup, running the full test suite after each incremental change.

## Appendix A — Immediate Word Stack/State Summary

| Immediate word       | Stack effect (logical)                                  | VM/compiler state touched                                                                                                       | Notes                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beginDefinition`    | `( — EndDefinitionCloser )`                             | `vm.compiler` (`compileOpcode`, `compile16`, `preserve`, `enterFunction`); `markWithLocalReset`; `currentDefinition` assignment | Emits forward branch placeholder, marks dictionary checkpoint, enables preserve, tracks active definition, pushes `@EndDefinition` closer onto data stack.                         |
| `endDefinition`      | `( EndDefinitionCloser — )`                             | `vm.compiler` (`compileOpcode`, `exitFunction`); `patchBranchOffset`; `forget`; `define`; `currentDefinition` clear             | Requires the closer on top of stack (consumed by caller before invocation); patches forward branch to start of definition, restores dictionary to checkpoint, installs CODE entry. |
| `beginIf`            | `( — placeholder EndIfCloser )`                         | `vm.compiler` (`compileOpcode`, `compile16`, `CP` read); data stack via `push`                                                  | Emits `IfFalseBranch` with zero placeholder, pushes branch position and `@EndIf` closer onto stack.                                                                                |
| `beginElse`          | `( placeholder EndIfCloser — placeholder EndIfCloser )` | Pops/pushes via `pop`/`push`; `vm.compiler` (`compileOpcode`, `compile16`, `CP` mutate via `patchPlaceholder`)                  | Validates closer/opcode, patches prior false-branch target, emits unconditional forward branch, replaces placeholder with new exit placeholder while keeping closer on stack.      |
| `endIf` (builtin op) | `( placeholder EndIfCloser — )`                         | Handled in `src/ops/builtins.ts` via `endIfOp`, which patches final placeholder, pops closer                                    | Not an immediate word but finalizes the stack discipline established above; relies on the same placeholder/closer layout.                                                          |

All routines rely on a shared `vm.currentDefinition` field (to replace the current wrapper object) and expect the compiler helpers listed in Phase 0.

## Advanced / Future Work

### Phase A — Compile Mode Toggle

- Introduce `beginCompile` / `endCompile` to toggle compile mode from Tacit code once the base architecture is solid.
- Adjust parser to honor the flag: in compile mode, non-immediate words emit their CODE ref directly; in interpret mode, they execute.
- Document stack effects and invariants for these builtins; tackle only after immediate-word surfacing and kernel hardening are complete.

## References

- `docs/specs/vm-architecture.md` — execution model and memory layout.
- `docs/specs/tagged.md` — CODE tag meta bit mechanics.
- `docs/specs/variables-and-refs.md` — dictionary and ref semantics relied upon by compiler.
