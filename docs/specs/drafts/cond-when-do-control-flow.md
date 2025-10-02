# cond / when … do / default / ; — Guarded Multi-branch (Exploration Draft)

Status

- Purpose: Explore a familiar “cond/when/default” surface over Tacit’s guard-based, first-true-wins semantics; assess advantages vs when/do and ifx/thenx/elifx/elsex
- Depends on: Plan 31 (`;` generic closer), Plan 32 (brace-block removal)
- Scope: Immediate words only. Fixed arity at runtime AND constant compile-time arity (normative) via a single skip slot (NIL-or-address)
- Tokens (proposed): cond, when, do, default, ; (final ‘;’ executes the EndCond closer via the generic closer)

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

- Guard-based: Each when supplies its own predicate; first true wins; default runs if none match.
- Subject management is explicit:
  - Transient subject: duplicate (dup) wherever needed; drop after the final `;` if it should not escape.
  - Local subject: use a var or other binding; no need to dup.

Behavior

- True predicate → enter when body; at the next boundary (when/default/;) that when is closed and the construct exits (skips the rest).
- False predicate → jump over that when’s body to the next when or default; if none, control reaches the final `;` (no default).
- Boundaries are explicit tokens: when, default, `;`.

Compiler model (constant meta-arity)

Legend (compile-time data stack; TOS rightmost)

- EndCond: Tag.BUILTIN closer executed by the generic ‘;’ to finalize the construct (mirrors EndWhen in when/do). It sits directly beneath the skip slot (second from top).
- preExit: code address (number) immediately AFTER `Branch +3` (the opcode of the second Branch). Back‑branch target for taken whens (the “pre‑exit” hop). Kept until the final ‘;’.
- p_exit: 16‑bit operand address (number) of the opener’s forward Branch (patched to the final exit at the final ‘;’).
- skip: single slot always present above EndCond; holds:
  - NIL → no open when
  - p_skip (number) → operand address of the current when’s IfFalseBranch (when is open)

Branch addressing (relative)

- `Branch` / `IfFalseBranch` take a signed 16‑bit relative offset; VM does `IP := IP + offset` after reading the operand.
- Forward patch “to here”: `offset = here - (operandPos + 2)`
- Backward jump “to opcode at target”: `offset = targetOpcode - (operandPos + 2)`
- `Branch +3` skips one Branch instruction (1 byte opcode + 2 bytes operand)

Sentinel (normative)

- Use NIL as the skip sentinel; it must not collide with valid operand addresses (finite, non‑negative).

Emits (tables; TOS → right)

1. cond (immediate opener)

| Emit           | Notes                                      | Stack (TOS → right)                    |
| -------------- | ------------------------------------------ | -------------------------------------- |
| Branch +3      | preExit := CP (address of next opcode)     | [ … ]                                  |
| Branch +0      | p_exit := CP (operand address placeholder) | [ … ]                                  |
| push p_exit    | Number                                     | [ …, p_exit ]                          |
| push preExit   | Number                                     | [ …, p_exit, preExit ]                 |
| push EndCond | BUILTIN closer (generic ‘;’ executes this) | [ …, p_exit, preExit, EndCond ]      |
| push NIL       | skip slot (NIL)                        | [ …, p_exit, preExit, EndCond, NIL ] |

2. when (begin a new when’s predicate region)

| Action                | Notes                                                          | Stack (TOS → right)                                 |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| ensure cond is open | Require frame [ p_exit, preExit, EndCond, skip ]; if skip != NIL, boundary auto-close runs first | [ …, p_exit, preExit, EndCond, skip ] |
| (no emit yet)         | After boundary auto-close, predicates compile until `do`       | [ …, p_exit, preExit, EndCond, NIL ]              |

3. do (start of this when’s body)

| Emit/Action             | Notes                                          | Stack (TOS → right)                          |
| ----------------------- | ---------------------------------------------- | -------------------------------------------- |
| IfFalseBranch +0        | p_skip := CP (operand address placeholder)    | [ …, p_exit, preExit, EndCond, skip ] |
| set skip = p_skip  | Replace NIL with p_skip (constant frame size) | [ …, p_exit, preExit, EndCond, p_skip ]   |

When body compiles until the next boundary token: when, default, or `;`.

4. Boundary auto-close (when encountering when/default/‘;’)

If skip != NIL, close the previously opened when (EndCond remains in place):

| Action             | Notes                                                      | Stack (TOS → right)                    |
| ------------------ | ---------------------------------------------------------- | -------------------------------------- |
| pop skip       | Pop p_skip from TOS                                       | [ …, p_exit, preExit, EndCond ]      |
| emit Branch (back) | Target = preExit, offBack = preExit − (hereOperandPos + 2) | [ …, p_exit, preExit, EndCond ]      |
| patch p_skip      | Fall‑through: offFalse = here − (p_skip + 2)              | [ …, p_exit, preExit, EndCond ]      |
| push NIL           | Restore skip slot to NIL (constant frame size)         | [ …, p_exit, preExit, EndCond, NIL ] |

5. default (introduces default region; optional)

| Action                 | Notes                                    | Stack (TOS → right)                    |
| ---------------------- | ---------------------------------------- | -------------------------------------- |
| (auto-close skip)  | If skip != NIL, close previous when  | [ …, p_exit, preExit, EndCond, NIL ] |
| begin default region   | Compile code until final `;`             | [ …, p_exit, preExit, EndCond, NIL ] |

6. ‘;’ (final closer — executes EndCond via generic closer)

| Action               | Notes                                                                  | Stack (TOS → right)               |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| pop skip         | Generic ‘;’ first pops skip (NIL or p_skip)                       | [ …, p_exit, preExit, EndCond ] |
| execute EndCond    | Generic ‘;’ then evals EndCond (now at TOS):                         | [ …, p_exit, preExit ] → [ … ]    |
| (EndCond behavior) | If popped value was p_skip: close last when (back‑branch + patch)     |                                   |
|                      | Drop preExit; patch p_exit (offExit = here − (p_exit + 2)); pop p_exit |                                   |

Notes

- Auto-close at boundaries removes the need for per-clause explicit terminators and keeps the surface compact.

Correctness invariants (normative)

- Runtime fixed arity
  - Each predicate leaves exactly one numeric flag; bodies have explicit stack behavior.
- Constant compile-time meta‑arity
  - Open frame is always 4 items: [ p_exit, preExit, EndCond, skip ] with the TOS slot named skip.
  - do sets skip to p_skip; boundary auto-close resets skip to NIL.
  - The final `;` pops exactly one skip (NIL or p_skip), then executes EndCond to drop preExit, patch p_exit, and pop p_exit.
- preExit and closer discipline
  - EndCond sits beneath the skip slot for the lifetime of the construct: frame shape is always [ p_exit, preExit, EndCond, skip ].
  - Boundary auto-closes manipulate only the skip slot (pop/patch/push NIL) and must not move EndCond or preExit.
  - The final ‘;’ first pops the skip slot (to NIL or p_skip), then executes the EndCond closer at TOS.
- Single‑exit guarantee
  - All taken whens back‑branch to preExit, then the unified forward Branch at preExit jumps to a single exit set by the final `;`.
- Relative‑branch math
  - VM applies `IP := IP + offset` after reading a 16‑bit operand:
    - Backward (to opcode at preExit): `offBack = preExit − (hereOperandPos + 2)`
    - Fall‑through (IfFalseBranch): `offFalse = here − (p_skip + 2)`
    - Final exit (forward): `offExit = here − (p_exit + 2)`
- Nesting and LIFO
  - Nested cond constructs are allowed anywhere ordinary code is allowed.
  - Inner immediates (when/do/default/‘;’) must restore their own frame before outer ones run.
- Default region
  - default is optional; when present, it runs until the final `;`.
  - If all predicates are false and default is omitted, control reaches the final `;` and exits.

Isolated test scenarios (to be implemented)

- Degenerate forms (all must compile and run with correct exits)
  - No whens, no default:
    - Input:
      ```
      cond ;
      ```
    - CODE: two Branches from opener; final ‘;’ pops NIL, executes EndCond → patches p_exit to here; no bodies emitted
    - Stack behavior: frame [ p_exit, preExit, EndCond, NIL ] → final ‘;’ → [ … ]
  - No whens, default only:
    - Input:
      ```
      cond default D ;
      ```
    - Boundary at default auto-closes nothing (skip==NIL), compiles D; final ‘;’ pops NIL and finalizes; D runs unconditionally
  - Whens but no default:
    - Input:
      ```
      cond
        when P0 do B0
        when P1 do B1
      ;
      ```
    - Each when boundary auto-closes previous skip; if all predicates false → final ‘;’ pops NIL and exits; if any true → back-branch to preExit then generic forward exit at final ‘;’

A) cond (opener) emits (bytes + stack)

- Input: "cond"
  - CODE:
    - next8() == Op.Branch
    - nextInt16() == 3
    - next8() == Op.Branch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit(number), preExit(number), EndCond, NIL ]

B) do (clause start) emits (bytes + stack)

- Input: "cond when P do"
  - CODE append:
    - next8() == Op.IfFalseBranch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit, preExit, EndCond, p_skip(number) ]
- Input: "do" without when (or with skip already set)
  - Expect syntax error

C) Auto-close at boundary (stack constancy + back‑branch + fall‑through patch)

- Input: "cond when P do B when …"
  - Just before the second when, the first when is auto‑closed:
    - Data stack returns to [ …, p_exit, preExit, EndCond, NIL ]
  - CODE:
    - One backward Branch; operand encodes `offBack = preExit − (hereOperandPos + 2)`
    - p_skip patched to `offFalse = here − (p_skip + 2)`

D) default (introducer)

- Input: "cond when P do B default D ;"
  - If skip was set, it is closed; stack returns to [ …, p_exit, preExit, EndCond, NIL ]
  - D compiles; the final `;` later patches p_exit

E) final `;` (closer)

- Input: "cond ;"
  - Data stack becomes [ … ] (pop skip(NIL); drop preExit; patch p_exit; pop p_exit)
- Input: "cond when P do B ;"
  - Behavior: the final `;` auto‑closes the open when (back‑branch + patch), then drops preExit, patches p_exit, pops p_exit
  - Ensures “no default” last when is valid without an explicit clause terminator

F) Nesting (valid)

- Input:

  ```
  cond
    cond ;   \ inner cond inside outer default or when body
  ;
  ```

  - Inner final `;` runs first; outer final `;` runs last; outer frame intact

G) Behavioral (first‑true‑wins, default)

- "cond when 1 do 10 when 1 do 20 ;" → 10
- "cond when 0 do 10 when 1 do 20 ;" → 20
- "cond when 0 do 10 when 0 do 20 default 99 ;" → 99

Comparative analysis (advantages and tradeoffs)

vs when/do

- Pros:
  - Familiar surface for many programmers (“cond/when/default”).
  - Less punctuation: no per‑clause terminator token required; boundaries auto‑close.
  - Strong visual alignment of “when <predicate> do <body>”.
- Cons:
  - Keyword after predicate (“do”) is slightly “reversed” compared to “when … then”-style; this was a prior concern.
  - Auto‑close adds a small amount of immediate‑side logic at boundary tokens (still constant meta‑arity).

vs ifx/thenx/elifx/elsex

- Pros:
  - Fewer distinct keywords to learn; `when/do/default/;` mirrors common idioms.
  - Natural reading order in clause: predicate, then “do”, then body.
  - Auto‑close at boundaries reduces the chance of forgetting a clause closer.
- Cons:
  - ifx/thenx/elifx separates clause start (thenx) from clause boundary (elifx) more explicitly; some may prefer explicit “elifx” to implicit boundary control.

Open questions to evaluate during prototyping

- Do we want to allow “empty body” whens (e.g., “when P do” followed by immediate boundary)? If allowed, ensure `do` sets skip, boundary auto‑close fires, yielding a no‑op body.
- Error policy if a programmer writes `do` twice within a when without an intervening boundary.
- Diagnostics quality: “when without cond”, “do without when”, “; with skip==NIL but unexpected state”, etc.

Summary

- This exploration keeps Tacit’s invariants: immediate‑only, constant compile‑time meta‑arity, first‑true‑wins, single exit.
- It provides a familiar surface with less punctuation via boundary auto‑close, while preserving explicit subject management.
- Worth prototyping alongside when/do and ifx/thenx/elifx to compare readability, error rates, and bytecode clarity.
