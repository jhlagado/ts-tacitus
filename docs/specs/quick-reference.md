# Tacit Quick Reference

This one‑page cheatsheet lists common patterns and their canonical lowerings.

Variables
- Locals — declare: `value var x`; access: `x` (value), `&x` (address)
- Globals — declare: `value global name`; access: `name` (value), `&name` (address)

Access & Write (lowering)
```tacit
x               → VarRef(slot) · Load
&x              → VarRef(slot) · Fetch
name            → LiteralNumber(DATA_REF(global-slot)) · Load
&name           → LiteralNumber(DATA_REF(global-slot))

value -> x      → VarRef(slot) · Store
value -> name   → LiteralNumber(DATA_REF(global-slot)) · Store

expr[ … ]       → [path] · Select · Load · Nip
value -> x[ … ] → VarRef(slot) · Fetch · [path] · Select · Nip · Store
value -> name[ …]→ LiteralNumber(DATA_REF(global-slot)) · Fetch · [path] · Select · Nip · Store
```

Increment (+>)
- Locals-only:
```tacit
value +> x      → VarRef(slot) · Swap · Over · Fetch · Add · Swap · Store
value +> x[ … ] → VarRef(slot) · Fetch · [path] · Select · Nip · Swap · Over · Fetch · Add · Swap · Store
```
- Globals: use explicit RMW `value name add -> name` (no `+>` on globals).

Bracket Paths
- Read: numbers index list elements; strings index maplist keys.
- Reads are liberal; writes require an address destination.
 - Shorthand: `'key` is equivalent to `"key"` for bare keys (no spaces/grouping).

Invariants (essentials)
- Value-by-default: `load` materializes refs; `fetch` strictly reads addresses.
- Destinations are never materialized; compound writes require compatibility.
- SP/RSP/BP are cell-indexed; bytes only at memory boundaries.

Common Pitfalls
- TOS is rightmost; RPN executes immediately with fixed arity.
- Don’t assume `+>` works for globals; use explicit RMW.
- Destinations must be addresses; sources that are refs are materialized.

See also
- variables-and-refs.md — full spec for variables, globals, refs
- lists.md — list structure, traversal, addressing
- core-invariants.md — canonical rules
