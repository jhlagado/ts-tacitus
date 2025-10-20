# Variables and References — Specification

Orientation

- Start with core invariants: docs/specs/core-invariants.md
- Lists and bracket paths: docs/specs/lists.md

Status: Authoritative spec for variables (locals and globals) and data references in Tacit.

---

## 1. Overview and Terminology

- Variable: named storage in the VM. Two kinds: local (function-frame slot) and global (module-scope cell in the global heap window).
- Ref (data): a tagged handle using `Tag.DATA_REF`; its payload stores the absolute cell index inside the unified data arena. Segment ownership is inferred by comparing that index against the global, data-stack, and return-stack windows. Data refs are not code and are never executed.
- Code ref: a tagged handle to builtins or compiled bytecode (from `@symbol`); evaluated via `eval`.
- Load (value-by-default): produce a value from a value-or-ref; identity on non-refs; dereferences up to two levels; materializes lists.
- Fetch (strict address read): read the value at a reference address; materializes lists when the read cell is a LIST header.
- Store (write): destination must be an address; sources that are refs are materialized before the write; compound writes require compatibility.

Analogy — Refs as Symlinks

- Structure-aware operations (e.g., list `length`, `head`, `elem`) transparently follow refs, like syscalls following filesystem symlinks.
- Pure stack ops (`dup`, `swap`, …) treat refs as opaque values (no implicit dereference).
- `load` “follows the link”; `fetch` strictly reads the addressed cell.
- Assignment resolves sources before writing; destinations are mutated in place (never materialized).

---

## 2. Data Arena and Reference Encoding

Tacit stores globals, the data stack, and the return stack inside a single data arena. Three contiguous windows carve up that arena:

- **Global heap window** — persistent dictionary entries and global values (indexed by `GP`)
- **Data-stack window** — operand storage (indexed by `SP`)
- **Return-stack window** — frames and locals (indexed by `RSP`/`BP`)

Runtime references use the unified `Tag.DATA_REF`. Its 16-bit payload stores an absolute cell index in the range `0 ≤ index < TOTAL_DATA_BYTES / CELL_SIZE`. Helpers infer which window owns that index by comparing against the global, data-stack, and return-stack bounds.

Helpers

- `createDataRef(segment, cellIndex)` → `DATA_REF`
- `resolveReference(vm, ref)` → { segment, address }
- `readReference(vm, ref)` / `writeReference(vm, ref)` → value I/O at resolved address

### 2.1 Reference Taxonomy

- **Heap entries:** dictionary payloads always store `Tag.DATA_REF` values. For globals they refer to the global heap window; for locals they carry `Tag.LOCAL` slot numbers that are resolved to return-stack cells at run time.
- **Names:** the `name` field in each dictionary entry is a `Tag.STRING` offset into the interned string digest. Shadowing relies on pointer equality against those offsets.
- **Code/Immediates:** function payloads store either `Tag.CODE` (user bytecode) or `Tag.BUILTIN` (native implementation). The sign bit carries the `IMMEDIATE` flag.
- **Sentinels:** the `prev` field of the oldest entry is `Tag.SENTINEL` (`NIL`) so a single equality check terminates dictionary walks without special cases.

Heap-backed dictionary nodes therefore bridge all three tag families—`DATA_REF` for data, `STRING` for keys, `CODE`/`BUILTIN` for behaviour—without introducing new runtime tags.

---

## 3. Variable Model: Locals and Globals

- Declared inside functions with `value var name`. Each `var` consumes the value at TOS and initializes a fixed-size slot in the current frame.
- Storage: one 32-bit slot holding a simple value or a `DATA_REF` pointing to local compound storage above the slot.
- Addressing: `&x` forms a `DATA_REF` whose payload is the absolute cell index `(BP + slot)` in the unified arena.
- Access: `x` yields the value (VarRef+Load); `&x` yields the slot address; `&x fetch` reads the slot content; `&x load` yields the slot value.

- Declared at top level with `value global name`.
- Lifetime: persist for the VM/program lifetime.
- Storage: live in the global-heap window; simple values stored directly; compounds copied into the heap with dictionary payloads holding a `DATA_REF` that resolves to the heap header.
- Access: `name` yields the value (value-by-default); `&name` yields a `DATA_REF` address; `value -> name` overwrites; bracket-path writes allowed (`value -> name[ … ]`).

Local vs Global symmetry

- Reads are value-by-default for both; `&name`/`&x` returns a ref.
- Writes require a destination address; sources that are refs are materialized before writing.
- Increment operator `+>` is locals-only (see §7); for globals, use explicit RMW (`value name add -> name`).

---

## 4. Frames and Slots (summary)

Frame root and slots (cells)

- Function prologue saves return address and caller BP, then sets `BP = RSP`.
- `Reserve` allocates N local slots: `RSP += N` (cells). Slot `i` resides at cell index `BP + i`.
- Compounds for locals live above the slots within the return-stack window; slots store `DATA_REF` handles that resolve to those payloads.

See docs/specs/vm-architecture.md (Frames & BP) for full layout, diagrams, and invariants.

---

## 5. Access Forms and Value-by-Default

Target compilation (locals/globals)

```tacit
x        → VarRef + Load              (value-by-default)
&x       → VarRef + Fetch             (slot address)
name     → LiteralNumber(DATA_REF(global-slot)) + Load
&name    → LiteralNumber(DATA_REF(global-slot)) + Fetch
value -> x     → VarRef + Store       (assignment)
value -> name  → LiteralNumber(DATA_REF(global-slot)) + Store
```

Stack effects (logical)

```tacit
x, name      ( — value )        \ value of variable (simple or compound)
&x           ( — DATA_REF )     \ local slot address (resolves into return-stack window)
&name        ( — DATA_REF )     \ global address (resolves into heap window)
value -> x   ( — )              \ assignment
value -> name( — )              \ assignment
```

> Migration note: until the parser switch lands, `LiteralNumber(Tag.GLOBAL_REF(slot))` may still appear in bytecode. The runtime treats it as the `DATA_REF` form that resolves to the global heap window, so semantics remain identical.

Load / Fetch / Store

- `load ( value|ref — value )`: identity on non-refs; if ref, deref once; if result is ref, deref once more; materializes lists.
- `fetch ( ref — value )`: strict address read; materializes lists when the cell read is a LIST header; errors on non-ref.
- `store ( value ref — )`: destination must be a ref; if source is a ref, materialize first; simple→simple allowed; compound→compound allowed only if compatible (see §6); simple↔compound mismatch is an error.

Stack ops transparency

- `dup`, `swap`, `rot`, `over`, `pick`, `tuck` manipulate the ref value itself; no implicit deref.

---

## 6. Assignment and In-Place Mutation (compatibility)

Principles

- Liberal sources; strict destinations: sources may auto-deref; destinations must be addresses and are never materialized.
- In-place for locals and globals: destinations in the return-stack or global-heap windows are updated in place.

Compatibility rule (compound→compound)

- Allowed only when source and destination have the same structural type and total slot count; update payload then header at the destination; do not change the destination reference (aliasing preserved).
- Attempts to assign simple↔compound are errors.

Locals (normative)

- Simple locals: overwrite slot `(BP + slot)` directly (after materializing source).
- Compound locals: slot holds a `DATA_REF` that resolves to the return-stack window; compatible assignment copies payload then header in-place at that address; slot’s reference is unchanged.

Globals

- Same compatibility rule; storage lives in the global-heap window; `DATA_REF` addresses are resolved before write; compatible compound assignments mutate in place.

---

## 7. Increment Operator (+>)

Purpose

- Concise syntax for in-place updates of local variables and their bracket-selected subparts.

Syntax and desugaring

- `value +> x` ⇒ `value x add -> x`
- `value +> x[ … ]` ⇒ `value x[ … ] add -> x[ … ]`

Scope and constraints

- Locals-only destination: valid only inside function definitions; targets local slots or bracket-path selections within locals.
- Using `+>` outside a function errors: “Increment operator (+>) only allowed inside function definitions”.
- Undefined destination local errors: “Undefined local variable: <name>”.

Lowering (implementers)

- Simple: `VarRef(slot)` → `Swap` → `Over` → `Fetch` → `Add` → `Swap` → `Store`.
- Bracket-path: build destination address like assignment, then RMW as above.

For globals, use explicit RMW: `value name add -> name` or `value name[ … ] add -> name[ … ]`.

---

## 8. Bracket Paths with Variables (lowering)

Bracket paths are the primary ergonomic way to read/write inside compounds.

Syntax

- Read: `expr[ i j … ]`, `expr[ "key" … ]` or `expr[ 'key … ]`
- Write: `value -> x[ … ]`, `value -> name[ … ]` (destinations must be addresses). For string keys, both `"key"` and `'key` are accepted when the key has no spaces.

Lowering (normative)

- Read (liberal): `expr[ … ]` compiles to `Select` → `Load` → `Nip` over the source expression.
- Write (strict): destination compiles to `&x` or `&name`, then `Select` → `Nip` → `Store`.

Semantics

- Path items: numbers index list elements; strings index maplist keys.
- Reads are value-by-default; writes mutate in place; compound compatibility applies (§6).

Canonical details and low-level addressing ops live in docs/specs/lists.md.

---

## 9. Opcodes & Compilation (locals)

Reserve & init

- `RESERVE N` allocates N local slots in the frame (cells).
- `INIT_VAR_SLOT slot` pops TOS and stores into the slot (simple direct, compound copies into the return-stack window and stores a `DATA_REF` handle).

Addressing

- `LOCAL_VAR_ADDR slot` pushes the absolute address `(BP + slot)` as a `DATA_REF` for `&x`.

Compilation pattern

1. Function prologue emits `RESERVE` with placeholder count.
2. Each `var` registers a local symbol with its slot number and emits `INIT_VAR_SLOT slot`.
3. Compiler back-patches the final slot count into `RESERVE`.

Symbol resolution priority

1. Local variables (if inside function)
2. Global symbols
3. Built-in operations

Compile-time vs runtime tags

- Parser marks locals with a compile-time `LOCAL_VAR` kind; runtime addressing uses `DATA_REF` handles (no `Tag.LOCAL` at runtime).

---

## 10. Lifetime, Aliasing, and Safety

Locals

- Lifetime: from declaration until function return; automatic deallocation by restoring `RSP = BP`.
- Aliasing: `&x` remains valid within the owner frame; compound assignments preserve the existing handle (slot ref unchanged).
- Illegal: returning local references; storing locals into globals (lifetime mismatch).

Globals

- Lifetime: program/VM lifetime.
- Aliasing: `&name` remains stable; compatible compound assignments do not rebind.

Safety guarantees

- Automatic deallocation for locals; no dangling refs when respecting lifetimes.
- No fragmentation: contiguous stack/global allocation.

---

## 11. Errors and Diagnostics

Principles (see `docs/specs/core-invariants.md` for mutation rules and `docs/reference/known-issues.md` for documented failure cases.)

- Reads soft-fail where applicable; writes throw on failure.

Canonical errors

- Bad address: "store expects DATA_REF address".
- Type mismatch: "Cannot assign simple to compound or compound to simple".
- Incompatible compound: "Incompatible compound assignment: slot count or type mismatch".
- Strict read: "fetch expects DATA_REF address".
- Increment out of scope: "Increment operator (+>) only allowed inside function definitions".

---

## 12. Examples

Locals — basic

```tacit
: calculate
  10 var a
  5 var b
  a b add
;
```

Locals — compounds and in-place update

```tacit
: process-list
  (1 2 3) var xs
  5 -> xs[1]
  xs
;
```

Globals — basics

```tacit
42 global answer
answer              \ -> 42

( 1 2 ) global xs
5 -> xs[1]         \ xs becomes ( 1 5 )

: use
  &xs 0 elem fetch  \ address read
;
```

Increment (locals-only)

```tacit
: inc1
  0 var x
  1 +> x
  x
;

: inc-nested
  ( ( 1 2 ) ( 3 4 ) ) var ys
  1 +> ys[0 1]
  ys
;
```

---

## Appendix A: Dictionary Management

Compile-time scope

- Mark at function start; revert at function end. The compiler maintains a scoped dictionary for names.
- Each `var` registers the symbol with kind `LOCAL_VAR` and its slot number.

Symbol resolution priority

1. Local variables (if inside a function)
2. Global symbols
3. Built-in operations

Symbol kinds

| Symbol Kind | Purpose                | Data Stored      |
| ----------- | ---------------------- | ---------------- |
| BUILTIN     | Built-in operations    | Opcode number    |
| USER_DEF    | User-defined functions | Bytecode address |
| LOCAL_VAR   | Local variables        | Slot number      |

---

## Appendix B: Opcode Details (locals)

| Opcode         | Purpose                  | Encoding                     | Operation                                |
| -------------- | ------------------------ | ---------------------------- | ---------------------------------------- |
| RESERVE        | Allocate local slots     | `RESERVE slot_count`         | Advance RSP by `slot_count` cells        |
| INIT_VAR_SLOT  | Initialize variable slot | `INIT_VAR_SLOT slot_number`  | Pop TOS, store in slot with tagging      |
| LOCAL_VAR_ADDR | Push slot address        | `LOCAL_VAR_ADDR slot_number` | Push `DATA_REF` resolving to `BP + slot` |

RESERVE

- Limits: 8-bit slot count (0–255 locals per function)
- Timing: executed once per function call during prologue

INIT_VAR_SLOT

- Simple: store directly into `(BP + slot)`
- Compound: transfer list into the return-stack window and store a `DATA_REF` that resolves to the header in the slot

LOCAL_VAR_ADDR

- Address calculation: `BP + slot` (cell index)
- Used for `&x` and as a base for bracket-path destination construction

---

## Appendix C: Immediate Conditionals (Lexical Access)

`if … else … ;` executes at compile time but emits bytecode that runs inside the current frame. Branch bodies therefore access the surrounding locals directly; no additional function frame is created.

Example

```tacit
: conditional-math
  5 var x
  x 0 gt if x 2 mul else 0 ;
;
```

The branch bodies access the parent function's local `x` using the current `BP`. Bare `x` yields the value; `&x fetch` reads the slot content.

---

## Appendix D: Testing Notes

Testable assertions

- `&x load` equals `x` value.
- Polymorphic list ops return identical results for values and refs.
- `ref` returns a `DATA_REF` pointing at the correct header.
- `load` materializes entire list per lists.md.
- `store`/`set` materialize source refs before writing.

---

## Appendix E: Glossary and Cross‑References

Glossary

- Absolute cell index — integer payload in a ref; address = index × 4.
- Borrowing — using a ref owned by another frame; safe to return to owner.
- Code ref — handle to builtins/bytecode; evaluated via `eval`.
- Data ref — unified handle to data in the arena; payload is an absolute cell index, and helpers map it to the appropriate window.
- Destination — the location being written (slot or addressed element).
- Materialize/Resolve — convert a ref to its current value.
- Owner — the frame that holds the slot to which the ref points.
- Source — the value provided for storage or assignment.

Cross‑references

- Locals/globals and refs: this doc
- Lists and compounds: docs/specs/lists.md
- Frames & BP: docs/specs/vm-architecture.md
- Tagged values: docs/specs/tagged.md

---

## Appendix F: Additional Examples

Formal parameters via variables

```tacit
: area ( radius -- area )
  var radius
  3.14159 var pi
  radius dup mul
  pi mul
;
```

Multiple locals with mixed types

```tacit
: complex-calc
  var input
  (10 20 30) var coeffs
  0 var result
  input coeffs head
  result add -> result
;
```

Conditional access to locals

````tacit
: conditional-process
  var data
  data 0 gt if data 2 mul else 0 ;
;

---

## Appendix G: Lowering Cookbook (Surface → Ops)

Common surface forms and their canonical lowering:

Locals
```tacit
x                 → VarRef(slot) · Load
&x                → VarRef(slot) · Fetch
value -> x        → VarRef(slot) · Store

value +> x        → VarRef(slot) · Swap · Over · Fetch · Add · Swap · Store
value +> x[ … ]   → VarRef(slot) · Fetch · [path] · Select · Nip · Swap · Over · Fetch · Add · Swap · Store
````

Globals

```tacit
name              → LiteralNumber(DATA_REF(global-slot)) · Load
&name             → LiteralNumber(DATA_REF(global-slot))
value -> name     → LiteralNumber(DATA_REF(global-slot)) · Store
value -> name[ … ]→ LiteralNumber(DATA_REF(global-slot)) · Fetch · [path] · Select · Nip · Store
```

Bracket-path read (any expr)

```tacit
expr[ … ]         → [path] · Select · Load · Nip
```

Notes

- “[path]” means the parser emits an OpenList · elements · CloseList path literal.
- Destinations must be addresses; sources that are refs are materialized before writes.
- `+>` is locals-only; use `value name add -> name` for globals.

```

```
