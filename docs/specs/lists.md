# TACIT Lists Specification

> **Status:** normative for lists; implementation-defined parameters are called out explicitly.
> **Scope:** stack representation, parsing, traversal, operations, invariants, edge cases, and design rationale.
> **Audience:** implementers and advanced users building capsules/VM ops over lists.

---

## Table of contents

1. Introduction and design goals
2. Terminology
**ref** — an abstract, tagged address pointing to a cell in a memory segment. There are three ref types:
  - **STACK_REF**: refers to a cell location in the data stack segment (SEG_STACK)
  - **LOCAL_REF**: refers to a cell location in the return stack segment (SEG_RSTACK)
  - **GLOBAL_REF**: (future) will refer to a cell location in a global segment
Refs are used for polymorphic memory addressing and are encoded as tagged values. Unless otherwise specified, references in this document refer to STACK_REFs.

4. Tagged values and headers (overview)
5. Representation of a list on the stack
6. Literal syntax and grammar (BNF)
7. Parser semantics
8. Printing / pretty representation
9. Length and counting
### slots ( list -- n )

* Returns the **payload slot count** `s` directly from the header.
* **Cost:** O(1).

### size ( list -- n )

* Returns the **element count** by traversing the payload from `SP-1` downward.
* **Rule:** simple → step 1; compound → step `span(header)`; increment element count each step.
* Returns a **ref** (typically a STACK_REF) to the **start slot** for **element index `idx`** in the data stack segment (SEG_STACK).
* **Method:** traverse from `SP-1`, stepping by `1` for simple or by `span(header)` for compound, until `idx` elements have been skipped; returns a STACK_REF to the element start slot.
* **Cost:** O(s) worst-case.
    - `pack`
* Returns the value located at the address referenced by `addr` (which may be a STACK_REF, LOCAL_REF, or GLOBAL_REF).
* If the value at `addr` is **simple** (single-slot), returns that slot's value.
* If the value at `addr` is the start of a **compound** (its header), returns the entire compound value (header plus payload) as a single value.
* `addr` is typically a STACK_REF address, but may be any ref type depending on context.
* **Cost:** O(1) for simple; O(span) to materialize a compound.
* **Example:** `list 3 elem fetch` yields the element at index 3, whether simple or compound.
14. Sorting
* Writes `value` into the slot at the address referenced by `addr` in place. `addr` is typically a STACK_REF, but may be any ref type depending on context.
* Allowed only when the target at `addr` is a **simple** (single-slot) value; this preserves list structure.
* If the target at `addr` is a **compound header** (e.g., a `LIST:s` header) or otherwise not simple, the operation is a **no-op (silent fail)**.
* Implementations may additionally require `value` itself to be simple; attempting to write a compound must not alter structure.
* **Cost:** O(1).
* **Example:** `100 list 2 elem store` overwrites element 2 if and only if that element is simple.
21. Worked examples (diagrams)
22. Edge cases and failure modes
23. Testing checklist

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
### length ( list -- n )
### slots ( list -- n )
* Returns the **element count** by traversing the payload from `SP-1` downward.
* **Cost:** O(s).
* **Cost:** O(1).

### length ( list -- n )

* Returns the **element count** by traversing the payload from `SP-1` downward.
* **Rule:** simple → step 1; compound → step `span(header)`; increment element count each step.
* **Cost:** O(s).
* **Note:** elements **cannot** be random-accessed without traversal.

---

## 10. Address queries

### slot ( idx -- addr )

* Returns the **address** (stack index) of a payload slot at **slot index `idx`**.
* **Preconditions:** `0 ≤ idx < s`.
* **Result:** returns a STACK_REF to the payload slot at index `idx`.
* **Cost:** O(1).

### elem ( idx -- addr )

* Returns the **address** of the **start slot** for **element index `idx`**.
* **Method:** traverse from `SP-1`, stepping by `1` for simple or by `span(header)` for compound, until `idx` elements have been skipped; returns a STACK_REF to the element start slot.
* **Cost:** O(s) worst-case.

### fetch ( addr -- value )

* Returns the value located at stack address `addr`.
* If the value at `addr` is **simple** (single-slot), returns that slot's value.
* If the value at `addr` is the start of a **compound** (its header), returns the entire compound value (header plus payload) as a single value.
* `addr` is a STACK_REF address.
* **Cost:** O(1) for simple; O(span) to materialize a compound.
* **Example:** `list 3 elem fetch` yields the element at index 3, whether simple or compound.

### store ( value addr -- )

* Writes `value` into the slot at stack address `addr` in place. `addr` is a STACK_REF.
* Allowed only when the target at `addr` is a **simple** (single-slot) value; this preserves list structure.
* If the target at `addr` is a **compound header** (e.g., a `LIST:s` header) or otherwise not simple, the operation is a **no-op (silent fail)**.
* Implementations may additionally require `value` itself to be simple; attempting to write a compound must not alter structure.
* **Cost:** O(1).
* **Example:** `100 list 2 elem store` overwrites element 2 if and only if that element is simple.

#### Compound Mutation: Compatibility Rule

Compound elements (e.g., lists, maplists) may be replaced in place **only if the new value has the same slot (cell) count and type** as the existing value. This is called compatibility. Assignment to a compound slot copies the new value into the existing structure, element-wise, without changing the slot reference. If the slot count or type does not match, the operation is an error and must be rejected.

**Examples:**
* Assigning `(1 2 3)` (4 cells) to a slot containing `(4 5 6)` (4 cells) is allowed.
* Assigning `(1 2)` (3 cells) to a slot containing `(4 5 6)` (4 cells) is an error.
* Assigning a maplist of 5 cells to a slot containing a maplist of 5 cells is allowed.
* Assigning a list to a slot containing a maplist (even if slot count matches) is not allowed; type must also match.

---

## 11. Traversal rule (type-agnostic span)

**Invariant:** Every compound’s first slot is a header that **encodes its total span** in slots.
**Algorithm:**

```
addr := SP-1
while not done:

1. Introduction and design goals
2. Terminology and ref types
3. Stack model and registers
4. Tagged values and headers (overview)
5. Representation of a list on the stack
6. Literal syntax and grammar (BNF)
7. Parser semantics
8. Printing / pretty representation
9. Length and counting
   - `slots ( list -- n )`
   - `length ( list -- n )`
10. Address queries and refs
  - `slot ( idx -- addr )`
  - `elem ( idx -- addr )`
  - `fetch ( addr -- value )`
  - `store ( value addr -- )`
11. Traversal rule (type-agnostic span)
12. Structural operations
  - `enlist`
  - `cons`
  - `tail`
  - `pack`
  - `unpack`
  - `append`
  - `concat`
  - `head`
  - `uncons`
13. Mutation (high-level)
14. Sorting
15. Binary search (bfind)
16. Safety and validation
17. Constraints and implementation-defined limits
18. Zero-length lists
19. Complexity summary
20. Algebraic laws and identities
21. Worked examples (diagrams)
22. Edge cases and failure modes
23. Testing checklist

### concat

### append

**Stack effect:** `( list value -- list' )`
**Semantics:** appends `value` (simple or compound) as the last element. Compounds remain intact; the list stays flat.
**Cost:** O(n). Requires shifting payload to make room at the tail and updating the header. Prefer `cons`/`tail` in hot paths.
**Examples**

```tac
( 1 2 ) 3 append         \ -> ( 1 2 3 )
( 1 ) ( 2 3 ) append     \ -> ( 1 ( 2 3 ) )
```

### head

**Stack effect:** `( list -- head | nil )`
**Semantics:** returns the first element as a single value; `nil` if the list is empty.
**Cost:** O(1) to read element 0.

### uncons

**Stack effect:** `( list -- tail head )`
**Semantics:** splits the list into its tail and head. On empty, returns `( ) nil`.
**Cost:** O(1): head is read from `SP-1`, tail is built by reducing the header length by the head span.

### concat

**Stack effect:** `( listA listB -- listC )`
**Semantics:** merge the **elements of `listB`** into `listA` to form a **flat** list.
**Fallback:** if the second arg is **not** a list, **behave as `cons`**.
**Mechanics:** increase `sA` by `sB`; shift `listA`’s payload deeper or splice `listB`’s payload as needed; push new header.
**Cost:** O(n) due to shifting; discouraged on hot paths.
**Ordering:** list-first ordering `( listA listB -- listC )`.

---

## 13. Mutation (high-level)

Only **simple** (single-slot) payload cells may be overwritten in place. Use `store ( value addr -- )` for in-place updates to simple cells obtained via `slot`/`elem` addressing. Attempts to overwrite a **compound** element (i.e., when `addr` points to a compound header such as `LIST:s`) must leave the list unchanged and are a **no-op (silent)**. Structural operations like `cons` and `tail` are the canonical way to change list shape. `fetch ( addr -- value )` returns either a simple value or a full compound value when the address points to a compound header.

---

## 14. Sorting

### Overview

`sort` returns a new list whose elements are stably reordered according to a comparator. Elements (including compounds) move as whole units; the original list is unchanged.

### Stack effect

```
list  sort { cmp }   ->  list'
```

### Comparator contract

- The block is called with A B on the stack (A = earlier, B = later):
  `( A B -- r )` where `r < 0` ⇒ A before B; `r > 0` ⇒ B before A; `r = 0` ⇒ keep order (stable).
- Short forms:
  - numeric ascending: `{ - }`
  - numeric descending: `{ swap - }`
- Mixed types require a comparator that can compare them.

### Semantics

- Stable: equal elements keep original order.
- Unit = element: compounds are not split; traversal uses element spans.
- Pure: returns a new list (no in-place structural edits).

### Complexity (informative)

- Time: O(n log n) comparisons.
- Space: O(n) (built via `cons` + final `reverse`).

### Examples

```tac
( 3 1 2 )                 sort { - }        \ -> ( 1 2 3 )
( 3 1 2 )                 sort { swap - }   \ -> ( 3 2 1 )
( (2 9) 1 (0 0 0) )       sort { length swap length - }
                                           \ by element count: -> ( 1 (2 9) (0 0 0) )
```

### Errors / sentinels

- Non-list input → error/sentinel.
- Comparator not returning a number → error/sentinel.

---

## 15. Binary search (bfind)

This is the list case of the unified `bfind` defined in Access §3.

- Precondition: list sorted by the same comparator used for `bfind`.
- Stack: `list key bfind { cmp } -> addr | nil` (address of matching element start)
- Comparator: `cmp ( key elem -- r )`; r<0 search upper, r>0 lower, r=0 match.
- Semantics: binary search over elements (compounds move as units).
- Complexity: O(log n) comparisons; O(1) space.

---

## 16. Safety and validation

* **Header validity:** tag = `LIST`; `0 ≤ s ≤ maxSlots` (see §15).
* **Depth checks:** ensure `s+1` slots are available on the stack before operating.
* **Atomicity:** failing mutations **must leave the list unchanged**.
* **Traversal safety:** always read span from header; never assume fixed widths for compounds.

---

## 17. Constraints and implementation-defined limits

* **Word size:** 32‑bit cells.
* **Length field width:** **implementation-defined** (`LIST_LEN_BITS`). Current implementation uses **16 bits**, giving `s ≤ 65,535` (≈256 KiB payload at 4 bytes/slot).
* **Future variants:** increasing `LIST_LEN_BITS` (e.g., 18) scales maximum payload (e.g., ≈1 MiB total including header).
* **Effective maximum:** `min( (1<<LIST_LEN_BITS)-1, available_stack_space )`.

---

## 18. Zero-length lists

* `LIST:0` prints as `( )`.
* `slots(( )) = 0`, `length(( )) = 0`.
* `drop` on a list removes the **entire list** (header plus payload) from the stack.
* `cons` on `LIST:0` yields a one-element list via the normal header rewrite.

---

## 19. Complexity summary

* `slots` → O(1)
* `length` → O(s)
* `slot` → O(1)
* `elem` → O(s)
* `cons` → O(1)
* `tail` → O(1)
* `concat` → O(n)
* In-place overwrite of a simple slot (if supported) → O(1)

---

## 20. Algebraic laws and identities

Let `x` be a simple or compound value (complete if compound). Let `xs`, `ys`, `zs` be lists.

- Head/tail with cons
  - `xs x cons tail == xs`
  - `xs x cons head == x`
  - `xs x cons uncons == xs x`  (order: tail head)

- Concat identity
  - `xs ( ) concat == xs`
  - `( ) xs concat == xs`

- Concat associativity (flat)
  - `xs ys concat zs concat == xs ys zs concat concat`

- Cons vs concat (singleton)
  - `xs ( ) x cons concat == xs x cons`

Note: `concat` flattens and `cons` nests a compound as a single element.

---

## 21. Worked examples (diagrams)

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

### tail

Before: `… x 3 2 1 LIST:4`
After:  `… 3 2 1 LIST:3`.

### concat

```
xs = ( 1 2 )  → stack: … 2 1 LIST:2
ys = ( 3 4 )  → stack: … 4 3 LIST:2

concat xs ys  → … 4 3 2 1 LIST:4  (flattened)
```

If `ys` is **not** a list, treat as `cons xs ys`.

### Slot vs element queries

```
( 1 ( 2 3 ) 4 )
slots   → 5
length  → 3
slot 0  → addr (SP-1) → 1
slot 1  → addr (SP-2) → (list header of nested)
elem 0 → SP-1 (1)
elem 1 → SP-2 (start of nested, span 3)
elem 2 → address after skipping span 3 → SP-5 (4)
```

---

## 22. Edge cases and failure modes

* **Empty:** `( )` behaves as described in §16.
* **Out-of-bounds `slot`/`elem`:** must not read beyond the payload; return `nil`.
* **Illegal in-place overwrite on compound:** list remains unchanged; return `nil` or no-op.
* **Malformed header:** operations must validate tag/length before acting; reject invalid structures.

---

## 23. Testing checklist

* **Parsing**

  * `()` → `LIST:0`
  * `(1 2 3)` → `LIST:3` with correct payload order
  * Nested: `(1 (2 3) 4)` → correct `s` and element traversal
* **Printing**

  * Round-trip: parse → print → parse yields isomorphic lists
  * Empty prints `( )`
* **Lengths**

  * `slots` matches header
  * `length` matches traversal count
* **Address queries**

  * `slot 0` = `SP-1`
  * `elem i` returns the start slot per traversal
* **Ops**

  * `cons` then `tail` restores original
  * `concat xs () == xs` and associativity
* **Mutation**

  * Overwrite of a simple slot (if supported) succeeds; attempts on compound must not alter the list

