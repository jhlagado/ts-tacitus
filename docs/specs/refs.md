# References (Refs) — Specification

Status: authoritative spec for Tacit data references. Aligns with current implementation while defining the target, value-first model with explicit aliasing and clear resolve-at-boundaries guidance.

This specification defines how Tacit handles references (refs) to data stored in the VM’s memory segments. It clarifies ownership and lifetimes, unifies terminology, and sets behavioral requirements for reading variables, assignment, traversal, and return semantics. It integrates with:

- docs/specs/local-vars.md — frame layout, slot assignment, compound assignment rules
- docs/specs/lists.md — list structure, header/payload layout, traversal
- docs/specs/access.md — get/set polymorphic traversal and storage rules
- docs/specs/polymorphic-operations.md — operations that accept values or references consistently

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
- Resolve: Converting a data ref to the current value at its target address.
- Destination: The location being written (e.g., a slot, an addressed list element).
- Source: The data being written (could be a value or a ref that must be resolved).

Design principles:

- Value-first: variable reads produce values by default (target model).
- Explicit aliasing: `&x` explicitly requests an alias (ref) to a local.
- Resolve at boundaries: resolve refs before assignment and persistent storage.
- Polymorphism: data-structure operations accept values or refs without behavioral differences.

## 2. Memory Model and Tag Encoding

Segments:

- Data stack segment (SEG_STACK): computation values, list headers/payload when built on data stack.
- Return stack segment (SEG_RSTACK): frames, saved BP, local slots, and return-stack-resident compounds.
- Global segment: not yet implemented.

Reference kinds (data):

- STACK_REF — points to a data stack cell; the payload is the absolute cell index (address = index × 4 bytes).
- RSTACK_REF — points to a return stack cell (e.g., a local slot or an element in return-stack-resident compound).
- GLOBAL_REF — reserved for persistent globals; not implemented.

Encoding:

- Refs are NaN-boxed; payload value is an absolute cell index. Address computation is `address = index * 4`.
- Absolute addressing: payloads are never relative. Ownership does not mean relative addressing.

Helpers (src/core/refs.ts):

- `resolveReference(vm, ref) → { segment, address }` — segment-aware dereferencing.
- `readReference(vm, ref)` / `writeReference(vm, ref)` — read/write via resolved address.
- `getVarRef(vm, slotNumber) → RSTACK_REF` — creates a ref to a local slot using `absoluteCellIndex = BP/4 + slotNumber`.

Consequences:

- There is no such thing as a “relative ref.” A ref is absolute, but its validity is governed by the lifetime of the owning frame.
- Address computations are deterministic and straightforward; safety comes from lifetime rules and resolve-at-boundaries discipline.

## 3. Ownership, Lifetimes, and Borrowing

Ownership:

- A ref to a local slot is owned by the stack frame that created/holds that slot. The ref remains valid only while the owning frame is alive.

Borrowing model:

- A callee may receive a ref whose owner is the caller (borrowed ref). The callee can read/write through it while executing.
- Borrowed refs may be returned to their owner.

Escape considerations:

- Refs that outlive their owning frame become dangling. Programmers using `&x` accept this responsibility.
- Resolve sources to values before storage to avoid embedding refs in persistent structures.

Aliasing scope (safety rule):

- References may only alias named variables (locals or fields). General aliasing of anonymous data stack slots is prohibited because the data stack is volatile and stack operations (e.g., swap, drop, over) can invalidate such aliases.
- Exception: the `ref` opcode may produce a short-lived `STACK_REF` to a list header on the data stack for immediate structural operations (e.g., elem/slot/fetch/store). Do not interleave arbitrary stack-reordering ops while holding such a `STACK_REF`, and do not persist it; consume it promptly.

## 4. Access and Resolve

Access (target):

- `x` — push a copy of the value of local `x`.
- `&x` — push an RSTACK_REF alias to slot `x`.
- `@f` — push a code reference to symbol `f`; evaluate via `eval`.

Rationale:

- Explicit aliasing avoids hidden refs; value-first reads are safer and clearer.
- Code refs and data refs are disjoint: data refs are never executed; code refs are evaluated.

Compatibility (current):

- Bare local access often yields RSTACK_REF; polymorphic ops (e.g., `length`, `head`) read through refs. Target behavior is value-by-default; see Migration.

Resolve (current):

- Converts a data ref (STACK_REF, RSTACK_REF, GLOBAL_REF) to its value; for lists, materializes payload+header per lists.md.

Mandatory resolution (normative):

- Before assignment/storage (destinations: local slots, addressed elements, fields) when the source is a ref.

Optional resolution: allowed anytime for clarity or to end aliasing. Use “destination” and “source” terminology; polymorphic read-only ops may work through refs without materializing.

## 5. Lists, Access, and Traversal

Ref creation on data stack:

- `ref` converts a list on the data stack into a STACK_REF pointing to its header cell, leaving the list in place. Stack effect: `( list -- list STACK_REF )`.

Materialization:

- `resolve` materializes any data ref. For lists, pushes all payload slots followed by the header, conforming to docs/specs/lists.md.

Polymorphic reads:

- `length`, `head`, `fetch`, `elem`, `slot`, `find`, `keys`, `values` must accept values or refs transparently. Internally, they compute addresses via `resolveReference()` when given a ref.

Writes:

- `store`, `set` write to destination addresses resolved via `resolveReference()`. Sources that are refs MUST be resolved first to avoid embedding refs into structures.

Locals with compounds:

- Local slots that contain compound values store a tagged reference to internal return-stack storage. Assignment updates the payload in-place if compatible, without changing the slot’s header address (see local-vars.md).

## 6. Locals, Slots, and Assignment

Slots and addressing:

- `var` allocates fixed-size slots on the return stack. Slots store either simple values or tagged refs pointing to compound structures within SEG_RSTACK (see local-vars.md).
- `&x` forms an RSTACK_REF to slot `x` via absolute cell index `BP/4 + slot`.

Assignment semantics (normative target):

- Simple → simple: write the source value into the destination slot.
- Ref (to simple) → simple: resolve source to its value, then write.
- Compound → compound: enforce compatibility per local-vars.md (same structural type and slot count); update in place without altering header location.
- Ref (to compound) → compound: resolve source, then enforce compatibility, then update in place.
- Simple ↔ compound mismatch: error (cannot assign simple into a compound slot or vice versa).

Compatibility note (current implementation):

- Some paths may write a ref into a destination (e.g., `storeOp` writing the source without resolve). The target model requires resolve-first for sources; see Migration Plan for phased fixes.

Access traversal (docs/specs/access.md):

- Path traversal computes destination addresses within lists/maplists. Inputs and intermediate results may be values or refs.
- `get` materializes to value at the end of traversal; `set` resolves source and writes to the destination; traversal accepts LIST or refs at each step and may form transient refs internally.

## 7. Stack Operations and Ref Transparency

Stack ops (`dup`, `drop`, `swap`, `rot`, `over`, `nip`, `tuck`, `pick`) treat refs as opaque values:

- They manipulate the reference values themselves; they do not implicitly dereference.
- This preserves identity and performance. Materialization remains explicit via `resolve` or via destination-based rules in store/set.


## 8. Errors and Diagnostics

Error classes:

- InvalidReferenceError — using a non-ref where an address is required.
- GlobalRefNotImplementedError — attempting to create or dereference a global ref.

Messages should be precise and segment-aware, e.g., “store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)”.

## 9. Examples and Idioms

Locals as values vs refs:

- `x` → push copy of value in x
- `&x` → push RSTACK_REF to slot x
- `&x resolve` → materialize value currently in x

Assignments always resolve sources when needed:

- `value -> x` → store value into x
- `&y -> x` → resolve y, then store into x
- `(1 2 3) -> xs` → store list per compound assignment rules

Borrowing across calls:

- `&x foo` → pass ref to x into foo
- Borrowed refs may be returned to their owner

Lists and refs:

- `(1 2 3) ref` → list, STACK_REF  
- `resolve` → materialize a ref to its value
- `length`/`head` → operate on value or ref identically

## 10. Implementation and Migration

Current:

- `varRefOp` pushes RSTACK_REF for locals; `ref`/`resolve` implemented; list ops reference-aware.
- Some stores may embed refs instead of resolving sources first.

Target:

- Bare local access yields values; `&x` yields refs.
- Sources that are refs are resolved before assignment/storage.

Migration Plan

Phase 1: add `&x`; update store/set to resolve sources.

Phase 2: switch bare local access to value-by-default.

Testable Assertions

- `&x resolve` equals `x` value.
- Polymorphic list ops return identical results for values and refs.
- `ref` returns STACK_REF to correct header.
- `resolve` materializes entire list per lists.md.
- `store`/`set` resolve source refs before writing (target).
- GLOBAL_REF operations error with "not implemented".

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

- Locals and frames: docs/specs/local-vars.md (§ frame layout, assignment, lifetime)
- Lists and compounds: docs/specs/lists.md (§ header, slots, materialization)
- Access ops: docs/specs/access.md (§ get/set traversal and storage rules)
- Polymorphism: docs/specs/polymorphic-operations.md (§ ref-aware behaviors)

---

## Implementation Notes

**Key Operations:**

- `VarRef` — pushes `RSTACK_REF(BP/4 + slotNumber)` (underpins `&x`)
- `resolve` — materializes any ref to its value; no-op on non-refs  
- `fetch` — reads value at ref address; errors on non-ref
- `store` — writes to ref address; resolves source refs before writing

**Polymorphic Operations:**
All list operations (`length`, `head`, `elem`, `slot`, `find`, etc.) accept values or refs transparently via `resolveReference()` internally.

**Frame Layout:**
```
[ return addr ]
[ saved BP    ] ← BP (byte address)  
[ slot0       ] ← BP + 0 = cellIndex (BP/4 + 0)
[ slot1       ] ← BP + 4 = cellIndex (BP/4 + 1)
```
