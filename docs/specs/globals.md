# Global Variables — Specification

**Status**: Design specification for global variable implementation in Tacit VM.

**Related**:

- Variables and References: `docs/specs/variables-and-refs.md`
- VM Architecture: `docs/specs/vm-architecture.md`
- Lists: `docs/specs/lists.md`
- Core Invariants: `docs/specs/core-invariants.md`

## Table of Contents

1. [Overview](#1-overview)
   - 1.1 [Purpose and Scope](#11-purpose-and-scope)
   - 1.2 [Relationship to Locals](#12-relationship-to-locals)
   - 1.3 [Core Invariants](#13-core-invariants-assumed-by-this-spec)

2. [Storage Model](#2-storage-model)
   - 2.1 [Unified Data Arena and Global Area](#21-unified-data-arena-and-global-area)
   - 2.2 [Global Cell Format](#22-global-cell-format)
   - 2.3 [Allocation Model and Addressing](#23-allocation-model-and-addressing)
   - 2.4 [64K Limit and Rationale](#24-64k-limit-and-rationale)
   - 2.5 [Lifetime, Aliasing, and Safety](#25-lifetime-aliasing-and-safety)

3. [Declaration Semantics](#3-declaration-semantics-value-global-name)
   - 3.1 [Top-Level Restriction](#31-top-level-restriction)
   - 3.2 [Execution Sequence of a Declaration](#32-execution-sequence-of-a-declaration)
   - 3.3 [Compiler Path](#33-compiler-path-pseudo-implementation)
   - 3.4 [Compound Declarations](#34-compound-declarations)
   - 3.5 [Dictionary Integration](#35-dictionary-integration)
   - 3.6 [Error Handling](#36-error-handling)

4. [Dictionary Integration](#4-dictionary-integration)
   - 4.1 [Entry Payload and Metadata](#41-entry-payload-and-metadata)
   - 4.2 [Lookup Resolution and Compilation](#42-lookup-resolution-and-compilation)
   - 4.3 [Shadowing and Redefinition](#43-shadowing-and-redefinition)
   - 4.4 [Boundary Validation at Runtime](#44-boundary-validation-at-runtime)
   - 4.5 [Persistence and Reloading](#45-persistence-and-reloading)

5. [Opcodes and Lowering](#5-opcodes-and-lowering)
   - 5.1 [GlobalRef — Reference to Global Heap Cell](#51-globalref--reference-to-global-heap-cell)
   - 5.2 [Read (Value-By-Default)](#52-read-value-by-default)
   - 5.3 [Address-Of (Strict Fetch)](#53-address-of-strict-fetch)
   - 5.4 [Assignment](#54-assignment)
   - 5.5 [Increment Operator](#55-increment-operator)
   - 5.6 [Bracket-Path Assignment](#56-bracket-path-assignment)
   - 5.7 [Reading Compound Elements](#57-reading-compound-elements)
   - 5.8 [Bytecode Footprint](#58-bytecode-footprint)

6. [Compound Handling](#6-compound-handling)
   - 6.1 [Compound Storage Location](#61-compound-storage-location)
   - 6.2 [Compatibility and In-Place Mutation](#62-compatibility-and-in-place-mutation)
   - 6.3 [Compound Reads and Materialization](#63-compound-reads-and-materialization)
   - 6.4 [Prohibited Simple↔Compound Rebinding](#64-prohibited-simplecompound-rebinding)
   - 6.5 [Compound Declarations vs. Assignments](#65-compound-declarations-vs-assignments)
   - 6.6 [Bracket-Path Semantics on Compounds](#66-bracket-path-semantics-on-compounds)
   - 6.7 [Safety Guarantees](#67-safety-guarantees)

7. [Error Model](#7-error-model)
   - 7.1 [Liberal Sources, Strict Destinations](#71-liberal-sources-strict-destinations)
   - 7.2 [Declaration-Time Errors](#72-declaration-time-errors)
   - 7.3 [Assignment Errors](#73-assignment-errors)
   - 7.4 [Access and Lookup Errors](#74-access-and-lookup-errors)
   - 7.5 [Bracket-Path and Selection Errors](#75-bracket-path-and-selection-errors)
   - 7.6 [Error Propagation Semantics](#76-error-propagation-semantics)

8. [Performance Considerations](#8-performance-considerations)
   - 8.1 [Instruction Cost and Address Resolution](#81-instruction-cost-and-address-resolution)
   - 8.2 [Lookup Overhead at Compile Time](#82-lookup-overhead-at-compile-time)
   - 8.3 [Memory Locality and Contiguity](#83-memory-locality-and-contiguity)
   - 8.4 [Allocation and Fragmentation](#84-allocation-and-fragmentation)
   - 8.5 [Relative Cost vs. Locals](#85-relative-cost-vs-locals)
   - 8.6 [Compound Copying Cost](#86-compound-copying-cost)
   - 8.7 [Concurrency and Synchronization](#87-concurrency-and-synchronization)
   - 8.8 [Summary](#88-summary)

9. [Summary](#9-summary)

## 1. Overview

### 1.1 Purpose and Scope

Global variables provide persistent, module-scope storage for Tacit programs. Each global occupies a single 32-bit cell within the global area of the unified data segment. A global cell can hold either a simple value (number, code ref, builtin, string ref) or a reference pointing to a compound stored in the global area (for example, a list). This spec defines the addressing model, declaration rules, dictionary integration, opcode lowering, and runtime invariants for globals. It assumes the platform's core rules for refs, value-by-default, lists, and compatibility.

### 1.2 Relationship to Locals

Globals mirror locals wherever possible to reduce cognitive overhead:

- **Value-by-default reads**: `name` compiles to “address then load”, exactly like `x` for locals; that is, `GlobalRef <offset>; Load`. Reads dereference refs up to two levels and materialize lists.
- **Address-of**: `&name` compiles to `GlobalRef <offset>; Fetch`, paralleling `&x` for locals. `Fetch` is a strict address read and materializes lists when the cell contains a list header.
- **Writes**: `value -> name` compiles to `GlobalRef <offset>; Store`. Destinations are never materialized; sources that are refs are materialized before the write. This matches locals’ “liberal sources, strict destinations.”

Key differences, driven by lifetime:

- **Addressing**: locals use frame-relative slots via `VarRef(slot)`; globals use absolute cell indices within the global area via `GlobalRef(offset)`. Both are Tag.REF under the absolute addressing model.
- **Storage locality**: local compounds live above the frame in the return-stack area and the slot stores a ref; global compounds live in the global area and the global cell stores a ref to that compound's header.
- **Increment operator**: `+>` works identically for both locals and globals. The bytecode sequence is the same, differing only in the first opcode (`VarRef` vs `GlobalRef`). Both compile to: `VarRef/GlobalRef; Swap; Over; Fetch; Add; Swap; Store`.

### 1.3 Core Invariants (assumed by this spec)

This spec relies on the canonical invariants:

- **Unified REF model**: a ref's 16-bit payload is an absolute cell index into the shared arena; the runtime infers which area (global, data-stack, or return-stack) owns an address by comparing against boundary constants. Globals must point into the global area; mismatches are errors.
- **Value-by-default semantics**: `load` dereferences up to two levels and materializes lists; `fetch` is a strict address read that materializes when it encounters a list header. These rules apply identically to globals and locals.
- **Compound compatibility**: in-place mutation of a compound destination is allowed only when source and destination are the same structural type with the same slot count; list headers and compound starts are immutable targets for simple writes. This governs bracket-path writes into global compounds.
- **Bracket-path lowering**: writes to `name[ … ]` compile to `&name; Select; Nip; Store`. Reads compile to `Select; Load; Nip`. These forms are shared with locals.

Together, these constraints make globals feel like "locals with a different address space," while preserving deterministic lifetime and memory safety.

## 2. Storage Model

### 2.1 Unified Data Arena and Global Area

Tacit's VM uses one **unified data arena**, a contiguous range of 32-bit cells. The arena is organized into three contiguous areas:

1. **Global area** – persistent, module-scope data (from `GLOBAL_BASE` to `GLOBAL_TOP`).
2. **Data-stack area** – transient operand storage (from `STACK_BASE` to `STACK_TOP`).
3. **Return-stack area** – function frames and locals (from `RSTACK_BASE` to `RSTACK_TOP`).

Globals live exclusively in the **global area** of the data segment, starting at `GLOBAL_BASE_CELLS`.
Each cell in this area may contain either:

- A **simple value** (number, string address, builtin ref, code ref), or
- A **compound reference** — a `Tag.REF` whose payload indexes another structure (e.g. list, map, capsule) that also resides in the global heap.

The global area grows **upward** as new globals are declared. A dedicated register `GP` (global pointer) always indicates the next free cell in that area.

### 2.2 Global Cell Format

Each global variable occupies exactly **one 32-bit cell**.
That cell’s content may be:

| Stored form                | Meaning                                   | Example              |
| -------------------------- | ----------------------------------------- | -------------------- |
| `Tag.NUMBER`               | Plain scalar                              | `42 global count`    |
| `Tag.STRING`               | Pointer into string segment               | `"hello" global msg` |
| `Tag.CODE` / `Tag.BUILTIN` | Function or builtin reference             | `@square global fn`  |
| `Tag.REF`                  | Pointer to compound header in global heap | `(1 2 3) global xs`  |

This model keeps globals _flat_; even complex data is addressed through a single level of indirection.
The compound’s payload remains contiguous in the heap, and the global cell’s `Tag.REF` is treated just like any other reference during `Load` and `Store`.

### 2.3 Allocation Model and Addressing

Every new global declaration consumes the next available cell in the global area.
Address computation is fixed and lightweight:

```
absoluteIndex = GLOBAL_BASE_CELLS + offset
```

where `offset = GP - GLOBAL_BASE_CELLS` at the moment of allocation.
The compiler emits that 16-bit offset as the operand to `Op.GlobalRef`.

At runtime, `GlobalRef` reconstructs the absolute index and wraps it in a `Tag.REF`.
That reference unambiguously identifies the global cell and lets `fetch`, `load`, and `store` operate without any extra indirection.

### 2.4 64K Limit and Rationale

Because offsets are 16 bit, the VM supports **65 536** global cells:

- **Address range:** 0 – 65535
- **Total bytes:** ≈ 256 KiB (4 × 65 536)
- **Practical implication:** ample for configuration constants, shared lists, and long-lived capsules.

Exceeding this range raises `Global variable limit exceeded (64K)` at compile time.
Future extensions could switch to 24-bit offsets or segmented heaps but the current flat 64K area favors simplicity and direct addressing.

### 2.5 Lifetime, Aliasing, and Safety

- **Lifetime:** globals persist for the entire VM session. They are initialized once at load-time and reclaimed only when the VM resets.
- **Aliasing:** `&name` returns a stable `REF` whose payload always points to the same cell. It may be passed to functions or stored in lists freely.
- **Boundary enforcement:** the VM validates that a global's ref payload lies within `[GLOBAL_BASE_CELLS, GLOBAL_BASE_CELLS + 65535]`. Anything outside the global area is an error.
- **Compound placement:** when storing a compound whose origin is on the data or return stack, the VM copies it into the global area (via helper `pushListToGlobalHeap` or `GPushList`) and replaces the cell content with a `REF` to the new header.
- **No leakage of locals:** a local compound's address must never be written directly into a global cell. If a function attempts to do so, the runtime copies the structure into the global area instead, preserving lifetime safety.

This strict separation ensures that globals can always be dereferenced safely regardless of call-stack state.

## 3. Declaration Semantics (`value global name`)

### 3.1 Top-Level Restriction

Global declarations are **only legal at the top level** of a source file or interactive session.
They cannot appear within a colon definition, quotation, or any function scope.

Attempting to declare a global inside a function causes a compile-time error:

```
"Global declarations only allowed at top level"
```

This rule prevents lifecycle ambiguity between per-frame locals (created and forgotten as frames unwind) and globals (persistent across the entire VM session).

### 3.2 Execution Sequence of a Declaration

When the parser encounters

```tacit
value global name
```

it emits bytecode equivalent to:

```
<value-emission>
GlobalRef <offset>
Store
```

Runtime behaviour:

1. **Value**: top-of-stack holds the value to assign — simple or compound.
2. **Address creation**: `GlobalRef` constructs a `Tag.REF` to the cell at `GLOBAL_BASE_CELLS + offset`.
3. **Write**: `Store` pops the value and writes it to that cell.
   - If the value is simple → copied directly.
   - If compound → copied to the global heap, and the cell receives a `REF` to the new header.

4. **Dictionary registration**: compiler records `name` → `Tag.REF(globalCellIndex)` so later references to `name` emit `GlobalRef <offset>`.
5. **Advance pointer**: `GP` increments by one cell to mark the next free slot.

### 3.3 Compiler Path (pseudo-implementation)

```typescript
function compileGlobal(vm, tokenName, valueExpr) {
  if (vm.scopeDepth > 0) throw new Error('Global declarations only allowed at top level');
  const offset = vm.gp - GLOBAL_BASE_CELLS;
  if (offset > 0xffff) throw new Error('Global variable limit exceeded (64K)');
  vm.gp += 1;
  compile(valueExpr); // emit value-producing ops
  emit(Op.GlobalRef);
  emit16(offset);
  emit(Op.Store);
  const globalRef = createRef(GLOBAL_BASE_CELLS + offset);
  define(vm, tokenName, globalRef); // dictionary entry
}
```

This mirrors local variable compilation but uses the `GP` counter instead of a frame slot number.

### 3.4 Compound Declarations

If the initial value is a compound structure like a list, the store must first materialize it in the global heap.

Example:

```tacit
(1 2 3) global xs
```

Bytecode:

```
OpenList
LiteralNumber 1
LiteralNumber 2
LiteralNumber 3
CloseList
GlobalRef <offset>
Store
```

Runtime:

1. The list `(1 2 3)` exists temporarily on the data stack.
2. `Store` detects that the destination address is in the global area.
3. The VM copies the list's header and payload into the global area using the same contiguous layout rules as lists on the stack.
4. A new `Tag.REF` to that header is written into the global cell.
5. The temporary stack copy is dropped.

This ensures all global compounds have permanent residency in the heap and never reference transient stack memory.

### 3.5 Dictionary Integration

A successful declaration creates a standard dictionary entry:

| Field | Description |
| | - |
| `name` | interned `Tag.STRING` symbol |
| `payload` | `Tag.REF` pointing to the global cell |
| `flags` | marks entry as data (not code) |
| `prev` | link to previous dictionary entry |

The payload is a genuine runtime `REF`, not a compile-time `Tag.LOCAL`. When the compiler later encounters the symbol `name`, it resolves this reference and emits `GlobalRef <offset>` accordingly.

### 3.6 Error Handling

| Condition                        | Message                                         | Phase   |
| -------------------------------- | ----------------------------------------------- | ------- |
| Inside function                  | “Global declarations only allowed at top level” | compile |
| Redeclaration of existing global | “Global `<name>` already defined”               | compile |
| Invalid identifier               | “Expected variable name after global”           | compile |
| Exceeded 64K area                | "Global variable limit exceeded (64K)"          | compile |
| Runtime boundary mismatch        | "REF points outside global area"                | runtime |

These guardrails make global declarations deterministic and memory-safe within the VM's static global area.

## 4. Dictionary Integration

### 4.1 Entry Payload and Metadata

Every global variable appears in the dictionary as a standard entry whose `payload` is a `Tag.REF` to its storage cell in the global heap.
This unifies global variable names with the same lookup system that handles user-defined functions and builtins.

| Field | Tag | Description |
| | -- | |
| `name` | `Tag.STRING` | Pointer to the interned symbol for the variable name. |
| `payload` | `Tag.REF` | Absolute cell index of the global heap slot. |
| `flags` | — | Marks entry as “data,” not executable (`CODE` or `BUILTIN`). |
| `prev` | `Tag.REF` / `NIL` | Link to prior entry for chaining. |

This means globals are ordinary dictionary entries whose value field happens to reference a persistent cell instead of a code address.
The VM doesn’t special-case them at lookup; it simply checks the tag on the payload to determine how to emit code.

### 4.2 Lookup Resolution and Compilation

When the compiler encounters a bare word `name`, lookup proceeds as usual:

1. **Search the current dictionary** from most recent entry backward.
2. **Match found** whose payload tag is `Tag.REF`.
3. **Determine window** using the absolute index from the payload:
   - If the index lies within the global heap range, it’s a global variable.
   - If the index lies within the return-stack range, it’s a local variable.

4. **Emit bytecode** according to context:

| Form | Emitted Sequence |
| | |
| `name` | `GlobalRef <offset>; Load` |
| `&name` | `GlobalRef <offset>; Fetch` |
| `value -> name` | `GlobalRef <offset>; Store` |

Offset = `absoluteIndex - GLOBAL_BASE_CELLS`, stored as a 16-bit operand.

This mechanism uses the same address-range discrimination already present in `variables-and-refs.md`, ensuring that no explicit type flag is needed to tell globals from locals.

### 4.3 Shadowing and Redefinition

Tacit follows straightforward shadowing rules to preserve determinism:

- **Global vs builtin:** a global name overrides a builtin of the same spelling; the builtin remains accessible through its opcode or alternate alias.
- **Global vs function:** globals and colon definitions share the namespace. Redeclaring an existing function as a global (or vice-versa) is an error:
  `"Global already defined"` or `"Name already used for code symbol"`.
- **Redeclaration:** re-using a global name after it’s defined is forbidden; use `->` for reassignment instead.
- **Visibility inside functions:** once defined, globals are visible everywhere, including function bodies, since dictionary lookup is flat and global entries persist for the entire VM lifetime.

### 4.4 Boundary Validation at Runtime

When executing any global reference instruction, the VM validates that the target address is inside the global area:

```
if (cellIndex < GLOBAL_BASE_CELLS || cellIndex >= GLOBAL_BASE_CELLS + 65536)
    throw "REF points outside global area"
```

This guarantees that no corrupted dictionary entry or user error can direct a global ref into stack or return-stack memory.

### 4.5 Persistence and Reloading

Dictionary entries for globals survive across resets of the data and return stacks.
When the VM performs a "soft reset" (clearing call stacks but preserving heap data), global entries remain linked.
On a full VM reload, global area and dictionary may be serialized together to reconstruct identical addresses on restore.

This persistence design aligns globals with the VM's module system: a compiled module may pre-populate its global area, then export those dictionary entries for external linkage.

## 5. Opcodes and Lowering

### 5.1 `GlobalRef` — Reference to Global Heap Cell

**Opcode:** `Op.GlobalRef`
**Operands:** 16-bit unsigned integer `offset`
**Stack Effect:** `( — REF )`

**Purpose**
Pushes a reference (`Tag.REF`) to a specific global cell. The absolute cell index is computed as:

```
absoluteIndex = GLOBAL_BASE_CELLS + offset
```

**Semantics**

1. Read `offset` (u16) from bytecode stream.
2. Compute `absoluteIndex`.
3. Construct a `Tag.REF` whose payload is `absoluteIndex`.
4. Push that reference onto the data stack.

**Implementation Sketch**

```typescript
function opGlobalRef(vm) {
  const offset = nextUint16(vm);
  const absoluteIndex = GLOBAL_BASE_CELLS + offset;
  const ref = createRef(absoluteIndex);
  push(vm, ref);
}
```

**Invariant checks**

- Offset must be within `[0, 65535]`.
- Absolute index must fall inside the global area (between `GLOBAL_BASE_CELLS` and `GLOBAL_BASE_CELLS + 65535`).
- Ref payloads outside this range raise `"REF points outside global area"`.

### 5.2 Read (Value-By-Default)

**Surface Form:** `name`
**Stack Effect:** `( — value )`

**Lowering:**

```
GlobalRef <offset>
Load
```

**Runtime Semantics:**

- `GlobalRef` pushes a REF to the variable’s cell.
- `Load` dereferences once or twice and materializes if it encounters a compound header.
  This matches locals’ behaviour exactly.

### 5.3 Address-Of (Strict Fetch)

**Surface Form:** `&name`
**Stack Effect:** `( — value )`

**Lowering:**

```
GlobalRef <offset>
Fetch
```

**Runtime Semantics:**

- `Fetch` reads the raw cell content without materialization beyond a single list header deref.
- Returns a simple value or a `Tag.REF` for compound globals.
  Useful for bracket-path destinations or explicit address manipulation.

### 5.4 Assignment

**Surface Form:** `value -> name`
**Stack Effect:** `( value — )`

**Lowering:**

```
GlobalRef <offset>
Store
```

**Runtime Semantics:**

- Pops `value`, writes into addressed global cell.
- If `value` is a ref → materialize first.
- If `value` is a compound originating on the stack → copy it into the global heap before writing a new `Tag.REF` to the header.
- If incompatible types (`simple`→`compound` or mismatch in compound slot count) → throw `"Incompatible type for reassignment"`.

### 5.5 Increment Operator

**Surface Form:** `value +> name`
**Stack Effect:** `( value — )`

**Lowering:**

```
GlobalRef <offset>
Swap
Over
Fetch
Add
Swap
Store
```

**Runtime Semantics:**

- Equivalent to `value name add -> name` (syntactic sugar for read-modify-write).
- Reads current value from global cell, adds `value` to it, writes result back.
- Works identically to local variable increment; only difference is using `GlobalRef` instead of `VarRef`.
- Supports bracket paths: `value +> name[path]` compiles to `GlobalRef; Fetch; <path>; Select; Nip; Swap; Over; Fetch; Add; Swap; Store`.

**Note:** The current implementation restricts `+>` to locals only, but there is no technical reason for this limitation. The bytecode sequence is identical except for the first opcode (`VarRef` vs `GlobalRef`). This restriction should be removed to maintain symmetry with locals.

### 5.6 Bracket-Path Assignment

**Surface Form:** `value -> name[ path ]`
**Stack Effect:** `( value — )`

**Lowering:**

```
GlobalRef <offset>
Fetch
<path-literal>
Select
Nip
Store
```

**Semantics:**

1. `Fetch` obtains the REF to the compound header.
2. `<path>` describes numeric or string indices compiled as a list.
3. `Select` navigates to the addressed element.
4. `Nip` removes the path, leaving target address under value.
5. `Store` overwrites element in place, enforcing compatibility.

Behaviour mirrors locals’ bracket-path lowering but targets global heap addresses.

### 5.7 Reading Compound Elements

**Surface Form:** `name[ path ]`
**Stack Effect:** `( — value )`

**Lowering:**

```
GlobalRef <offset>
Fetch
<path-literal>
Select
Load
Nip
```

Provides value-by-default read access into global compound structures such as lists or maplists.

### 5.8 Bytecode Footprint

| Operation | Bytes | Stack Effect |
| -- | | - |
| `GlobalRef` | 3 (1 opcode + 2 operand) | pushes REF |
| `GlobalRef; Load` | 4 | pushes value |
| `GlobalRef; Store` | 4 | pops value |
| `GlobalRef; Fetch` | 4 | pushes cell content |
| `GlobalRef; Fetch; Select; Nip; Store` | variable (≈6+path) | bracket-write |

Compact addressing keeps globals inexpensive in both code size and runtime latency.

## 6. Compound Handling

### 6.1 Compound Storage Location

When a compound (list, maplist, capsule) is assigned to a global variable, the VM must guarantee that the structure resides entirely within the **global area**.
If the compound currently lives on the **data stack** or **return stack**, the runtime performs a _copy-up_ into the global area before writing the global's header reference.

Mechanics:

1. Detect compound type by inspecting the top value's tag.
2. If `Tag.LIST` or another compound header is found and its address is not inside the global area, call `pushListToGlobalHeap` (or equivalent) to duplicate it in the global area.
3. Replace the value on the stack with a `Tag.REF` whose payload is the new header's absolute index.
4. Perform the normal `Store` into the target global cell.

This ensures all compound globals are permanent and never reference transient stack memory.

### 6.2 Compatibility and In-Place Mutation

Global compounds obey the same **compatibility rule** defined for locals:

> A compound destination may be overwritten in place only if the new value has the same structural type and total slot count.

Therefore:

- `(1 2 3) -> xs` followed by `(4 5 6) -> xs` is valid.
- `(1 2 3) -> xs` followed by `(1 2)` is rejected (`Incompatible compound assignment`).
- `42 -> xs` is rejected (simple → compound).
- `(1 2 3) -> x` where `x` was simple is rejected (compound → simple).

The destination reference (`&xs`) never changes, preserving alias stability: any other refs to the same compound will now see the updated contents.

### 6.3 Compound Reads and Materialization

Reading a compound global through `Load` or bracket-path access follows Tacit’s **value-by-default** rule:

- `Load` dereferences up to two levels of refs.
- If the final value is a compound header, the VM materializes the full structure to the stack (header + payload).
- This is identical to list materialization semantics for locals.

Example:

```
items               \ (list global)
GlobalRef <offset>
Load                \ pushes full list structure
```

produces a stack copy of the list’s contents in reverse-layout form, safe for iteration or transient manipulation.

### 6.4 Prohibited Simple↔Compound Rebinding

To preserve predictable memory layouts and avoid accidental heap leaks:

- Converting a compound global to a simple type (`(1 2 3)` → `42`) is illegal without explicit clearing.
- Likewise, converting a simple global to a compound (`42 -> items`) raises a type error unless the implementation supports `clear name` semantics (future).

This prevents half-written states where a global cell points to an invalid or deallocated area.

### 6.5 Compound Declarations vs. Assignments

At declaration time `(1 2 3) global xs`, the VM automatically copies the compound to heap and stores a `REF` to it.
At assignment time `(4 5 6) -> xs`, the runtime performs an in-place overwrite _if_ compatible, or rejects the operation if incompatible.
This symmetry allows functional initialization but safe, structural mutation later.

### 6.6 Bracket-Path Semantics on Compounds

Globals that reference lists or maplists can be accessed element-wise using standard bracket syntax:

```tacit
10 -> items[1]
items[1] .
```

Lowering (write):

```
LiteralNumber 10
GlobalRef <offset>
Fetch              \ cell content -> REF to list header
LiteralNumber 1
Select
Nip
Store
```

Lowering (read):

```
GlobalRef <offset>
Fetch
LiteralNumber 1
Select
Load
Nip
```

Both forms operate directly on the global heap copy of the list.
Compatibility rules apply to the final `Store` operation to prevent mismatched element shapes.

### 6.7 Safety Guarantees

1. **Boundary enforcement:** All compound payloads reachable from globals must reside in the global area.
2. **Lifetime stability:** Once written, the compound exists for the entire VM session unless explicitly destroyed.
3. **Isolation:** No compound in the global area may reference data- or return-stack memory through embedded refs.
4. **Deterministic traversal:** All compounds in the global area obey the same header-and-span invariant as stack lists, ensuring predictable iteration and printing.

These rules make compound globals as safe and composable as their stack-resident equivalents while preserving lifetime correctness.

## 7. Error Model

### 7.1 Liberal Sources, Strict Destinations

Global variables inherit the **same write discipline** as locals:

- **Sources** (the values you assign _from_) are liberal. They may be simple values, references, or compounds. The VM will dereference and materialize them as needed before writing.
- **Destinations** (the globals you assign _to_) are strict. They must always be `Tag.REF` addresses that point inside the global area. Destinations are never materialized.

This dual rule avoids ambiguous writes: a `Store` always knows the address it’s mutating, and a `Load` always returns a full value or compound copy.

### 7.2 Declaration-Time Errors

**Compile-Time Guardrails:**

| Condition | Error Message | Explanation |
| | - | - |
| Inside function | `"Global declarations only allowed at top level"` | Prevents frame-bound lifetime confusion. |
| Invalid identifier | `"Expected variable name after global"` | Parser check for legal word tokens. |
| Redeclaration | `"Global <name> already defined"` | Duplicate entry in dictionary. |
| Exceeded 64K area | `"Global variable limit exceeded (64K)"` | Offset overflow beyond 16-bit capacity. |

**Runtime Guard:**

| Condition          | Error Message                      |
| ------------------ | ---------------------------------- |
| Bad address in REF | `"REF points outside global area"` |

These checks ensure deterministic allocation and valid addressing.

### 7.3 Assignment Errors

Assignments validate both **address** and **type compatibility**.
If either fails, the VM throws a fatal runtime error and leaves the destination unchanged.

| Condition                        | Message                                                           | Handling                            |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| Destination not REF              | `"store expects REF address"`                                     | Operand type error; aborts write.   |
| REF outside global area          | `"Invalid global address"`                                        | Boundary check failure.             |
| Type mismatch (simple↔compound) | `"Cannot assign simple to compound or compound to simple"`        | Structural compatibility violation. |
| Incompatible compound shapes     | `"Incompatible compound assignment: slot count or type mismatch"` | Rejected before copy.               |

All compound writes are atomic at the level of the header: either the new payload is fully copied and header replaced, or the destination remains intact.

### 7.4 Access and Lookup Errors

| Context | Message | Description |
| - | -- | |
| Undefined global name | `"Undefined global: <name>"` | No dictionary entry found. |
| Undefined word (general) | `"Undefined word: <name>"` | Standard parser error for unknown symbols. |
| REF points outside global area | `"<name> is not a global variable"` | Payload lies outside global area. |

Runtime lookup performs a boundary check before emitting a `GlobalRef` operand; failure means the symbol is mis-tagged or corrupted.

### 7.5 Bracket-Path and Selection Errors

When indexing compound globals (lists, maplists):

- **Out-of-bounds index** → returns `NIL` for reads, errors for writes.
- **Invalid path type** → error `"Invalid path element: expected number or string"`.
- **Destination not compound** → `"Cannot index into non-compound global"`.

These mirror list semantics and ensure bracket operations never dereference arbitrary memory.

### 7.6 Error Propagation Semantics

Tacit’s error model ensures **deterministic unwinding**:

- An error in global read/write sets `ERR` (the VM error register).
- Normal stack unwinding proceeds; if a `finally` wrapper is active, it executes cleanup before termination.
- The global heap remains untouched if a `Store` fails mid-operation.

Globals themselves do not own cleanup semantics; they persist even after an error, making them reliable for diagnostic logging or recovery paths. Global errors are designed to be **fail-fast and non-destructive**:

- No partial writes to global memory.
- No lifetime leakage from stack compounds.
- No silent type coercion.
- Clear textual diagnostics for each category (declaration, assignment, access).

Together, these rules keep the global area safe, predictable, and resilient under Tacit's unified memory model.

## 8. Performance Considerations

### 8.1 Instruction Cost and Address Resolution

The **`GlobalRef`** opcode is extremely lightweight.

- **Fetch cost:** a single 16-bit operand fetch followed by one addition (`GLOBAL_BASE_CELLS + offset`).
- **Result:** a `Tag.REF` pushed to the data stack.
- **Total size:** 3 bytes (1 opcode + 2 operand bytes).

This makes global access roughly equivalent to local access via `VarRef(slot)`; the only difference is that locals use a frame-relative base (`BP`) while globals use an absolute heap base (`GLOBAL_BASE_CELLS`).

There are no hash lookups or dynamic tables at runtime: once compiled, globals resolve to fixed offsets. This keeps both execution and code size compact.

### 8.2 Lookup Overhead at Compile Time

Dictionary traversal remains **linear** (`O(n)` per lookup), since global entries share the main symbol table with functions and builtins.
However, this is a compile-time cost only: once emitted, the resulting bytecode references globals by absolute index.

If large numbers of globals cause compile-time slowdown, optimizations like prefix indexing or hash-bucketed dictionaries can be added without altering runtime semantics.

### 8.3 Memory Locality and Contiguity

Globals are laid out contiguously in the **global area**, giving them excellent spatial locality.
Sequential reads or writes to nearby globals tend to hit the same cache lines.

When global compounds (lists, maplists) are copied into the global area, their payloads are also contiguous, preserving cache-friendly traversal for iteration, sorting, or printing operations.

### 8.4 Allocation and Fragmentation

Global allocation is monotonic:

- Each new declaration increments `GP` by one cell.
- Compounds are copied contiguously within the global area.
- No free-list or GC overhead occurs during normal execution.

Fragmentation is negligible since globals are fixed-size (one cell) and compounds are appended once, not resized.
If a compound global is reassigned with a new structure of identical size, the write happens in place—no heap shift required.

### 8.5 Relative Cost vs. Locals

| Operation            | Locals                       | Globals                |
| -------------------- | ---------------------------- | ---------------------- |
| **Address creation** | `BP + slot`                  | `GLOBAL_BASE + offset` |
| **Read (load)**      | 2 ops                        | 2 ops                  |
| **Write (store)**    | 2 ops                        | 2 ops                  |
| **Frame setup**      | requires `Reserve`/`InitVar` | none                   |
| **Lifetime mgmt**    | auto on return               | static for VM lifetime |

So while locals incur frame prologue/epilogue costs, globals pay nothing per function call.
For heavily reused constants or configuration data, globals are faster overall.

### 8.6 Compound Copying Cost

The only non-trivial expense is when a compound built on the data or return stack is first assigned to a global.
Copying the structure into the heap involves a single contiguous memory copy proportional to its slot count (`O(n)`), followed by header registration.
Subsequent reads, traversals, and in-place updates operate in `O(1)` or `O(span)` time just like stack-based lists.

### 8.7 Concurrency and Synchronization

Tacit’s single-threaded VM design means globals are inherently atomic per instruction:
no locks or memory fences are needed.
If multi-VM scheduling is later introduced (per §29 in Tacit roadmap), global access will require either per-VM heap partitions or explicit synchronization channels to prevent shared writes.

### 8.8 Summary

- **Runtime:** Global access = O(1) fixed cost.
- **Memory:** contiguous, non-fragmenting, cache-efficient.
- **Copy cost:** proportional only to compound size at initialization.
- **Thread safety:** trivially guaranteed in single-VM mode.

Globals therefore add minimal runtime overhead while providing stable, persistent storage suited for constants, lookup tables, or long-lived lists.

## 9. Summary

Global variables form the last pillar of Tacit's memory model. They unify the constant and persistent data domains with the same low-level semantics that govern locals, lists, and capsules. Each global is simply a cell in the global area—addressed by an absolute index, referenced through a `Tag.REF`, and managed through the same three primitives: `Load`, `Fetch`, and `Store`. Nothing about their operation introduces new rules; the entire mechanism extends naturally from the invariants already established in `core-invariants.md` and `variables-and-refs.md`.

At the language surface, `value global name` provides a literal mirror of `value var name`. The only distinction is lifetime. Locals expire with their frame; globals survive until the VM halts. This simple shift in allocation base—`BP` for locals, `GLOBAL_BASE_CELLS` for globals—lets the compiler treat both uniformly. Each becomes an addressable slot inside the unified arena, differing only in which boundary check the VM performs.

Conceptually, this is a very narrow feature: there is no notion of package state, mutable environment frames, or implicit side effects. A global variable is not a namespace; it is a persistent cell. Its safety depends on the same four principles that define the rest of Tacit’s execution semantics:

1. **Value-by-default reads.** Everything dereferences itself until it becomes a value, ensuring predictable load behaviour across types.
2. **Strict destinations.** All writes require explicit addresses and never materialize their targets.
3. **Compound compatibility.** Structural updates happen in place only when shapes and types match.
4. **Deterministic lifetime.** No stack allocation outlives its frame unless explicitly copied to the global area.

These guarantees mean that the global heap can be reasoned about just like a permanent frame: one contiguous block whose addresses never change. Programs can therefore rely on globals for constants, shared configurations, and long-lived data structures without risk of aliasing or corruption when stack frames unwind.

At runtime, the distinction between global and local access vanishes into a handful of instructions. The opcode `GlobalRef` simply computes `GLOBAL_BASE_CELLS + offset`, pushes a reference, and leaves the rest to the existing memory machinery. Reads and writes that follow obey the same cost model and tagging rules as any other cell. The result is a form of persistence that costs almost nothing in performance or conceptual weight.

This design also reinforces Tacit’s broader philosophy:

- **Compile-time structure, runtime simplicity.** All binding of globals happens during compilation through dictionary entries; runtime never performs name lookups.
- **Unified arena semantics.** There are no hidden heaps or invisible scopes—just one address space segmented by discipline.
- **Predictable determinism.** Every read and write is explicit, bounded, and type-checked.

The absence of special behaviour is the point. Globals behave exactly as locals would if they never went out of scope. They share the same instructions, the same error model, and the same constraints. That symmetry keeps Tacit’s semantics small, testable, and portable across implementations.

From a systems view, globals are the connective tissue between ephemeral computation and stable program state. They anchor long-lived data, hold configuration constants, and provide the shared context necessary for higher-level abstractions such as module loaders or persistent capsules. Yet their implementation remains mechanical: one register, one area, one tag.

In summary, Tacit’s global variables are not a new subsystem but a disciplined extension of the existing memory model. They achieve persistence without introducing mutability hazards, and they enable module-level reasoning without polluting lexical scope. The result is a language where permanence is a spatial decision, not a semantic exception—another expression of Tacit’s guiding principle that _everything is data, and data is always explicit_.
