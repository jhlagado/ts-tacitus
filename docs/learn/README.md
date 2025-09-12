# Learn Orientation

Start here to get productive quickly. Specs are authoritative; this “learn” section summarizes and links to them.

Essentials
- Core invariants: `docs/specs/core-invariants.md`
- VM architecture: `docs/specs/vm-architecture.md`
- Tagged values: `docs/specs/tagged.md`
- Variables & refs (locals + globals): `docs/specs/variables-and-refs.md`
- Lists (representation, traversal, bracket paths): `docs/specs/lists.md`
- Errors & failures: `docs/specs/errors-and-failures.md`

Notation
- Stack effects `( before — after )` are documentation only. In code fences, they are written as `\ ( — … )` so examples are valid Tacit.
- Tacit comments use backslash `\` to end-of-line. `//`, `#`, and `;` are not comment markers.
- Blocks `{ … }` push a code reference; they do not execute without `eval`.

Learning Guide (source files)
- Core: `src/core/vm.ts`, `src/core/tagged.ts`, `src/core/list.ts`, `src/core/refs.ts`
- Lists ops: `src/ops/lists/query-ops.ts`
- Locals init/transfer: `src/ops/builtins.ts` (Reserve/InitVar), `src/ops/local-vars-transfer.ts`
- Parser/Interpreter: `src/lang/parser.ts`, `src/lang/interpreter.ts`
