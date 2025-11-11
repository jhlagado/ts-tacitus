# Learn Orientation

Start here to get productive quickly. Specs are authoritative; this “learn” section summarizes and links to them.

Essentials

- Core invariants: `docs/specs/core-invariants.md`
- VM architecture: `docs/specs/vm-architecture.md`
- Tagged values: `docs/specs/tagged.md`
- Variables & refs (locals + globals): `docs/specs/variables-and-refs.md`
- Lists (representation, traversal, bracket paths): `docs/specs/lists.md`
- Error handling notes: `docs/reference/known-issues.md`
- Control flow walkthroughs (`if`, `when`, `case`): `docs/learn/control-flow.md`

Notation

- Stack effects `( before — after )` are documentation only. In code fences, they are written as `# ( — … )` so examples are valid Tacit.
- Tacit comments use hash `#` to end-of-line. `//`, `\`, and `;` are not comment markers.

Learning Guide (source files)

- Core: `src/core/vm.ts`, `src/core/tagged.ts`, `src/core/list.ts`, `src/core/refs.ts`
- Lists ops: `src/ops/lists/query-ops.ts`
- Locals init/transfer: `src/ops/builtins.ts` (Reserve/InitVar), `src/ops/local-vars-transfer.ts`
- Parser/Interpreter: `src/lang/parser.ts`, `src/lang/interpreter.ts`

Try it (quick hands‑on)

```tacit
42 global answer
answer                # -> 42

( 10 20 ) global xs
7 -> xs[1]           # xs becomes ( 10 7 )

: inc
  0 var x
  1 +> x             # same as: 1 x add -> x
  x
;

: abs dup 0 lt if neg ; ;
-7 abs               # -> 7
```

Common pitfalls

- TOS is rightmost in stack effects and diagrams.
- Only `#` is a comment in Tacit examples; `//` and `\` are not.
