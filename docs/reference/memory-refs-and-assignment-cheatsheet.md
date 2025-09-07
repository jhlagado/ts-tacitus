# Memory Access, Refs, Load/Fetch, Store — Cheatsheet

Status: authoritative quick reference (kept in sync with specs: lists.md, refs.md, access.md, local-vars.md)

## Core Model
- Values are 32-bit tagged; lists are reverse-layout compounds: `[payload …] [LIST:s] ← TOS`.
- Data refs hold absolute cell indices into a segment: `STACK_REF`, `RSTACK_REF` (locals), `GLOBAL_REF` (not implemented).
- Code refs are separate (`BUILTIN`, `CODE`) and only execute via `eval`.

## Read Operations
- fetch ( addr — value )
  - Input must be a ref. Reads the slot at `addr`.
  - If the read is a LIST header, materializes its payload + header from the same segment.
  - Otherwise returns the simple value.

- load ( x — v )
  - Identity on non-refs.
  - If x is a ref: deref once; if that yields a ref, deref once more; if final is a LIST header, materialize payload+header.
  - Optimized “value-by-default” read for locals and refs.

Local quick reads
- x → compiles to `VarRef + Load` (value-by-default).
- &x → compiles to `VarRef + Fetch` (address form; yields a ref to slot).
- &x fetch → reads slot content; if slot holds a ref, returns that ref.
- &x fetch fetch or &x load → produces the value (materializes lists).

## Write Operation (Assignment)
- store ( value addr — )
  - Destination must be a ref (e.g., `VarRef` result or list element address).
  - If source is a ref, store dereferences the source once to get its current value.
  - Type rules:
    - simple → simple: allowed; overwrites slot.
    - compound → compound: allowed only if compatible (same type and same total slot count). Performs in-place payload copy without changing the destination header location.
    - simple ↔ compound mismatch: error.

Locals assignment idioms
- Simple: `42 -> x` (value form) or `&y -> x` when y is simple (store derefs source ref once).
- Compound (lists): `(1 2 3) -> x` or `y -> x` (where `y` is bare, compiling to `Load`).
  - Do not use `&y -> x` for compounds; `&y` yields a ref to y’s slot, which by itself does not provide the full payload needed for in-place mutation. Use `&y load -> x` or just `y -> x`.

## Lists: Address Queries and Mutation Boundaries
- slot ( idx list — addr ) → O(1) payload slot address.
- elem ( idx list — addr ) → O(s) logical element start.
- fetch respects segment; store writes only to simple cells; attempting to overwrite a compound element is rejected (error).

## Do / Don’t
- Do use `load` when the input may be a ref and you want its value.
- Do pass a fully materialized compound on the stack when assigning to a compound local.
- Don’t persist `STACK_REF` produced by transient list ops; consume promptly.
- Don’t assign simple ↔ compound; enforce compatibility for compounds.
- Don’t expect `GLOBAL_REF` to work — it must throw “not implemented”.

## Mini Examples
- Read value from local (simple or list): `x` (→ VarRef + Load).
- Get slot address for mutation: `&x` (→ VarRef + Fetch) then `store`.
- Read then write simple local: `&x fetch 1 add  -> x` (or `x 1 add -> x`).
- Replace list in local (same length): `(10 20 30) -> xs`.
- Replace from another local list: `ys -> xs` (bare `ys` compiles to `Load`).

## Errors and Sentinels
- fetch on non-ref → error: “fetch expects reference address …”.
- GLOBAL_REF deref → error: “Global variable references not yet implemented”.
- Out-of-bounds list addressing → NIL.
- store simple↔compound mismatch or incompatible compounds → error.

## Where to Read More
- refs.md — ref kinds, lifetimes, value-by-default model.
- lists.md — reverse layout, traversal, element vs slot, mutation constraints.
- access.md — path traversal (`get`/`set`) built on elem/find + fetch/store.
- local-vars.md — frame layout, `VarRef`, compound compatibility, in-place mutation.

