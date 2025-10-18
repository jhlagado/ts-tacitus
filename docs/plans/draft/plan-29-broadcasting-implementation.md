# Plan 29 — Broadcasting (APL‑style) Implementation

Status: draft
Depends on: specs/broadcasting.md, specs/lists.md, specs/variables-and-refs.md, docs/reference/known-issues.md

## Goals
- Add elementwise broadcasting for core unary/binary built‑ins over simple values and lists.
- Support scalar extension and cycle‑to‑match (shorter repeats modulo) for list×list.
- Recurse into nested lists when operators are defined at that level.
- Preserve Tacit invariants: value‑by‑default deref, reverse list layout, in‑place assignment compatibility.

## Out of Scope
- General broadcast combinators (e.g., bmap/bimap).
- Shape inference beyond list element counts.

## Deliverables
- Engine: `broadcastUnary`, `broadcastBinary` helpers (non‑exported), integrated into target built‑ins.
- Built‑ins lifted: unary (`negate abs floor ceil round not`), binary (`add sub mul div mod pow eq neq lt le gt ge and or`).
- Error: "broadcast type mismatch" path added to errors handling.
- Docs: specs/broadcasting.md (normative); cross‑refs updated where needed.
- Tests: full matrix for unary, simple×list, list×simple, list×list (equal/unequal), nested, empties, refs, type errors.

## Approach
1) Detection and dispatch
- Unary: in each target builtin, if TOS is a list header → `broadcastUnary(vm, opId)`, else simple fast path.
- Binary: if either operand is a list header → `broadcastBinary(vm, opId)`, else simple×simple fast path.

2) Algorithms (no cycle materialization)
- Unary: traverse elements by span, apply op on value (load), recurse on list elements if supported.
- Binary:
  - simple×list / list×simple: traverse list elements; for each element, apply recursively with the simple counterpart.
  - list×list: `m = length(a)`, `n = length(b)`, `L = max(m,n)`; for `i=0..L-1`, get element addresses via modulo index, `load` values, recurse/apply.
- Builders: push element results (preserve spans), then header (reverse layout).

3) Performance
- Fast‑path equal‑length flat numeric lists with tight zipped loops.
- Avoid temporary cycled lists; modulo indexing only.
- Use existing span traversal utilities.

4) Errors and assignment
- Throw "broadcast type mismatch" when a pair has no supported op at that level.
- Assignment with `->` follows existing compatibility rules; destinations are never materialized.

## Milestones
- M1 Engine scaffolding
  - Add helpers in lists/ or core layer (private): element address by index (reusing `elem`), length (element count), list header checks.
  - Implement `broadcastUnary` with `negate` wired.
  - Tests: unary simple, list, nested, empty.
- M2 Binary, scalar extension
  - Implement `broadcastBinary` simple×list and list×simple; wire `add`.
  - Tests: scalar extension both sides; refs inputs; empty handling.
- M3 Binary list×list, modulo cycling
  - Add cycle‑to‑match modulo iteration; wire `add`, `mul`.
  - Tests: equal length, unequal length, nested.
- M4 Extend builtin coverage
  - Wire comparisons/logicals; numeric ops (`sub div mod pow`); unary math.
  - Tests: mixed operations; type mismatch assertions.
- M5 Perf and polish
  - Add equal‑length flat numeric fast path.
  - Audit errors/messages; finalize docs.

## Built‑ins mapping (initial)

- Unary: `Negate, Abs, Floor, Ceil, Round, Not`
- Binary: `Add, Sub, Mul, Div, Mod, Pow, Eq, Neq, Lt, Le, Gt, Ge, And, Or`

Each builtin receives an `opId` used by broadcasting helpers to dispatch simple handlers:
- `applyUnary(opId, x) → y`
- `applyBinary(opId, a, b) → r`

## Pseudocode (sketch)

Unary
```
broadcastUnary(vm, opId):
  x = vm.peek()
  if isList(x):
    xs = popList(vm)                ; materialized payload+header
    out = []
    for each element e in xs.elements():
      if isList(e): out.push( broadcastUnaryOnList(e, opId) )
      else:         out.push( applyUnary(opId, e) )
    pushList(vm, out)
  else:
    y = applyUnary(opId, pop())
    push(y)
```

Binary
```
broadcastBinary(vm, opId):
  b = peek(); a = peek2()
  if isList(a) and isList(b):
    as = popListA(); bs = popListB()
    L = max(len(as), len(bs))
    out = []
    for i in 0..L-1:
      ea = as.elementAt(i % len(as))
      eb = bs.elementAt(i % len(bs))
      out.push( broadcastPair(ea, eb, opId) )
    pushList(vm, out)
  else if isList(a) or isList(b):
    listSide = listOf(a,b); simpleSide = simpleOf(a,b)
    ls = popList(listSide); s = pop(simpleSide)
    out = []
    for e in ls.elements(): out.push( broadcastPair(e, s, opId) )
    pushList(vm, out)
  else:
    r = applyBinary(opId, pop2())
    push(r)

broadcastPair(ea, eb, opId):
  if isList(ea) or isList(eb): return broadcastBinaryOnElements(ea, eb, opId)
  return applyBinary(opId, ea, eb)
```

Notes
- `popList`/`pushList` are conceptual: use existing list builders and traversal without duplicating payloads unnecessarily.
- Use value‑by‑default (`load`) on element reads; never operate on addresses.

## Invariants & Safety
- No modification of input lists; broadcasting constructs new outputs.
- Reverse list layout preserved in all outputs.
- Assigning results via `->` follows existing destination compatibility rules.

## Success Criteria
- All test matrix cases pass; performance on equal‑length flat numeric lists within acceptable factor of simple zipped loops.
- No regressions in simple×simple built‑ins.

## Test Matrix (high‑level)
- Unary: `( )`, `( 1 2 3 ) negate`, `( (1 2) 3 ) negate`.
- Binary:
  - simple×simple: `1 2 add`.
  - simple×list: `1 ( 10 20 ) add`; list×simple: `( 1 2 ) 10 add`.
  - list×list equal: `( 1 2 ) ( 3 4 ) add`.
  - list×list unequal: `( 1 2 ) ( 3 4 5 ) add`.
  - nested: `( (1 2) (3 4) ) ( 10 20 ) add`.
  - empties: `( ) ( 1 2 ) add`, `( ) negate`.
  - type errors: `( 1 "a" ) ( 2 3 ) add`.
  - refs: `&x ( 1 2 ) add` (value‑by‑default), `&name ( 1 2 ) add`.

## Risks & Mitigations
- Deep recursion costs on heavily nested lists → ensure tail‑like iteration at top level; recurse only per element.
- Type dispatch surface area across built‑ins → stage integration by opcode, reuse a central op table.
- Performance regressions → keep simple×simple fast paths; add equal‑length flat numeric path.

## Rollout
- Land M1–M3 behind a feature flag if needed; enable by default once tests stabilize.
- Document in specs/broadcasting.md + examples.

