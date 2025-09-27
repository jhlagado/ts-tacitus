# Immediate Words & Generic Terminators — Draft Specification

## Status
- **Stage:** exploratory draft
- **Scope:** immediate-word infrastructure, shared `;` terminator, colon definitions
- **Not yet implemented:** parser changes, dictionary updates, tests

## Goals
- Allow selected words to execute during compilation (Forth-style immediates).
- Provide a generic terminator `;` that finalizes whichever construct is currently open.
- Rework colon definitions and control structures to use immediates plus the shared terminator.

## Immediate Words
- Dictionary entries gain an `immediate` flag.
- When the parser reads a token:
  1. Look up the dictionary entry.
  2. If it is immediate, the compiler **executes the word immediately**. For native words this means calling the TypeScript implementation; for Tacit-defined words (future work) the compiler will temporarily jump the VM's instruction pointer (`IP`) to the word's bytecode, run it, then return to compilation. In all cases the word operates with full access to the VM's data (`SP`) and return (`RSP`) stacks, just like runtime execution.
  3. If the word is not immediate, emit bytecode as usual.
- Because Tacit always compiles a chunk before executing it, immediate execution occurs entirely within the compilation pass and returns control to the parser once the word finishes.

- ## Generic Terminator `;`
- Defined as an immediate alias of `eval` (same implementation, immediate flag set).
- Pops the top code reference from the VM data stack and **invokes `eval` immediately** so the closer executes right away (and may emit additional bytecode itself).
- Openers (e.g. `:`/`if`/`do`) push the appropriate closer reference onto the stack before control reaches `;`.
- Supports nesting: innermost opener’s reference is on TOS, so the innermost `;` resolves the correct closer first.

## Colon Definitions
- `:` becomes immediate:
  - Emits prologue code (reserve entry in dictionary, mark start address).
  - Pushes the closing word reference (e.g. `@enddef`) onto the stack so the following `;` can invoke it.
- Closer (invoked via `;`) emits epilogue code (`Exit`, dictionary finalization).

## Control Structures
- Immediate `if`/`else` push their closer reference (e.g. `@endif`) onto the stack alongside branch placeholders.
- Terminator `;` pops and evaluates the closer, which patches outstanding offsets.
- Other structures (`do`/`loop`, `begin`/`until`, etc.) follow the same pattern.

## Stack Discipline During Compilation
- Immediate words operate directly on the VM's own data and return stacks (no shadow stacks).
- Openers push whatever metadata they need (branch placeholders, closer code refs) onto those stacks.
- Closers rely on the presence of the pushed code reference/placeholder data; missing entries trigger immediate-word errors (e.g., `Unexpected ';'`).

## Error Handling
- `;` with no code reference on TOS → compile-time error.
- Opener encountering a mismatched closer (e.g. `else` without `if`) → compile-time error.
- Nested constructs rely on LIFO discipline; any imbalance is caught when the closer compares current stack depth with the saved marker.

## Open Questions / Decisions
1. **Closer reference shape** — use raw code references (`@word` tagged values). No sentinel tokens required.
2. **User-defined immediates** — out of scope for this phase; future work can mirror Forth's `IMMEDIATE` (mark most recently defined word).
3. **Closer words** — provide dictionary entries (e.g. `endif`) but discourage direct use; they exist chiefly for the terminator to `eval`.
4. **REPL diagnostics** — detect stray `;` or missing closers during compilation, print an error, and reject the line.
