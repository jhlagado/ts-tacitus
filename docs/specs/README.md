# Specs Orientation

Start here to get a zero-to-productive overview. Read in this order:

- core-invariants.md — Canonical rules used across all specs
- vm-architecture.md — Memory layout, execution model, frames & BP
- tagged.md — Tagged values and CODE meta semantics
- variables-and-refs.md — Locals, globals, references, assignment, +>
- lists.md — Reverse lists, traversal, bracket paths, addressing
- errors-and-failures.md — Error policy and messages

Quick Reference
- quick-reference.md — One‑page cheatsheet of common patterns and lowerings

Drafts and future work live under `drafts/`.

---

## Stack Primer (for humans and LLMs)

Tacit uses a data stack for computation. Understanding stack mechanics is critical.

Top-of-Stack (TOS)
- Rightmost item in diagrams is always TOS. Stack grows to the right in examples.
- Operations consume from TOS and produce to TOS.

Stack effects
```tacit
( before — after )
dup   ( a — a a )
swap  ( a b — b a )
drop  ( a — )
add   ( a b — a+b )   \ b is TOS
```

Immediate execution (RPN)
- Operations execute as they appear; no argument collection phase.
- Fixed arity is mandatory: each op knows exactly how many items it consumes.

LIFO output is normal
```tacit
1 2 3        \ stack: [ 1 2 3 ] (3 is TOS)
. . .        \ prints: 3 2 1
```

Registers (cells)
- SP: data stack pointer; RSP: return stack pointer; BP: frame base pointer. All are cell-indexed; bytes only at memory boundaries.

References and values
- Stack ops treat refs as opaque values; structure-aware ops dereference as needed.
- Use `load` for value-by-default; use `fetch` for strict address reads.

Notation
- Stack effects `( before — after )` are documentation only. Inside code fences they are written as `\ ( — … )` so examples remain valid Tacit.
- Tacit comments use backslash `\` to end-of-line. `//`, `#`, and `;` are not comment markers.

### Visualization

```tacit
Stack grows upward (toward TOS):

[item4]  ← Bottom of Stack (BOS)
[item3]
[item2]
[item1]  ← Top of Stack (TOS)
```

Critical rule: all operations act at TOS (rightmost in effects).

### Common Operations by Arity

Nullary
```tacit
42     ( — 42 )
```

Unary
```tacit
dup    ( a — a a )
abs    ( a — |a| )
not    ( a — ¬a )
```

Binary
```tacit
add    ( a b — a+b )
sub    ( a b — a-b )
mul    ( a b — a*b )
div    ( a b — a/b )
```

Stack manipulation
```tacit
drop   ( a — )
swap   ( a b — b a )
over   ( a b — a b a )
rot    ( a b c — b c a )
```

### Critical Mental Model Rules

1) Immediate execution vs collection
- RPN executes immediately (`1 2 + 3 +`), not like `(+ 1 2 3)`.

2) LIFO output is normal
- `1 2 3` prints as `3 2 1` with `. . .`.

3) TOS is always rightmost
- Effects read right-to-left at TOS.

4) Fixed arity is mandatory
- Operations must know consumption counts; true variadics use length prefixes, sentinels, or list collection.

### Workarounds for Variable Arity

Length prefix
```tacit
1 2 3 4  4 sum-n
```

Sentinel
```tacit
1 2 3 4 nil sum-until-nil
```

Collection
```tacit
1 2 3 4 →list sum-list
```

### Composition
```tacit
( — a )  ( a — b )  ( b — c )  ≡  ( — c )
```

### Tacit-Specifics

Tagged values
- 32-bit NaN-boxing; see tagged.md.

Code blocks
Immediate control words such as `if … else … ;` execute during parsing to generate the required bytecode.
- Blocks are references; execute via `eval`.

Symbols
```
@add           \ ( — symbol-ref )
```
- `@symbol` yields BUILTIN/CODE; `eval` executes.

### Pitfalls (Quick)

1) Index confusion — TOS is not index 0
2) Direction errors — rightmost is TOS
3) Execution model — immediate, fixed arity
4) Output confusion — LIFO is correct
5) Variadic assumptions — use prefixes/sentinels/lists
6) Arity mistakes — count inputs
7) Composition errors — ensure outputs feed next inputs
8) Side effects — track what remains on stack

### Verification Strategies (Quick)

1) Draw stack states before/after
2) Count arity and types
3) Trace data flow step-by-step
4) Verify composition
5) Test edge cases (empty stack, single item)

---

Learning Guide (source files)
- Core: `src/core/vm.ts`, `src/core/tagged.ts`, `src/core/list.ts`, `src/core/refs.ts`
- Lists ops: `src/ops/lists/query-ops.ts`
- Locals init/transfer: `src/ops/builtins.ts` (Reserve/InitVar), `src/ops/local-vars-transfer.ts`
- Parser/Compiler/Interpreter: `src/lang/parser.ts`, `src/lang/interpreter.ts`
