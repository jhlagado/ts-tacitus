# Plan 58 – Recursive-Descent `include` Macro

## Goals
Design and implement an `include "<path>"` immediate that behaves like a macro expansion: when seen during compilation it synchronously descends into the target file, parses it in place, and leaves behind a canonical-path global pointing at the file’s entry point. Re-including the same file is a pragma-once no-op, and encountering a smudged copy avoids circular recursion. The runtime sees **no** emitted opcode for `include`; all effects are compile-time.

## Current State
* **Tokenizer** – Single-buffer, pull-based tokenizer with one-token pushback and `#` line comments; no notion of files or stream switching.
* **Parser** – `parse(vm, tokenizer)` resets compiler state, installs a tokenizer, and appends `Abort` on completion. It is not re-entrant: it assumes a single top-level call and always resets compiler fields (`branchPos`, `checkpoint`, `entryCell`, `tokenizer`) before parsing.
* **Immediates** – Immediate words are Tag.CODE with `meta=1`, dispatched via `emitWord` → `executeImmediateOpcode` / `runImmediateCode`. There is no built-in `include`.
* **Globals/Smudging** – Dictionary entries carry a `meta` bit; colon definitions use smudging to mark “in definition.” There is no helper yet for smudging a canonical-path global to represent “include in progress.”
* **Host split** – Path resolution and file IO live on the host. The VM currently expects a fully formed tokenizer and does not ask the host to swap inputs mid-parse.
* **REPL hygiene** – No rollback: failed includes would leave new dictionary entries (including smudged ones) unless the host truncates the dictionary to a checkpoint.

## Proposed Approach
1. **Re-entrant parse helper**  
   Add an internal “child parse” entry (e.g., `parseIncluded(vm, tokenizer, opts)`) that **does not** reset the compiler, does **not** auto-emit `Abort`, and restores `vm.compile.tokenizer` on exit. This is what `include` will call after swapping in a child tokenizer.
2. **Built-in immediate `include`**  
   Implement as a built-in immediate opcode:
   * Expect next token to be a literal string.
   * Ask the host to canonicalize the path and load file contents (host API, no VM file access).
   * Look up/create a global whose **name** is the canonical path. States:
     - Absent → create global, set `meta=smudged`.
     - Smudged → circular include; return immediately (no parse, no error).
     - Complete → already included; return immediately (pragma-once).
   * On the fresh-include path, invoke the child parse on a tokenizer built from the file contents.
   * On successful EOF, set the global’s payload to the file’s entry point (see below) and clear the smudge bit.
3. **Entry-point assignment**  
   Track the last dictionary entry emitted during child parse (mirrors includes spec). Use that as the global payload. If no new entry was produced, treat as an error.
4. **State preservation**  
   Ensure all compiler fields (`branchPos`, `checkpoint`, `entryCell`, list depth, etc.) are saved/restored around child parses. Parent parse must resume with its tokenizer intact.
5. **Host responsibilities**  
   Provide canonical path resolution and file contents; expose a small hook callable from the immediate to obtain both. Host also records dictionary checkpoints in REPL mode and truncates on error to avoid poisoned smudges/globals.
6. **Errors**  
   Tokenization/parse/runtime errors during include leave the include global **smudged**; caller propagates the error. Circular includes are silent skips, not errors.

## Work Plan
1. **Parser reentrancy**
   - Extract the reset/teardown portions from `parse` into helpers so we can call a “no-reset” child parse.
   - Ensure `parseProgram` can be invoked with a swapped tokenizer without injecting `Abort`.
2. **Immediate definition**
   - Add a built-in immediate opcode for `include`.
   - Wire it through `emitWord` immediate dispatch.
3. **Host bridge**
   - Define a minimal interface for `canonicalize(path)` + `loadFile(path)` available to the immediate.
   - Decide where to store this hook (e.g., on `vm.compile.host`).
4. **Smudge helpers**
   - Add utility to create/find a canonical-path global, set/clear smudge (`meta`), and test states.
   - Reuse definition-system smudge semantics for consistency.
5. **Entry-point tracking**
   - Add tracking of the last emitted dictionary entry during a parse segment; surface it to the include immediate for final assignment.
6. **REPL safety**
   - Add dictionary checkpoint/rollback in the host REPL loop so failed includes don’t leave stray smudges.
7. **Tests**
   - Simple include (single file), duplicate include (skip), circular A→B→A (skip inner), shadowing order, error path leaves smudged global, REPL rollback removes smudged globals, and end-to-end compile that confirms no runtime opcode is emitted for `include`.

## Risks and Mitigations
* **State leakage across nested parses** – Mitigate by explicit save/restore of all compiler fields and tokenizer.
* **Entry-point ambiguity** – If a file emits no new entry, throw; if needed, future-proof with an explicit “export” word.
* **Host/VM contract drift** – Document the host hooks in `includes.md` and ensure the VM fails clearly if they are missing.
* **REPL rollback complexity** – Keep rollback host-side by truncating dictionary to a checkpoint; VM need not track per-include allocations.

## Deliverables
* Code: re-entrant parser path, built-in `include` immediate, smudge helpers, host bridge, REPL rollback hook.
* Docs: Update `includes.md` and related specs to match the implemented behaviour (canonical globals, smudge/no-op circular handling, entry-point = last definition, no runtime opcode).
* Tests: Unit and integration coverage for include semantics and REPL rollback.
