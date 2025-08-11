# TACIT Reference Glossary

This glossary reflects the current, canonical TACIT specs. Legacy terms (e.g., LINK, function table) are intentionally omitted.

## Lists (data structure)

- LIST: Reverse list with header at TOS storing payload slot count `s`; payload (elements) beneath. Traversal uses span headers only.
- element: Logical member (simple or compound) of a list.
- slots ( list — n ): O(1) payload slot count (from header).
- length ( list — n ): O(s) element count via traversal.
- slot ( idx — addr ): O(1) payload slot address.
- elem ( idx — addr ): O(s) start address of element by logical index.
- fetch ( addr — value ): Read simple or compound value at address.
- store ( value addr — ): In-place write to simple cell; compounds are no-op.

Structural ops
- enlist ( value — list ): Wrap value as one-element list.
- cons ( list value — list' ): Prepend value as single element. O(1).
- tail ( list — list' ): Remove head element. O(1).
- head ( list — head | nil ): Return head element, or nil for empty.
- uncons ( list — tail head ): Split into tail and head. O(1).
- append ( list value — list' ): Append value as last element. O(n).
- concat ( listA listB — listC ): Flat merge; O(n).
- pack ( item-n … item0 n — list ): Build list from n stack items.
- unpack ( list — item-n … item0 ): Push elements; inverse of pack (without count).

Sorting and search
- sort ( list { cmp } — list' ): Stable element reorder; comparator `( A B — r )`.
- bfind ( target key { cmp } — addr | nil ):
  - List: binary search over elements (pre-sorted by same cmp).
  - Maplist: binary search over keys (pre-sorted by mapsort comparator).
- hindex ( maplist [capacity] — index ): Build hash index for maplist keys.
- hfind ( target index key — addr | default-addr | nil ): Hashed lookup (maplist only).
- find ( target key — addr | default-addr | nil ): Linear; list index or maplist key.

## Maplists

- Maplist: List of alternating key/value pairs `( k1 v1 k2 v2 … )`.
- default key: Fallback value when lookup fails.
- mapsort ( maplist { kcmp } — maplist' ): Stable reorder by key comparator.
- keys / values: Extract keys-only or values-only lists.

## Access (polymorphic)

- get ( target { path } — value | nil ): Path of numbers (indices) and symbols (keys).
- set ( value target { path } — ok | nil ): Simple-only writes; no structural edits.

## Capsules

- Capsule: List-based object; element 0 is dispatch maplist; subsequent elements are fields.
- with { … }, .method: Receiver-scoped method dispatch.

## Tagged values and numbers

- Numbers: IEEE‑754 float32 (default numeric type).
- Tagged value: NaN-boxed with 6-bit tag + 16-bit payload for non-number types.
- NIL: Sentinel (Tag.INTEGER payload 0) for “absent”.

## VM

- Segments: STACK (data), RSTACK (return), CODE (bytecode), STRING (digest).
- Registers: SP (stack), RP (return), IP (instruction), BP (base).
- Symbol table: Maps names to built-ins and code addresses.
- Stack effect notation: `( before — after )`.
