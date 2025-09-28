# Plan 30 — Immediate Word Infrastructure

## Status
- **State:** Draft (current focus)
- **Owner:** Tacit control-flow initiative
- **Prerequisites:** None (carves a foundation for later control constructs)

## Goals
1. Introduce immediate-word support in the Tacit dictionary so selected words execute as soon as they are parsed.
2. Reimplement colon definitions (`: … ;`) using immediate words and the shared terminator.
3. Provide the generic `;` infrastructure required by colon definitions (including an `isExecutable` helper for closer validation).
4. Keep draft documentation (`immediate-words-and-terminators`) aligned with the implementation.

## Non-Goals
- Removing legacy brace-based combinators (kept for now).
- Adding explicit compile/interpret toggles (may be explored later with macro support).
- Enabling user-defined immediates/macros (future work beyond the current infrastructure).
- Extending loops or other control words beyond the `if` family (will piggyback once the foundation is stable).

## Deliverables
- Updated dictionary entry structure carrying an `immediate` flag plus helper(s) for registering immediate natives.
- Colon-definition opener (`:`) and closer (via `;`) rewritten as immediate words that manage dictionary entries and rely on the shared terminator (pushing builtin closers via `toTaggedValue(opcode, Tag.BUILTIN)`).
- Generic terminator `;` (immediate alias of `eval`) that pops a code reference, errors if TOS is not a code ref, and invokes it.
- An `isExecutable` helper in tagged utilities so `;` can accept both builtin and bytecode closers.
- Parser/compiler changes so immediate words run during the streaming compilation pass while other tokens emit bytecode as today.
- Unit tests covering the immediate infrastructure and colon definitions.
- Documentation touch-up to keep the draft spec aligned and note the new behaviour in README/changelog.

## Work Breakdown
1. **Colon definitions first**
   - Make `:` an immediate word: reserve dictionary entry, record start address, push the closer reference directly as `toTaggedValue(Op.EndDef, Tag.BUILTIN)` so `;` can invoke it.
   - Ensure `;` pops the colon closer, emits the proper epilogue (`Exit`, dictionary finalisation), and validates stack state.
   - Add targeted tests verifying that `: foo … ;` works in the REPL and nested definitions are rejected appropriately.

2. **Dictionary updates**
   - Extend symbol metadata with an `immediate` flag.
   - Provide helper for registering immediate natives (colon definition uses it immediately).

3. **Generic terminator**
   - Implement the shared `;` behaviour (using `isExecutable` to validate TOS) so colon definitions can rely on it.

4. **Testing & docs**
   - Maintain regression tests for immediates/colon definitions.
   - Keep the draft spec and release notes in sync.
