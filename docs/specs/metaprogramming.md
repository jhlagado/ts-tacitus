# Immediate Metaprogramming & Control Flow (Normative)

## Status
- **Stage:** normative (tracks current implementation).
- **Scope:** compile-time immediates, the shared `;` terminator, colon definitions, conditional families (`if/else`, `when/do`, `case/of`).
- **Audience:** compiler/runtime implementors, language designers, and anyone extending Tacit's immediate-word system.

This specification supersedes the older drafts `immediate-words-and-terminators.md`, `cond-control-flow.md`, `when-do-control-flow.md`, and consolidates content from `case-control-flow.md`.

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

### Surface syntax
```
<discriminant> case
  <constant> of   …body…   ;
  <constant> of   …body…   ;
  DEFAULT   of   …body…   ;   \ optional
;
```

- The discriminant value (any tagged Tacit datum) is evaluated before `case` executes.
- Each clause compares the discriminant against a constant literal. The first matching clause runs its body and terminates the construct.
- The optional `DEFAULT` clause acts as a wildcard that matches if all previous clauses fail.
- Clause bodies are regular Tacit code compiled inline between the immediates.

### Runtime stack discipline

- The discriminant is present on the data stack when `case` executes and remains there until a clause body consumes it.
- Clause bodies do **not** see the discriminant; `of` arranges for it to be automatically dropped on the true path.
- If no clause matches and there is no default, the final closer ensures the discriminant is removed before control resumes.

#### Stack snapshots

| Moment | Data stack (rightmost = TOS) |
| --- | --- |
| Before `case` | `[..., discriminant]` |
| After `case` opener | `[..., savedRSP, EndCase, discriminant]` |
| Inside clause body (true branch) | `[..., savedRSP, EndCase]` |
| Between clauses (false branch) | `[..., savedRSP, EndCase, discriminant]` |
| After final terminator (matched clause) | prior state restored, discriminant consumed |
| After final terminator (no match) | prior state restored, discriminant dropped |

### Immediate word semantics

#### `case` (immediate)

1. Snapshots the current return-stack depth (`savedRSP`).
2. Pushes `savedRSP` and the closer reference `EndCase` onto the data stack.
3. Leaves the discriminant on the data stack beneath the case metadata. No bytecode emitted at this stage.

#### `of` (immediate)

Executed for each clause header:

1. Validates that the data stack ends with `[…, savedRSP, EndCase, discriminant, constant]`. If not, raises "`of` without `case`".
2. Compiles the runtime comparison sequence **in this precise order**:
   - Emit `over` so the discriminant is duplicated while the clause constant remains at TOS.
   - Emit the equality builtin (`eq`). At runtime `eq` must treat the designated wildcard sentinel (used by `DEFAULT`) as matching any discriminant.
   - Emit `IfFalseBranch +0` and record its operand address (`p_skip`) before the discriminator is dropped. This ensures the placeholder references the correct `CP`.
3. Pushes `p_skip` followed by the clause closer reference `EndOf` onto the data stack. The two entries ensure the matching closer can patch the predicate skip and restore the stack shape.
4. Emits a `drop`. On the true path this removes the duplicated discriminant before the clause body executes. On the false path the `IfFalseBranch` transfers control past this drop, preserving the original discriminant for subsequent clauses.

Because the `DEFAULT` clause pushes a runtime sentinel constant, the sequence above is emitted unchanged. The equality builtin is responsible for recognising the sentinel and returning `true`, so the body is entered without any `of`-specific branching logic.

#### Clause terminator `;` (executes `EndOf`)

1. Pops the stored `p_skip`; verifies the stack is `[…, savedRSP, EndCase]` after removal. Otherwise raises "clause closer without `of`".
2. Emits `Branch +0` to skip remaining clauses once the current one succeeds; records its operand (`p_exit`) on the return stack.
3. Patches `p_skip` so a failed comparison falls through to the next clause (i.e., sets offset to reach the instruction immediately after the branch placeholder and before the trailing `drop`).
4. Restores the data stack to `[…, savedRSP, EndCase, discriminant]`, ready for the next clause or default.

#### Final terminator `;` (executes `EndCase`)

1. Removes the discriminant from the data stack. The drop occurs exactly once per construct—either in the matching clause body or here if no clause (including `DEFAULT`) matched.
2. Pops `savedRSP`; while `RSP > savedRSP`, pops each recorded `p_exit` operand from the return stack and patches it to jump to the instruction immediately after the discriminant drop. This guarantees successful clauses do not drop the discriminant twice.
3. (Optional assertion) Implementations may verify the return stack depth matches `savedRSP`—mirroring the safeguard used by `when/do`—and raise "case corrupted return stack" if not.
4. Net stack effect: `( discriminant — )`. The discriminant is consumed exactly once per construct.

### Default clause sentinel

- `DEFAULT` pushes a distinguished sentinel constant (e.g., `toTaggedValue(Sentinel.DEFAULT, Tag.SENTINEL)`) onto the stack via an immediate word. The emitted `eq` must treat comparisons involving this sentinel as an automatic match, so the default clause reuses the standard comparison/branch sequence without alteration.
- Because the `DEFAULT` clause still goes through the standard `of` lowering, there are no compile-time differences: the comparison sequence is emitted, `IfFalseBranch` is recorded (it simply never triggers at runtime), and the trailing `drop` removes the discriminant before the body executes.
- Equality treats `Sentinel.DEFAULT` as a wildcard (`areValuesEqual` returns `true` when either operand carries `Tag.SENTINEL` with payload `Sentinel.DEFAULT`).
- Additional defaults are permitted. Because the sentinel wildcard causes the equality check to succeed immediately, the first encountered default will match; later defaults are effectively dead code but remain legal.

### Emitted bytecode skeleton

For a simple two-clause case with default:

```
; prior code leaves discriminant on stack
case
  const1 literal
  of       ; emits: over, eq, IfFalseBranch p1, drop
    …body1…
  ;        ; emits: Branch p2, patch p1
  const2 literal
  of       ; emits: over, eq, IfFalseBranch p3, drop
    …body2…
  ;        ; emits: Branch p4, patch p3
  DEFAULT literal
  of       ; emits: over, eq (wildcard match), IfFalseBranch p5, drop
    …default body…
  ;        ; emits: Branch p6 (patch no-op)
; final closer drops discriminant if still present, then patches p2/p4/p6
```

### Error handling

- `of` outside an open `case`
  - Immediate can check that the next-on-stack entry is `EndCase`; otherwise signal `SyntaxError("'of' without open case")`.
- Clause body terminator `;` without a pending predicate placeholder
  - When the terminator attempts to pop a skip placeholder and finds none, raise `SyntaxError("clause closer without of")`.
- Final `;` without `EndCase` on TOS
  - Terminator validates the closer on TOS; absence triggers `SyntaxError("case not open")`.
- Return stack mismatch when unwinding
  - Optional assertion mirroring `when/do`; implementers may raise `SyntaxError("case corrupted return stack")` if the snapshot invariant fails.

### Interaction with other immediates

- Cases may nest inside other immediate constructs (e.g., inside `when` clauses) because each opener snapshots and restores `RSP` independently.
- Clause bodies can freely open additional immediate constructs; they execute after the discriminant has been dropped.
- `DEFAULT` acts as a wildcard via the sentinel value; multiple defaults are legal (the first will match, subsequent defaults are effectively dead code).

## Closer summary
| Construct | Opener pushes | Closer word (executed via `;`) | Compile-time duties |
|-----------|---------------|-------------------------------|---------------------|
| `:` … `;` | `Op.EndDefinition` | `endDefinitionOp` | Emit `Exit`, patch prologue branch, register definition |
| `if` … `;` | `Op.EndIf` | `endIfOp` | Patch `IfFalseBranch` and optional trailing `Branch` |
| `when` … `;` | `Op.EndWhen` (clauses push `Op.EndDo`) | `endWhenOp`, `endDoOp` | Record/patch clause skips, backpatch exit branches |
| `case` … `;` | `Op.EndCase` (clauses push `Op.EndOf`) | `endCaseOp`, `endOfOp` | Compare discriminant, manage clause exits, drop unmatched discriminant |
| `does` … `;` | `Op.EndCapsule` (opener emits `Op.ExitConstructor`) | `endCapsuleOp` | Swap closer `EndDefinition→EndCapsule`, compile `ExitConstructor`; closer compiles `ExitDispatch` then finalises the definition |

All closers live in `src/ops/core/core-ops.ts` and are dispatched through the generic terminator.

## Diagnostics & validation
- The parser’s final validation pass invokes `ensureNoOpenConditionals`, which now flags any leftover `Op.EndIf` **or** `Op.EndWhen` markers to catch unclosed constructs.
- Individual openers detect misuse early (e.g. nested `:`) to provide precise error messages.

## Future work
- Expose a user-level `immediate` word to mark freshly defined colon definitions as immediates.
- Migrate remaining legacy combinators (e.g. repeat-style loops) onto the immediate infrastructure or retire them.
- Expand this spec with additional structures (loop families, pattern match variants) as they are ported.

## Capsules (`does`)

`does` is an immediate opener used inside a colon definition to construct a capsule (see docs/specs/capsules.md). It follows the same opener/closer protocol:

- Opener (`does`):
  - Validates a colon definition is open (TOS must be `Op.EndDefinition`).
  - Swaps the closer on TOS to `Op.EndCapsule` so the shared `;` will close the capsule body.
  - Emits `Op.ExitConstructor`, which at runtime freezes the current locals in place, appends `[CODE_REF(entry), LIST:(locals+1)]` to the caller’s return frame, pushes an `RSTACK_REF` handle to the data stack, and restores the caller.

- Closer (`endCapsuleOp` via `;`):
  - Emits `Op.ExitDispatch`, the custom epilogue used by capsule dispatch bodies to restore the caller without touching the payload.
  - Invokes the standard end-definition handler to finalise the surrounding colon definition (no extra terminator required).

The dispatch body code after `does` is entered via the `dispatch` runtime operation, which consumes the receiver handle and rebinds `BP` to the capsule payload before jumping to the `CODE_REF` captured at slot 0. The epilogue (`Op.ExitDispatch`) restores the caller and preserves the payload in the caller’s frame.
