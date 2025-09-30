# ifx / thenx / elifx / elsex — Guarded Multi-branch (Draft, Parallel Spec)

Status

- Depends on: Plan 32 (brace-block removal)
- Scope: Immediate words only. Fixed arity at runtime AND constant compile-time arity (normative, p_false slot with NIL-or-address).
- Goal: Clause-oriented surface syntax using explicit markers (thenx/elifx/elsex/endifx) with minimal, proven lowering and a constant meta-stack shape.

What it is (for programmers)

- A linear “if/elif/else/endif” chain expressed with explicit markers:
  - thenx starts a clause body for the preceding predicate.
  - elifx ends the current clause and indicates that further predicates follow.
  - elsex ends the current clause and introduces the default region (optional).
  - endifx closes the entire construct.
- No discriminant is managed for you. If you have a subject value, manage duplication/cleanup explicitly (dup / drop or locals).
- elsex and everything after it are optional; i.e., “no default” is valid.

Examples

- With a transient subject:
  ```
  10 ifx
    dup 3 eq  thenx  "three"  elifx
    dup 9 gt  thenx  "big"    elsex
                  "default"
  endifx
  drop             \ discard subject after the construct
  ```

- With a local:
  ```
  : describe
    10 var x
    ifx
      x 3 eq  thenx  "three"  elifx
      x 9 gt  thenx  "big"    elsex
                    "default"
    endifx
  ;
  ```

- No default (elsex omitted):
  ```
  ifx
    p0  thenx  b0  elifx
    p1  thenx  b1
  endifx
  ```

Behavior

- Predicate true → fall through into the body → the clause terminator (elifx or elsex) closes the clause and the construct exits (skips the rest) via the preExit/exit mechanism.
- Predicate false → jump over the body to the next predicate; if none, run the default if present, else exit.
- thenx/elifx/elsex/endifx are compile-time immediates; all clause and construct closures are explicit and driven by these words.

Compiler emits with constant meta-stack arity (TOS → right)

Legend

- preExit: code address (number) immediately AFTER `Branch +3` (the opcode of the second Branch). Back‑branch target for taken clauses (the “pre‑exit” hop). Kept at NOS until endifx.
- p_exit: 16‑bit operand address (number) of the opener’s forward Branch (patched to final exit at endifx).
- p_false slot (always present): a single slot atop preExit whose value is either:
  - NIL: sentinel meaning “no open clause”
  - p_false: a 16‑bit operand address (number) of the current clause’s IfFalseBranch, meaning “clause open”

Branch addressing (used below)

- `Branch` / `IfFalseBranch` take a signed 16‑bit relative offset; the VM does `IP := IP + offset` after reading the operand.
- Forward patch to “here”: `offset = here - (operandPos + 2)`.
- Backward jump to a known opcode at `targetOpcode`: `offset = targetOpcode - (operandPos + 2)`.
- `Branch +3` skips exactly one Branch instruction (1‑byte opcode + 2‑byte operand).

Sentinel choice (normative)

- Use NIL as a dedicated sentinel that cannot collide with valid operand addresses (which are finite, non‑negative numbers).

1) ifx (immediate opener)

| Emit        | Notes                                          | Stack (TOS → right)              |
|-------------|------------------------------------------------|----------------------------------|
| Branch +3   | Let preExit := CP (address of next opcode)     | [ … ]                            |
| Branch +0   | Let p_exit := CP (operand address placeholder) | [ … ]                            |
| push p_exit | Number                                         | [ …, p_exit ]                    |
| push preExit| Number (kept at NOS)                           | [ …, p_exit, preExit ]           |
| push NIL    | p_false slot initialized to NIL                | [ …, p_exit, preExit, NIL ]      |

2) thenx (start of a clause body)

| Emit               | Notes                                     | Stack (TOS → right)               |
|--------------------|-------------------------------------------|-----------------------------------|
| IfFalseBranch +0   | Let p_false := CP (operand address pos)   | [ …, p_exit, preExit, NIL ]       |
| set p_false slot   | Replace NIL with p_false (constant size)  | [ …, p_exit, preExit, p_false ]   |

3) elifx (clause terminator that continues with more predicates)

| Action               | Notes                                                                 | Stack (TOS → right)               |
|----------------------|-----------------------------------------------------------------------|-----------------------------------|
| read p_false slot    | Must be p_false (error if NIL)                                        | [ …, p_exit, preExit, p_false ]   |
| emit Branch (back)   | Target = preExit (peek), offBack = preExit − (hereOpPos + 2)          | [ …, p_exit, preExit, p_false ]   |
| patch p_false        | Fall‑through: offFalse = here − (p_false + 2)                         | [ …, p_exit, preExit, p_false ]   |
| set p_false slot=NIL | Reset to NIL (constant size)                                          | [ …, p_exit, preExit, NIL ]       |

After elifx, another predicate is expected, followed by thenx … and a subsequent elifx/elsex/endifx.

4) elsex (introduces default region; optional)

| Action                   | Notes                                                                 | Stack (TOS → right)               |
|--------------------------|-----------------------------------------------------------------------|-----------------------------------|
| if p_false slot==p_false | Close clause as in elifx (back‑branch + patch); set slot=NIL          | [ …, p_exit, preExit, NIL ]       |
| begin default region     | Subsequent code until endifx is default                               | [ …, p_exit, preExit, NIL ]       |

5) endifx (final closer)

| Action                    | Notes                                                                    | Stack (TOS → right)           |
|---------------------------|--------------------------------------------------------------------------|-------------------------------|
| pop p_false slot          | Always exactly one item (NIL or p_false)                                 | [ …, p_exit, preExit ]        |
| if popped==p_false        | Close last clause (back‑branch to preExit + patch); stack size constant  | [ …, p_exit, preExit ]        |
| drop preExit              | No longer needed                                                         | [ …, p_exit ]                 |
| patch p_exit              | Forward: offExit = here − (p_exit + 2)                                   | [ …, p_exit ]                 |
| pop p_exit                | Close construct                                                          | [ … ]                         |

Notes on simplification vs when/do

- No pushed closers: all control words are explicit immediates that perform compile‑time work directly.
- Constant meta‑arity: the p_false slot keeps the compile‑time stack at a constant size during the open construct lifetime; only at the final closer does the frame tear down.
- elsex explicitly marks default; default is optional (omit elsex for “no default”).
- Lowering remains equivalent to when/do: a single preExit anchor per ifx block, per‑clause IfFalseBranch (p_false), and a per‑block forward p_exit patched at the end.

Constraints

- Predicates must leave exactly one numeric flag (0 or non‑zero).
- thenx must follow a predicate.
- elifx/elsex must appear only after a clause body has started (i.e., after thenx set the p_false slot to an address).
- Manage subject values explicitly (dup/drop or locals).

Happy path (informative)

Two clauses with default; first predicate is true:
```
ifx
  P0 thenx B0 elifx
  P1 thenx B1 elsex
            DFLT
endifx
```
- Compile-time (high level):
  - Opener pushes [ p_exit, preExit, NIL ]
  - thenx sets p_false slot = p_false
  - Each elifx closes the clause (back‑branch + patch) and sets the p_false slot back to NIL; frame remains [ p_exit, preExit, NIL ]
  - elsex also closes a clause if the p_false slot holds an address, then sets it to NIL and begins default
  - endifx pops the p_false slot (closing if needed), drops preExit, patches p_exit, then drops p_exit
- Runtime (P0 true):
  - IfFalseBranch(p_false0) does not jump → B0 runs
  - Elifx’s back Branch jumps to preExit; preExit’s forward Branch (patched at endifx) jumps to the single exit, skipping the rest

Correctness invariants (normative)

- Runtime fixed arity
  - Each predicate leaves exactly one numeric flag; bodies have explicit stack behavior.
- Constant compile-time meta‑arity
  - Open frame is always 3 items: [ p_exit, preExit, (NIL or p_false) ]
  - thenx sets the p_false slot to an address (no growth)
  - elifx/elsex reset the slot to NIL after clause close
  - endifx always pops exactly one slot value (NIL or p_false), then tears down [ preExit, p_exit ] in a fixed sequence
- preExit discipline
  - preExit remains at NOS for the lifetime of the open construct; clause closes must only peek preExit (e.g., via over) to compute the back‑branch
- Single‑exit guarantee
  - All taken clauses back‑branch to preExit, then the unified forward Branch at preExit jumps to the single exit set by endifx
- Relative‑branch math
  - VM applies `IP := IP + offset` after reading a 16‑bit operand
  - Backward (to opcode at preExit): `offBack = preExit − (hereOperandPos + 2)`
  - Fall‑through (IfFalseBranch): `offFalse = here − (p_false + 2)`
  - Final exit (forward): `offExit = here − (p_exit + 2)`
- Nesting and LIFO
  - Nested ifx constructs are allowed anywhere ordinary code is allowed
  - Inner immediates (thenx/elifx/elsex/endifx) must restore their own frame before outer ones run
- Default region
  - elsex is optional; when present, default is the code until endifx
  - If all predicates are false and elsex is omitted, control reaches endifx and exits

Isolated test scenarios (to be implemented)

A) ifx (opener) emits (bytes + stack)
- Input: "ifx"
  - CODE:
    - next8() == Op.Branch
    - nextInt16() == 3
    - next8() == Op.Branch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit(number), preExit(number), NIL ]

B) thenx (clause start) emits (bytes + stack)
- Input: "ifx thenx"
  - CODE append:
    - next8() == Op.IfFalseBranch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit, preExit, p_false(number) ]  (slot set)

C) elifx (clause terminator) in isolation (stack constancy + back‑branch + fall‑through patch)
- Input: "ifx thenx … elifx"
  - After elifx:
    - Data stack restored to [ …, p_exit, preExit, NIL ] (constant 3 items)
  - CODE:
    - One backward Branch; its operand encodes offBack = preExit − (hereOperandPos + 2)
    - p_false patched to offFalse = here − (p_false + 2)

D) elsex (default introducer)
- Input: "ifx thenx B elsex D endifx"
  - If slot held p_false, close clause and set slot=NIL; compile D; endifx later patches p_exit
  - Data stack stays [ …, p_exit, preExit, NIL ] throughout

E) endifx (final closer)
- Input: "ifx endifx"
  - Data stack becomes [ … ] (pop slot(NIL); drop preExit; patch p_exit; pop p_exit)
- Input: "ifx p0 thenx b0 endifx"
  - Behavior: endifx pops slot (p_false), closes the open clause (back‑branch + patch), then drops preExit, patches p_exit, pops p_exit
  - Ensures “no default” last clause is valid without an explicit elifx

F) Nesting (valid)
- Input:
  ```
  ifx
    ifx endifx   \ inner ifx inside outer default area
  endifx
  ```
  - Inner endifx runs first; outer endifx runs last; outer frame intact

G) Behavioral (first‑true‑wins, default)
- "ifx p0 thenx 10 elifx p1 thenx 20 endifx" → 10
-
