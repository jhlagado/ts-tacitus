# Broadcasting — Specification (Normative)

Depends on: `lists.md`, `variables-and-refs.md`, `errors-and-failures.md`, `vm-architecture.md`
Assumes list invariants (reverse layout, header at TOS) and value-by-default deref for refs.

## 1. Scope & Intent

Elementwise application of **unary** and **binary** operators over **simple values** and **lists**.
When list lengths differ, **the shorter list is logically repeated (cycled) to the length of the longer one** before pairwise application.

## 2. Unary Broadcasting

**Stack effect**

```tacit
\ ( x — y )
```

**Rules**

* If `x` is simple → apply operator directly.
* If `x` is a list → apply operator to each **element**; result list preserves slot count and element structure per `lists.md`.&#x20;

**Examples**

```tacit
5 negate                 \ -> -5
( 1 2 3 ) negate         \ -> ( -1 -2 -3 )
```

## 3. Binary Broadcasting

**Stack effect**

```tacit
\ ( a b — r )
```

**Cases**

1. **simple simple**: `a b op` → simple
2. **simple list**: broadcast `a` across elements of `b`
3. **list simple**: broadcast `b` across elements of `a`
4. **list list**: pairwise application after **cycle-to-match** (below)

### 3.1 Cycle-to-Match (normative)

Given lists `A` (length `m`) and `B` (length `n`):

* Let `L = max(m, n)`.
* Form logical views `A*` and `B*` of length `L` by repeating each list’s elements **in order**, cycling from the start, until length `L` is reached. (Conceptual: implementations may compute indices modulo `m`/`n` without materializing.)
* Apply `op` pairwise over `A*` and `B*` to produce a length-`L` result; header and payload are constructed per list layout rules.&#x20;

**Canonical example (your rule)**

```tacit
( 1 2 3 ) ( 1 2 3 4 5 6 ) add
\ cycle shorter to match longer:
\ ( 1 2 3 1 2 3 ) ( 1 2 3 4 5 6 ) add
\ -> ( 2 4 6 5 7 9 )
```

**More examples**

```tacit
1 ( 10 20 30 ) add        \ -> ( 11 21 31 )
( 1 2 3 ) 10 add          \ -> ( 11 12 13 )
( 1 2 ) ( 10 20 30 40 ) mul
\ cycles (1 2)->(1 2 1 2) → ( 10 40 30 80 )
```

## 4. Nesting & Types

* If an element is itself a list and `op` is defined for lists, broadcast **recursively** at that element; otherwise this pair is a type error.
* Result element spans follow `lists.md` span rules; structure is preserved; compound compatibility rules still apply when storing results.&#x20;

## 5. Empty Lists

```tacit
( ) x op             \ -> ( )          \ unary over empty → empty
x ( ) op             \ -> ( )          \ binary with one empty → empty
( ) ( ) op           \ -> ( )          \ both empty → empty
```

## 6. Errors (normative)

* If a paired element combination has **no defined `op`** at that level:
  `"broadcast type mismatch"` (throw).&#x20;
* Reads still follow value-by-default; strict address reads use `fetch`; invalid addresses error per variables-and-refs spec.

## 7. Interaction with Refs & Assignment

* Inputs may be **values or refs**; evaluation uses value-by-default (`load`) so element values are operated on, not their addresses.&#x20;
* Storing broadcast results with `->` respects list mutation rules: simple→simple allowed; compound→compound requires **compatibility**; otherwise error.&#x20;

## 8. Determinism & Layout

* Result length is deterministically `max(length(a), length(b))` for binary list cases; headers and payloads obey standard reverse layout (header at TOS).&#x20;
* No hidden side effects; works within the VM’s cell-indexed frame model.&#x20;

## 9. Operators in Scope (initial)

- Unary: `negate abs floor ceil round not`
- Binary: `add sub mul div mod pow eq neq lt le gt ge and or`

---

## 10. Dispatcher Behavior (implicit lifting)

Unary built-ins
- If TOS is a simple value → run the builtin’s simple fast path.
- If TOS is a list header (`Tag.LIST`) → run unary broadcasting over its elements.

Binary built-ins
- If both operands are simple → run the builtin’s simple×simple fast path.
- If either operand is a list header (`Tag.LIST`) → run binary broadcasting:
  - simple×list or list×simple → scalar extension over the list.
  - list×list → cycle-to-match, then pairwise application.

Notes
- Lifting is implicit for the listed built-ins. No new surface syntax or opcodes are required.
- Value-by-default applies before element application: inputs (values or refs) are treated as values for broadcasting.

## 11. Algorithm Details (normative)

Unary `op(x)`
1) If `x` is simple → return `op(x)`.
2) If `x` is a list:
   - Iterate elements by traversal (elements may be simple or compounds with span).
   - For each element `e`:
     - If `e` is simple → `op(e)`.
     - If `e` is a list and `op` is defined for lists → recurse.
     - Else → throw "broadcast type mismatch".
   - Assemble payload in depth order; push header at TOS (reverse layout).

Binary `op(a,b)`
1) simple×simple → return `op(a,b)`.
2) simple×list or list×simple → iterate the list’s elements; apply recursively per element with the simple counterpart.
3) list×list → let `m = length(a)`, `n = length(b)`, `L = max(m,n)`:
   - For `i = 0..L-1`:
     - `ea = elementAt(a, i % m)`, `eb = elementAt(b, i % n)` (element-level indexes; do not materialize cycles).
     - If both `ea`, `eb` are simple → `op(ea, eb)`.
     - If either is a list and the operator is defined for lists → recurse at that pair.
     - Else → throw "broadcast type mismatch".
   - Assemble payload in depth order; push header.

Implementation guidance
- Use existing list span rules (`lists.md`) to step elements and preserve compound spans.
- Avoid building temporary cycled lists; use modulo indices only.
- Preserve simple×simple fast paths for performance.

## 12. Type Domains (informative)

Unary
- `negate abs floor ceil round`: defined for numbers; error otherwise.
- `not`: defined for truthy/falsy numeric domain (0 = false, non‑zero = true); returns numeric 0/1.

Binary
- Arithmetic (`add sub mul div mod pow`): defined for numbers.
- Comparisons (`eq neq lt le gt ge`): defined for numbers (and optionally for strings when both operands are strings). Mixed types error.
- Logical (`and or`): defined for numeric truth domain; returns numeric 0/1.

Notes
- Exact domain coverage beyond numbers is implementation‑defined; when unsupported, raise "broadcast type mismatch" at the element pair.

## 13. Worked Examples (nested + errors)

Nested success
```tacit
( (1 2) (3 4) ) ( 10 20 ) add
\ -> ( (11 12) (23 24) )

( (1 2) 3 ) 10 add
\ -> ( (11 12) 13 )
```

Type mismatch (error on mixed types)
```tacit
( 1 "a" ) ( 2 3 ) add
\ error: broadcast type mismatch
```

Empties
```tacit
( ) ( 1 2 ) add   \ -> ( )
( ) negate        \ -> ( )
```

## 14. Testing Checklist (informative)

- Unary: simple, list, nested, empty.
- Binary: simple×simple; simple×list; list×simple; list×list equal length; list×list unequal with modulo cycling.
- Nested: list elements that are lists (recurse vs mismatch).
- Empties: unary over empty; one or both empty in binary.
- Refs: inputs as `&x`/`&name` behave as values (value‑by‑default).
- Assignment: writing broadcast results with `->` respects compatibility rules; incompatible assignments throw.
