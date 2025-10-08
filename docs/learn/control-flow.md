# Tacit Control Flow — Quick Guide

This learn doc complements the normative specification `docs/specs/metaprogramming.md`.

## Immediate words recap

- Words marked *immediate* run during parsing. They manipulate the VM stacks to emit bytecode.
- The shared terminator `;` executes the closer that the opener pushed onto the data stack.
- Stack effects treat the top-of-stack (TOS) as the rightmost item.

## `if` / `else`

Predicate must be on stack before `if`:

```tacit
dup 0 lt if
  \ negative branch
  neg
else
  \ non-negative branch
  drop
;
```

Stack effect: `( value — abs(value) )`.

## `when` / `do`

`when` chains predicates that guard `do` blocks. The first truthy predicate wins; optional fall-through code executes when all clauses fail.

```tacit
dup when
  dup 0 lt do  \ negative
    drop -1
  ;
  dup 0 gt do  \ positive
    drop 1
  ;
  drop 0        \ zero
;
```

## `case` / `of` / `DEFAULT`

`case` compares a discriminant (already on stack) against constants. `DEFAULT` matches anything.

```tacit
dup case
  0 of drop "zero" ;
  1 of drop "one" ;
  DEFAULT of drop "other" ;
;
```

Key details:

- Each `of` duplicates the discriminant with `over`, compares, emits `drop` for the match path, and restores the discriminant when the clause fails.
- `DEFAULT` pushes a sentinel value; equality treats it as matching any discriminant.
- Nested `case` constructs are supported—each opener/closer pair manages its own stack state.

## Further reading

- Normative lowering details: `docs/specs/metaprogramming.md`
- Bytecode skeletons and stack diagrams: `docs/specs/case-control-flow.md`
- Tests exercising the control-flow suite: `src/test/lang/case-control-flow.test.ts`
