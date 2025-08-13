Status: draft

# Plan 14 — Implement `get` and `set` combinators (Access)

## Combinators introduction

  • How blocks compile
    • Parser requires a block after a combinator word. For “do”/“repeat” it peeks the next token and errors if not “{”.
    • The block is compiled first with a Branch-skip pattern, then Exit, then the parser emits a LiteralCode with the block’s start address. Blocks don’t run until
      evaluated.
    • Immediately after emitting the block literal, the parser emits the combinator opcode. At runtime the stack holds operands, then the block literal, then the combinator
       executes.
  • Runtime semantics
    • do: pops block and value, re-pushes value, then pushes the block and evals it once. Stack effect: apply the block to the value at TOS without duplicating or consuming
       extra values.
    • repeat: pops block, count, value; re-pushes value, then loops pushing/evaluating the same block count times. Count is validated as a non-negative integer.
    • Both dispatch eval via the symbol table, so the block can be a CODE or BUILTIN reference and is executed uniformly.
  • Why this fits RPN
    • Visually “x do { … }” looks infix, but it’s still postfix: operands are on stack, the block literal is compiled and pushed, then a fixed-arity opcode runs.
    • No variadic behavior or hidden context; the block produces whatever it wants, and the combinator orchestrates when/how it’s run.
  • Tests cover
    • Blocks compile and eval correctly (standalone, nested, multiple eval calls).
    • do and repeat handle empty blocks, nested combinators, and stack manipulation inside blocks.
    • Parser enforces syntax: combinators must be followed by “{ … }”.
  • Implication for get/set
    • They should follow exactly the same pattern: parser compiles the path block to a LiteralCode, then emits the get/set opcode.
    • At runtime, get/set pop target (+ value for set) and the block, eval the block to produce a path list, then perform address-returning traversal and fetch/store.
    • This keeps get/set purely combinator-based, RPN-safe, and consistent with do/repeat.

  Summary:
  • Combinators are “enhanced infix” only in appearance; the parser compiles block-then-opcode so runtime stays pure RPN.
  • do/repeat implement the model: block literal + eval under the hood.
  • get/set should mirror this exact compilation/execution flow.

## Goals
- Implement high-level `get` and `set` combinators per `docs/specs/access.md`
- Follow the combinator model used by `do` and `repeat` (block literal + opcode)
- Align with list/maplist semantics (address-returning primitives + fetch/store)
- Behavioral tests only; no tag inspection (NaN-boxing safe)

## Scope
- Parser support for `get` and `set` as combinators that require a `{ … }` path block
- Runtime ops to evaluate the path block and traverse target data
- Path semantics: numbers = list element indices; symbols = maplist keys
- Write semantics: simple-only in-place via `store`; compounds are no-op (return nil)

Non-goals (this plan)
- No structural edits (insertion/extension)
- No advanced search in dispatch (bfind/hfind) — basic traversal only
- No spec changes to `docs/specs/access.md`

## References
- `docs/specs/access.md` — combinator forms and semantics
- `docs/specs/lists.md` — list layout, elem/slot/fetch/store
- `docs/specs/maplists.md` — maplist find and default rules
- Existing combinators: `src/ops/combinators/do.ts`, `repeat.ts`
- Parser combinator handling: `src/lang/parser.ts` (`beginStandaloneBlock`, `processWordToken`)

## Stack effects
- get: `target get { path }  ->  value | nil`
- set: `value target set { path }  ->  ok | nil`

Notes
- Path block result must be a list of path items (numbers and/or symbols);
  otherwise the operation returns `nil`.
- Empty path: get returns the target unchanged; set is a no-op and returns `ok`.

## Parser changes
- In `processWordToken`:
  - When encountering `get` or `set`, require the next token to be `BLOCK_START` (`{`)
  - Compile the block using `beginStandaloneBlock(state)` (branch-skip + Exit)
  - Emit the `get` or `set` opcode
- This mirrors the pattern used for `do` and `repeat`

## Runtime ops (new file: `src/ops/access-ops.ts`)
- Register new verbs `get` and `set`
- Common flow:
  1) Ensure stack depth (2 for get; 3 for set)
  2) Pop block; pop target (and value for set)
  3) Evaluate the block (push block; call `eval`) to produce a path list
  4) Validate the path is a list; on failure push `nil` and return
  5) Traverse

### Traversal algorithm (behavioral outline)
- Input: `current = target`, `path = ( p0 p1 ... pk-1 )`
- For each item `pi` in path, left-to-right:
  - If `pi` is a number
    - Require `current` to be a list; compute the element address by traversal (element semantics)
    - If OOB/mismatch: return `nil`
    - `fetch` the element to update `current`
  - If `pi` is a symbol
    - Require `current` to be a maplist; compute the value address via `find` (default rules apply)
    - If not found and no default: return `nil`
    - `fetch` the value to update `current`
- End: for `get`, push `current` (the final value)

### Set terminal step
- After traversing to the address for the final element (last path step), perform:
  - If the target element is simple: `store value`
  - Else: no change; return `nil`
- Return `ok` sentinel on success

### Error handling & edge cases
- Non-list target when numeric index encountered → `nil`
- Non-maplist target when symbol key encountered → `nil`
- Out-of-bounds index → `nil`
- Missing key with no `default` → `nil`
- Path item not number or symbol → `nil`
- Empty path → `get`: return target; `set`: no-op, return `ok`

## Implementation notes
- Reuse existing primitives (`elem`, `find`, `fetch`, `store`) as building blocks
- Keep loops explicit and simple; avoid array methods and closures
- Do not copy large structures; operate via addresses and single-slot `fetch`/`store`
- Use `vm.ensureStackSize` aggressively; keep stack integrity on all error paths
- Dispatch block execution via unified `eval` lookup (same pattern as `do`/`repeat`)

## Tests
- Location: `src/test/ops/access/get-set.test.ts`
- Patterns (behavioral only):
  - Simple list indexing: `( 10 20 30 ) get { 1 }  ->  20`
  - Nested mixed path: `root get { `users 1 `name }  ->  "Bob"`
  - OOB index → `nil`; missing key with `default` → default value
  - Empty path: `xs get { } -> xs`; `v xs set { } -> ok`
  - set simple value: `99 ( 0 1 2 ) set { 1 }  -> ok`; then read back equals 99
  - set compound target (attempt) → `nil`, underlying structure unchanged
  - Combined chains to ensure stack discipline

## Milestones
1) Parser support (get/set recognized as combinators; blocks compile)
2) Implement `get` runtime op
3) Implement `set` runtime op
4) Unit tests for traversal and error paths
5) Integration tests on realistic nested structures
6) Lint and full test run
7) Pause for review/approval

## Acceptance criteria
- All new tests pass; no regressions (`yarn test` green)
- `yarn lint` passes
- Behavior matches `docs/specs/access.md`
- No performance cliffs (linear traversal expected; no unnecessary copies)

## Rollout & follow-ups
- Document usage examples in a separate tutorial/reference (outside this plan)
- Consider later: optional optimized find variants (bfind/hfind) consistent with access spec
