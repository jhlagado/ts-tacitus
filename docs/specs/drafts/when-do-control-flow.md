# when … do — Guarded Multi-branch (Draft, Normative)

Status
- Depends on: Plan 31 (`;` generic closer), Plan 32 (brace-block removal)
- Scope: Immediate words only. Fixed arity. All compile-time state lives on the data stack.

What it is (for programmers)
- A compact “first-true-wins” chain (like if / else-if / else).
- Each clause has a predicate (must leave 0/false or non‑zero/true) and a body.
- The first true clause runs its body and the construct exits. An optional default runs if no clause matched.
- No discriminant is managed for you. If you have a subject value, manage duplication/cleanup explicitly (dup / drop or locals).

Form
```
when
  <predicate> do  <body>  ;
  <predicate> do  <body>  ;
  ...optional default...
;
```

Behavior
- Predicate true → fall through into the body → clause terminator `;` exits the construct (skips the rest).
- Predicate false → jump over the body to the next predicate; if none, run the default (if present) and exit.
- Subject/value management is explicit and up to you.

Examples
- With a transient subject:
  ```
  10 when
    dup 3 eq  do  "three"  ;
    dup 9 gt  do  "big"    ;
                "default"
  ;
  drop             \ discard subject after the construct
  ```
- With a local:
  ```
  : describe
    10 var x
    when
      x 3 eq  do  "three"  ;
      x 9 gt  do  "big"    ;
                "default"
    ;
  ;
  ```

Compiler model (minimal)
- Immediate words:
  - `when` (opener)
    1) `Branch +3` (skip over the next instruction), `p_here` = CP
    2) `Branch +0` (forward); record its 16‑bit operand address as `p_exit` (number)
    3) Push `p_exit` (number)
    3) Push `p_here` (number)  
    4) Push `EndWhen` (BUILTIN closer)
  - `do` (opener)
    1) `IfFalseBranch +0`; record its 16‑bit operand address as `p_false` (number)
    2) Push `p_false` (number) 
    3) Push `EndDo` (BUILTIN closer)
- Generic `;` executes the BUILTIN closer on TOS:
  - `EndDo` (clause `;`): 
  1) patches `p_false` to fall through here; stack becomes `[ …, p_here, EndWhen ]`
  2) emits a backward `Branch` that jumps to the opener’s Branch (using `p_here` beneath `EndWhen`), 
  - `EndWhen` (final `;`): 
  1) drops `p_here`
  2) patches the opener’s forward Branch operand to jump to the common exit; 

Constraints
- Predicates must leave exactly one numeric flag (0 or non‑zero).
- Every `do` must be closed by a `;` before the final `;`.

