# Capsules

## Status and Intent

This document is a **complete, self-contained specification** for **Capsules** in Tacit using the `methods` command. Capsules fuse environment capture and symbolic re-entry into a single value. The spec targets Tacit implementors and advanced users; it assumes familiarity with:

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
| Value-first    | A capsule is just another list value on the data stack                |
| Environment    | Contains all locals between `BP` and `RSP`                            |
| Continuation   | Slot 0 of the list is the CODE reference used to resume execution     |
| Stack-resident | No heap allocation; payload lives in the data segment                 |
| Symbolic       | Dispatch uses message symbols to select behaviour                     |
| Deterministic  | Explicit push/pop discipline; no hidden garbage collection            |

---

## 2. Capsule Construction

### 2.1 Syntax

A capsule is produced inside a colon definition by executing `methods`. The source after `methods` belongs to the dispatch routine, often—but not necessarily—a `case/of` structure:

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

When `methods` executes during compilation **the constructor terminates immediately**:

1. **Swap the closer**  
   Pop the current `Op.EndDef` closer and push `Op.EndCapsule`.

2. **Capture the re-entry address**  
   Compute the CODE reference as `CP + size(Op.Exit)` (single byte). This is where dispatch will resume.

3. **Freeze the frame onto the data stack**  
   - Push each local `1 … N` onto the data stack (local 1 = oldest, local N = newest).  
   - Push the computed CODE reference (re-entry point).  
   - Push the list header with length `N + 1` so that TOS is the header.  
   - The resulting layout is:  
     ```
     [ local0 … localN, CODE_REF, LIST:(N+1) ]
     ```
     The list header’s length equals the number of captured cells (locals + code).

4. **Return immediately**  
   Emit a plain `Op.Exit`. The constructor returns, leaving the capsule list on the data stack. No source after `methods` executes during construction.

Everything that appears in source **after** `methods` forms the dispatch routine. It will be executed only when the capsule is re-entered via `dispatch`.

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
    DEFAULT of 'unknown raw ;
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
- `CODE_REF` is the re-entry pointer
- `LIST:3` header indicates 3 payload cells

---

## 3. Dispatch Model

### 3.1 Calling Convention

Dispatch uses a **shallow frame** distinct from normal function calls:

| Feature             | Normal Function Call     | Capsule Dispatch                    |
| ------------------- | ------------------------ | ----------------------------------- |
| Return address      | Push to RSTACK           | Push to RSTACK                      |
| Save caller `BP`    | Push to RSTACK           | Push to RSTACK                      |
| Set new `BP`        | `BP = RSP`               | `BP = start of capsule payload`     |
| Payload storage     | New frame on RSTACK      | Capsule payload stays on data stack |
| Exit opcode         | `Op.Exit`                | `Op.ExitDispatch`                   |

**Dispatch prologue** (emitted by the `dispatch` op):

1. Pop the receiver capsule reference from the stack (typically supplied via alias).
2. Read slot 0 to obtain the CODE reference and compute the address of the first payload cell; leave the payload cells exactly where they already live.
3. Push return IP and caller BP onto RSTACK.
4. Set `BP` to the payload base address (no data is moved or copied).
5. Jump to the CODE reference.

**Dispatch epilogue** (`Op.EndCapsule` emits `Op.ExitDispatch`):

1. Assume `RSP` points to the saved BP (no local cleanup).
2. Pop and restore BP.
3. Pop return address and jump.
4. Leave the capsule payload untouched in place (memory location unchanged).

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
  then ;
;
```

Here the caller supplies a numeric message (0 = read, 1 ≠ 0 = increment). The dispatch body itself chooses the branch and the automatically generated epilogue takes care of unwinding.

#### Default-Only Behaviour

```
methods
drop 'unsupported raw ;
```

A capsule can ignore inputs entirely; only the calling convention is fixed.

---

## 4. Ergonomic Patterns

### 4.1 Store Immediately After Construction

Since dispatch consumes the receiver, capsules should be stored in locals as soon as they are constructed:

```
makePoint var point
```

Reading `&point` later is cheap; duplicating the capsule list repeatedly would be expensive.

### 4.2 Reusable Helpers (Optional)

Implementations may provide helpers that build message lists or reorder stack items, but they must respect RPN parsing. Example:

```
: dispatch/list ( list receiver -- )
  over elem0 swap drop     \ extract symbol
  swap elem-tail           \ leave args below
  dispatch ;
```

This helper consumes only stack values (no lookahead), keeping with Tacit/Forth style.

---

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
    DEFAULT of drop 'unknown raw ;
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
      then ;
    'reset of -> current ;
    DEFAULT of drop 'unknown raw ;
  ;
;
```

### 5.3 Degenerate Case: Logging Capsule

```
: make-logger ( addr -- capsule )
  var destination

  methods
  drop destination raw ;
;
```

---

## 6. Data Layout Recap

Data stack after `methods`:

```
payload[0]  = local0        (BP points here conceptually)
payload[1]  = local1
...
payload[N]  = localN
payload[N+1]= CODE_REF
header      = LIST:(N+1)
```

- `N+1` payload cells: all locals plus the CODE reference.
- Capsule list is first-class; it can be stored, passed, or serialized like any list.

During dispatch:

- The payload remains on the data stack in the same order.
- BP is set to the start of this payload to satisfy code that expects locals at `BP`.
- No locals are popped at epilogue.

---

## 7. Integration Notes

- **lists.md**: Capsule payload obeys normal list semantics (header + payload cells).
- **variables-and-refs.md**: Capsule creation relies on local-variable frame layout (contiguous cells above BP).
- **case-control-flow.md**: Dispatch bodies commonly use `case/of` but are not restricted to it.
- **metaprogramming.md**: `methods`, `dispatch`, `Op.EndCapsule`, and `Op.ExitDispatch` extend the immediate command set.

---

## 8. Summary of Invariants

| Invariant                  | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| Capsule layout             | `[ locals…, CODE_REF, LIST:(locals+1) ]` remains intact      |
| Constructor exit           | `methods` always emits `Op.Exit` immediately                 |
| Dispatch prologue          | Only consumes method symbol + receiver, leaves args intact   |
| Dispatch epilogue          | `Op.ExitDispatch` restores caller BP/IP without collapsing locals |
| BP semantics               | During dispatch BP references the capsule payload in place   |
| Alias usage                | Receivers should typically be accessed via aliases           |

---

## 9. Commentary

- Capsules reconcile Tacit’s macro-style metaprogramming with a structured object model. Immediate commands manipulate the compilation stream directly, inserting the exact opcode sequence needed for environment capture and re-entry.
- Keeping the capsule environment on the data stack avoids alloc/free churn and allows straightforward persistence (capsules can be serialized as lists).
- By enforcing a fixed dispatch signature (`args... method receiver dispatch`), the system cleanly separates concerns:
  - `dispatch` only needs the receiver and method symbol.
  - `case` (or other dispatch bodies) only inspect the discriminant.
  - Arguments remain untouched until the clause consumes them.

Capsules therefore deliver resumable, stateful behaviour within Tacit’s pure stack discipline, aligning well with Forth-like ergonomics while offering object-like expressiveness.
