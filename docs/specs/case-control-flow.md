# Switch / Case Control Flow (Draft)

## Status
- **Stage:** Draft
- **Scope:** Immediate multi-branch selection construct `case` / `of` / `DEFAULT` / `;`.
- **Audience:** Compiler/runtime implementors and language designers looking to extend Tacit’s immediate-word suite.

This specification complements `docs/specs/metaprogramming.md`, documenting the semantics, compile-time lowering, and runtime behaviour of a case-style conditional built entirely from immediates.

## Surface Syntax

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

## Runtime Stack Discipline

- The discriminant is present on the data stack when `case` executes and remains there until a clause body consumes it.
- Clause bodies do **not** see the discriminant; `of` arranges for it to be automatically dropped on the true path.
- If no clause matches and there is no default, the final closer ensures the discriminant is removed before control resumes.

### Stack snapshots

| Moment | Data stack (rightmost = TOS) |
| --- | --- |
| Before `case` | `[..., discriminant]` |
| After `case` opener | `[..., savedRSP, EndCase, discriminant]` |
| Inside clause body (true branch) | `[..., savedRSP, EndCase]` |
| Between clauses (false branch) | `[..., savedRSP, EndCase, discriminant]` |
| After final terminator (matched clause) | prior state restored, discriminant consumed |
| After final terminator (no match) | prior state restored, discriminant dropped |

## Immediate Word Semantics

### `case` (immediate)

1. Snapshots the current return-stack depth (`savedRSP`).
2. Pushes `savedRSP` and the closer reference `EndCase` onto the data stack.
3. Leaves the discriminant on the data stack beneath the case metadata. No bytecode emitted at this stage.

### `of` (immediate)

Executed for each clause header:

1. Validates that the data stack ends with `[…, savedRSP, EndCase, discriminant, constant]`. If not, raises “`of` without `case`”.
2. Compiles the runtime comparison sequence **in this precise order**:
   - Emit `over` so the discriminant is duplicated while the clause constant remains at TOS.
   - Emit the equality builtin (`eq`). At runtime `eq` must treat the designated wildcard sentinel (used by `DEFAULT`) as matching any discriminant.
   - Emit `IfFalseBranch +0` and record its operand address (`p_skip`) before the discriminator is dropped. This ensures the placeholder references the correct `CP`.
3. Pushes `p_skip` followed by the clause closer reference `EndOf` onto the data stack. The two entries ensure the matching closer can patch the predicate skip and restore the stack shape.
4. Emits a `drop`. On the true path this removes the duplicated discriminant before the clause body executes. On the false path the `IfFalseBranch` transfers control past this drop, preserving the original discriminant for subsequent clauses.

Because the `DEFAULT` clause pushes a runtime sentinel constant, the sequence above is emitted unchanged. The equality builtin is responsible for recognising the sentinel and returning `true`, so the body is entered without any `of`-specific branching logic.

### Clause terminator `;` (executes `EndOf`)

1. Pops the stored `p_skip`; verifies the stack is `[…, savedRSP, EndCase]` after removal. Otherwise raises “clause closer without `of`”.
2. Emits `Branch +0` to skip remaining clauses once the current one succeeds; records its operand (`p_exit`) on the return stack.
3. Patches `p_skip` so a failed comparison falls through to the next clause (i.e., sets offset to reach the instruction immediately after the branch placeholder and before the trailing `drop`).
4. Restores the data stack to `[…, savedRSP, EndCase, discriminant]`, ready for the next clause or default.

### Final terminator `;` (executes `EndCase`)

1. Removes the discriminant from the data stack. The drop occurs exactly once per construct—either in the matching clause body or here if no clause (including `DEFAULT`) matched.
2. Pops `savedRSP`; while `RSP > savedRSP`, pops each recorded `p_exit` operand from the return stack and patches it to jump to the instruction immediately after the discriminant drop. This guarantees successful clauses do not drop the discriminant twice.
3. (Optional assertion) Implementations may verify the return stack depth matches `savedRSP`—mirroring the safeguard used by `when/do`—and raise “case corrupted return stack” if not.
4. Net stack effect: `( discriminant — )`. The discriminant is consumed exactly once per construct.

## Default Clause Sentinel

- `DEFAULT` pushes a distinguished sentinel constant (e.g., `toTaggedValue(Sentinel.DEFAULT, Tag.SENTINEL)`) onto the stack via an immediate word. The emitted `eq` must treat comparisons involving this sentinel as an automatic match, so the default clause reuses the standard comparison/branch sequence without alteration.
- Because the `DEFAULT` clause still goes through the standard `of` lowering, there are no compile-time differences: the comparison sequence is emitted, `IfFalseBranch` is recorded (it simply never triggers at runtime), and the trailing `drop` removes the discriminant before the body executes.
- Additional defaults are permitted. Because the sentinel wildcard causes the equality check to succeed immediately, the first encountered default will match; later defaults are effectively dead code but remain legal.

## Emitted Bytecode Skeleton

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

## Error Handling

- `of` outside an open `case`
  - Immediate can check that the next-on-stack entry is `EndCase`; otherwise signal `SyntaxError("'of' without open case")`.
- Clause body terminator `;` without a pending predicate placeholder
  - When the terminator attempts to pop a skip placeholder and finds none, raise `SyntaxError("clause closer without of")`.
- Final `;` without `EndCase` on TOS
  - Terminator validates the closer on TOS; absence triggers `SyntaxError("case not open")`.
- Return stack mismatch when unwinding
  - Optional assertion mirroring `when/do`; implementers may raise `SyntaxError("case corrupted return stack")` if the snapshot invariant fails.

## Interaction with Other Immediates

- Cases may nest inside other immediate constructs (e.g., inside `when` clauses) because each opener snapshots and restores `RSP` independently.
- Clause bodies can freely open additional immediate constructs; they execute after the discriminant has been dropped.
- `DEFAULT` acts as a wildcard via the sentinel value; multiple defaults are legal (the first will match, subsequent defaults are effectively dead code).

## Future Extensions

- Additional clause heads (e.g., `range`, `match`) can reuse the same stack/closer discipline to support pattern matching on ranges, types, or other predicates.
- Bytecode generation helpers may be factored to reuse tuple (`over`/`eq`/`IfFalseBranch`) patterns used by existing conditional constructs.
