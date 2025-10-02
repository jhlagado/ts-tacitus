# cond / when … do / default / endcond — Guarded Multi-branch (Exploration Draft)

Status
- Purpose: Explore a “cond/when/do/default/endcond” surface over Tacit’s guard-based, first-true-wins semantics, without relying on the generic `;` closer
- Depends on: Plan 32 (brace-block removal)
- Scope: Immediate words only. Fixed arity at runtime AND constant compile-time arity (normative) via a single skip slot (NIL-or-address)
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
- Subject management is explicit:
  - Transient subject: duplicate (dup) wherever needed; drop after the construct if it should not escape.
  - Local subject: use a var or other binding; no need to dup.

Behavior
- True predicate → enter when body; on the next boundary (when/default/endcond) that when is closed and the construct exits (skips the rest).
- False predicate → jump over that when’s body to the next when or default; if none, control reaches endcond (no default).
- Boundaries are explicit tokens: when, default, endcond. There is no generic closer.

Compiler model (constant meta-arity)

Legend (compile-time data stack; TOS rightmost)
- preExit: code address (number) immediately AFTER `Branch +3` (the opcode of the second Branch). Back‑branch target for taken whens (the “pre‑exit” hop). Kept at NOS until endcond.
- p_exit: 16‑bit operand address (number) of the opener’s forward Branch (patched to the final exit at endcond).
- skip: single slot always present above preExit; holds:
  - NIL → no open when
  - p_skip (number) → operand address of the current when’s IfFalseBranch (the current when is “open”)

Branch addressing (relative)
- `Branch` / `IfFalseBranch` take a signed 16‑bit relative offset; the VM does `IP := IP + offset` after reading the operand.
- Forward patch “to here”: `offset = here - (operandPos + 2)`
- Backward jump “to opcode at target”: `offset = targetOpcode - (operandPos + 2)`
- `Branch +3` skips one Branch instruction (1 byte opcode + 2 bytes operand)

Emits (tables; TOS → right)

1) cond (immediate opener)

| Emit        | Notes                                          | Stack (TOS → right)         |
|-------------|------------------------------------------------|------------------------------|
| Branch +3   | preExit := CP (address of next opcode)         | [ … ]                        |
| Branch +0   | p_exit := CP (operand address placeholder)     | [ … ]                        |
| push p_exit | Number                                         | [ …, p_exit ]                |
| push preExit| Number (kept at NOS)                           | [ …, p_exit, preExit ]       |
| push NIL    | skip slot (NIL)                                | [ …, p_exit, preExit, NIL ]  |

2) when (begin a new when’s predicate region)

| Action                 | Notes                                                             | Stack (TOS → right)          |
|------------------------|-------------------------------------------------------------------|-------------------------------|
| ensure cond is open    | Require frame [ p_exit, preExit, (NIL or p_skip) ]                | [ …, p_exit, preExit, skip ]  |
| close current when     | If skip != NIL, first close the current when (see §4)             | [ …, p_exit, preExit, NIL ]   |
| (no emit yet)          | Predicates compile as ordinary code until `do`                    | [ …, p_exit, preExit, NIL ]   |

3) do (start of this when’s body)

| Emit/Action           | Notes                                                 | Stack (TOS → right)        |
|-----------------------|-------------------------------------------------------|-----------------------------|
| IfFalseBranch +0      | p_skip := CP (operand address placeholder)            | [ …, p_exit, preExit, NIL ] |
| set skip = p_skip     | Replace NIL with p_skip (constant frame size)         | [ …, p_exit, preExit, p_skip ] |

When body compiles until the next boundary token: when, default, or endcond.

4) Closing the current when (triggered by when/default/endcond)

If skip != NIL, close the currently open when:

| Action             | Notes                                                             | Stack (TOS → right)        |
|--------------------|-------------------------------------------------------------------|-----------------------------|
| pop skip           | Pop p_skip from TOS                                               | [ …, p_exit, preExit ]      |
| emit Branch (back) | Target = preExit, offBack = preExit − (hereOperandPos + 2)        | [ …, p_exit, preExit ]      |
| patch p_skip       | Fall‑through: offFalse = here − (p_skip + 2)                      | [ …, p_exit, preExit ]      |
| push NIL           | Restore skip slot to NIL (constant frame size)                    | [ …, p_exit, preExit, NIL ] |

5) default (introduces default region; optional)

| Action                 | Notes                                         | Stack (TOS → right)        |
|------------------------|-----------------------------------------------|-----------------------------|
| close current when     | If skip != NIL, close the current when        | [ …, p_exit, preExit, NIL ] |
| begin default region   | Compile code until endcond                     | [ …, p_exit, preExit, NIL ] |

6) endcond (final closer)

| Action                | Notes                                                                 | Stack (TOS → right)        |
|-----------------------|-----------------------------------------------------------------------|-----------------------------|
| close current when    | If skip != NIL, close the current when                                | [ …, p_exit, preExit, NIL ] |
| drop preExit          | No longer needed                                                      | [ …, p_exit ]               |
| patch p_exit          | Forward: offExit = here − (p_exit + 2)                                | [ …, p_exit ]               |
| pop p_exit            | Close construct                                                       | [ … ]                       |

Notes
- when, default, and endcond close the current when if one is open; this removes the need for per-when explicit terminators and keeps the surface compact.

Correctness invariants (normative)
- Runtime fixed arity
  - Each predicate leaves exactly one numeric flag; bodies have explicit stack behavior.
- Constant compile-time meta‑arity
  - Open frame is always 3 items: [ p_exit, preExit, skip ] with the TOS slot named skip (skip ∈ { NIL, p_skip }).
  - do sets skip to p_skip; closing a when resets skip to NIL.
  - endcond closes any open when (if needed), then drops preExit, patches p_exit, and pops p_exit.
- preExit discipline
  - preExit remains at NOS for the lifetime of the open construct; closing a when peeks preExit to compute the back‑branch and must not reorder it.
- Single‑exit guarantee
  - All taken whens back‑branch to preExit, then the forward Branch at preExit (patched at endcond) jumps to a single exit after the construct.
- Relative‑branch math
  - VM applies `IP := IP + offset` after reading a 16‑bit operand:
    - Backward (to opcode at preExit): `offBack = preExit − (hereOperandPos + 2)`
    - Fall‑through (IfFalseBranch): `offFalse = here − (p_skip + 2)`
    - Final exit (forward): `offExit = here − (p_exit + 2)`
- Nesting and LIFO
  - Nested cond constructs are allowed anywhere ordinary code is allowed.
  - Inner immediates (when/do/default/endcond) must restore their own frame before outer ones run.
- Default region
  - default is optional; when present, it runs until endcond.
  - If all predicates are false and default is omitted, control reaches endcond and exits.

Isolated test scenarios (to be implemented)

- Degenerate forms (all must compile and run with correct exits)
  - No whens, no default:
    - Input:
      ```
      cond endcond
      ```
    - CODE: two Branches from opener; endcond drops preExit and patches p_exit; no bodies emitted
    - Stack behavior: frame [ p_exit, preExit, NIL ] → endcond → [ … ]
  - No whens, default only:
    - Input:
      ```
      cond default D endcond
      ```
    - At default, if skip==NIL, no when is closed; compiles D; endcond finalizes; D runs unconditionally
  - Whens but no default:
    - Input:
      ```
      cond
        when P0 do B0
        when P1 do B1
      endcond
      ```
    - Each new when closes the previous when if one is open; if all predicates are false → endcond exits; if any true → back-branch to preExit then forward exit at endcond

A) cond (opener) emits (bytes + stack)
- Input: "cond"
  - CODE:
    - next8() == Op.Branch
    - nextInt16() == 3
    - next8() == Op.Branch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit(number), preExit(number), NIL ]

B) do (clause start) emits (bytes + stack)
- Input: "cond when P do"
  - CODE append:
    - next8() == Op.IfFalseBranch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit, preExit, p_skip(number) ]
- Input: "do" without when (or with skip already set)
  - Expect syntax error

C) Closing a when (stack constancy + back‑branch + fall‑through patch)
- Input: "cond when P do B when …"
  - Just before the second when, the first when is closed automatically:
    - Data stack returns to [ …, p_exit, preExit, NIL ]
  - CODE:
    - One backward Branch; operand encodes `offBack = preExit − (hereOperandPos + 2)`
    - p_skip patched to `offFalse = here − (p_skip + 2)`

D) default (introducer)
- Input: "cond when P do B default D endcond"
  - If skip was set, it is closed; stack returns to [ …, p_exit, preExit, NIL ]
  - D compiles; endcond later patches p_exit

E) endcond (final closer)
- Input: "cond endcond"
  - Data stack becomes [ … ] (close if needed; drop preExit; patch p_exit; pop p_exit)
- Input: "cond when P do B endcond"
  - Behavior: endcond closes the open when (back‑branch + patch), then drops preExit, patches p_exit, pops p_exit
  - Ensures “no default” last when is valid without an explicit per-when terminator

F) Nesting (valid)
- Input:
  ```
  cond
    cond endcond   \ inner cond inside outer default or when body
  endcond
  ```
  - Inner endcond runs first; outer endcond runs last; outer frame intact

G) Behavioral (first‑true‑wins, default)
- "cond when 1 do 10 when 1 do 20 endcond" → 10
- "cond when 0 do 10 when 1 do 20 endcond" → 20
- "cond when 0 do 10 when 0 do 20 default 99 endcond" → 99

Diagnostics (errors)
- when without cond
- do without when
- of-twice equivalent: multiple do’s in the same when without a boundary
- endcond with an incoherent frame (e.g., missing p_exit/preExit due to earlier errors)

Summary
- This exploration keeps Tacit’s invariants: immediate‑only, constant compile‑time meta‑arity, first‑true‑wins, single exit.
- It provides a familiar surface with less punctuation via implicit “close current when” at boundaries, while preserving explicit subject management.
- endcond replaces the generic closer, simplifying the frame to [ p_exit, preExit, skip ] and keeping ordering clear.
