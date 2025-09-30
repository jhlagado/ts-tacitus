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

Compiler emits with stack (tables; TOS → right)

Legend

- EndWhen / EndDo are Tag.BUILTIN closer refs (executed by generic `;`).
- preExit: code address (number) immediately AFTER the first `Branch +3` (the opcode of the second Branch). Back‑branch target for taken clauses (the “pre‑exit” hop before the final forward exit). It is kept at NOS (next‑on‑stack) across clause closes; it is peeked (e.g., via over) and only dropped by EndWhen.
- p_exit: 16‑bit operand address (number) of the opener’s forward Branch (to be patched to final exit).
- p_false: 16‑bit operand address (number) of the clause’s IfFalseBranch (to be patched to fall‑through).

Branch addressing (used below)

- `Branch` / `IfFalseBranch` take a signed 16‑bit relative offset; the VM does `IP := IP + offset` after reading the operand.
- Forward patch to “here”: `offset = here - (operandPos + 2)`.
- Backward jump to a known opcode at `targetOpcode`: `offset = targetOpcode - (operandPos + 2)`.
- `Branch +3` skips exactly one Branch instruction (1‑byte opcode + 2‑byte operand).

1) when (immediate opener)

| Emit | Notes | Stack (TOS → right) |
|------|-------|----------------------|
| Branch +3 | Let preExit := CP (address of next opcode) | [ … ] |
| Branch +0 | Let p_exit := CP (operand address placeholder) | [ … ] |
| push p_exit | Number | [ …, p_exit ] |
| push preExit | Number (kept at NOS) | [ …, p_exit, preExit ] |
| push EndWhen | BUILTIN closer | [ …, p_exit, preExit, EndWhen ] |

2) do (start of a clause body)

| Emit | Notes | Stack (TOS → right) |
|------|-------|----------------------|
| IfFalseBranch +0 | Let p_false := CP (operand address placeholder) | [ …, p_exit, preExit, EndWhen ] |
| push p_false | Number | [ …, p_exit, preExit, EndWhen, p_false ] |
| push EndDo | BUILTIN closer | [ …, p_exit, preExit, EndWhen, p_false, EndDo ] |

3) Clause terminator ‘;’ (executes EndDo via generic `;`)

| Action | Notes | Stack (TOS → right) |
|--------|-------|----------------------|
| pop EndDo (execute) | Generic `;` eval | [ …, p_exit, preExit, EndWhen, p_false ] |
| pop p_false | Get operand address to patch | [ …, p_exit, preExit, EndWhen ] |
| emit Branch (back) | Target = preExit (peek via over), offBack = preExit − (hereOperandPos + 2) | [ …, p_exit, preExit, EndWhen ] |
| patch p_false (fall‑through) | offFalse = here − (p_false + 2) | [ …, p_exit, preExit, EndWhen ] |

4) Final ‘;’ (executes EndWhen via generic `;`)

| Action | Notes | Stack (TOS → right) |
|--------|-------|----------------------|
| pop EndWhen (execute) | Generic `;` eval | [ …, p_exit, preExit ] |
| drop preExit | No longer needed | [ …, p_exit ] |
| patch p_exit (forward) | offExit = here − (p_exit + 2) | [ …, p_exit ] |
| pop p_exit | Close construct | [ … ] |

Constraints

- Predicates must leave exactly one numeric flag (0 or non‑zero).
- Every `do` must be closed by a `;` before the final `;`.
- Manage subject values explicitly (dup/drop or locals).

Test scenarios (to be implemented one-by-one)

A) when (opener) emits (bytes + stack)
- Input: "when"
  - CODE:
    - next8() == Op.Branch
    - nextInt16() == 3
    - next8() == Op.Branch
    - nextInt16() == 0 (placeholder)
  - Data stack (TOS → right): [ …, p_exit(number), preExit(number), EndWhen(BUILTIN) ]
  - Sanity:
    - preExit is the byte index of the second Branch opcode (address immediately after the first Branch’s operand)
    - p_exit is the byte index of the 16‑bit operand for the second Branch

B) do (clause start) emits (bytes + stack)
- Input: "when do"
  - CODE appended:
    - next8() == Op.IfFalseBranch
    - nextInt16() == 0 (placeholder)
  - Data stack: [ …, p_exit, preExit, EndWhen, p_false(number), EndDo(BUILTIN) ]

- Input: "do" (no opener)
  - Expect syntax error: "do without when"

C) EndDo (clause ';') in isolation (stack preservation + backward branch + fall‑through patch)
- Input: "when do ;"
  - After first ';':
    - Data stack restored to [ …, p_exit, preExit, EndWhen ] (EndDo consumed; p_false popped; preExit remains NOS)
- Input: "when 1 do 2 ;"
  - CODE around clause close:
    - An Op.Branch emitted backward; its operand encodes offBack = preExit - (hereOperandPos + 2)
    - p_false patched to offFalse = here - (p_false + 2)

D) EndWhen (final ';') in isolation (forward patch + cleanup)
- Input: "when ;"
  - Data stack becomes [ … ] (EndWhen popped; preExit dropped; p_exit patched to offExit = here - (p_exit + 2) and then popped)

E) Nesting (valid)
- Input:
  ```
  when
    when ;          \ inner when inside outer default area
  ;
  ```
  - Closers run LIFO: inner EndWhen runs first; outer EndWhen runs last
  - No interference: the outer [ p_exit, preExit, EndWhen ] frame is intact across inner open/close

F) Behavioral (first‑true‑wins, default)
- "when 1 do 10 ; 1 do 20 ; ;" → produces 10 (first true wins, exit after first body)
- "when 0 do 10 ; 1 do 20 ; ;" → produces 20
- "when 0 do 10 ; 0 do 20 ; 99 ;" → produces 99 (default)
- Transient subject: "10 when dup 3 eq do 'three' ; 'default' ; drop" → leaves 'three' or 'default', subject dropped

G) Negative
- Unclosed when: "when" → syntax error "Unclosed when"
- do without opener: "do" → syntax error "do without when"
- (Runtime) Bad predicate: if a predicate does not leave a number flag, the consumer op that expects it fails (existing semantics)

H) Offset fuzz (optional)
- Insert harmless ops between do bodies and ';' to vary here positions; assert relative offsets remain correct
