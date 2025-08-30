# References (Refs) — Specification

Status: authoritative spec for Tacit data references. Aligns with current implementation while defining the target, value-first model with explicit aliasing and mandatory resolve before escape.

This specification defines how Tacit handles references (refs) to data stored in the VM’s memory segments. It clarifies ownership and lifetimes, unifies terminology, and sets behavioral requirements for reading variables, assignment, traversal, and return semantics. It integrates with:

- docs/specs/local-vars.md — frame layout, slot assignment, compound assignment rules
- docs/specs/lists.md — list structure, header/payload layout, traversal
- docs/specs/access.md — get/set polymorphic traversal and storage rules
- docs/specs/polymorphic-operations.md — operations that accept values or references consistently

Primary goals:

- Safety: eliminate dangling references and frame-escape hazards.
- Clarity: value-first semantics by default; explicit aliasing when desired.
- Performance: refs as an optimization for locals and stack-resident compounds.
- Consistency: uniform ref behavior across lists, locals, and future fields.

Non-goals:

- No ambiguous “relative” addressing language. Refs hold absolute cell indices; ownership is about lifetime, not address relativity.
- No inconsistent use of infix nomenclature. Avoid terms like LHS/RHS; use “destination” and “source”.

## 1. Overview and Terminology

- Ref (data): A tagged, NaN-boxed handle whose payload is an absolute cell index into a specific VM memory segment. Data refs are never code and are never executed.
- Code ref: A tagged handle to builtins or compiled bytecode (e.g., from `@symbol`). Code refs are separate from data refs and must be explicitly evaluated (`eval`).
- Resolve: Converting a data ref to the current value at its target address. “Resolve” is the preferred term (replaces “unref”).
- Destination: The location being written (e.g., a slot, an addressed list element).
- Source: The data being written (could be a value or a ref that must be resolved).

Design principles:

- Value-first: variable reads produce values by default (target model).
- Explicit aliasing: `&x` explicitly requests an alias (ref) to a local.
- Resolve at boundaries: resolve refs before assignment, persistent storage, or when returning across frames unless returning to the owner.
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
- The callee may return the same borrowed ref back to its owner (the caller). This is safe because the owner outlives the callee.
- The callee must not return refs it owns (to its own locals). Those must be resolved before returning.

Escape prevention:

- A ref must not be allowed to outlive the owning frame. The VM must not let a ref to a current frame’s local appear in the caller after the frame exits.
- Any attempt to persist a ref (e.g., storing into a list that may outlive the frame or returning it to a longer-lived context) triggers resolve.

Frame exit enforcement (normative):

- Before a function returns, any result on the data stack that points to a local owned by the current frame MUST be resolved to its value.
- Borrowed refs owned by ancestor frames MAY remain refs while being returned back to the owner.

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

Resolve (aka `unref` currently):
- Converts a data ref (STACK_REF, RSTACK_REF, GLOBAL_REF) to its value; for lists, materializes payload+header per lists.md.

Mandatory resolution (normative):
- Before assignment/storage (destinations: local slots, addressed elements, fields) when the source is a ref.
- At function return for any ref owned by the current frame (borrowed refs may return to their owner).
- For cross-segment persistence attempts (always copy values, never persist refs across segments).

Optional resolution: allowed anytime for clarity or to end aliasing. Use “destination” and “source” terminology; polymorphic read-only ops may work through refs without materializing.

## 5. Lists, Access, and Traversal

Ref creation on data stack:

- `ref` converts a list on the data stack into a STACK_REF pointing to its header cell, leaving the list in place. Stack effect: `( list -- list STACK_REF )`.

Materialization:

- `resolve` (currently `unref`) materializes any data ref. For lists, pushes all payload slots followed by the header, conforming to docs/specs/lists.md.

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

 

Return-time enforcement (normative):

- Before exiting a frame, scan result values destined for the caller. For any data ref owned by the current frame, resolve to value.
- Refs owned by the caller (borrowed refs) may be returned unchanged, as they are returning to their owner.

Rationale:

- Prevents dangling refs that would outlive their stack frame.
- Supports borrowing by allowing safe round-trips of owner-owned refs through callees.

Implementation guidance:

- This can be implemented in the return op or in a prologue/epilogue pair. For now, explicit coding patterns and tests should ensure that dangerous escapes do not occur.

## 8. Errors and Diagnostics

Error classes (examples):

- InvalidReferenceError — using a non-ref where an address is required.
- IncompatibleCompoundAssignmentError — structure/type mismatch on compound destination.
- RefEscapeError — attempting to return or persist a ref owned by the current frame.
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

- Caller: `&x foo` → pass ref to x into foo
- Callee (foo): may return the same ref back to the caller, but must not create a new ref to its own locals that escapes return.

Lists and refs:

- `(1 2 3) ref` → list, STACK_REF
- `resolve` → materialize a ref to its value (lists expand per lists.md)
- `len`/`head` → operate on value or ref identically

Performance idiom: in-place list reversal using refs (illustrative)

```
: efficient-reverse ( list -- list' )
  dup length           -> count
  count 2 /            -> half
  count 1 -            -> last

  half {
    dup                -> i
    &list elem i       \ address front element i (owner-provided &list)
    &list elem last i -\ address back element (last - i)
    swap-elements      \ concept: swap via addressed refs (implementation-specific)
  } repeat
;
```

Notes:

- This pattern illustrates why explicit refs (`&list`) are useful: it avoids copying large structures by operating in place through addresses returned by `elem`.
- The `swap-elements` and `repeat` words are placeholders to illustrate flow; concrete implementations may differ. The key idea is addressing both ends via refs and mutating in place.

## 10. Implementation and Migration

Current:

- `varRefOp` pushes RSTACK_REF for locals; `ref`/`unref` implemented; list ops reference-aware.
- Some stores may embed refs instead of resolving sources first.

Target:

- Bare local access yields values; `&x` yields refs.
- Sources that are refs are resolved before assignment/storage.
- Frame-exit resolves current-frame-owned refs.

Rename:

- `unref` → `resolve` (alias preserved during migration).

Migration Plan

Phase 0: keep current behavior; expand tests around polymorphism.

Phase 1: add `&x`; update store/set to resolve sources; deprecate `unref` name.

Phase 2: switch bare local access to value-by-default; enforce return-time resolve.

Testable Assertions

- `&x resolve` equals `x` value.
- Polymorphic list ops return identical results for values and refs.
- `ref` returns STACK_REF to correct header.
- `resolve` materializes entire list per lists.md.
- `store`/`set` resolve source refs before writing (target).
- Compound assignment updates in place and enforces compatibility.
- Returning current-frame-owned ref triggers resolve or error; borrowed ref can return to owner.
- GLOBAL_REF operations error with “not implemented”.

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

## Appendix

This appendix consolidates detailed reference material. The core rules are defined in sections 1–12 above; use these notes for implementation detail and extended guidance.

### A. Opcode Semantics (Normative)

This section documents the required behavior for ops when handling refs. Some ops already satisfy these requirements; others are targets for migration.

- `VarRef` (`varRefOp`)
  - Stack effect: `( — RSTACK_REF )` when applied to a compiled local symbol (slot literal embedded in bytecode).
  - Semantics: Pushes `RSTACK_REF(BP/4 + slotNumber)`.
  - Notes: In the target model, this underpins `&x`. Bare `x` should compile to value access instead.

- `ref` (`refOp`)
  - Stack effect: `( list — list STACK_REF )`
  - Semantics: Converts a LIST at TOS into a STACK_REF to its header, leaving the list in place.
  - Errors: No-op on non-LIST (current); SHOULD become error in strict mode.

- `resolve` (`unrefOp` currently)
  - Stack effect: `( ref — value )`
  - Semantics: Materializes referenced value. If LIST header encountered, materializes payload+header per lists.md.
  - Inputs: Accepts `STACK_REF`, `RSTACK_REF`, or `GLOBAL_REF` (when implemented). Non-ref is a no-op pass-through.

- `fetch` (`fetchOp`)
  - Stack effect: `( ref — value )`
  - Inputs: MUST accept `STACK_REF` and `RSTACK_REF` (and `GLOBAL_REF` when implemented). Error on non-ref.
  - Semantics: Read memory at address; for LIST, materialize payload+header.

- `store` (`storeOp`)
  - Stack effect: `( value ref — )`
  - Inputs: `ref` MUST be a reference type. Error on non-ref.
  - Semantics (target): If source is a ref, resolve first. Then enforce simple↔simple and compound↔compound rules. For compounds, enforce compatibility and update in place; else error.

- `elem` (`elemOp`)
  - Stack effect: `( (list|ref) idx — (list|ref) STACK_REF )`
  - Semantics: Returns address of element start as STACK_REF, accepting LIST or STACK_REF and reading via `resolveReference()` as needed.

- `slot`
  - Stack effect: as defined in lists.md (`slot` returns payload slot address by index).
  - Semantics: Mirror `elem` with payload-slot addressing.

- `length` / `head` / `uncons` / `pack` / `unpack` / `reverse` / `concat` / `keys` / `values`
  - Polymorphism: MUST accept value or ref inputs where meaningful; use `resolveReference()` internally to access headers/payload.

---

### B. Detailed Algorithms (Reference)

`resolveReference(vm, ref)`

- Input: a tagged value expected to be `STACK_REF`, `RSTACK_REF`, or `GLOBAL_REF`.
- Steps:
  1. Decode tag and payload.
  2. Map tag to segment: STACK_REF→SEG_STACK, RSTACK_REF→SEG_RSTACK, GLOBAL_REF→SEG_GLOBAL (not implemented).
  3. Compute `address = payload * 4`.
  4. Return `{ segment, address }`.

`resolve` (aka `unref`)

- Input: any value.
- Steps:
  1. If value is not a ref, push it back (no-op).
  2. Else, `res = resolveReference(vm, value)`.
  3. Read `v = memory.readFloat32(res.segment, res.address)`.
  4. If `v` is LIST: compute slotCount from header; push slots (oldest to newest per lists.md), then push header.
  5. Else, push `v`.

`store` (target behavior)

- Inputs: `source`, `destRef`.
- Steps:
  1. Ensure `destRef` is a ref; error otherwise.
  2. Let `addr, seg = resolveReference(vm, destRef)`.
  3. Read `existing = memory.readFloat32(seg, addr)`; if `existing` is a ref, read through it to get existing value for type/compat checks only.
  4. If `source` is a ref, `sourceValue = readReference(vm, source)` (including list materialization where needed); else `sourceValue = source`.
  5. If simple/simple: write `sourceValue`.
  6. If compound/compound: check compatibility; if ok, mutate in place; else error.
  7. If mismatched kinds: error.

`get` / `set` (access traversal)

- `get`: perform traversal; final step materializes to value (never a ref).
- `set`: perform traversal; resolve source to value; write into addressed destination per `store` rules.

---

### C. Frame Layout and Absolute Addressing Examples

Example frame with two locals and one list stored in return-stack compounds area:

```
[ return addr ]
[ saved BP    ] ← BP (byte address)
[ slot0       ] ← BP + 0    = cellIndex (BP/4 + 0)
[ slot1       ] ← BP + 4    = cellIndex (BP/4 + 1)
[ ... compounds ... ] ← RP grows upward
```

`getVarRef(vm, 1)` computes: `absoluteCellIndex = BP/4 + 1` → `RSTACK_REF(absoluteCellIndex)`.

Suppose a list header for `(1 2 3)` resides at data stack byte address `H`. Then `STACK_REF(H/4)` addresses its header; payload slots are at `H - 12`, `H - 8`, `H - 4` in that order.

No relative addressing ambiguity exists: payload carries the absolute index and the segment determines where reads/writes occur.

---

### D. Borrowing Scenarios and Lifetimes

Call tree A→B→C:

- A owns `&x` (RSTACK_REF to A’s local). A passes `&x` to B.
- B may read/write via `&x` and pass it to C.
- C may return `&x` to B and B may return it to A — safe, as A still owns the slot.
- Neither B nor C may return refs to their own locals. Those must be resolved before returning.

Returning from owner frame (forbidden):

- If A attempts to return `&x` to its caller (outside A), that ref would outlive A’s frame. The VM MUST resolve `&x` to a value or raise a `RefEscapeError`.

Nested blocks (same frame):

- Code blocks executed within the same frame may use `&x` freely; no additional lifetime complexity arises as they share BP and RP context.

---

### E. References with Access Paths

`elem` and `slot` examples:

- Input can be LIST or STACK_REF; both yield STACK_REF addresses for downstream `fetch` or `store`.
- When chaining `elem`/`slot`, intermediate results remain refs; only `get`/`fetch` materialize.

Corner cases:

- Out-of-range index: return `NIL` (as per current behavior) rather than an invalid ref.
- Non-list input: return `NIL` (current) or consider strict-error mode; consistency with lists.md is preferred.

Maplist access:

- `find` on refs behaves like on lists. When it returns an address (e.g., to a value slot), the result is a STACK_REF suitable for `fetch` or `store`.

---

### F. Error Conditions Matrix (Guidance)

- `fetch` with non-ref input → InvalidReferenceError
- `store` with non-ref destination → InvalidReferenceError
- `store` with incompatible compound assignment → IncompatibleCompoundAssignmentError
- `store` with mismatched simple/compound kinds → Type error
- `resolve` on non-ref → no-op (for convenience and composability)
- Returning current-frame-owned ref → RefEscapeError or auto-resolve
- `GLOBAL_REF` usage → GlobalRefNotImplementedError

---

### G. Security and Robustness Considerations

- Deterministic addressing via absolute indices prevents overflow from relative math.
- Enforcing resolve-before-escape ensures no data structure persists pointers to destroyed frames.
- Treat stack ops as ref-transparent to avoid unexpected materialization and to keep predictable performance.

---

### H. Migration Cookbook

Pattern: bare local read yields ref (current) → value (target)

- Current: `x length` works because `length` is polymorphic.
- Target: `x` yields value; `&x` yields ref; `length` remains polymorphic, so both continue to work.

Pattern: assignment from ref writes a ref (current) → resolve then write (target)

- Current: `&y x store` may embed a ref into `x`.
- Target: `&y resolve x store` (or implicit resolve in `store`) writes the value of `y` into `x`.

Pattern: ref escape on return

- Current: not consistently enforced; avoid returning refs.
- Target: returning current-frame-owned refs resolves to value; returning borrowed refs to their owner is allowed.

Rename:

- Replace `unref` with `resolve` in examples; keep `unref` as alias until Phase 2 completes.

---

### I. Implementation Checklist

- Parser/Compiler:
  - Add `&x` sigil handling to compile-time local resolution → `VarRef` emit.
  - Switch bare local reads to compile into value access (fetch+materialize where needed) in Phase 2.

- Ops:
  - Ensure `store` resolves source refs; add guards and tests.
  - Keep polymorphic reads uniform via `resolveReference()` across list ops.
  - Add alias name `resolve` for `unref`; mark `unref` as deprecated in docs.

- VM return path:
  - Add scan to resolve current-frame-owned refs in function results (Phase 2).

- Tests:
  - Unit tests for all mandatory resolve boundaries and polymorphic equivalence.
  - Negative tests for ref escape and incompatible compound assignments.

---

### J. Rationale and Alternatives

- Why value-by-default? It keeps the mental model simple and avoids hidden aliasing pitfalls. Ref-based optimization remains available explicitly.
- Why absolute addressing? It aligns with the VM architecture (cell-indexed addressing) and simplifies correctness reasoning.
- Why allow returning borrowed refs? It enables efficient in-place operations on caller-owned data across helper functions without extra copying.

Alternatives considered:

- Always materialize on read: simpler but loses the optimization value of refs.
- Allow embedding refs in lists: unsafe; introduces lifetime hazards when lists outlive frames.

---

### K. Interaction with Code Refs

- `@symbol` pushes a code ref (Tag.BUILTIN or Tag.CODE). Code refs are not affected by data ref rules and are never “resolved” like data.
- `eval` executes code refs: builtins dispatch to native implementations; code refs jump to bytecode.
- Do not confuse code refs and data refs: similar naming but disjoint tags and use.

---

### L. Worked Examples

Example A: Borrowing and returning ref to owner

```
: inc! ( &x -- )   \ expects an RSTACK_REF
  1 over fetch add  \ read x, add 1 (over leaves &x for store)
  swap store        \ write back into x
;

: demo-borrow
  41 var n
  &n inc!           \ pass ref to callee; callee mutates n
  n                 \ value-by-default (target); in current model use &n resolve
;
```

Example B: Resolving before assignment

```
: copy-local
  10 var a
  0 var b
  &a -> b           \ resolve &a to 10 before storing into b (target behavior)
  b                 \ yields 10
;
```

Example C: Access and set across nested paths

```
: set-third
  ( 1 2 ( 7 8 9 ) ) var xs
  42 xs ( 2 2 ) set  \ set xs[2][2] to 42; resolves 42 if a ref
  xs ( 2 2 ) get     \ yields 42
;
```

Example D: Preventing ref escape on return

```
: bad-return
  5 var t
  &t                 \ current model: would push RSTACK_REF to t
  \ target model: VM resolves current-frame-owned ref before return → 5
;
```

---

### M. Reference Lifecycle (Summary)

1. Creation: via `&x` (alias to local) or address ops (`ref`, `elem`, `slot`, `find`).
2. Usage: read/write through the ref within its valid scope; stack ops remain ref-transparent.
3. Propagation: pass into callees (borrowed). Callee may return it back to the owner.
4. Resolution: mandatory at boundaries (assignment, storage into structures, current-frame return).
5. Invalidation: when the owning frame ends, its refs become invalid; callers cannot observe them because return-time resolution prevents escape.

Related utilities: use `dumpStackFrame` for introspection when debugging (see src/ops/builtins.ts: dumpStackFrameOp).

---

### N. Reference Polymorphism and Patterns

Polymorphism examples:

- Stack list: `( 1 2 3 ) elem 1 fetch` (LIST input).
- Memory list: `&listVar elem 1 fetch` (RSTACK_REF or STACK_REF input).
- Mixed: `&listVar elem 1 fetch &other elem 2 fetch` (chained addressing across refs).

Patterns enabled by refs:

- Uniform traversal: same ops work with values or refs; address computations happen internally via `resolveReference()`.
- In-place updates: use `elem/slot/find` to address locations and `store`/`set` to mutate, with implicit resolve of sources.
- Performance: avoid repeated materialization during inner loops by carrying refs, not reconstructed values.

Guidelines:

- Keep refs local in time and scope; prefer values for persistence or returns across frames.
- For clarity, explicitly `resolve` when an alias should end and a copy should be used.

---

### O. Prohibited Operations (Expanded)

- Returning a ref owned by the current frame to any longer-lived context.
- Storing a ref into lists, maplists, or fields; always store values (resolution occurs automatically at `set`/`store`).
- Creating cross-segment aliasing; any cross-segment move must be by value copy.

VM enforcement mechanisms:

- Destination guards in `fetch`/`store` and access ops; error on non-ref destinations.
- Return-time scan for current-frame-owned refs → resolve or error.
- Segment isolation: operations that require same-segment guarantees must validate (`seg1 === seg2`) when operating on two refs.

---

### P. Debugging and Introspection

- `dumpStackFrameOp` prints slot tags and, for RSTACK_REF, the target’s tag and value at the addressed cell.
- Use this to confirm which locals hold simple values vs refs to compounds and to visualize frame layouts during development.

---

### Q. Best Practices

Use refs when:

- Operating repeatedly on large compound data within one frame or between caller/callee via borrowing.
- Implementing in-place algorithms (e.g., swaps via `elem` addresses) where value reconstruction would be wasteful.

Use values when:

- Returning results; functions should return values, not current-frame-owned refs.
- Persisting into lists/maplists/fields or across segments.
- Handling simple scalars where refs provide no benefit.

Style tips:

- Prefer explicit `resolve` calls when it improves readability even if an op would auto-resolve at a boundary.
- Avoid leaving refs idle on the data stack; consume them promptly via `fetch`, `store`, `set`, or `resolve`.

---

### R. Future Extensions

Global refs:

- `GLOBAL_REF` is reserved. When implemented, it will allow references to persistent storage with different lifetime rules. Until then, attempts to create or dereference should error with “not implemented”.

Sigil choice:

- This spec uses `&x` for data refs to locals. An alternative caret sigil `^x` has been discussed for readability. If adopted, `^x` would be an alias for `&x`; code and docs SHOULD standardize on a single sigil to avoid confusion.

Compiler/VM opportunities:

- Static analysis could warn on obvious ref escapes in user code.
- Compiler could elide needless resolve/materialize pairs and fuse address computations.
