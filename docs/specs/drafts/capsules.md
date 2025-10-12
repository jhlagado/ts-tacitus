# Capsules

## Status and Intent

This document is a **complete, self-contained specification** for **Capsules** in Tacit using the `methods` combinator. It assumes familiarity with Tacit core specs (lists, refs, local-vars, VM architecture), and reintroduces key concepts only where necessary.

---

## 1. Overview

### 1.1 Motivation

Capsules are Tacit's mechanism for capturing local state and resumption logic in a single, first-class object. A capsule:

* Preserves **local variables** declared in a frame
* Captures a **reentry point** compiled as a symbolic `case/of` dispatch table
* Presents itself as a **list value** on the data stack

Use cases include:

* **Objects and stateful actors**
* **Generators, coroutines, or iterators**
* **Pipelines or capsules-as-closures**

### 1.2 Key Properties

| Property       | Meaning                                               |
| -------------- | ----------------------------------------------------- |
| Value-first    | Capsule is a first-class list value on the data stack |
| Self-contained | Includes dispatch code and frozen locals              |
| Frame-based    | Built from a local-variable frame on the return stack |
| Symbolic       | Dispatch uses symbolic message passing                |
| Deterministic  | All memory is stack-resident; no heap allocation      |

---

## 2. Capsule Creation

### 2.1 Syntax

Capsules are declared by defining locals followed by a `methods` block containing an explicit `case` structure:

```tacit
: makepoint
  100 var x
  200 var y

  methods
  case
    'move of +> y +> x ;
    'draw of x y native_draw ;
  ;
;
```

This defines a capsule with local state (`x`, `y`) and symbolic methods. The `methods` block marks the dispatch boundary and captures the frame, while the explicit `case/of` structure provides the multi-branch dispatch logic.

### 2.2 Semantics

At runtime, `methods` performs the following:

1. **Marks dispatch block boundary**:

   * Records the start address of the dispatch table
   * Emits a skip branch to jump over the table during normal execution
   * User writes explicit `case/of` structure for method dispatch

2. **Freezes the return stack frame**:

   * After the `case` block closes, captures all locals between `BP` and `RSP` as a list payload

3. **Constructs the capsule list**:

   * Element 0: a `CODE` reference to the compiled dispatch block
   * Elements 1..N: frozen local variables

4. **Moves to data stack**:

   * Copies the full list from return to data stack
   * Capsule is now a first-class list value

**Key architectural note:** `methods` does not automatically create the `case` structure. The user explicitly writes `case/of` clauses inside the `methods` block. This separates frame capture logic (handled by `methods`) from dispatch logic (handled by standard `case/of`).

---

## 3. Dispatch and Continuations

### 3.1 Syntax

```tacit
(message &capsule -- result) dispatch
```

* `message` can be:

  * A **symbol** (e.g. `draw`)
  * A **list** (e.g. `(`init 100 100)`) with the method name in slot 0

### 3.2 Behavior

Dispatch performs symbolic control:

1. Extracts the capsule’s method entry point from element 0
2. Pushes the current `BP` and return address onto the return stack
3. Sets `receiver` to the capsule; sets `BP` to point to the capsule frame
4. Calls the code reference
5. Inside the method block, a `case` examines the message symbol:

   * If symbol matches: jump to matching clause
   * If list: extracts symbol from element 0 and uses the tail as args
   * Fallback behavior (`DEFAULT`) is optional and user-defined

### 3.3 Dispatch Calling Convention

When `dispatch` re-enters the capsule, it uses a shallow frame convention distinct from ordinary calls:

| Feature             | Normal Function Call  | Capsule Dispatch              |
| ------------------- | --------------------- | ----------------------------- |
| Return address      | Push to RSTACK        | Push to RSTACK                |
| Save caller `BP`    | Push to RSTACK        | Push to RSTACK                |
| Set new `BP`        | `BP = RSP` (top frame)| `BP = start of capsule locals`|
| Locals layout       | Fresh frame           | Replayed capsule payload      |
| Exit opcode         | `Op.Exit`             | `Op.ExitDispatch`             |

**Dispatch prologue emitted by the `dispatch` op:**

1. Pop the capsule list and decode it.  
2. Push return IP and caller BP onto RSTACK (same as normal).  
3. Replay the payload cells (locals) back onto RSTACK; record the index of the first payload cell.  
4. Set `BP` to that index so the capsule environment becomes the active frame.  
5. Push the message discriminant (and arguments if the message was a list) onto the data stack.  
6. Jump to the CODE reference stored in slot 0.

**Dispatch epilogue emitted by `Op.EndCapsule`:**

1. Emit `Op.ExitDispatch` instead of `Op.Exit`.  
2. `Op.ExitDispatch` assumes `RSP` already points to the saved BP:  
   * Pop BP → restore caller BP.  
   * Pop return address → resume caller IP.  
   * No local cleanup; the capsule payload remains intact for future dispatches.

This ensures the capsule behaves like a delimited continuation: the environment is restored and preserved without the usual frame teardown.

Because the capsule environment already occupies the return stack, `dispatch` skips the usual “collapse locals and reset `SP`” step. The caller’s stack shape is identical before and after dispatch, apart from the method’s return values on the data stack.

This ensures that dispatch resumes capsule logic without affecting the return-stack depth used by caller functions. Capsule methods are effectively shallow coroutines.

### 3.4 Continuations

Each method is a named clause in a symbolic `case` block. This structure is the **resumption point** — no instruction pointer is needed. Continuations are symbolic and jump to a clause that restores the capsule’s local context.

---

## 4. Mutation and Encapsulation

* Locals inside a capsule are isolated to that capsule
* Access uses stack-aware operations:

  * `->` stores to a field
  * `+>`, `1+`, etc., mutate field values
* No external access to capsule internals is permitted

Field variables can only be read/written from within a method body via dispatch.

---

## 5. Integration

Capsules integrate with existing Tacit specs:

* **lists.md** — capsules are lists, and obey list rules
* **variables-and-refs.md** — `var` declarations define frame layout
* **access.md** — `dispatch` uses symbol lookup; frame locals accessed via `bp`
* **case-control-flow.md** — method tables follow `case/of` metaprogramming structure

---

## 6. Summary of Invariants

| Invariant                  | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| Immutable layout           | Capsule list has fixed size and shape                    |
| Locals are frame-based     | All fields are stored as variables on RSTACK             |
| Dispatch is symbolic       | Entry point is determined by message symbol or list form |
| State is encapsulated      | No external mutation of locals is possible               |
| Value-first                | Capsule is a list and passed by value                    |
| Stack frames are separated | `RSP` is untouched by dispatch; only BP is rebound       |

---

## 7. Commentary

Capsules unify objects, closures, and coroutine behavior into a single form. The `methods` block both marks the suspension point and installs a `case`-based dispatch table, making it a clean dual of both structural and control behavior.

Tacit avoids explicit IP tracking by leveraging symbolic continuations via `case/of`. Dispatch supports messages as bare symbols or compound lists, allowing flexible message arity.

By decoupling the call stack (`RSP`) from the local frame (`BP`), capsule methods act as isolated control fragments with persistent state but no stack obligations. Capsules require no heap, no garbage collection, and no runtime metadata. They form the backbone for actors, iterators, and stateful pipelines — all within Tacit’s pure stack discipline.
