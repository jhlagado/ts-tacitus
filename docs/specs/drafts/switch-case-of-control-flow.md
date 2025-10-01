# switch / case … of / default / ; — Guarded Multi-branch (Exploration Draft)

Status
- Purpose: Explore a familiar “switch/case/default” surface over Tacit’s guard-based, first-true-wins semantics; assess advantages vs when/do and ifx/thenx/elifx/elsex
- Depends on: Plan 32 (brace-block removal)
- Scope: Immediate words only. Fixed arity at runtime AND constant compile-time arity (normative) via a single pending slot (NIL-or-address)
- Tokens (proposed): switch, case, of, default, ;

Programmer view

With a transient subject:
```
10 switch
  case dup 3 eq  of  "three"
  case dup 9 gt  of  "big"
  default          "default"
;
drop             \ discard subject after the construct
```

With a local:
```
: describe
  10 var x
  switch
    case x 3 eq  of  "three"
    case x 9 gt  of  "big"
    default          "default"
  ;
;
```

Essentials
- Guard-based: Each case supplies its own predicate; first true wins; default runs if none match.
- Subject management is explicit:
  - Transient subject: duplicate (dup) wherever needed; drop after the final `;` if it should not escape.
  - Local subject: use a var or other binding; no need to dup.

Behavior
- True predicate → enter case body; at the next boundary (case/default/;) that case is closed and the construct exits (skips the rest).
- False predicate → jump over that case’s body to the next case or default; if none, control reaches the final `;` (no default).
- Boundaries are explicit tokens: case, default, `;`.

Compiler model (constant meta-arity)

Legend (compile-time data stack; TOS rightmost)
- preExit: code address (number) immediately AFTER `Branch +3` (the opcode of the second Branch). Back‑branch target for taken cases (the “pre‑exit” hop). Kept at NOS until the final `;`.
- p_exit: 16‑bit operand address (number) of the opener’s forward Branch (patched to the final exit at the final `;`).
- pending: single slot always present atop preExit; holds:
  - NIL → no open case
  - p_false (number) → operand address of the current case’s IfFalseBranch (case is open)

Branch addressing (relative)
- `Branch` / `IfFalseBranch` take a signed 16‑bit relative offset; VM does `IP := IP + offset` after reading the operand.
- Forward patch “to here”: `offset = here - (operandPos + 2)`
- Backward jump “to opcode at target”: `offset = targetOpcode - (operandPos + 2)`
- `Branch +3` skips one Branch instruction (1 byte opcode + 2 bytes operand)

Sentinel (normative)
- Use NIL as the pending sentinel; it must not collide with valid operand addresses (finite, non‑negative).

Emits (tables; TOS → right)

1) switch (immediate opener)

| Emit        | Notes                                          | Stack (TOS → right)        |
|-------------|------------------------------------------------|----------------------------|
| Branch +3   | preExit := CP (address of next opcode)         | [ … ]                      |
| Branch +0   | p_exit := CP (operand address placeholder)     | [ … ]                      |
| push p_exit | Number                                         | [ …, p_exit ]              |
| push preExit| Number (kept at NOS)                           | [ …, p_exit, preExit ]     |
| push NIL    | pending slot (NIL)                             | [ …, p_exit, preExit, NIL ]|

2) case (begin a new case’s predicate region)

| Action                 | Notes                                           | Stack (TOS → right)         |
|------------------------|-------------------------------------------------|------------------------------|
| ensure switch is open  | Error if no `[p_exit, preExit, pending]` frame  | [ …, p_exit, preExit, * ]    |
| (no emit yet)          | Predicates compile as ordinary code until `of`  | [ …, p_exit, preExit, * ]    |

3) of (start of this case’s body)

| Emit/Action           | Notes                                           | Stack (TOS → right)             |
|-----------------------|-------------------------------------------------|---------------------------------|
| IfFalseBranch +0      | p_false := CP (operand address placeholder)     | [ …, p_exit, preExit, pending ] |
| set pending = p_false | Replace NIL with p_false (constant frame size)  | [ …, p_exit, preExit, p_false ] |

Case body compiles until the next boundary token: case, default, or `;`.

4) Boundary auto-close (when encountering case/default/`;`)

If pending != NIL, close the previously opened case:

| Action             | Notes                                                             | Stack (TOS → right)               |
|--------------------|-------------------------------------------------------------------|-----------------------------------|
| emit Branch (back) | Target = preExit (peek), offBack = preExit − (hereOperandPos + 2) | [ …, p_exit, preExit, p_false ]   |
| patch p_false      | Fall‑through: offFalse = here − (p_false + 2)                     | [ …, p_exit, preExit, p_false ]   |
| set pending = NIL  | Reset slot to NIL (constant frame size)                           | [ …, p_exit, preExit, NIL ]       |

5) default (introduces default region; optional)

| Action               | Notes                                  | Stack (TOS → right)        |
|----------------------|----------------------------------------|----------------------------|
| (auto-close pending) | If pending != NIL, close previous case | [ …, p_exit, preExit, NIL ]|
| begin default region | Compile code until final `;`           | [ …, p_exit, preExit, NIL ]|

6) `;` (final closer)

| Action        | Notes                                          | Stack (TOS → right)      |
|---------------|------------------------------------------------|---------------------------|
| (auto-close)  | If pending != NIL, close last case             | [ …, p_exit, preExit, NIL ]|
| pop pending   | Always exactly one item (NIL)                  | [ …, p_exit, preExit ]    |
| drop preExit  | No longer needed                               | [ …, p_exit ]             |
| patch p_exit  | Forward: offExit = here − (p_exit + 2)         | [ …, p_exit ]             |
| pop p_exit    | Close construct                                | [ … ]                     |

Notes
- Auto-close at boundaries removes the need for per-clause explicit terminators and keeps the surface compact.

Correctness invariants (normative)
- Runtime fixed arity
  - Each predicate leaves exactly one numeric flag; bodies have explicit stack behavior.
- Constant compile-time meta‑arity
  - Open frame is always 3 items: [ p_exit, preExit, pending ] where pending ∈ {NIL, p_false}.
  - case/of sets pending to p_false; boundary auto-close resets pending to NIL.
  - The final `;` pops exactly one pending (should be NIL after auto-close), then tears down preExit and p_exit in fixed sequence.
- preExit discipline
  - preExit remains at NOS during the entire construct; case closes peek preExit to compute the back‑branch; they must not pop or reorder it.
- Single‑exit guarantee
  - All taken cases back‑branch to preExit, then the unified forward Branch at preExit jumps to a single exit set by the final `;`.
- Relative‑branch math
  - VM applies `IP := IP + offset` after reading a 16‑bit operand:
    - Backward (to opcode at preExit): `offBack = preExit − (hereOperandPos + 2)`
    - Fall‑through (IfFalseBranch): `offFalse = here − (p_false + 2)`
    - Final exit (forward): `offExit = here − (p_exit + 2)`
- Nesting and LIFO
  - Nested switch constructs are allowed anywhere ordinary code is allowed.
  - Inner immediates (case/of/default/`;`) must restore their own frame before outer ones run.
- Default region
  - default is optional; when present, it runs until the final `;`.
  - If all predicates are false and default is omitted, control reaches the final `;` and exits.

Isolated test scenarios (to be implemented)

A) switch (opener) emits (bytes + stack)
- Input: "switch"
  - CODE:
    - next8() == Op.Branch
    - nextInt16() == 3
    - next8() == Op.Branch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit(number), preExit(number), NIL ]

B) of (clause start) emits (bytes + stack)
- Input: "switch case P of"
  - CODE append:
    - next8() == Op.IfFalseBranch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit, preExit, p_false(number) ]
- Input: "of" without case (or with pending already set)
  - Expect syntax error

C) Auto-close at boundary (stack constancy + back‑branch + fall‑through patch)
- Input: "switch case P of B case …"
  - Just before the second case, the first case is auto‑closed:
    - Data stack returns to [ …, p_exit, preExit, NIL ]
  - CODE:
    - One backward Branch; operand encodes `offBack = preExit − (hereOperandPos + 2)`
    - p_false patched to `offFalse = here − (p_false + 2)`

D) default (introducer)
- Input: "switch case P of B default D ;"
  - If pending was set, it is closed; stack returns to [ …, p_exit, preExit, NIL ]
  - D compiles; the final `;` later patches p_exit

E) final `;` (closer)
- Input: "switch ;"
  - Data stack becomes [ … ] (pop pending(NIL); drop preExit; patch p_exit; pop p_exit)
- Input: "switch case P of B ;"
  - Behavior: the final `;` auto‑closes the open case (back‑branch + patch), then drops preExit, patches p_exit, pops p_exit
  - Ensures “no default” last case is valid without an explicit clause terminator

F) Nesting (valid)
- Input:
  ```
  switch
    switch ;   \ inner switch inside outer default or case body
  ;
  ```
  - Inner final `;` runs first; outer final `;` runs last; outer frame intact

G) Behavioral (first‑true‑wins, default)
- "switch case 1 of 10 case 1 of 20 ;" → 10
- "switch case 0 of 10 case 1 of 20 ;" → 20
- "switch case 0 of 10 case 0 of 20 default 99 ;" → 99

Comparative analysis (advantages and tradeoffs)

vs when/do
- Pros:
  - Familiar surface for many programmers (“switch/case/default”).
  - Less punctuation: no per‑clause terminator token required; boundaries auto‑close.
  - Strong visual alignment of “case <predicate> of <body>”.
- Cons:
  - Keyword after predicate (“of”) is slightly “reversed” compared to “when … then”-style; this was a prior concern.
  - Auto‑close adds a small amount of immediate‑side logic at boundary tokens (still constant meta‑arity).

vs ifx/thenx/elifx/elsex
- Pros:
  - Fewer distinct keywords to learn; `case/of/default/;` mirrors common idioms.
  - Natural reading order in clause: predicate, then “of”, then body.
  - Auto‑close at boundaries reduces the chance of forgetting a clause closer.
- Cons:
  - ifx/thenx/elifx separates clause start (thenx) from clause boundary (elifx) more explicitly; some may prefer explicit “elifx” to implicit boundary control.

Open questions to evaluate during prototyping
- Do we want to allow “empty body” cases (e.g., “case P of” followed by immediate boundary)? If allowed, ensure `of` sets pending, boundary auto‑close fires, yielding a no‑op body.
- Error policy if a programmer writes `of` twice within a case without an intervening boundary.
- Diagnostics quality: “case without switch”, “of without case”, “; with pending==NIL but unexpected state”, etc.

Summary
- This exploration keeps Tacit’s invariants: immediate‑only, constant compile‑time meta‑arity, first‑true‑wins, single exit.
- It provides a familiar surface with less punctuation via boundary auto‑close, while preserving explicit subject management.
- Worth prototyping alongside when/do and ifx/thenx/elifx to compare readability, error rates, and bytecode clarity.
