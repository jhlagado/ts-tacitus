# cond / when … do / default / endcond — Return-stack Exit Backpatching (Exploration Draft)

Status

- Purpose: Explore an alternative implementation that backpatches all exits using the return stack. No opener/anchor branches are emitted up front; exits are collected during clause closes and patched at endcond.
- Depends on: Plan 32 (brace-block removal)
- Scope: Immediate words only. Fixed arity at runtime AND constant compile-time arity (normative) via a 2-cell data-frame and the return stack for exit patch points.
- Tokens (proposed): cond, when, do, default, endcond

Programmer view

With a transient subject:

```
10 cond
  when dup 3 eq  do  "three"
  when dup 9 gt  do  "big"
  default          "default"
endcond
drop             \ discard subject after the construct
```

With a local:

```
: describe
  10 var x
  cond
    when x 3 eq  do  "three"
    when x 9 gt  do  "big"
    default          "default"
  endcond
;
```

Essentials

- Guard-based: Each when supplies its own predicate; first true wins; default runs if none match.
- No “pre-exit” anchor or unified forward-branch is emitted at cond. Instead:
  - Taken whens record a forward-branch patch point on the return stack (RSP).
  - At endcond, all recorded patch points are backpatched to the single exit after endcond.
- Subject/value management is explicit (dup/drop or locals).

High-level behavior (runtime)

- True predicate → run the when body. At the boundary (when/default/endcond), the compiler emits a short close sequence (only if skip != NIL) that:
  - Emits a forward Branch +0 (to be patched to the cond exit)
  - Pushes the operand address of that Branch on the return stack (as a patch record)
  - Patches the do’s IfFalseBranch (p_skip) to jump past this close sequence
  - Then continues with the next tokens; the forward Branch ensures later whens/default do not run
- False predicate → the IfFalseBranch at do skips both the body and its close sequence, continuing to the next when/default; no exit branch is recorded for this clause.
- default runs if no when matched; after default body, endcond is reached naturally; default does not need to record an exit (unless we desire symmetry, but it is not necessary).

Compiler model (constant meta-arity)

Legend (compile-time stacks; TOS rightmost)

- Data stack frame (constant size during an open cond):
  - savedRSP: snapshot of the return-stack pointer (RSP) taken at cond entry, kept at NOS
  - skip: NIL or p_skip (operand address of the current when’s IfFalseBranch)
  - Shape: [ …, savedRSP, skip ]
- Return stack (variable during an open cond):
  - Holds zero or more exit patch addresses (operand positions of Branch +0 recorded at taken-when closes)
  - endcond uses savedRSP to know how many entries to pop/patch

Branch addressing (relative)

- `Branch` / `IfFalseBranch` take a signed 16‑bit relative offset; VM does `IP := IP + offset` after reading the operand.
- Forward patch “to CP”: `offset = CP - (operandPos + 2)`
- Backward jump “to opcode at target”: `offset = targetOpcode - (operandPos + 2)`

Emits (tables; TOS → right)

1. `cond` (immediate opener)

| Emit/Action   | Notes                                            | Data Stack (TOS → right) | Return Stack |
| ------------- | ------------------------------------------------ | ------------------------ | ------------ |
| push RSP      | savedRSP := RSP current value                    | [ …, savedRSP ]          | [ … ]        |
| push NIL      | Initialize skip slot                             | [ …, savedRSP, NIL ]     | [ … ]        |
| (no branches) | Do not emit pre-exit anchors or forward branches | —                        | —            |

2. `when` (start new predicate region)

| Action              | Notes                                                                                     | Data Stack            | Return Stack        |
| ------------------- | ----------------------------------------------------------------------------------------- | --------------------- | ------------------- |
| ensure cond is open | Require frame [ savedRSP, (NIL or p_skip) ]                                               | [ …, savedRSP, skip ] | [ … ]               |
| if skip != NIL      | Close the current when (emit exit Branch +0 and record its operand; patch p_skip; set skip := NIL) | —                     | —                    |
| pop skip            | Pop p_skip from TOS                                                                       | [ …, savedRSP ]       | [ …, … ]            |
| emit Branch +0      | Record a forward branch to exit (placeholder operand)                                     | [ …, savedRSP ]       | [ …, … ]            |
| push operand on RSP | Rpush(operandAddressOf(Branch +0))                                                        | [ …, savedRSP ]       | [ …, …, patchAddr ] |
| patch p_skip        | Fall‑through: offFalse = CP − (p_skip + 2)                                                | [ …, savedRSP ]       | [ …, …, patchAddr ] |
| push NIL            | Restore skip slot to NIL (constant frame size)                                            | [ …, savedRSP, NIL ]  | [ …, …, patchAddr ] |
| (no emit yet)       | Subsequent tokens are processed normally; the next `do` immediate starts this when’s body | [ …, savedRSP, NIL ]  | [ …, … ]            |

3. `do` (start of this when’s body)

| Emit/Action       | Notes                                         | Data Stack              | Return Stack |
| ----------------- | --------------------------------------------- | ----------------------- | ------------ |
| IfFalseBranch +0  | p_skip := CP (operand address placeholder)    | [ …, savedRSP, NIL ]    | [ …, … ]     |
| set skip = p_skip | Replace NIL with p_skip (constant frame size) | [ …, savedRSP, p_skip ] | [ …, … ]     |

After `do`, subsequent tokens are processed normally; the next boundary immediate (when/default/endcond) closes the current when.

4. `default` (introduces default region; optional)

| Action               | Notes                                                                                          | Data Stack           | Return Stack         |
| -------------------- | ---------------------------------------------------------------------------------------------- | -------------------- | -------------------- |
| if skip != NIL       | Close the current when (emit exit Branch +0 and record its operand; patch p_skip; set skip := NIL) | —                    | —                    |
| pop skip             | Pop p_skip from TOS                                                                            | [ …, savedRSP ]      | [ …, … ]             |
| emit Branch +0       | Record a forward branch to exit (placeholder operand)                                          | [ …, savedRSP ]      | [ …, … ]             |
| push operand on RSP  | Rpush(operandAddressOf(Branch +0))                                                             | [ …, savedRSP ]      | [ …, …, patchAddr ]  |
| patch p_skip         | Fall‑through: offFalse = CP − (p_skip + 2)                                                     | [ …, savedRSP ]      | [ …, …, patchAddr ]  |
| push NIL             | Restore skip slot to NIL (constant frame size)                                                 | [ …, savedRSP, NIL ] | [ …, …, patchAddr ]  |
| compile default body | Subsequent tokens are processed normally; the next `endcond` immediate finalizes the construct | [ …, savedRSP, NIL ] | [ …, …, patchAddr? ] |

5. `endcond` (final closer)

| Action                   | Notes                                                      | Data Stack      | Return Stack         |
| ------------------------ | ---------------------------------------------------------- | --------------- | -------------------- |
| if skip != NIL          | Close the current when (emit exit Branch +0 and record its operand; patch p_skip; set skip := NIL) | —               | —                    |
| pop skip                 | Pop p_skip from TOS                                        | [ …, savedRSP ] | [ …, … ]             |
| emit Branch +0           | Record a forward branch to exit (placeholder operand)      | [ …, savedRSP ] | [ …, … ]             |
| push operand on RSP      | Rpush(operandAddressOf(Branch +0))                         | [ …, savedRSP ] | [ …, …, patchAddr ]  |
| patch p_skip             | Fall‑through: offFalse = CP − (p_skip + 2)                 | [ …, savedRSP ] | [ …, …, patchAddr ]  |
| exitAddr := CP           | Compute the final exit address (byte index of next opcode) | [ …, savedRSP ] | [ …, …, patchAddr? ] |
| while RSP > savedRSP:    | Repeatedly backpatch all recorded exits:                   |                 |                      |
| • addr := RPOP()         | Pop top recorded exit patch address                        | [ …, savedRSP ] | [ …, … ]             |
| • patch16(addr, offExit) | offExit := exitAddr − (addr + 2)                           | [ …, savedRSP ] | [ …, … ]             |
| drop savedRSP            | Tear down the frame                                        | [ … ]           | [ …, … ]             |

Notes

- when, default, and endcond close the current when if one is open; this removes the need for per-when explicit terminators and keeps the surface compact.
- Exits are unified at endcond by backpatching all recorded forward branches to the single exit.

Correctness invariants (normative)

- Runtime fixed arity
  - Each predicate leaves exactly one numeric flag; bodies have explicit stack behavior.
- Constant compile-time meta‑arity
  - Open frame is always 2 items: [ savedRSP, skip ] with the TOS slot named skip (skip ∈ { NIL, p_skip }).
  - do sets skip to p_skip; closing a when resets skip to NIL.
  - endcond pops skip (if present), then backpatches all recorded exits until RSP equals savedRSP; finally drops savedRSP.
- Single‑exit guarantee
  - All taken whens record an exit and then skip subsequent whens/default via their forward branch; all such exits are backpatched to the same exit at endcond.
- Relative‑branch math
  - VM applies `IP := IP + offset` after reading a 16‑bit operand:
    - Fall‑through (IfFalseBranch): `offFalse = CP − (p_skip + 2)`
    - Final exit (forward): `offExit = exitAddr − (addr + 2)` for each recorded patch address
- Nesting and LIFO
  - Nested cond constructs are allowed anywhere ordinary code is allowed.
  - Inner immediates (when/do/default/endcond) must restore their own frame before outer ones run.
- Default region
  - default is optional; when present, it runs until endcond.
  - If all predicates are false and default is omitted, control reaches endcond and exits; no exit branches are recorded.

Isolated test scenarios (to be implemented)

A) cond (opener) emits (frame only)

- Input: "cond"
  - CODE: no branches emitted at opener
  - Data stack: [ …, savedRSP, NIL ] (savedRSP equals current RSP snapshot)
  - Return stack: unchanged

B) do (clause start) emits (bytes + frame)

- Input: "cond when P do"
  - CODE append:
    - next8() == Op.IfFalseBranch
    - nextInt16() == 0 (placeholder for p_skip)
  - Data stack: [ …, savedRSP, p_skip(number) ]

C) Closing a when (stack constancy + forward exit record + fall‑through patch)

- Input: "cond when P do B when …"
  - Just before the second when, the first when is closed automatically:
    - CODE: emitted Branch +0; its operand address was pushed on RSP; p_skip was patched to skip the close sequence
    - Data stack returns to [ …, savedRSP, NIL ]

D) default (introducer)

- Input: "cond when P do B default D endcond"
  - If skip was set, default FIRST closes the current when by emitting Branch +0, pushing its operand address on RSP, patching p_skip to fall through, and restoring skip to NIL; stack returns to [ …, savedRSP, NIL ]
  - D compiles; endcond later backpatches all recorded exit addresses

E) endcond (closer)

- Input: "cond endcond"
  - Behavior: no exits recorded; loop patches nothing; frame [ savedRSP ] torn down; exit performed
- Input: "cond when P do B endcond"
  - Behavior: endcond closes the open when (emit Branch +0 and record it; patch p_skip), then backpatches that single exit to the endcond exit; frame torn down

F) Degenerate forms

- No whens, no default: "cond endcond" → valid, no exits recorded
- Default only: "cond default D endcond" → D runs unconditionally; no exits recorded
- Whens only (no default): each taken when records an exit; if none taken, falls through to endcond

Worked example (bytes, sketch)

- Assume:
  - do emits: IfFalseBranch 00 00 (p_skip points to those two bytes)
  - close emits: Branch 00 00, then pushes addr(00 00) on RSP
- Sequence:
  - cond
  - when P0 do B0 (p_skip0)
  - close → Branch +0; push addr0; patch p_skip0
  - when P1 do B1 (p_skip1)
  - close → Branch +0; push addr1; patch p_skip1
  - default D
  - endcond → for addr in [addr1, addr0] pop and patch to exitAddr

Comparative analysis (advantages and tradeoffs)

- Advantages:
  - No up-front preExit anchor or unified forward Branch required
  - Straight-line close logic; exits are centralized at endcond
  - Naturally supports multiple taken branches in code generation (though at runtime only the first true runs)
- Tradeoffs:
  - Uses the return stack for compiler patch bookkeeping
  - Slightly more work at endcond (loop through exit patches)
  - Requires careful interaction with nesting (savedRSP provides a robust delimiter)

Diagnostics (errors)

- when without cond
- do without when
- Multiple do’s in the same when without a boundary
- endcond with an incoherent frame (e.g., missing savedRSP/skip due to earlier errors)

Summary

- This exploration replaces the preExit/unified forward-branch pattern with “record exits and patch later” using the return stack for patch addresses.
- Entry discipline (save RSP + NIL skip), per-when close discipline (emit Branch +0 + record + patch p_skip), and endcond backpatch loop together yield a single, clean exit while keeping the compile-time data-frame constant.
