# Immediate Words & Generic Terminators — Draft Specification

## Status
- **Stage:** draft (aligned with implementation)
- **Scope:** immediate-word infrastructure, shared `;` terminator, colon definitions

## Goals
- Allow selected words to execute during compilation (Forth-style immediates).
- Provide a generic terminator `;` that finalizes whichever construct is currently open.
- Rework colon definitions and, eventually, other control structures to use immediates plus the shared terminator.

## Immediate Words
- Dictionary entries gain an `immediate` flag.
- When the parser reads a token:
  1. Look up the dictionary entry.
  2. If it is immediate, the compiler **executes the word immediately**. For native words this means calling the TypeScript implementation; for Tacit-defined words (future work) the compiler will temporarily jump the VM's instruction pointer (`IP`) to the word's bytecode, run it, then return to compilation. In all cases the word operates with full access to the VM's data (`SP`) and return (`RSP`) stacks, just like runtime execution.
  3. If the word is not immediate, emit bytecode as usual.
- Because Tacit always compiles a chunk before executing it, immediate execution occurs entirely within the compilation pass and returns control to the parser once the word finishes.

### Colon `:` Immediate (implemented)
```
: (immediate)
  ensure not already defining a word
  read next token → name
  compile Branch and placeholder to skip over definition body until the closer patches it
  checkpoint symbol table so we can roll back if compilation fails
  record definition metadata (name, branch position, checkpoint)
  enter function compilation, preserving current code segment
  push createBuiltinRef(Op.EndDefinition)   # closer for ';'
```
- Subsequent tokens are compiled as the definition body until the matching `;` appears.

## Generic Terminator `;`
- Defined as an immediate alias of `eval` (same implementation, immediate flag set).
- Ensures the data stack is not empty; otherwise raises `Unexpected semicolon`.
- Pops the top value and asks `eval` to execute it. If the value is not executable, `eval` simply pushes it back, so only openers that placed a closer on the stack succeed.
- Openers (e.g. `:`/`if`/`do`) push the appropriate closer reference onto the stack before control reaches `;`. Builtin closers use `createBuiltinRef(opcode)`; future user-defined closers may push bytecode references directly.
- Supports nesting: innermost opener’s reference lives on TOS, so the innermost `;` resolves the correct closer first.

## Colon Definitions
- `:` is immediate and orchestrates the prologue described above.
- Closer logic lives in the builtin `enddef` opcode. When executed via `;` it emits `Exit`, back-patches the initial branch, defines the word in the symbol table, and clears parser state.
- Because the parser no longer has bespoke colon handling, new openers can reuse the same pattern by pushing their matching closer onto the stack.

## Control Structures
- Future immediate `if`/`else` (Plan 31) will push their closer reference (e.g. `createBuiltinRef(Op.EndIf)`) alongside branch placeholders.
- Terminator `;` continues to act as the dispatcher, evaluating the closer that patches outstanding offsets.
- Other structures (`do`/`loop`, `begin`/`until`, etc.) can follow the same pattern once migrated.

## Stack Discipline During Compilation
- Immediate words operate directly on the VM's own data and return stacks (no shadow stacks).
- Openers push whatever metadata they need (branch placeholders, closer code refs) onto those stacks.
- Closers rely on the presence of the pushed code reference/placeholder data; missing entries trigger immediate-word errors (e.g., `Unexpected ';'`).

## Error Handling
- `;` with an empty stack → compile-time error (`Unexpected semicolon`).
- Openers detect illegal re-entry (e.g. nested `:`) and throw syntax errors immediately.
- Nested constructs rely on LIFO discipline; mismatches surface when the closer executes and discovers the expected metadata is absent.

## Open Questions / Decisions
1. **Closer reference shape** — implemented via `createBuiltinRef(opcode)` for builtins; user bytecode remains an option.
2. **User-defined immediates** — still out of scope; future work can mirror Forth's `IMMEDIATE` (mark most recently defined word).
3. **Closer words** — dictionary entries (e.g. `enddef`, future `endif`) remain runtime-accessible but are primarily targets for the terminator.
4. **REPL diagnostics** — richer messaging for mismatched openers/closers is desirable once more structures migrate.
