# `switch/case/default` Immediate Control Flow (Draft)

## Status
- **Stage:** design draft
- **Depends on:** immediate-word infrastructure (`if/else`) and brace-block removal

## Overview
Tacit gains a structured multi-branch form:

```
value switch
  case predicate-1 of   ...body-1...
  case predicate-2 of   ...body-2...
  default               ...body-default...
;
```

- `switch` captures the **guard value** (top of stack on entry) and prepares shared bookkeeping for the subsequent cases.
- Each `case … of` automatically duplicates the guard so the predicate sees it on TOS; on success the guard is dropped before the branch body executes and the flow jumps to the shared exit.
- A failed predicate skips its body by branching to the next `case` (or `default`).
- `default` provides the required fallback body; omitting it is a compile-time error.
- The final `;` executes the switch closer, patching any outstanding branches and restoring compilation state.

## Immediate Words and Stack Discipline
All scaffolding lives in `src/lang/meta`. The VM data stack carries the backpatch addresses and the closing code reference—no extra frame structure is needed.

### `switch`
- Leaves the guard on the data stack (the caller supplies it as the switch subject).
- Emits a `Branch` placeholder that serves as the **exit jump target** once a case succeeds; the placeholder address is pushed onto the stack for the closing word to patch.
- Pushes the executable closer reference (`Op.EndSwitch`, invoked by `;`). Because it is an executable value, subsequent immediates can confirm they are still operating inside the active switch. The stack now looks like `[ ... guard exit-placeholder closer ]`.
- Initializes the switch meta context (`defaultSeen = false`, `pendingBranch = null`, `pendingSkip = null`).

### `case`
- Raises “`case` after default” if the meta switch context has already recorded a `default`.
- If the top stack item is a skip placeholder (a numeric address left by the preceding `of`), pop and patch it so the previous clause falls through to this clause when its predicate fails.
- If the next item is a branch placeholder (the numeric address of the previous clause’s exit jump), pop it, emit `Branch 0`, and patch that branch to jump to the shared exit. For the very first `case`, this step is skipped because only the closer executable is on the stack.
- The next item must now be the closer executable; if not, raise “`case` outside switch”.
- Emit `Branch 0` for the current clause and push its placeholder address above the closer so the following clause (or `default`) can patch it.
- Emit a `Dup` so the guard is on TOS for the predicate without consuming the original copy reserved for later cases (skip if the next token is an executable closer meaning the predicate is implicit).
- Update the meta context with the new branch placeholder (for the next clause) and mark `defaultSeen = false`.

### `of`
- Closes the predicate section and starts the case body.
- Emits `IfFalseBranch 0` to skip the body when the predicate fails; the guard stays on the stack along the false path.
- On the true path, emits a `Drop` to remove the original guard before executing the branch body.
- Pushes the skip placeholder above the branch placeholder so the next control word can patch it, and records this address in the meta context.

### `default`
- Raises “duplicate default” if the meta context already marked the switch as exhaustive.
- If a skip placeholder is on top of the stack, pop and patch it so the previous clause falls through to the default body when its predicate fails.
- If a branch placeholder follows, pop it, emit `Branch 0`, and patch that branch to the shared exit. If the closer executable is encountered instead, this `default` follows immediately after `switch` with no prior clauses.
- Confirm the closer executable is now on top; otherwise raise “`default` outside switch”.
- Emit a `Drop` to consume the guard before the default body runs.
- Leave the stack as `[ ... guard exit-placeholder closer ]` (no new placeholders are pushed) and set `defaultSeen = true` in the meta context.

### `;` (Closer)
- Pops the closer reference (`Op.EndSwitch`) and executes it immediately.
- If any skip or branch placeholders remain on the stack, raise “switch must include default”.
- If the meta context reports `defaultSeen = false`, raise “switch requires default clause”.
- Patch the exit placeholder with the current code pointer so all successful branches jump past the switch body.
- Pop the exit placeholder; the guard has already been consumed by whichever clause executed.

## Proposed Bytecode Layout
For two cases and a default:

```
switch:
  Branch exit-placeholder     ; skip entire switch (patched later by closer)
case 1:
  Dup
  ...predicate-1...
  IfFalseBranch skip-case-1
  Drop                ; remove original guard on success
  ...body-1...
  Branch exit-placeholder     ; jump to shared exit
skip-case-1:
case 2:
  Dup
  ...predicate-2...
  IfFalseBranch skip-case-2
  Drop
  ...body-2...
  Branch exit-placeholder
skip-case-2:
default:
  Drop                ; guard consumed before default body
  ...body-default...
exit-placeholder:
```

Key properties:
- Only **one** unconditional branch target (`exit-placeholder`) needs backpatching at the end.
- Each `case` owns a single `IfFalseBranch` placeholder; once patched (either by the next case/default or the closer), the structure is fully resolved.

## Guard Handling
The guard remains on the data stack throughout the construct. Each `case` emits a `Dup` before running its predicate; successful branches `Drop` the original guard, while failures leave it in place for subsequent cases. If every predicate fails, the mandatory `default` performs the final `Drop`, so the guard is always consumed by the time control leaves the switch.

## Error Conditions
- `case`/`default` outside `switch` → syntax error (raised during immediate execution).
- Missing `of` after `case` predicate → syntax error.
- Missing `default` clause → detected by the closer when a skip placeholder remains on the stack.
- `case` after `default` → immediate error raised when the meta context reports `defaultSeen = true`.
- Multiple `default` clauses → syntax error.
- Missing terminator (`;`) → detected by the closer (unpatched exit placeholder on the stack).
- Predicate that consumes the guard without restoring it → runtime concern; documentation will recommend treating the guard as read-only.

## Testing Checklist
- Single-case switch with match/miss.
- Multiple cases with middle match.
- `default` only fallback.
- Nested switches sharing guard cache discipline.
- Error cases: stray `case`, `case` after `default`, missing `of`, missing `default`, duplicate `default`, missing `;`.
