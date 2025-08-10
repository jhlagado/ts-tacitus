# TACIT Access Specification

## Table of contents

1. Overview
2. Combinator form and path construction
3. Addressing and search (find family)
4. `get` — conceptual behavior
5. `set` — conceptual behavior
6. Edge cases and failure modes
7. Performance characteristics
8. Relation to capsules
9. Example structure
10. Summary
11. Test checklist (conformance)

### 1. Overview

`get` and `set` are high-level, polymorphic access operators for TACIT data structures.
They provide a uniform way to traverse and optionally modify nested lists, map lists, or mixed structures using a **path**.

Paths are expressed as lists of **indices** (numbers) and/or **keys** (symbols).

* **Numbers** → element index (0-based, element semantics).
* **Symbols** → map key (map list semantics).
* Mixed values → alternate between list and map lookups as traversal proceeds.

A failed lookup at any step produces `nil` and terminates the operation.

These combinators are layered on the foundational list/maplist primitives:
- Addressing via `element` for lists and `find` for maplists
- Value access via `fetch ( addr -- value )`
- In-place simple updates via `store ( value addr -- )`

They hide address arithmetic and traversal details while preserving stack discipline.

### 2. Combinator form and path construction

Both operators are combinators. They consume the value(s) on the left, then execute a **standalone code block** on the right to produce the path.

```
list  get { path-items… }
value list  set { path-items… }
```

The block’s result is always taken as a list representing the path.

#### Path construction
- The block can compute paths dynamically; its result must be a list of tokens to apply.
- Path items must be either numbers (element indices, 0-based) or symbols (map keys).
- Mixed paths are allowed; traversal semantics switch based on item type at each step.

### 3. Addressing and search (find family)

This section defines unified, address-returning search operations that `get`/`set` build upon. These words do not mutate; they compute addresses which you can pair with `fetch`/`store`.

#### find

Stack effect:

```
target  key  find   ⇒   addr | default-addr | nil
```

Semantics:
- If `key` is a number and `target` is a list: return the address of element `key` (0-based) using element traversal. O(s) worst-case.
- If `key` is a symbol and `target` is a maplist: return the address of the associated value via linear search; if absent and `default` is present, return its value address; else `nil`. O(n).
- Otherwise: `nil`.

Notes: Always returns an address or `nil`; combine with `fetch`/`store`.

#### bfind (binary search)

Stack effect:

```
target  key  bfind { cmp }   ⇒   addr | nil
```

Semantics by target:
- List: classic binary search over elements using comparator `cmp ( key elem — r )`. Precondition: list sorted by the same comparator. Returns address of matching element start, or `nil`.
- Maplist: binary search over keys using key comparator consistent with `mapsort`. Precondition: maplist sorted by that key comparator. Returns address of matching value element, or `nil`.

Policy and constraints:
- Comparator block is required; it must return a number (float).
- With duplicates, return the first equal (lower_bound) for determinism.
- Mismatched comparator vs sort order yields undefined results.

#### hfind (hashed lookup)

Stack effect:

```
target  key  index  hfind   ⇒   addr | default-addr | nil
```

Semantics:
- Maplist only: with an explicit hash index `index` (built via `hindex`), perform O(1) average lookup by interned key identity and return the value address; on miss, return `default`’s value address if present, else `nil`.
- Invalid or mismatched index → `nil`.
- Lists: not applicable → `nil`.

Implementation notes: Hash indices store key identities and value slot offsets (relative to the header) so results remain valid regardless of stack address. Build them with `hindex` (see maplists), and pass the index explicitly to `hfind`.

### 4. `get` — conceptual behavior

**Stack effect:**

```
target  get { … }   ⇒   value | nil
```

1. Executes the block, producing a path list.
2. Traverses the target using the path:

   * Numbers → list element access.
   * Symbols → map key lookup.
3. Returns the final value, or `nil` if any step fails.

Traversal details per path item:
- Number `i`: target must be a list; compute address with `element i`, then `fetch` the element.
- Symbol `k`: target must be a maplist; compute address with `find k`, then `fetch` the value (or `nil` if not found and no default).
- If the current target is not of the expected shape for the item type, return `nil`.

#### Examples

```
root  get { 2 }                      \ get root[2]
root  get { `name }                  \ get root[`name]
root  get { 3 `address `postcode }   \ nested lookup
root  get { `users 0 `email }        \ mixed types in path
```

If any index is out-of-bounds, or a key is absent with no default, `nil` is returned immediately.

Computed path example:
```
( 0 1 2 ) dup 1 element fetch          \ pick a dynamic index
root  get { swap }                     \ use the fetched index as the path
```

### 5. `set` — conceptual behavior

**Stack effect:**

```
value  target  set { … }   ⇒   ok | nil
```

1. Executes the block, producing a path list.
2. Traverses the target just like `get`.
3. If traversal fails → returns `nil`.
4. If it lands on a **simple element** → overwrites it with `value`, returns `ok`.
5. If the target is **compound** (list, capsule, etc.) → no change, returns `nil`.

Traversal mirrors `get`, but the final step obtains the element address and applies `store`:
- For number `i`: address = `element i`; apply `store` if the element is simple; else return `nil`.
- For symbol `k`: address = `find k`; apply `store` if the value element is simple; else return `nil`.

#### Examples

```
3  list  set { 7 }                      \ list[7] = 3
"Jane"  root  set { `users 0 `name }    \ set users[0].name
0  root  set { `stats `count }          \ set stats.count
```

#### Notes

* Only **simple values** may be written (`number`, `boolean`, `string`, `symbol`, `nil`).
* No structural edits: `set` does not insert keys or extend lists.

### 6. Edge cases and failure modes

- Non-list target when number index encountered → `nil`.
- Non-maplist target when symbol key encountered → `nil`.
- Out-of-bounds index → `nil`.
- Missing key with no `default` in maplist → `nil`.
- Attempting to overwrite a compound element → `nil` (no change).

### 7. Performance characteristics

- Path evaluation cost is proportional to the number of steps and underlying access costs:
  - List element step: address O(s) in worst case for deep traversal to compute `element i`; `fetch` is O(1) simple or O(span) for compound.
  - Maplist key step: address via `find` is O(n) linear, or O(log n) with `bfind` on sorted keys, or average O(1) with a prebuilt hash index as described in maplists Appendix A.
- `set` adds an O(1) `store` when the target is simple; otherwise returns `nil`.

### 8. Relation to capsules

Capsules are lists with conventions. Paths that index into capsule elements (numbers) behave like list access. Method dispatch and named field access inside capsule methods remain separate concerns; use capsule field names or `with` blocks for behavior. For low-level element updates on capsule data fields, these combinators still apply (subject to simple-only write rules).

### 9. Example structure

```
\ Root object
(
  `users (                           \ key: users
    ( `name "Alice" `age 30 )         \ element 0
    ( `name "Bob"   `age 25 )         \ element 1
  )
  `stats ( `count 2 `active true )
  `items ( 10 20 30 )
)
```

#### Access with `get`

```
root  get { `users 1 `name }    \ → "Bob"
root  get { `stats `count }     \ → 2
root  get { `items 0 }          \ → 10
root  get { `users 2 `name }    \ → nil (out of bounds)
```

#### Modify with `set`

```
"Charlie" root set { `users 0 `name }  \ users[0].name = "Charlie"
99       root set { `items 1 }         \ items[1] = 99
root get { `users 0 `name }            \ → "Charlie"
```

### 10. Summary

* **Uniform path traversal** across lists and map lists.
* **Numbers** = element index; **symbols** = map key.
* `get` returns a value or `nil`.
* `set` modifies simple values in-place, returns `ok` or `nil`.
* Always uses the combinator form: target, operator, path block.
* Designed to replace low-level `element` and `slot` access for most use cases, internally leveraging `element`/`find` with `fetch`/`store`.

### 11. Test checklist (conformance)

- Path evaluation
  - Empty path returns target unchanged (read), and is a no-op for `set`.
  - Mixed list/maplist paths traverse correctly and short-circuit to `nil` on mismatch.
- `get`
  - In-bounds indices and present keys return correct values.
  - OOB index, missing key with/without `default` → `nil` / default value respectively.
- `set`
  - Simple targets update in place; compounds remain unchanged and yield `nil`.
  - No structural edits occur; list/maplist shapes are preserved.
- find family (addressing)
  - `find` returns correct addresses for list indices and maplist keys; matches `fetch` results.
  - `bfind` with correct pre-sorted inputs returns address of the first equal (lower_bound) or `nil`.
  - `hfind` with a valid `hindex` returns matching addresses; invalid index → `nil`.
- Error handling
  - Non-number comparator result in `bfind` is rejected.
  - Non-maplist input to `hindex` rejected; non-pair payload rejected.
