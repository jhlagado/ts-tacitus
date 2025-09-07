# Core Invariants (Canonical)

This short document centralizes the rules all other specs assume.

- Reverse list layout: lists are compounds with header at TOS and payload slots beneath. Span = payload slots + 1.
- Traversal by span: element stepping uses simple=1, compound=span(header). Never assume fixed widths for compounds.
- Refs: data refs are absolute cell indices tagged by segment (`STACK_REF`, `RSTACK_REF`, `GLOBAL_REF` [not implemented]). Code refs are separate (`BUILTIN`, `CODE`).
- Value-by-default: `load` dereferences refs (up to two levels) and materializes lists; `fetch` strictly reads by address and materializes lists when the slot read is a LIST header.
- Assignment materializes sources: when writing, if the source is a ref, materialize to a value before comparing/applying.
- Compound compatibility: in-place mutation of compound destinations is allowed only when the source has the same structural type and total slot count; otherwise it is an error. List headers and compound starts are immutable as targets for simple writes.
- Access consistency: `get`/`set` are built on address-returning `elem`/`find` plus `fetch`/`store`. `set` updates only simple element cells; no structural edits.
- Errors and NIL: Out-of-bounds address queries yield NIL; invalid reference kinds for fetch/store error; `GLOBAL_REF` deref is not implemented and must throw.

Quick Patterns (for day-to-day use)
- Read value regardless of being a ref: `load` (identity on non-refs; deref up to two levels; materializes lists).
- Strict address read: `fetch` (requires ref; materializes lists when the cell read is a LIST header).
- Assignment: destination must be a ref; if source is a ref, materialize first; simple→simple allowed; compound→compound allowed only if compatible (type + slot count); otherwise error.
- Locals: `x` → VarRef + Load (value); `&x` → VarRef + Fetch (slot ref); `&x fetch` → slot content (possibly a ref); `&x load` → value.
