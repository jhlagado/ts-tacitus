# cond / when … do / default / ; — Return-stack Exit Backpatching with Generic Closer (Exploration Draft)

Status

- Purpose: Explore return-stack-based exit backpatching for cond/when/do/default using the generic `;` closer. The generic `;` pops and evaluates an EndCode BUILTIN closer placed on TOS by the construct, same pattern as other generic-closer constructs.
- Depends on: Plan 31 (`;` generic closer), Plan 32 (brace-block removal)
- Scope: Immediate words only. Immediate-driven compilation (Forth/Tacit style). Fixed arity at runtime and constant compile-time meta-arity via a 3-cell data-frame plus a return-stack ledger.

Tokens (proposed)

- cond, when, do, default, ;

Programmer view

With a transient subject:

```
10 cond
  when dup 3 eq  do  "three"
  when dup 9 gt  do  "big"
  default          "default"
;
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
  ;
;
```

Essentials

- Guard-based: Each when supplies its predicate; first true wins; default runs if none match.
- Exit management is deferred: taken whens record their forward exit branches on the return stack; these are backpatched by the EndCode closer evaluated by the generic `;`.
- Immediate-driven: subsequent tokens are processed normally; the immediates (when / do / default / `;`) control compilation.

High-level behavior (runtime)

- True predicate → run the when body; at the next boundary (when/default/;), compilation emits a short “close current when” sequence that:
  - Emits a forward Branch +0 (to be patched to the cond exit)
  - Pushes that branch’s operand address on the return stack (as a patch record)
  - Patches the do’s IfFalseBranch (p_skip) to jump past this close sequence (fall-through)
  - Ensures subsequent whens/default do not run at runtime
- False predicate → do’s IfFalseBranch skips the body and its close sequence; no exit branch is recorded.
- default runs if no when matched; falls into the final `;`.

Compiler model (constant meta-arity)

Legend (compile-time stacks; TOS rightmost)

- Data stack (constant during an open cond):
  - savedRSP: snapshot of the return-stack pointer (RSP) at cond entry
  - skip: NIL or p_skip (operand address of current when’s IfFalseBranch)
  - EndCode: Tag.BUILTIN closer placed on TOS so the generic `;` can pop and execute it
  - Shape: [ …, savedRSP, skip, EndCode ]
- Return stack (variable during an open cond):
  - Holds zero or more exit patch addresses (operand positions of Branch +0 recorded at taken-when closes)
  - EndCode uses savedRSP to know how many entries to pop/patch

Branch addressing (relative)

- `Branch` / `IfFalseBranch` take a signed 16‑bit relative offset; VM does `IP := IP + offset` after reading the operand.
- Forward patch “to CP”: offset = CP − (operandPos + 2)
- Backward jump “to opcode at target”: offset = targetOpcode − (operandPos + 2)

Emits (tables; TOS → right)

1. cond (immediate opener)

| Emit/Action   | Notes                                                      | Data Stack (TOS → right)      | Return Stack |
| ------------- | ---------------------------------------------------------- | ----------------------------- | ------------ |
| push RSP      | savedRSP := RSP current value                              | [ …, savedRSP ]               | [ … ]        |
| push NIL      | Initialize skip slot                                       | [ …, savedRSP, NIL ]          | [ … ]        |
| push EndCode  | BUILTIN closer (to be popped and evaluated by generic `;`) | [ …, savedRSP, NIL, EndCode ] | [ … ]        |
| (no branches) | No pre-exit anchors or forward branches at opener          | —                             | —            |

2. when (start new predicate region)

| Action                | Notes                                                                                     | Data Stack                    | Return Stack        |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | ------------------- |
| pop EndCode           | Preserve closer on entry; restore before returning                                        | [ …, savedRSP, skip ]         | [ …, … ]            |
| if skip != NIL        | Close current when (emit/record/patch; see rows below)                                    | —                             | —                   |
| • pop skip            | Pop p_skip from TOS                                                                       | [ …, savedRSP ]               | [ …, … ]            |
| • emit Branch +0      | Record a forward branch to exit (placeholder operand)                                     | [ …, savedRSP ]               | [ …, … ]            |
| • push operand on RSP | Rpush(operandAddressOf(Branch +0))                                                        | [ …, savedRSP ]               | [ …, …, patchAddr ] |
| • patch p_skip        | Fall‑through: offFalse = CP − (p_skip + 2)                                                | [ …, savedRSP ]               | [ …, …, patchAddr ] |
| • push NIL            | Restore skip slot to NIL (constant frame size)                                            | [ …, savedRSP, NIL ]          | [ …, …, patchAddr ] |
| (no emit yet)         | Subsequent tokens are processed normally; the next `do` immediate starts this when’s body | [ …, savedRSP, NIL ]          | [ …, … ]            |
| push EndCode          | Restore EndCode to TOS                                                                    | [ …, savedRSP, NIL, EndCode ] | [ …, … ]            |

3. do (start of this when’s body)

| Emit/Action       | Notes                                              | Data Stack                       | Return Stack |
| ----------------- | -------------------------------------------------- | -------------------------------- | ------------ |
| pop EndCode       | Preserve closer on entry; restore before returning | [ …, savedRSP, skip ]            | [ …, … ]     |
| IfFalseBranch +0  | p_skip := CP (operand address placeholder)         | [ …, savedRSP, skip ]            | [ …, … ]     |
| set skip = p_skip | Replace NIL with p_skip (constant frame size)      | [ …, savedRSP, p_skip ]          | [ …, … ]     |
| push EndCode      | Restore EndCode to TOS                             | [ …, savedRSP, p_skip, EndCode ] | [ …, … ]     |

After `do`, subsequent tokens are processed normally; the next boundary immediate (when/default/`;`) closes the current when.

4. default (introduces default region; optional)

| Action                | Notes                                                                                     | Data Stack                    | Return Stack         |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | -------------------- |
| pop EndCode           | Preserve closer on entry; restore before returning                                        | [ …, savedRSP, skip ]         | [ …, … ]             |
| if skip != NIL        | Close current when (emit/record/patch; see rows below)                                    | —                             | —                    |
| • pop skip            | Pop p_skip from TOS                                                                       | [ …, savedRSP ]               | [ …, … ]             |
| • emit Branch +0      | Record a forward branch to exit (placeholder operand)                                     | [ …, savedRSP ]               | [ …, … ]             |
| • push operand on RSP | Rpush(operandAddressOf(Branch +0))                                                        | [ …, savedRSP ]               | [ …, …, patchAddr ]  |
| • patch p_skip        | Fall‑through: offFalse = CP − (p_skip + 2)                                                | [ …, savedRSP ]               | [ …, …, patchAddr ]  |
| • push NIL            | Restore skip slot to NIL (constant frame size)                                            | [ …, savedRSP, NIL ]          | [ …, …, patchAddr ]  |
| compile default body  | Subsequent tokens are processed normally; the final generic `;` will finish the construct | [ …, savedRSP, NIL ]          | [ …, …, patchAddr? ] |
| push EndCode          | Restore EndCode to TOS                                                                    | [ …, savedRSP, NIL, EndCode ] | [ …, …, patchAddr? ] |

5. Generic `;` (final closer — pops and evaluates EndCode)

Generic `;` pops EndCode from TOS and executes it:

| EndCode (execute)        | Notes                                                           | Data Stack      | Return Stack         |
| ------------------------ | --------------------------------------------------------------- | --------------- | -------------------- |
| if skip != NIL           | Close current when (emit/record/patch; see rows below)          | —               | —                    |
| • pop skip               | Pop p_skip from TOS                                             | [ …, savedRSP ] | [ …, … ]             |
| • emit Branch +0         | Record a forward branch to exit (placeholder operand)           | [ …, savedRSP ] | [ …, … ]             |
| • push operand on RSP    | Rpush(operandAddressOf(Branch +0))                              | [ …, savedRSP ] | [ …, …, patchAddr ]  |
| • patch p_skip           | Fall‑through: offFalse = CP − (p_skip + 2)                      | [ …, savedRSP ] | [ …, …, patchAddr ]  |
| exitAddr := CP           | Compute the final exit address (CP = byte index of next opcode) | [ …, savedRSP ] | [ …, …, patchAddr? ] |
| while RSP > savedRSP:    | Repeatedly backpatch all recorded exits:                        |                 |                      |
| • addr := RPOP()         | Pop top recorded exit patch address                             | [ …, savedRSP ] | [ …, … ]             |
| • patch16(addr, offExit) | offExit := exitAddr − (addr + 2)                                | [ …, savedRSP ] | [ …, … ]             |
| drop savedRSP            | Tear down the frame                                             | [ … ]           | [ …, … ]             |

Notes

- when, default, and `;` “close the current when” if one is open; this removes per-when explicit terminators while keeping immediate-driven compilation clear.
- EndCode on TOS allows the generic `;` to work uniformly: pop closer → eval closer.

Correctness invariants (normative)

- Runtime fixed arity
  - Each predicate leaves exactly one numeric flag; bodies have explicit stack behavior.
- Constant compile-time meta‑arity
  - Open frame is always 3 items: [ savedRSP, skip, EndCode ].
  - do sets skip to p_skip; closing a when (when/default/EndCode) consumes p_skip (no restoring needed).
  - EndCode pops skip (if present), backpatches until RSP == savedRSP, then drops savedRSP.
- Single‑exit guarantee
  - All taken whens record a forward exit branch; EndCode backpatches all recorded exits to the same final exit.
- Relative‑branch math
  - VM applies `IP := IP + offset` after reading a 16‑bit operand:
    - Fall‑through (IfFalseBranch): offFalse = CP − (p_skip + 2)
    - Final exit (forward): offExit = exitAddr − (addr + 2) for each recorded patch address
- Nesting and LIFO
  - Nested cond constructs are allowed anywhere ordinary code is allowed.
  - Immediates must preserve EndCode on TOS by popping it on entry and restoring it before returning.
- Default region
  - default is optional; when present, it runs until the final generic `;`.
  - If all predicates are false and default is omitted, control reaches `;` and exits; no exit branches are recorded.

Isolated test scenarios (to be implemented)

A) cond (opener) frame

- Input: "cond"
  - CODE: no branches emitted at opener
  - Data stack: [ …, savedRSP, NIL, EndCode ] (savedRSP equals current RSP snapshot)
  - Return stack: unchanged

B) do (clause start) emits

- Input: "cond when P do"
  - CODE append:
    - next8() == Op.IfFalseBranch
    - nextInt16() == 0 (placeholder for p_skip)
  - Data stack: [ …, savedRSP, p_skip, EndCode ]

C) Closing a when at a following when

- Input: "cond when P do B when …"
  - Just before the second when:
    - CODE: emitted Branch +0; its operand address was pushed on RSP; p_skip was patched to skip the close sequence
    - Data stack returns to [ …, savedRSP, NIL, EndCode ]

D) default

- Input: "cond when P do B default D ;"
  - If skip was set, default first closes the current when (emit Branch +0, Rpush operand, patch p_skip), leaving [ …, savedRSP, NIL, EndCode ]
  - D compiles; `;` later backpatches all recorded exit addresses

E) final generic `;`

- Input: "cond ;"
  - Behavior: no exits recorded; EndCode patches nothing; drops savedRSP; frame torn down
- Input: "cond when P do B ;"
  - Behavior: EndCode closes the open when (emit Branch +0 and record; patch p_skip), then backpatches that single exit to the final exit; frame torn down

F) Degenerate forms

- No whens, no default: "cond ;" → valid, no exits recorded
- Default only: "cond default D ;" → D runs unconditionally; no exits recorded
- Whens only (no default): each taken when records an exit; if none taken, falls through to `;`

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
  - ; → for addr in [addr1, addr0] pop and patch to CP (final exit)

Comparative analysis (advantages and tradeoffs)

- Advantages:
  - Integrates with the standard generic `;` closer pattern via EndCode on TOS
  - No up-front pre-exit anchor or unified forward Branch at cond
  - Straight-line close logic; all exits centralized at EndCode
- Tradeoffs:
  - Requires each immediate (when/do/default) to pop/restore EndCode on TOS
  - EndCode backpatch loop at `;` handles all recorded exits
  - Uses return stack as an exit-ledger; savedRSP bounds the ledger

Diagnostics (errors)

- when without cond
- do without when
- Multiple do’s in the same when without a boundary
- `;` evaluating EndCode with an incoherent frame (e.g., missing savedRSP/skip due to earlier errors)

Summary

- This exploration merges return-stack-based exit backpatching with the generic-closer model by placing EndCode on TOS.
- Entry discipline (push savedRSP, NIL, EndCode), per-when close discipline (emit Branch +0 + record + patch p_skip), and EndCode’s backpatch loop together yield a single exit and preserve a constant compile-time frame shape during the construct.
