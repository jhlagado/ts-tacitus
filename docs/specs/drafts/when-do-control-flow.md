# `when` … `do` — Guarded Multi-branch (Draft, Normative)

## Status

- Scope: Immediate words only. All compile-time bookkeeping lives on the regular data stack and, when needed, the return stack. Runtime arity is fixed by the user’s predicates/bodies.
- Terminology: `CP` denotes the current compile pointer ("here").

## Programmer View

`tacit` provides a single opener `when`, clause bodies introduced by `do`, and a shared closer `;`. Each clause consists of a predicate immediately followed by `do` and its body, terminated by `;`. The first clause whose predicate evaluates true runs its body; remaining clauses are skipped. If no predicate matches, control falls into the default code region between the last clause `;` and the final `;`.

Predicates and bodies manage their own stack usage. If you need to retain a subject value across multiple predicates, store it in a variable or duplicate/drop it explicitly.

### Examples

Using a transient subject value:

```
10 when
  dup 3 eq  do  "three"  ;
  dup 9 gt  do  "big"    ;
              "default"  \ optional fall-through body
;
drop                        \ caller discards the subject
```

Using locals:

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

## Runtime Behaviour

- Predicate true → execution falls straight into the clause body. When the clause `;` runs, the compiler-emitted branch transfers control to the common exit, skipping the rest.
- Predicate false → the clause’s `IfFalseBranch` skips over the body and its closing machinery, so evaluation continues with the next predicate.
- If no predicate succeeds, execution reaches the optional default region (ordinary code before the final `;`) and then exits the construct naturally.

## Compile-time Stack Discipline

All bookkeeping is visible on the data stack; exit patch addresses accumulate on the return stack.

### Data Stack Invariants (TOS → right)

- Open construct (no active clause): `[…, savedRSP, EndWhen]`
  - `savedRSP` – snapshot of the return-stack pointer taken by `when`.
  - `EndWhen` – closer executable consumed by the generic `;` to finish the construct.
- Inside a clause body (after `do` until its `;`): `[…, savedRSP, EndWhen, p_skip, EndDo]`
  - `p_skip` – operand address of the clause’s `IfFalseBranch` (placeholder to be patched at clause close).
  - `EndDo` – closer executable consumed by the clause terminator `;`.

### Return Stack Discipline

- At `when`, no entries are pushed; the return stack must be exactly as it was.
- Each clause terminator records a forward branch (`p_exit`) to the common exit by pushing its operand address onto the return stack.
- `EndWhen` back-patches every recorded `p_exit` in LIFO order until the return stack pointer matches `savedRSP`.

## Immediate Words

The tables below show emitted code and stack effects. TOS is on the right.

### `when` (opener)

| Emit / Action | Notes | Data Stack | Return Stack |
| --- | --- | --- | --- |
| (no pre-check) | Nested `when` inside predicates/bodies is permitted | — | — |
| Snapshot RSP | `savedRSP := RSP` (push snapshot) | `[…, savedRSP]` | unchanged |
| Push `EndWhen` | generic closer stays at TOS | `[…, savedRSP, EndWhen]` | unchanged |

No code is emitted; the construct begins with the first predicate.

### `do` (start clause body)

Precondition: data stack must be `[…, savedRSP, EndWhen]`; otherwise signal `do without when`.

| Emit / Action | Notes | Data Stack | Return Stack |
| --- | --- | --- | --- |
| Emit `IfFalseBranch +0` | Reserve predicate skip; let `p_skip := CP` (address of operand) | `[…, savedRSP, EndWhen]` | unchanged |
| Push `p_skip` | Remember skip placeholder | `[…, savedRSP, EndWhen, p_skip]` | unchanged |
| Push `EndDo` | Clause closer sits on TOS | `[…, savedRSP, EndWhen, p_skip, EndDo]` | unchanged |

The predicate must already have compiled code that leaves a boolean flag on the runtime stack when `do` executes.

### Clause `;` (generic `;` executes `EndDo`)

When the clause terminator `;` is read, the generic closer pops `EndDo` and executes it. Expected stack when `EndDo` runs: `[…, savedRSP, EndWhen, p_skip]` with `p_skip > 0`.

`EndDo` performs:

1. Validate `p_skip` (if zero or missing → “clause closer without do”).
2. Emit `Branch +0`; let `p_exit := CP` (operand address). This branch will jump to the shared exit.
3. Push `p_exit` on the return stack (`>r`).
4. Patch the predicate skip to the current `CP`: `offset_skip = CP − (p_skip + 2)`; store into the operand at `p_skip`.
5. Drop `p_skip` from the data stack, restoring `[…, savedRSP, EndWhen]`.

### Final `;` (generic `;` executes `EndWhen`)

At the final `;`, the generic closer pops `EndWhen` and executes it. Expected stack: `[…, savedRSP, EndWhen]`.

`EndWhen` performs:

1. Pop `EndWhen` (already removed by the generic closer call).
2. Pop `savedRSP` into `targetRSP`.
3. While `RSP > targetRSP`:
   - Pop a pending exit placeholder (`p_exit := r>`).
   - Patch it forward to the common exit: `offset_exit = CP − (p_exit + 2)`.
4. Done; the loop leaves `RSP == targetRSP` under the invariants below, so the compile-time data stack matches its pre-`when` shape.

## Default Region

Any code between the last clause `;` and the final `;` acts as the default. Because every executed clause records a branch to be patched to the exit, control skips the default whenever a predicate succeeds. If no predicate succeeds, execution falls through into the default naturally. The compiler imposes no additional structure here; the programmer is responsible for stack hygiene (e.g., dropping a duplicated subject if needed).

## Error Conditions (non-exhaustive)

- `do` encountered when the data stack top is not `EndWhen` → “do without when”.
- Clause `;` encountered when TOS is not `EndDo` → “clause closer without do”.
- Clause `;` with `p_skip == 0` → “clause closer without predicate”.
- Final `;` encountered when TOS is not `EndWhen` → “when not open”.
- Any new `do` or final `;` while a previous clause’s `EndDo` is still on TOS → “previous clause not closed”.

## Correctness Invariants

- **Compile-time frame:** `when` establishes `[savedRSP, EndWhen]`; clauses temporarily extend it with `[p_skip, EndDo]`. No other cells may be inserted between these values.
- **Return-stack balance:** Every clause `;` pushes exactly one `p_exit` address. `EndWhen` must consume exactly as many addresses as the difference `RSP − savedRSP` at entry.
- **Branch patching:**
  - Predicate skip: `offset_skip = CP − (p_skip + 2)`.
  - Exit jumps: `offset_exit = CP − (p_exit + 2)`.
- **LIFO nesting:** Because `savedRSP` captures the return stack depth, nested `when` constructs compose naturally; each inner construct restores the return stack before any outer closer executes.
- **Runtime arity:** Clauses may manipulate the runtime stack arbitrarily, but predicates must leave exactly one flag before each `do`.

### Nested and Degenerate Forms (valid)

The stack discipline above supports `when` anywhere ordinary code may appear:

```
when
  predicate0 do
    …
    when                     \ inner `when` in a clause body
      innerPredicate do … ;
    ;
  ;
  predicate1 do … ;
  when                     \ `when` used in the default region
    inner2Predicate do … ;
  ;
;
```

The inner constructs snapshot the current `RSP` and push their own `EndWhen`; the outer clause’s `p_skip`/`EndDo` pair sits beneath them and is untouched until the inner construct closes. Because the opener performs no `EndDo` pre-check, both “`when` inside a clause body” and “`when` in the default region” compile without extra ceremony.

## Test Scenarios (to implement)

1. **Opener frame:** parsing `when` pushes `[savedRSP, EndWhen]` and does not emit code.
2. **Clause start:** `when … do` emits `IfFalseBranch +0`, records its operand as `p_skip`, and pushes `EndDo`.
3. **Clause close:** `when … do … ;` emits a forward `Branch +0`, pushes its operand to the return stack, patches `p_skip` to the current `CP`, and restores the frame.
4. **Final close:** `when … ;` patches all recorded `p_exit` operands to the final `CP` and restores both stacks to their entry shapes.
5. **Default fall-through:** with no predicates true, execution reaches the default region and exits without recorded exits.
6. **Taken clause:** with an early predicate true, observe that only one branch operand is recorded/patched and that default code is skipped at runtime.
7. **Error cases:** `do` without `when`, clause `;` without `do`, missing clause `;`, nested constructs, and mismatched return-stack depth.
