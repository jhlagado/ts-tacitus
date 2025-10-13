# Capsules

## Status and Intent

This document is a **complete, self-contained specification** for **Capsules** in Tacit using the `does` command (formerly `methods`). Capsules fuse environment capture and symbolic re-entry into a single value. The spec targets Tacit implementors and advanced users; it assumes familiarity with:

- Core stack and segment model (`docs/specs/vm-architecture.md`)
- Colon definitions and immediate commands (`docs/specs/metaprogramming.md`)
- Local-variable frames (`docs/specs/variables-and-refs.md`)
- List representation (`docs/specs/lists.md`)

---

## 1. Overview

### 1.1 Motivation

Capsules provide a lightweight way to package:

1. The current local-variable frame (the *environment*)
2. A re-entry code pointer (the *continuation*)

They behave much like delimited continuations or reified closures but remain fully stack-resident. Typical use cases:

- Stateful objects (`counter`, `actor`, `iterator`)
- Pipeline stages with internal buffers
- Generator-style resumable computations

### 1.2 Key Properties

| Property       | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| Value-first    | A capsule is a list that lives on the return stack; callers receive an `RSTACK_REF` handle |
| Environment    | Contains all locals between `BP` and `RSP` captured in place          |
| Continuation   | Slot 0 of the list is the CODE reference used to resume execution     |
| Stack-resident | No heap allocation; payload remains in the existing frame             |
| Symbolic       | Dispatch uses message symbols to select behaviour                     |
| Deterministic  | Explicit push/pop discipline; no hidden garbage collection            |

---

## 2. Capsule Construction

### 2.1 Syntax

A capsule is produced inside a colon definition by executing `does`. The source after `does` belongs to the dispatch routine, often—but not necessarily—a `case/of` structure:

```tacit
: makePoint
  100 var x
  200 var y

  methods          \ constructor terminates here
  case             \ dispatch routine (optional but idiomatic)
    'move of +> y +> x ;
    'draw of x y native_draw ;
  ;
;
```

### 2.2 Constructor Semantics (`methods` Command)

`methods` lowers to a dedicated freeze + constructor exit sequence:

1. **Validate and swap closer (compile-time)**
   - Ensure a colon definition is open: the data stack must contain `Op.EndDef`.
   - Replace the closer by pushing `createBuiltinRef(Op.EndCapsule)` so the shared terminator emits the capsule-specific epilogue.

2. **Emit `Op.ExitConstructor`**
   - `methods` emits a single opcode `Op.ExitConstructor` that performs the freeze and unwinds the frame in one step. At runtime it:
     - Leaves the callee's locals where they already live (`[BP … RSP)`).
     - Wraps the current `vm.IP` (the instruction immediately after the opcode) as `CODE_REF(entryAddr)`.
     - `rpush`es that `CODE_REF`, then `rpush`es the list header `LIST:(locals+1)` so `RSP` now points at the capsule header.
     - Pushes `toTaggedValue(RSP_before_header, Tag.RSTACK_REF)` onto the data stack so the caller receives a handle.
     - Reads the caller's saved BP from (BP-1) and return address from (BP-2), restores them, and jumps to the caller's return address – leaving `RSP` untouched so the capsule payload remains appended to the caller's frame.

Everything compiled after `methods` is the dispatch routine and runs only when the returned `RSTACK_REF` is supplied to `dispatch`.

### 2.3 Example: Counter Capsule

```
: make-counter
  0  var count
  1  var step

  methods
  case
    'inc of step +> count ;
    'get of count ;
    'set of -> count ;
    DEFAULT of 'unknown . ;
  ;
;
```

Invoking:

```
make-counter var counter

10 'set &counter dispatch
'inc &counter dispatch
'get &counter dispatch   \ returns current count
```

Stack at return from constructor:

```
[..., count, step, CODE_REF, LIST:3]
```

- `count` is oldest local (lowest address)
- `step` is next
The returned reference points at the capsule list header; the payload cells beneath it hold the captured locals. Callers may stash the handle in a local (`var point`). If it needs to escape the caller's frame (e.g., assigned to a global or returned) the capsule must be copied (using normal list copy operations) because the underlying storage is reclaimed when the caller returns. Using a capsule handle after the owning frame has been reclaimed results in undefined behavior; it is the programmer's responsibility to ensure handle validity.

---

## 3. Dispatch Model

### 3.1 Calling Convention

Dispatch uses the same call scaffolding but rebinds BP to the capsule payload instead of allocating a fresh frame:

| Feature             | Normal Function Call     | Capsule Dispatch                               |
| ------------------- | ------------------------ | ---------------------------------------------- |
| Return address      | `rpush`                  | `rpush`                                         |
| Save caller `BP`    | `rpush`                  | `rpush`                                         |
| Set new `BP`        | `BP = RSP`               | `BP = capsule header index − payloadSlots`     |
| Exit opcode         | `Op.Exit`                | `Op.ExitDispatch`                              |

**Dispatch prologue** (`dispatch` opcode):

1. Pop the capsule handle (`RSTACK_REF`) and method symbol; leave arguments in place.
2. Save caller return address and BP on RSTACK.
3. Read the capsule header via the handle, resolve slot 0 to the `CODE_REF`, and set `BP` to the first payload cell.
4. Jump to the dispatch entry address.

**Dispatch epilogue** (`Op.EndCapsule` emits `Op.ExitDispatch`):

1. Pop the saved BP from the top of RSTACK (recorded in the dispatch prologue) and restore it.
2. Pop the saved return address and jump.
3. Leave the capsule payload untouched; it remains part of the caller's frame until the caller returns.

### 3.2 Invocation Order

Dispatch expects a **fixed arity**:

```
<argN> ... <arg1>  <method-symbol>  <receiver>  dispatch
```

- Arguments (if any) are pushed first (they remain below the receiver).
- Method symbol (`'move`, `'get`, …) follows.
- Receiver capsule (typically via alias `&x`) is pushed last so it sits at TOS.
- `dispatch` consumes both the method symbol and the receiver; arguments remain for the method clause to use.

Example:

```
10 20 'move &point dispatch
```

Inside the `'move` clause, the data stack still holds `10 20` because dispatch only consumes the method symbol and receiver.

### 3.3 Degenerate Dispatch Bodies

Code after `methods` is free-form—no requirement to use `case`, symbols, or even a discriminant at all. Examples:

#### Single Routine (no message required)

```
methods
step +> count
count ;
```

The capsule now behaves like a resumable coroutine: every `dispatch` call ignores its arguments, increments `count` by `step`, and returns the updated value.

#### Manual Branching

```
methods
  dup 0 eq if
    drop count
  else
    drop step +> count
  ;
;
```

Here the caller supplies a numeric message (0 = read, 1 ≠ 0 = increment). The dispatch body itself chooses the branch and the automatically generated epilogue takes care of unwinding.

## 4. Ergonomic Patterns

### 4.1 Store Immediately After Construction

Since dispatch consumes the receiver, capsules should be stored in locals as soon as they are constructed:

```
100 100 make-point var point
```

Reading `&point` later is cheap; duplicating the capsule list repeatedly would be expensive.

## 5. Worked Examples

### 5.1 Point Capsule with Translation

```
: make-point ( x y -- capsule )
  var y0
  var x0

  methods
  case
    'translate of
      rot rot +> x0 +> y0 ;    \ expecting dx dy
    'coords of x0 y0 ;         \ pushes coords
    DEFAULT of drop 'unknown . ;
  ;
;

\ Usage
100 200 make-point var p

\ Move by (10, -5)
10 -5 'translate &p dispatch

\ Fetch new coords
'coords &p dispatch    \ leaves 110 195 on stack
```

### 5.2 Coroutine with State Machine

```
: make-range ( start limit -- capsule )
  var limit
  var current

  methods
  case
    'next of
      current limit ge if
        drop NIL
      else
        current dup 1 +-> current
      ;
    'reset of -> current ;
    DEFAULT of drop 'unknown . ;
  ;
;
```

### 5.3 Degenerate Case: Logging Capsule

```
: make-logger ( addr -- capsule )
  var destination

  methods
  drop destination . ;
;
```

---

## 6. Data Layout Recap

Immediately after `Op.ExitConstructor`:

```
Return stack (top → bottom)
  LIST:(locals+1)   ← RSP
  CODE_REF(entry)
  localN-1
  …
  local0            ← BP during dispatch
  … caller locals …

Data stack (top → bottom)
  toTaggedValue(cellIndexOf(LIST header), Tag.RSTACK_REF)
  … caller operands …
```

No locals move; the capsule simply extends the caller's frame. When `dispatch` runs, `BP` is temporarily rebound to `cellIndexOf(local0)`. When the caller later executes its own `Exit`, `RSP` is reset to the saved BP, reclaiming the capsule with the rest of the frame.

---

## 7. Integration Notes

- **lists.md**: Capsule payload obeys normal list semantics (header + payload cells).
- **variables-and-refs.md**: Capsule creation relies on local-variable frame layout (contiguous cells above BP).
- **case-control-flow.md**: Dispatch bodies commonly use `case/of` but are not restricted to it.
- **metaprogramming.md**: `methods`, `dispatch`, `Op.ExitConstructor`, `Op.EndCapsule`, and `Op.ExitDispatch` extend the immediate command set.
- **vm-architecture.md**: Frame layout (BP-1 = saved BP, BP-2 = return address) matches `Op.ExitConstructor` assumptions.

---

## 8. Summary of Invariants

| Invariant                  | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| Capsule layout             | `[ locals…, CODE_REF, LIST:(locals+1) ]` appended to caller frame |
| Constructor exit           | `methods` emits `Op.ExitConstructor` (restores BP/IP, keeps RSP) |
| Dispatch prologue          | Consumes receiver only; leaves message/args intact           |
| Dispatch epilogue          | `Op.ExitDispatch` restores caller BP/IP without collapsing locals |
| BP semantics               | During dispatch BP references the capsule payload in place   |
| Alias usage                | Receivers should typically be accessed via `&name` aliases (`RSTACK_REF`) |
| Handle validity            | RSTACK_REF handles are valid only within the lifetime of the frame that created them |

---

## 9. Commentary

- Capsules reconcile Tacit's macro-style metaprogramming with a structured object model. Immediate commands manipulate the compilation stream directly, inserting the exact opcode sequence needed for environment capture and re-entry.
- Leaving the capsule environment in place on the return stack avoids alloc/free churn and still gives callers a first-class reference they can store like any other `RSTACK_REF`.
- By enforcing a fixed dispatch signature (`args... method receiver dispatch`), the system cleanly separates concerns:
  - `dispatch` only needs the receiver and method symbol.
  - `case` (or other dispatch bodies) only inspect the discriminant.
  - Arguments remain untouched until the clause consumes them.

Capsules therefore deliver resumable, stateful behaviour within Tacit's pure stack discipline, aligning well with Forth-like ergonomics while offering object-like expressiveness.
