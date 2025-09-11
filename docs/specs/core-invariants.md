# Core Invariants (Canonical)

This short document centralizes the rules all other specs assume.

- Reverse list layout: lists are compounds with header at TOS and payload slots beneath. Span = payload slots + 1.
- Traversal by span: element stepping uses simple=1, compound=span(header). Never assume fixed widths for compounds.
- Refs: data refs are absolute cell indices tagged by segment (`STACK_REF`, `RSTACK_REF`, `GLOBAL_REF`). Code refs are separate (`BUILTIN`, `CODE`).
- Value-by-default: `load` dereferences refs (up to two levels) and materializes lists; `fetch` strictly reads by address and materializes lists when the slot read is a LIST header.
- Analogy: treat refs like symlinks rather than raw pointers — structure-aware operations follow them transparently; stack ops manipulate the ref value itself; use `load` to “follow the link”, and `store` materializes source refs before writing.
- Assignment materializes sources: when writing, if the source is a ref, materialize to a value before comparing/applying. Do not materialize the destination; destinations are mutated in place.
- Compound compatibility: in-place mutation of compound destinations is allowed only when the source has the same structural type and total slot count; otherwise it is an error. List headers and compound starts are immutable as targets for simple writes.
- Access consistency: bracket paths are primary. Reads: `expr[ … ]` → select→load→nip, return value or NIL. Writes: `value -> var[ … ]` → &var (local or global), select→nip→store, mutate in place or throw. Low-level `elem`/`slot`/`find`/`select`/`fetch`/`store` are supporting operations.
- Liberal sources; strict destinations: sources may auto‑dereference and materialize; destinations must be addresses and are never materialized.
- Errors and NIL: Out-of-bounds address queries yield NIL; invalid reference kinds for fetch/store error; `GLOBAL_REF` is implemented and resolves to the global segment for reads/writes.

Quick Patterns (for day-to-day use)
- Read value regardless of being a ref: `load` (identity on non-refs; deref up to two levels; materializes lists).
- Strict address read: `fetch` (requires ref; materializes lists when the cell read is a LIST header).
- Assignment: destination must be a ref; if source is a ref, materialize first; simple→simple allowed; compound→compound allowed only if compatible (type + slot count); otherwise error.
- Locals/Globals: `x`/`name` → Ref + Load (value); `&x`/`&name` → address; `&x fetch`/`&name fetch` → slot content (possibly a ref); `&x load`/`&name load` → value.

Explicit local semantics (normative)
- Destination for local updates: local variables live on the return stack; assignment mutates the destination in SEG_RSTACK in place. The destination is never copied to the data stack to perform updates.
- Compound locals: slots store an `RSTACK_REF` to the compound header; compatible compound assignment overwrites payload+header at that address without changing the slot’s reference.
