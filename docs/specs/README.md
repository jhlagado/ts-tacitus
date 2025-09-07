# Specs Orientation

Start here to get a zero-to-productive overview.

- Core invariants: docs/specs/core-invariants.md
- Quick patterns and usage are summarized inside core-invariants.md, refs.md, and local-vars.md.

Deep dives (essentials)
- Tagged values: docs/specs/tagged.md
- Lists (representation and ops): docs/specs/lists.md
- References (value-by-default model): docs/specs/refs.md
- Access (get/set over elem/find): docs/specs/access.md
- Locals and frames: docs/specs/local-vars.md

Helpful next reads
- VM architecture: docs/specs/vm-architecture.md
- Refs & polymorphism: docs/specs/refs.md

Learning Guide (source files)
- Core: `src/core/vm.ts`, `src/core/tagged.ts`, `src/core/list.ts`, `src/core/refs.ts`
- Lists ops: `src/ops/lists/query-ops.ts` (+ structure/build/query folders)
- Access ops: `src/ops/access/*`
- Locals init/transfer: `src/ops/builtins.ts` (InitVar, VarRef), `src/ops/local-vars-transfer.ts`
- Parser/Compiler: `src/lang/parser.ts`, `src/lang/compiler.ts`
