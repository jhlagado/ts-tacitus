# TACIT Lists — Definitive Specification (Expanded)

> **Status:** normative for lists; implementation-defined parameters are called out explicitly.
> **Scope:** stack representation, parsing, traversal, operations, invariants, edge cases, and design rationale.
> **Audience:** implementers and advanced users building capsules/VM ops over lists.

---

## Table of contents

1. Introduction and design goals
2. Terminology (cell, slot, element, simple, compound)
3. Stack model and registers (SP, growth direction, TOS)
4. Tagged values and headers (overview)
5. Representation of a list on the stack
6. Literal syntax and grammar (BNF)
7. Parser semantics (finalization on `)`; examples)
8. Printing / pretty representation
9. Length and counting
   - `slots ( list -- n )` — O(1)
   - `elements ( list -- n )` — O(s) traversal
10. Address queries
    - `slot ( idx -- addr )` — O(1)
    - `element ( idx -- addr )` — O(s)
11. Traversal rule (type-agnostic span)
12. Structural operations (overview)
    - `cons` (prepend) — O(1)
    - `drop-head` — O(1)
    - `concat` — O(n), flattening merge
    - Append (discouraged; not a primitive)
13. Mutation (high-level)
14. Safety and validation
15. Constraints and implementation-defined limits
16. Zero-length lists
17. Complexity summary
18. Algebraic laws and identities
19. Worked examples (step-by-step stack diagrams)
20. Edge cases and failure modes
21. Testing checklist (conformance)
22. Interactions with capsules, receiver, and control flow
23. Performance notes and implementation guidance
24. FAQ / common pitfalls
25. Change log (rationale for decisions)
26. Glossary

---

## 1. Introduction and design goals

Lists in **tacit** are contiguous, stack-resident aggregates. They are engineered to:

* **Avoid heaps and pointers.** There are no cons cells or linked lists; all structure is encoded in-place on the data stack.
* **Support constant-time skipping/dropping** via a run-length header at TOS.
* **Separate physical vs logical view.** A *slot* is a fixed-size 32‑bit cell in a list’s payload; an *element* is a logical member that can span one or more slots (for compounds).
* **Favor prepend and front-drop.** These operations are O(1) and map to simple header rewrites; append is possible but O(n) and discouraged.
* **Permit limited in-place mutation.** Only simple (fixed-size) slots may be overwritten; compounds preserve structure.
* **Be type-agnostic for traversal.** Any compound’s header encodes its total span in slots so walking the payload never branches on type.

This document is intentionally explicit and example-heavy to eliminate ambiguity around stack direction, offsets, and costs.

---

## 2. Terminology

**cell** — a 32‑bit memory unit anywhere (stack, code, etc.).
**slot** — a cell addressed **relative to a list’s payload**; all slots are cells, but scoped to a particular list.
**element** — a logical member of a list: either a *simple* (1 slot) or a *compound* (multiple slots).
**simple** — a fixed-size value occupying exactly 1 slot (e.g., number, bool as 1/0, interned symbol/id, `nil`, code ref).
**compound** — a value occupying multiple slots; **must** start with a header slot that encodes its total span (e.g., a **list** with `LIST:s` header plus `s` payload slots → span = `s+1`).
**span(header)** — the total number of slots for a compound, including its header.

**Note:** a list is a compound, but compounds are not limited to lists. Future compound types must conform to the *header-with-span-in-first-slot* contract.

---

## 3. Stack model and registers

* The **data stack grows upward**: pushing increases `SP`.
* **TOS** is the slot at index `SP`.
* A list header is **at TOS**; its payload lies **below TOS** at decreasing addresses.
* The first payload slot (element 0 start) is **`SP-1`**.
* Higher element indices lie **deeper** (i.e., at lower addresses: `SP-2`, `SP-3`, … minus spans).

When this doc says “beneath” or “deeper,” it means **lower addresses** since the stack grows upward.

---

## 4. Tagged values and headers (overview)

* `LIST:s` is a tagged 32‑bit header. The tag identifies “list,” and a length field encodes the **payload slot count** `s` (implementation-defined width; see §15).
* For lists, **span** = `s + 1` (header + payload).
* For all compounds, the **first slot** is a header that **must** encode the compound’s total slot span (directly or derivably from fields).

---

## 5. Representation of a list on the stack

A list with `s` payload slots occupies `s+1` contiguous slots:

```
[ payload slot s-1 ] … [ payload slot 1 ] [ payload slot 0 ] [ LIST:s ]  ← TOS (SP)
                                                    ^ element 0 start = SP-1
```

**Example: `( 1 2 3 )`**

```
…  3  2  1  LIST:3   ← SP
           ^ SP-1 = element 0 (value 1)
```

**Key points**

* The printed order `( 1 2 3 )` matches **element order**; physically the payload is in reverse depth order because the header sits at TOS.
* `s` counts **slots**, not elements. Elements are counted by traversal (see §9.2).

---

## 6. Literal syntax and grammar (BNF)

```
list     ::= "(" elems? ")"
elems    ::= elem | elem elems

# An elem is either a simple value or a complete compound (with header)
# Nested lists are complete compounds by the time the outer list closes.
```

The language parser is responsible for producing complete compounds for any nested list before emitting the outer header.

---

## 7. Parser semantics

On encountering `)`, the parser **finalizes** the list by emitting a `LIST:s` header **above** the payload so that **element 0** is at `SP-1`.

**Worked parse** — `( 1 ( 2 3 ) 4 )`

1. Push `1` → simple slot.
2. Parse `( 2 3 )` recursively: push `2`, `3`, then header `LIST:2`. The nested list is now a complete compound occupying 3 slots.
3. Push `4`.
4. Close the outer list: count payload slots `s = 1 (for 1) + 3 (for nested) + 1 (for 4) = 5`; emit `LIST:5`.

Final stack (deep → TOS):

```
…   4   LIST:2  3  2   1   LIST:5   ← SP
            ^ nested list (span 3) is a single element of the outer list
```

---

## 8. Printing / pretty representation

* A simple printer uses **element traversal** to reconstruct `( … )`.
* `LIST:0` prints as `( )`.
* Compound elements are printed according to their own printers (lists recurse).

---

## 9. Length and counting

### slots ( list -- n )

* Returns the **payload slot count** `s` directly from the header.
* **Cost:** O(1).

### elements ( list -- n )

* Returns the **element count** by traversing the payload from `SP-1` downward.
* **Rule:** simple → step 1; compound → step `span(header)`; increment element count each step.
* **Cost:** O(s).
* **Note:** elements **cannot** be random-accessed without traversal.

---

## 10. Address queries

### slot ( idx -- addr )

* Returns the **address** (stack index) of a payload slot at **slot index `idx`**.
* **Preconditions:** `0 ≤ idx < s`.
* **Result:** `addr = SP - 1 - idx`.
* **Cost:** O(1).

### element ( idx -- addr )

* Returns the **address** of the **start slot** for **element index `idx`**.
* **Method:** traverse from `SP-1`, stepping by `1` for simple or by `span(header)` for compound, until `idx` elements have been skipped.
* **Cost:** O(s) worst-case.

### get ( addr -- value )

* Returns the value located at stack address `addr`.
* If the value at `addr` is **simple** (single-slot), returns that slot's value.
* If the value at `addr` is the start of a **compound** (its header), returns the entire compound value (header plus payload) as a single value.
* **Cost:** O(1) for simple; O(span) to materialize a compound.
* **Example:** `list 3 element get` yields the element at index 3, whether simple or compound.

### set ( value addr -- )

* Writes `value` into the slot at stack address `addr` in place.
* Allowed only when the target at `addr` is a **simple** (single-slot) value; this preserves list structure.
* If the target at `addr` is a **compound header** (e.g., a `LIST:s` header) or otherwise not simple, the operation is a **no-op (silent fail)**.
* Implementations may additionally require `value` itself to be simple; attempting to write a compound must not alter structure.
* **Cost:** O(1).
* **Example:** `100 list 2 element set` overwrites element 2 if and only if that element is simple.

---

## 11. Traversal rule (type-agnostic span)

**Invariant:** Every compound’s first slot is a header that **encodes its total span** in slots.
**Algorithm:**

```
addr := SP-1
while not done:
  if isSimple(addr): addr := addr - 1
  else:              addr := addr - span(headerAt(addr))
```

This rule is **type-agnostic** and remains valid as new compound types are introduced.

---

## 12. Structural operations

### cons

**Stack effect:** `( list value -- list' )`
**Semantics:** prepend `value` (simple or compound) as a **single element**. If `value` is a list, it becomes a **nested** list element.
**Mechanics:** pop `LIST:s`, push `value` (already complete if compound), push `LIST:s+1`.
**Cost:** O(1).
**Ordering:** list-first is the natural ordering; the list precedes the value being added at the head.

### drop-head

**Stack effect:** `( list -- list' )`
**Semantics:** remove the first element.
**Mechanics:** pop `LIST:s`, pop element 0 span (1 if simple, else `span(header)`), push `LIST:s'` where `s' = s - span(element0)`.
**Cost:** O(1) to locate/remove the head (span is at `SP-1`).

### concat

**Stack effect:** `( listA listB -- listC )`
**Semantics:** merge the **elements of `listB`** into `listA` to form a **flat** list.
**Fallback:** if the second arg is **not** a list, **behave as `cons`**.
**Mechanics:** increase `sA` by `sB`; shift `listA`’s payload deeper or splice `listB`’s payload as needed; push new header.
**Cost:** O(n) due to shifting; discouraged on hot paths.
**Ordering:** list-first ordering `( listA listB -- listC )`.

### Append (discouraged; not a primitive)

Appending at the tail is **not provided as a primitive**. It can be achieved via head-based building (e.g., swap followed by `concat`, or enlist + `concat`). This pattern is O(n) and should be avoided on hot paths. Prefer `cons` and `concat`.

---

## 13. Mutation (high-level)

Only **simple** (single-slot) payload cells may be overwritten in place. Use `set ( value addr -- )` for in-place updates to simple cells obtained via `slot`/`element` addressing. Attempts to overwrite a **compound** element (i.e., when `addr` points to a compound header such as `LIST:s`) must leave the list unchanged and are a **no-op (silent)**. Structural operations like `cons` and `drop-head` are the canonical way to change list shape. `get ( addr -- value )` returns either a simple value or a full compound value when the address points to a compound header.

---

## 14. Safety and validation

* **Header validity:** tag = `LIST`; `0 ≤ s ≤ maxSlots` (see §15).
* **Depth checks:** ensure `s+1` slots are available on the stack before operating.
* **Atomicity:** failing mutations **must leave the list unchanged**.
* **Traversal safety:** always read span from header; never assume fixed widths for compounds.

---

## 15. Constraints and implementation-defined limits

* **Word size:** 32‑bit cells.
* **Length field width:** **implementation-defined** (`LIST_LEN_BITS`). Current implementation uses **16 bits**, giving `s ≤ 65,535` (≈256 KiB payload at 4 bytes/slot).
* **Future variants:** increasing `LIST_LEN_BITS` (e.g., 18) scales maximum payload (e.g., ≈1 MiB total including header).
* **Effective maximum:** `min( (1<<LIST_LEN_BITS)-1, available_stack_space )`.

---

## 16. Zero-length lists

* `LIST:0` prints as `( )`.
* `slots(( )) = 0`, `elements(( )) = 0`.
* `drop` on a list removes the **entire list** (header plus payload) from the stack.
* `cons` on `LIST:0` yields a one-element list via the normal header rewrite.

---

## 17. Complexity summary

* `slots` → O(1)
* `elements` → O(s)
* `slot` → O(1)
* `element` → O(s)
* `cons` → O(1)
* `drop-head` → O(1)
* `concat` → O(n)
* Append (if emulated via `swap`+`concat`) → O(n)
* In-place overwrite of a simple slot (if supported) → O(1)

---

## 18. Algebraic laws and identities

Let `x` be a simple or compound value (complete if compound). Let `xs`, `ys` be lists.

* **Head law:** `drop-head ( cons xs x )  == xs`
* **Cons-assoc (nesting-preserving):** `cons (cons xs x) y  == cons xs y'` where `y'` is `y` placed before `x` (note: not commutative).
* **Concat identity:** `concat xs ( ) == xs` and `concat ( ) xs == xs`.
* **Concat associativity (flat):** `concat (concat xs ys) zs == concat xs (concat ys zs)`.
* **Cons vs concat:** `concat xs (cons ( ) x) == cons xs x`.

**Note:** Laws assume `concat` flattens and `cons` nests a compound as a single element.

---

## 19. Worked examples (diagrams)

### Building `( 1 2 3 )`

Tokens: `1 2 3 )`

```
… 1         
… 1 2       
… 1 2 3     
… 1 2 3 LIST:3   ← close, s=3
… 3 2 1 LIST:3   ← physical view deep→TOS
```

Element order: `1, 2, 3` (logical). Element 0 at `SP-1` is `1`.

### Nested `( 1 ( 2 3 ) 4 )`

```
… 1                     
… 1 2                   
… 1 2 3                 
… 1 LIST:2 3 2          ← oops (reader view)
… 1 LIST:2 3 2 4        
… 1 LIST:2 3 2 4 LIST:5 ← close outer, s=5
… 4 LIST:2 3 2 1 LIST:5 ← deep→TOS
```

Traversal sees the nested list as a **single element** with span 3.

### cons

Stack before: `… 3 2 1 LIST:3   x`
After `cons`: `… x 3 2 1 LIST:4` (logical head is `x`).

### drop-head

Before: `… x 3 2 1 LIST:4`
After:  `… 3 2 1 LIST:3`.

### concat

```
xs = ( 1 2 )  → stack: … 2 1 LIST:2
ys = ( 3 4 )  → stack: … 4 3 LIST:2

concat xs ys  → … 4 3 2 1 LIST:4  (flattened)
```

If `ys` is **not** a list, treat as `cons xs ys`.

### append

```
xs = ( 1 2 )
append xs 3 → shift payload [2 1] deeper, write 3 at tail, set LIST:3
```

### Slot vs element queries

```
( 1 ( 2 3 ) 4 )
slots   → 5
elements→ 3
slot 0  → addr (SP-1) → 1
slot 1  → addr (SP-2) → (list header of nested)
element 0 → SP-1 (1)
element 1 → SP-2 (start of nested, span 3)
element 2 → address after skipping span 3 → SP-5 (4)
```

---

## 20. Edge cases and failure modes

* **Empty:** `( )` behaves as described in §16.
* **Out-of-bounds `slot`/`element`:** must not read beyond the payload; implementation may signal error or return `nil`.
* **Illegal in-place overwrite on compound:** list remains unchanged; return `nil` or no-op.
* **Malformed header:** operations must validate tag/length before acting; reject invalid structures.

---

## 21. Testing checklist

* **Parsing**

  * `()` → `LIST:0`
  * `(1 2 3)` → `LIST:3` with correct payload order
  * Nested: `(1 (2 3) 4)` → correct `s` and element traversal
* **Printing**

  * Round-trip: parse → print → parse yields isomorphic lists
  * Empty prints `( )`
* **Lengths**

  * `slots` matches header
  * `elements` matches traversal count
* **Address queries**

  * `slot 0` = `SP-1`
  * `element i` returns the start slot per traversal
* **Ops**

  * `cons` then `drop-head` restores original
  * `concat xs () == xs` and associativity
* **Mutation**

  * Overwrite of a simple slot (if supported) succeeds; attempts on compound must not alter the list

---

## 22. Interactions with capsules, receiver, and control flow

While lists are pure data, they often back **capsules** and **sequence** abstractions. Common patterns:

* Use lists as **records** (compound) where slot-addressed fields are accessed in O(1).
* Use **drop-head** and **cons** to maintain rolling windows or queues entirely on the stack.
* Leverage the VM’s **receiver** or local frame to keep references to list addresses when iterating, but prefer traversal utilities to avoid O(n²) element access.

---

## 23. Performance notes and implementation guidance

* Prefer **cons** and **drop-head** for growth/shrink; avoid **append** in hot loops.
* Keep **mutation** confined to simple slots; treat compounds as immutable units.
* Use `slot`/`slots` when you need physical indexing; use `element`/`elements` for logical views.
* When merging, consider building lists **front-first** and reverse-printing if necessary; this keeps operations O(1) and cache-friendly.

---

## 24. FAQ / common pitfalls

* **Q:** Is element 0 at `SP+1`?
  **A:** No. The stack grows **upwards**; element 0 is at **`SP-1`**.
* **Q:** Are elements random-access?
  **A:** No. Only slots are O(1). Elements require traversal.
* **Q:** Can I overwrite a list element with another list in place?
  **A:** Not if the target is compound; perform a structural operation instead.
* **Q:** Why does `(1 (2 3) 4)` have 5 **slots** but 3 **elements**?
  **A:** Because the nested list’s span is 3 slots (header + 2 payload).
* **Q:** Do I ever need a LINK/footer?
  **A:** No; LINK-era formats are gone. Lists are header-first, run-length encoded.

---

## 25. Change log (rationale)

* Unified on **RList-like** header-at-TOS representation and removed all LINK formats.
* Clarified **upward-growing** stack and `SP-1` indexing for element 0.
* Introduced explicit distinction between **slots** and **elements**, with commands `slots`, `elements`, `slot`, `element`.
* Canonicalized **cons/drop-head** as O(1) primitives; classified **append** as discouraged O(n).
* Codified type-agnostic **span** rule for all compounds.

---

## 26. Glossary

**addr** — a stack address/index.
**append** — O(n) tail add; discouraged.
**compound** — multi-slot value starting with a header that encodes its span.
**cons** — O(1) prepend of a value as a single element.
**concat** — O(n) merge of two lists’ elements; flat result; falls back to `cons` if second arg isn’t a list.
**drop-head** — O(1) removal of element 0.
**element** — logical list member (simple or compound).
**elements** — command returning element count (O(s)).
**header** — first slot of a compound; for lists, `LIST:s`.
**LIST\:s** — list header storing payload slot count `s`.
**nil** — sentinel simple value used optionally on failure.
**slot** — cell addressed relative to a list’s payload.
**slot / slots** — address/length queries for slots.
**span** — total slot count of a compound (header + payload).
**SP** — stack pointer (top-of-stack index).
**TOS** — top-of-stack (`SP`).

---

*End of specification.*
