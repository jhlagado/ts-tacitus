# Immediate Metaprogramming & Control Flow (Normative)

## Status
- **Stage:** normative (tracks current implementation).
- **Scope:** compile-time immediates, the shared `;` terminator, colon definitions, conditional families (`if/else`, `when/do`).
- **Audience:** compiler/runtime implementors, language designers, and anyone extending Tacit’s immediate-word system.

This specification supersedes the older drafts `immediate-words-and-terminators.md`, `cond-control-flow.md`, and `when-do-control-flow.md`.

## Overview
Tacit adopts a Forth-like metaprogramming model:

- Words marked **immediate** run during parsing. They execute with full access to the VM’s data (`SP`) and return (`RSP`) stacks—both expressed in **cells**. If an immediate needs raw byte addresses it must derive them explicitly (e.g. `SP * CELL_SIZE`).
- A single shared terminator `;` executes the closer that the opener pushed onto the stack. Closers are plain words (usually builtins) that patch placeholders and restore compile-time invariants.
- Colon definitions, conditionals, and the new multi-branch `when/do` construct are all built on this pattern.

The sections below detail the infrastructure and each control construct.

## Immediate-word infrastructure

### Dictionary entries
Each dictionary entry stores an `isImmediate` flag. When the parser encounters a word:
1. Look up the dictionary entry.
2. If immediate, execute the entry immediately (for builtins this calls the TypeScript verb; for CODE references the VM temporarily jumps to the bytecode and returns on completion).
3. Otherwise emit bytecode normally.

Immediate words run inside the VM instance used for compilation—no shadow interpreter. They may push values, emit opcodes, or manipulate placeholders exactly as runtime code would.

### Generic terminator `;`
- Defined as `eval` with the immediate flag set.
- Requires the data stack to be non-empty; otherwise raises `Unexpected semicolon`.
- Pops the top value and evaluates it. Openers are responsible for pushing a suitable closer reference (usually `createBuiltinRef(opcode)`); if the value is not executable, `eval` simply pushes it back, so mis-matched `;` produce errors rapidly.
- Because closers live on the data stack, nested constructs naturally unwind LIFO-style.

### Compile-time stack discipline
Immediate openers and closers share the VM stacks with runtime code:
- **Data stack:** holds branch placeholders, closer references, and any temporary metadata the opener needs.
- **Return stack:** available for bookkeeping (e.g. `when` snapshots `RSP` so it can later count pending exit placeholders). Openers must restore any state they save.

Closers validate invariants when invoked. Missing placeholders or unexpected stack contents produce immediate syntax errors.

## Colon definitions (`:` … `;`)

### `:` opener (immediate)
1. Ensure we are not already inside a definition; throw if nested.
2. Read the next token as the word name; reject `:`/`;` or missing names.
3. Emit `Branch +0` to skip over the body during runtime entry; record the operand address for later patching.
4. Snapshot the symbol-table checkpoint so we can roll back if compilation fails.
5. Mark that we are compiling a function and preserve the compiler buffer.
6. Push `createBuiltinRef(Op.EndDefinition)` onto the data stack so the next `;` will resolve it.

### Closer (`enddef`)
When `;` executes `Op.EndDefinition` it:
1. Emits a trailing `Exit` and finalises the function prologue/epilogue.
2. Patches the initial `Branch` to point at the code after the definition body.
3. Registers the word in the symbol table at the computed bytecode address.
4. Clears parser state so another definition can start.

Errors (nested definitions, missing names, stray `;`) are reported immediately by the opener or closer.

## Conditional control flow (`if` / `else` / `;`)

### Surface syntax
```
cond  if   …true-branch…   ;
cond  if   …true-branch…   else   …false-branch…   ;
```
`else` is optional. Each construct must end with `;`.

### Compile-time lowering
1. **`if` (immediate)**
   - Emit `IfFalseBranch +0`; push the operand address (`p_false`) onto the data stack.
   - Push `createBuiltinRef(Op.EndIf)` so the terminator can execute it later.
2. **True branch**
   - Compiled as straight-line code. The guard value will have been consumed at runtime by `IfFalseBranch`.
3. **`else` (optional immediate)**
   - Emit `Branch +0`; push the operand address (`p_exit`).
   - Patch `p_false` so failing the predicate jumps to the start of the false branch.
   - Push the `EndIf` closer again (the final terminator still expects it on TOS).
4. **False branch (if present)**
   - Straight-line code.
5. **Terminator `;`**
   - Pops the closer and executes `Op.EndIf`, which patches any outstanding placeholders (the final `Branch`, the original `IfFalseBranch`) and restores compile-time state.

### Runtime behaviour
- The guard is produced before `if`. At runtime `IfFalseBranch` pops it; zero (or non-numeric) skips the true branch.
- If an `else` was emitted, the true branch’s trailing `Branch` jumps over the false branch after executing it.

### Error handling
- `do` without `if` equivalent: `else` checks that the closer on TOS is `EndIf`, otherwise raises `ELSE without IF`.
- A stray `;` with no executable on TOS raises `Unexpected semicolon`.
- Unclosed `if` constructs are detected when final validation runs (`ensureNoOpenConditionals`) or earlier if the terminator encounters the wrong placeholder layout.

## Guarded multi-branch (`when` … `do` … `;`)

### Surface syntax
```
when
  predicate do  …body…  ;
  predicate do  …body…  ;
  …optional default code…
;
```
- Each clause consists of a predicate followed by `do` and its body, terminated by `;`.
- The final `;` closes the construct. Code between the last clause and that terminator acts as the default.

### Compile-time invariants
- **Data stack (TOS → right):**
  - Open construct: `[…, savedRSP, EndWhen]`
  - Inside clause body: `[…, savedRSP, EndWhen, p_skip, EndDo]`
- **Return stack:**
  - Snapshot `RSP` when `when` starts (`savedRSP`).
  - Each clause terminator pushes one forward-branch operand (`p_exit`) addressing the shared exit.

### Immediate words
1. **`when`**
   - Snapshot `RSP` and push the `savedRSP` value onto the data stack.
   - Push `EndWhen` so the final `;` can resolve it. No bytecode is emitted at this point.
2. **`do`**
   - Require the data stack to contain `[…, savedRSP, EndWhen]`; otherwise raise “do without when”.
   - Emit `IfFalseBranch +0`; record its operand address as `p_skip` and push it.
   - Push `EndDo` so the clause terminator can execute it.
3. **Clause terminator `;`**
   - Executes `EndDo`:
     1. Verify a skip placeholder is present.
     2. Emit `Branch +0`; push its operand address (`p_exit`) onto the return stack.
     3. Patch `p_skip` to fall through to the next clause/default.
     4. Drop `p_skip`, restoring `[…, savedRSP, EndWhen]`.
4. **Final `;`**
   - Executes `EndWhen`:
     1. Pop `savedRSP`.
     2. While `RSP > savedRSP`, pop each recorded `p_exit` and patch it to the shared exit (`CP - (p_exit + 2)`).
     3. The loop leaves `RSP == savedRSP`; the data stack returns to its pre-`when` shape.

### Runtime behaviour
- Each clause’s predicate runs just before `do`; it must produce a numeric truth value.
- Failing the predicate causes the compiled `IfFalseBranch` to skip the body and its closing logic.
- When a clause body completes, its back-branch jumps to the shared exit (after the whole construct). Default code executes only if every predicate fails.

### Error handling
- `do` without an open `when` → “do without when”.
- Clause `;` without a pending predicate skip → “clause closer without do/predicate”.
- Final `;` without `EndWhen` on TOS → “when not open”.
- Return-stack under/overflow during closing raises dedicated VM errors; under normal use `savedRSP` guarantees balance.

### Nested forms
`when` can appear inside clause bodies or default regions. Each nested construct snapshots its own `savedRSP`, leaving outer placeholders untouched until the inner construct has closed.

## Switch-style multi-branch (`case` … `of` … `;`)

The forthcoming `case` / `of` / `DEFAULT` suite follows the same immediate pattern. See `docs/specs/case-control-flow.md` for the full draft; highlights:

- `case` snapshots `RSP`, pushes `savedRSP` and `EndCase`, leaving the discriminant beneath the metadata.
- `of` duplicates the discriminant (`over`), compares it to the clause constant, emits `IfFalseBranch +0`, records the skip placeholder, then emits a `drop` so matching bodies do not see the discriminant.
- Clause terminator `;` (running `EndClause`) patches the predicate skip, emits a forward exit branch, and restores the discriminant for subsequent clauses.
- `DEFAULT` provides an unconditional match via a recognised sentinel.
- Final `;` (running `EndCase`) drops any remaining discriminant, patches recorded exits to the shared continuation, and validates the return stack snapshot.

## Closer summary
| Construct | Opener pushes | Closer word (executed via `;`) | Compile-time duties |
|-----------|---------------|-------------------------------|---------------------|
| `:` … `;` | `Op.EndDefinition` | `endDefinitionOp` | Emit `Exit`, patch prologue branch, register definition |
| `if` … `;` | `Op.EndIf` | `endIfOp` | Patch `IfFalseBranch` and optional trailing `Branch` |
| `when` … `;` | `Op.EndWhen` (clauses push `Op.EndDo`) | `endWhenOp`, `endDoOp` | Record/patch clause skips, backpatch exit branches |
| `case` … `;` | `Op.EndCase` (clauses push `Op.EndOf`) | `endCaseOp`, `endOfOp` | Compare discriminant, manage clause exits, drop unmatched discriminant |

All closers live in `src/ops/core/core-ops.ts` and are dispatched through the generic terminator.

## Diagnostics & validation
- The parser’s final validation pass invokes `ensureNoOpenConditionals`, which now flags any leftover `Op.EndIf` **or** `Op.EndWhen` markers to catch unclosed constructs.
- Individual openers detect misuse early (e.g. nested `:`) to provide precise error messages.

## Future work
- Expose a user-level `immediate` word to mark freshly defined colon definitions as immediates.
- Migrate remaining legacy combinators (e.g. repeat-style loops) onto the immediate infrastructure or retire them.
- Expand this spec with additional structures (`case`, loop families) as they are ported.
