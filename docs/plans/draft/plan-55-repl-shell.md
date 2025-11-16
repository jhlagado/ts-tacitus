---
title: REPL ergonomics and history support
status: draft
authors: tacit kernel team
---

## Context

Tacit already compiles and executes one submitted “line” (string) at a time. Each submission is parsed, validated, compiled, executed, and the temporary code buffer is reset unless a definition marked `compiler.preserve = true`. This works for single-line interaction but the developer experience is still raw: there is no command history, no multiline editing affordance, and error recovery is clunky when a user hits newline before closing a construct.

## Goals

- Improve usability of the Tacit REPL without changing the underlying VM semantics.
- Support recall/edit/replay of previous submissions.
- Allow multiline entry (soft newline) so larger definitions aren’t shoehorned onto one physical line.
- Preserve the “compile whole submission, fail fast on syntax errors” behavior.
- Keep the dictionary/code preservation rules unchanged.

## Out-of-scope

- Adding new language syntax.
- Changing the compiler execution model.
- Persisting history across sessions (can be a later enhancement).
- GUI/editor integrations (focus on terminal REPL).

## Open Questions

- How should history be stored? (in-memory ring, optional disk file?).
- What keybindings do we adopt? (readline-like? configurable?).
- Should the REPL print partial diagnostics when a submission fails validation (e.g., showing unmatched construct)?
- Do we provide a way to continue an incomplete submission instead of erroring immediately?

## Proposed Steps

1. **Audit existing REPL entry point**
   - Identify where `executeProgram` is called.
   - Confirm how input strings are gathered and whether whitespace is already normalized.

2. **Prototype history storage**
   - Start with simple in-memory array of strings.
   - Expose commands (`history`, `!n`, etc.) to inspect/replay.
   - Investigate `readline`/`node:readline` integration for up/down arrow support.

3. **Add multiline submission**
   - Define “soft newline” convention (e.g., Shift+Enter or trailing `\`).
   - Accumulate lines until the user submits (Enter without modifier).
   - Ensure tokenizer treats embedded newlines as whitespace.

4. **Improve syntax error feedback**
   - Catch `UnclosedDefinitionError`/`Unclosed IF` before execution.
   - Surface a clear prompt message indicating the offending construct.
   - Optionally, offer automatic re-entry mode (continue editing) vs abort.

5. **Refinement & tests**
   - Unit test history replay and multiline behaviors.
   - Update developer docs / README with new keybindings.
   - Consider saving history across sessions (optional stretch).

## Risks / Considerations

- Integrating a richer line editor may pull in dependencies (e.g., `readline-sync`), which we need to vet.
- Need to ensure multiline accumulation doesn’t break existing scripts that pipe input.
- Watch for memory growth if history is unbounded (set a cap / LRU).
- Make sure exit paths reset the compiler state even after aborted multiline submissions.
