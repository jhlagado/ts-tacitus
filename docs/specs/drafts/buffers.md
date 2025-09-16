# Buffer (LIST‑backed Ring Buffer)

Purpose
- Define a fixed‑size, mutable buffer primitive for Tacit, built entirely on the existing LIST representation and stack addressing. Buffers can act like stacks (push/pop) or queues (unshift/shift) and live as first‑class values or inside locals/globals via refs.

Design goals
- Constant‑size: no resizing or heap allocation.
- Pure LIST semantics: header at TOS; payload slots addressed via `slot`/`fetch`/`store`.
- Dual‑mode: O(1) push/pop and shift/unshift with wrap‑around.
- In‑place mutation: only simple slots are written; structure remains intact.
- Caller policy: no internal overwrite policy; compose behavior explicitly.

Stack representation (cells)
- A buffer is a LIST with payload layout: `[ start, end, data0, data1, …, data(capCells-1) ]`.
- Header `LIST:s` sits at TOS; payload lies beneath (lower addresses) per list spec.
- Meta slots (nearest the header):
  - slot 0 (SP-1): start — index of the first logical element
  - slot 1 (SP-2): end — one past the last logical element
- Capacity and size are derived:
  - `s = slots(list)` (payload slots from header)
  - `capCells = s - 2` (ring storage including one reserved cell)
  - `capacity = capCells - 1` (maximum storable elements)
  - `size = (end - start + capCells) % capCells`
  - `empty ⇔ start == end`
  - `full  ⇔ ((end + 1) % capCells) == start`

Addressing rules (no raw memory)
- Use `slot` to address payload cells relative to the header, then `fetch`/`store`.
- Works equally with a materialized LIST or a ref‑to‑LIST header; `slot` is segment‑aware.

Creation
- `buffer` ( N -- list )
  - Allocates a LIST with `s = 2 + (N + 1)` payload slots (one reserved to distinguish full vs empty).
  - Initializes `start = 0`, `end = 0` and sets each data slot to `NIL`.
  - Minimum `N` is 1; invalid sizes throw.

Operations (no dots; human‑readable names)
- `buf-size` ( list/ref -- n )
  - Computes current element count using the size formula above.
- `is-empty` ( list/ref -- 1|NIL )
  - Pushes `1` when `start == end`, otherwise `NIL`.
- `is-full` ( list/ref -- 1|NIL )
  - Pushes `1` when `((end + 1) % capCells) == start`, otherwise `NIL`.
- `push` ( list/ref x -- list/ref 1|NIL )
  - If full, returns `NIL` (no mutation). Otherwise, writes `x` at `data[end]`, then `end = (end + 1) % capCells`, returns `1`.
- `pop` ( list/ref -- list/ref v|NIL )
  - If empty, returns `NIL`. Otherwise, `end = (end - 1 + capCells) % capCells`, then returns `data[end]`.
- `unshift` ( list/ref x -- list/ref 1|NIL )
  - If full, returns `NIL`. Otherwise, `start = (start - 1 + capCells) % capCells`, writes `x` at `data[start]`, returns `1`.
- `shift` ( list/ref -- list/ref v|NIL )
  - If empty, returns `NIL`. Otherwise, returns `data[start]`, then `start = (start + 1) % capCells`.

Aliases
- `read`  ≡ `pop`
- `write` ≡ `unshift`

Notes on policy and composition
- Overwrite‑on‑full is left to the caller. For example: `is-full` guarded `shift` then `push` implements drop‑oldest.
- All meta/data cells are simple; `store` to those slots is always allowed by the list spec.

Integration in capsules and locals
- Buffers are just lists. To embed a buffer in a local, allocate with `buffer N` and `store` into the local’s ref. All subsequent updates operate in place via the ref.
- Example (sketch):
  - `( buffer 8 ) &q store   \ allocate 8‑cap buffer and bind local q`
  - `42 &q fetch write       \ unshift 42 into q`
  - `&q fetch read           \ pop from the tail`

Use cases
- Traversal stacks, bounded histories, token queues, sliding windows.

Future extensions (non‑normative)
- Optional timestamp metadata per slot, blocking semantics, or multi‑VM variants — all can be layered without changing the base layout.

Operational lowering (illustrative)
- The following shows how each op interacts with list cells using only `slot`/`fetch`/`store` and integer arithmetic. Pseudocode expresses stack effects; it is not a separate API.

Size
1. `s = slots(list)`
2. `cap = s - 2`
3. `start = list[0] load`, `end = list[1] load`
4. `size = (end - start + cap) % cap`

Push
1. Compute `cap` and read `start,end` as above; if `((end + 1) % cap) == start` → `NIL`.
2. `addr = 2 + end` → `slot` → `store x`.
3. `end' = (end + 1) % cap` → `slot 1` → `store end'`.

Pop
1. Read `start,end`; if `start == end` → `NIL`.
2. `end' = (end - 1 + cap) % cap` → `slot 1` → `store end'`.
3. `addr = 2 + end'` → `slot` → `fetch` to return value.

Unshift
1. Read `start,end`; if `((end + 1) % cap) == start` → `NIL`.
2. `start' = (start - 1 + cap) % cap` → `slot 0` → `store start'`.
3. `addr = 2 + start'` → `slot` → `store x`.

Shift
1. Read `start,end`; if `start == end` → `NIL`.
2. `addr = 2 + start` → `slot` → `fetch` to return value.
3. `start' = (start + 1) % cap` → `slot 0` → `store start'`.

Testing checklist (behavioral)
- Creation: `buffer 0/1/N` valid ranges; meta zeroed; data set to `NIL`.
- Meta queries: `buf-size`, `is-empty`, `is-full` match constructed scenarios.
- Wrap‑around: push/unshift past boundary; pop/shift across boundary.
- Under/overflow: return `NIL` with no meta changes.
- Locals/refs: same behavior when operating via a local’s ref.

