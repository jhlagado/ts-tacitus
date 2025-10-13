# Capsules — State + Methods on the Stack

This guide introduces capsules in Tacit: compact, stack‑resident “objects” that capture local state and a re‑entry point. You will learn how to build them with `methods`, call them with `dispatch`, and avoid common pitfalls.

See the normative spec for complete details: `docs/specs/capsules.md`.

---

## 1) What Is a Capsule?

A capsule packages two things:

- The current function’s local variables (the environment)
- A re‑entry code reference (the continuation)

It lives entirely on the return stack (no heap). Callers receive a handle (an `RSTACK_REF`) and use `dispatch` to invoke methods against the captured state.

Key properties:

- Value‑first: created and passed like any other value
- Stack‑resident: no allocation or GC; predictable lifetimes
- Message‑driven: `args … method receiver dispatch`

---

## 2) Quick Start

### Counter capsule

```tacit
: make-counter
  0 var count
  1 var step

  methods
  case
    'inc of step +> count ;
    'get of count ;
    'set of -> count ;
    DEFAULT of 'unknown . ;
  ;
;

\ Construct and use it
make-counter var c
'inc &c dispatch      \ count += step
'get &c dispatch      \ => pushes current count
10 'set &c dispatch   \ set count = 10
'get &c dispatch      \ => 10
```

Call order is fixed: push arguments (if any), then the method symbol, then the receiver handle, then `dispatch`.

---

## 3) Building Capsules with `methods`

Place `methods` inside a colon definition after your local `var` declarations. Everything after `methods` (up to the matching `;`) becomes the capsule’s dispatch body. A `case/of` is idiomatic but optional.

```tacit
: make-point ( x y -- capsule )
  var y0
  var x0

  methods
  case
    'translate of             \ dx dy 'translate &p dispatch
      rot rot +> x0 +> y0 ;
    'coords of x0 y0 ;        \ 'coords &p dispatch  => x y
    DEFAULT of drop 'unknown . ;
  ;
;
```

What `methods` does (intuitively):

- Freezes the locals in place and appends a small list to the caller’s return stack: `[ locals…, CODE_REF, LIST:(locals+1) ]`
- Pushes an `RSTACK_REF` handle to that list on the data stack (your “receiver”)
- Returns to the caller immediately; nothing is copied to the heap

Store the handle right away so you can reuse it:

```tacit
100 200 make-point var p
10 -5 'translate &p dispatch
'coords &p dispatch    \ => 110 195
```

---

## 4) Calling Capsules with `dispatch`

Calling convention:

```
<argN> … <arg1>   <method-symbol>   <receiver>   dispatch
```

Behavior:

- `dispatch` consumes the method symbol and receiver; arguments remain for the method body
- The VM temporarily rebinds `BP` to the capsule’s captured locals and jumps to the stored code reference (slot 0)
- A custom epilogue restores the caller without touching the capsule payload

Examples:

```tacit
'inc &c dispatch     \ mutate count inside the capsule
'get &c dispatch     \ leaves the current count on stack
10 'set &c dispatch  \ update state via argument
```

Degenerate (coroutine‑like) capsules also work: the body can ignore the method symbol entirely and just resume work on each call.

---

## 5) Lifetime and Safety

- Capsule storage is part of the caller’s return stack frame. The handle (`RSTACK_REF`) is valid only while that frame is alive.
- If a capsule must outlive the frame that created it (e.g., stored in a global or returned), copy the capsule list just like any list value, then keep a handle to the copy.
- Access a stored capsule via an alias: `var p` then later `&p` to pass the handle to `dispatch`.

Do:

- `make-counter var c` and reuse `&c` for dispatches
- Copy a capsule list before storing it beyond its frame

Avoid:

- Using a stale handle after the creator frame has returned
- Mutating capsule internals from outside; always go through `dispatch`

---

## 6) Patterns You’ll Use

- Object‑like API
  - Use `case/of` to branch on method symbols (`'get`, `'set`, `'inc`, …)
  - Keep all state as locals; mutate via `+>` or `->`

- Single‑routine coroutine
  - Body ignores the message and just resumes work each `dispatch`
  - Example: counters, generators, finite‑state machines

- Structured messages
  - Accept lists as arguments to carry multiple fields
  - Split with normal stack ops inside the body

---

## 7) Troubleshooting

- “methods outside definition” → `methods` must appear inside a `:`…`;` definition
- “dispatch on non‑capsule” → receiver must be an `RSTACK_REF` handle produced by a capsule constructor (`methods`)
- “stale capsule handle” → you used a handle after the creating frame returned; copy the capsule if it must escape
- Body never runs → check call order; it must be `args … method receiver dispatch`

---

## 8) Reference Links

- Spec: `docs/specs/capsules.md`
- Locals & references: `docs/learn/local-vars.md`, `docs/learn/refs.md`
- Lists (reverse layout): `docs/learn/lists.md`
- VM frames: `docs/learn/stack-frames.md`

Capsules give you object‑like expressiveness without leaving the stack discipline: fast to make, cheap to pass, and easy to reason about.
