# References (Refs) — Specification


Try it (refs vs values)
```tacit
: show
  10 var x
  x            \ value-by-default (10)
  &x fetch     \ strict slot read (10)
  &x load      \ materialize value (10)
;
```

Try it (stack ref to list)
```tacit
( 1 2 ) ref    \ -> ( 1 2 ) STACK_REF
load           \ -> ( 1 2 )
```

Orientation
- Start with core invariants: docs/specs/core-invariants.md
- Quick usage (summary):
  - `load ( x — v )`: value-by-default; identity on non-refs; deref up to two levels; materializes lists.
  - `fetch ( addr — v )`: strict address read; materializes lists when the slot is a LIST header.
  - `store ( v addr — )`: materialize source refs; simple/simple writes allowed; compound/compound only if compatible.
  - Locals: `x` (VarRef+Load), `&x` (VarRef+Fetch), `&x fetch`, `&x load`.

Status: authoritative spec for Tacit data references. Aligns with current implementation while defining the target, value-first model with explicit aliasing and clear materialize-at-boundaries guidance.

This document explains how Tacit handles references (refs) to data stored in the VM’s memory segments. It clarifies ownership and lifetimes, unifies terminology, and sets behavioral requirements for reading variables, assignment, traversal, and return semantics. It integrates with:

- docs/specs/variables-and-refs.md — locals, globals, assignment rules, lifetimes
- docs/specs/lists.md — list structure, header/payload layout, traversal and bracket paths
- docs/specs/core-invariants.md — canonical rules

Primary goals:

- Clarity: value-first semantics by default; explicit aliasing when desired.
- Performance: refs as an optimization for locals and stack-resident compounds.
- Consistency: uniform ref behavior across lists, locals, and future fields.

Non-goals:

- No ambiguous “relative” addressing language. Refs hold absolute cell indices; ownership is about lifetime, not address relativity.
- No inconsistent use of infix nomenclature. Avoid terms like LHS/RHS; use “destination” and “source”.

## 1. Overview and Terminology

- Ref (data): A tagged, NaN-boxed handle whose payload is an absolute cell index into a specific VM memory segment. Data refs are never code and are never executed.
- Code ref: A tagged handle to builtins or compiled bytecode (e.g., from `@symbol`). Code refs are separate from data refs and must be explicitly evaluated (`eval`).
- Load (value-by-default): Converting a reference to its current value; identity on non-refs. Performs one dereference (plus one additional deref if the first read yields a ref). If the final value is a LIST header, materializes header+payload.
- Destination: The location being written (e.g., a slot, an addressed list element).
- Source: The data being written (could be a value or a ref that must be resolved).

Analogy — Symlinks vs Pointers
- Think of data refs more like filesystem symbolic links than C pointers.
  - Many structure-aware operations (e.g., list ops like `length`, `elem`, `head`) behave like syscalls that follow symlinks transparently (they dereference as needed).
  - Pure stack operations treat refs as opaque, like manipulating a path string or the symlink inode itself (no automatic deref).
  - `load` acts like opening a path and reading its contents (follows the link), while `fetch` is a strict address read (akin to reading the cell at a specific address; if that cell is a list header, the full content is materialized).
  - Assignment is careful: before writing you materialize sources (follow the link), and compound writes require compatibility with the destination “file shape”.
- Differences to keep in mind: Tacit refs carry absolute cell indices and are bound by stack frame lifetimes; filesystem symlinks persist independently of process memory.

Design principles:

- Value-first: variable reads produce values by default via `load`.
- Explicit aliasing: `&x` explicitly requests an alias (ref) to a local.
- Resolve at boundaries: use `load` before assignment and persistent storage when sources may be refs.
- Polymorphism: data-structure operations accept values or refs without behavioral differences.

## 2. Memory Model and Tag Encoding

Segments:

- Data stack segment (SEG_STACK): computation values, list headers/payload when built on data stack.
- Return stack segment (SEG_RSTACK): frames, saved BP, local slots, and return-stack-resident compounds.
- Global segment (SEG_GLOBAL): persistent globals storage.

Reference kinds (data):

- STACK_REF — points to a data stack cell; the payload is the absolute cell index (address = index × 4 bytes).
- RSTACK_REF — points to a return stack cell (e.g., a local slot or an element in return-stack-resident compound). Return stack indexing uses RSP (cells).
- GLOBAL_REF — address of a global cell (SEG_GLOBAL).

Encoding:

- Refs are NaN-boxed; payload value is an absolute cell index. Address computation is `address = index * 4`.
- Absolute addressing: payloads are never relative. Ownership does not mean relative addressing.

Helpers (src/core/refs.ts):

- `resolveReference(vm, ref) → { segment, address }` — segment-aware dereferencing.
- `readReference(vm, ref)` / `writeReference(vm, ref)` — read/write via resolved address.
- `getVarRef(vm, slotNumber) → RSTACK_REF` — creates a ref to a local slot using `absoluteCellIndex = BP + slotNumber`.

Consequences:

- There is no such thing as a “relative ref.” A ref is absolute, but its validity is governed by the lifetime of the owning frame.
- Address computations are deterministic and straightforward; safety comes from lifetime rules and materialize-at-boundaries discipline.

## 3. Ownership, Lifetimes, and Borrowing

Ownership:

- A ref to a local slot is owned by the stack frame that created/holds that slot. The ref remains valid only while the owning frame is alive.

Borrowing model:

- A callee may receive a ref whose owner is the caller (borrowed ref). The callee can read/write through it while executing.
- Borrowed refs may be returned to their owner.

---

## Common Pitfalls (Quick)

- Using `fetch` on a non-ref errors; use `load` when you want value-by-default.
- Stack ops (`dup`, `swap`, …) do not dereference; they move the ref itself.
- Never return a local reference past its owning frame’s lifetime.
- Globals live in SEG_GLOBAL; `&global` is valid at top level, `&local` is not.

Escape considerations:

- Refs that outlive their owning frame become dangling. Programmers using `&x` accept this responsibility.
- Resolve sources to values before storage to avoid embedding refs in persistent structures.

Aliasing scope (safety rule):

- References may only alias named variables (locals or fields). General aliasing of anonymous data stack slots is prohibited because the data stack is volatile and stack operations (e.g., swap, drop, over) can invalidate such aliases.
- Exception: the `ref` opcode may produce a short-lived `STACK_REF` to a list header on the data stack for immediate structural operations (e.g., elem/slot/fetch/store). Do not interleave arbitrary stack-reordering ops while holding such a `STACK_REF`, and do not persist it; consume it promptly.

## 4. Access and Resolve

Access (target):

- `x` — push a copy of the value of local `x` (compiled as `VarRef + Load`).
- `&x` — push an RSTACK_REF alias to slot `x`.
- `@f` — push a code reference to symbol `f`; evaluate via `eval`.

Rationale:

- Explicit aliasing avoids hidden refs; value-first reads are safer and clearer.
- Code refs and data refs are disjoint: data refs are never executed; code refs are evaluated.

Compatibility (current):

- Bare local access yields values by default (`VarRef + Load`). `&x` yields RSTACK_REF when an explicit address is needed. Polymorphic ops (e.g., `length`, `head`) also accept refs transparently.

Resolve (current):

- Converts a data ref (STACK_REF, RSTACK_REF, GLOBAL_REF) to its value; for lists, materializes payload+header per lists.md.

Mandatory resolution (normative):

- Before assignment/storage (destinations: local slots, addressed elements, fields) when the source is a ref.

Optional resolution: allowed anytime for clarity or to end aliasing. Use “destination” and “source” terminology; polymorphic read-only ops may work through refs without materializing.

## 5. Lists, Access, and Traversal

Ref creation on data stack:

- `ref` converts a list on the data stack into a STACK_REF pointing to its header cell, leaving the list in place. Stack effect: `( list -- list STACK_REF )`.

Materialization:

- `load` materializes values by default. For references to lists, it pushes all payload slots followed by the header, conforming to docs/specs/lists.md.

Polymorphic reads:

- `length`, `head`, `fetch`, `elem`, `slot`, `find`, `keys`, `values` must accept values or refs transparently. Internally, they compute addresses via `resolveReference()` when given a ref.

Writes:

- `store`, `set` write to destination addresses resolved via `resolveReference()`. Sources that are refs MUST be materialized (e.g., via `load`) first to avoid embedding refs into structures.

Locals with compounds:

- Local slots that contain compound values store a tagged reference to internal return-stack storage. Assignment updates the payload in-place if compatible, without changing the slot’s header address (see docs/specs/variables-and-refs.md).

## 6. Locals, Slots, and Assignment

Slots and addressing:

- `var` allocates fixed-size slots on the return stack. Slots store either simple values or tagged refs pointing to compound structures within SEG_RSTACK (see docs/specs/variables-and-refs.md).
- `&x` forms an RSTACK_REF to slot `x` via absolute cell index `BP + slot`.

Assignment semantics (normative target):

- Simple → simple: write the source value into the destination slot.
- Ref (to simple) → simple: materialize source to its value, then write.
- Compound → compound: enforce compatibility per docs/specs/variables-and-refs.md (same structural type and slot count); update in place without altering header location.
- Ref (to compound) → compound: materialize source, then enforce compatibility, then update in place.
- Simple ↔ compound mismatch: error (cannot assign simple into a compound slot or vice versa).

Compatibility note:

- Sources that are refs are materialized before writing; destinations are never materialized. Compound → compound requires compatibility (type + slot count).

Access traversal (see docs/specs/lists.md):

- Bracket paths compute destination addresses within lists/maplists. Inputs and intermediate results may be values or refs.
- Reads: `expr[ … ]` compiles to Select → Load → Nip (value-by-default).
- Writes: `value -> var[ … ]` compiles to &var → Select → Nip → Store (strict destination).

## 7. Stack Operations and Ref Transparency

Stack ops (`dup`, `drop`, `swap`, `rot`, `over`, `nip`, `tuck`, `pick`) treat refs as opaque values:

- They manipulate the reference values themselves; they do not implicitly dereference.
- This preserves identity and performance. Materialization remains explicit via `load` or via destination-based rules in store/set.

## 12. Polymorphic Semantics (Consolidated)

Principles
- Stack operations are reference-transparent: they copy/move the reference value, not the referenced data.
- Structure-aware list operations accept values or refs and internally dereference when needed (use `resolveReference()` pattern established by `length`/`size`).
- Convenience: use `ref` to create a short‑lived `STACK_REF` to a list on the data stack; use `load` for value‑by‑default deref (identity on non‑refs; two‑level deref; materialize lists).

Examples
- `RSTACK_REF(5) dup` → `RSTACK_REF(5) RSTACK_REF(5)` (no deref)
- `STACK_REF→(1 2 3) head` → `1` (internal deref)
- `RSTACK_REF→(1 2 3) 4 concat` → modifies referenced list (element‑unit)
- `RSTACK_REF→42 load` → `42`; `STACK_REF→(1 2) load` → `( 1 2 )`

Implementation guideline
- For list ops expecting a list: if given a ref, resolve to segment/address and read the header; if it’s a list, proceed as direct.
- For strict address reads/writes: `fetch`/`store` resolve addresses and operate without hidden deref beyond the address cell; `store` must materialize source refs before type checks and writes.

Testing notes
- Verify stack ops keep refs opaque.
- Verify list ops behave identically for direct lists and refs to lists.


## 8. Errors and Diagnostics

Error classes:

- InvalidReferenceError — using a non-ref where an address is required.
- GlobalRefNotImplementedError — attempting to create or dereference a global ref.

Messages should be precise and segment-aware, e.g., “store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)”.

## 9. Examples and Idioms

Locals as values vs refs:

- `x` → push copy of value in x
- `&x` → push RSTACK_REF to slot x
- `&x load` → materialize value currently in x

Assignments always materialize sources when needed:

- `value -> x` → store value into x
- `&y -> x` → load y, then store into x
- `(1 2 3) -> xs` → store list per compound assignment rules

Borrowing across calls:

- `&x foo` → pass ref to x into foo
- Borrowed refs may be returned to their owner

Lists and refs:

- `(1 2 3) ref` → list, STACK_REF  
- `load` → materialize a ref to its value (identity on non-refs)
- `length`/`head` → operate on value or ref identically

## 10. Implementation and Migration

Current:

- `varRefOp` underpins `&x`; `ref`/`load` implemented; list ops reference-aware.
- Some stores may embed refs instead of resolving sources first.

Target:

- Bare local access yields values; `&x` yields refs.
- Sources that are refs are materialized before assignment/storage.

In-place locals (normative clarification)
- Destination locality: When the destination is a local variable, updates occur in place in the return stack segment (SEG_RSTACK). The destination is not materialized to the data stack for mutation.
- Mechanism: Compound locals store an `RSTACK_REF` to their header. `store` resolves that ref and overwrites the existing region (payload then header) if compatible; simple locals are overwritten directly in their slot.
- Implications: Aliasing through `&x` is preserved across assignments; assignment does not rebind the slot for compounds, it mutates the existing region.

Migration Plan

Phase 1: add `&x`; update store/set to materialize sources.

Phase 2: switch bare local access to value-by-default.

Testable Assertions

- `&x load` equals `x` value.
- Polymorphic list ops return identical results for values and refs.
- `ref` returns STACK_REF to correct header.
- `load` materializes entire list per lists.md.
- `store`/`set` materialize source refs before writing.

## 11. Glossary and Cross-References

- Absolute cell index — integer payload in a ref; address = index × 4.
- Borrowing — using a ref owned by another frame; safe to return to owner.
- Code ref — handle to builtins/bytecode; evaluated via `eval`.
- Data ref — handle to data in SEG_STACK/SEG_RSTACK (or future SEG_GLOBAL).
- Destination — the location being written (slot or addressed element).
- Materialize/Resolve — convert a ref to its current value.
- Owner — the frame that holds the slot to which the ref points.
- Source — the value provided for storage or assignment.

Cross-References:

- Variables & frames: docs/specs/variables-and-refs.md (§ frames, assignment, lifetime)
- Lists and compounds: docs/specs/lists.md (§ header, slots, materialization, bracket paths)
- Core invariants: docs/specs/core-invariants.md

---

## Implementation Notes

**Key Operations:**

- `VarRef` — pushes `RSTACK_REF(BP + slotNumber)` (underpins `&x`)
- `load` — value-by-default materialization; identity on non-refs  
- `fetch` — reads value at ref address; errors on non-ref
- `store` — writes to ref address; materializes source refs before writing

**Polymorphic Operations:**
All list operations (`length`, `head`, `elem`, `slot`, `find`, etc.) accept values or refs transparently via `resolveReference()` internally.

**Frame Layout:**
```
[ return addr ]
[ saved BP    ] ← BP (cell index)
[ slot0       ] ← BP + 0
[ slot1       ] ← BP + 1
```
