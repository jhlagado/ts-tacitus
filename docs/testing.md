# Tacit Testing Tutorial

This tutorial shows how to write high‑quality, spec‑aligned tests for Tacit. It inlines
representative examples from the existing Jest suites and ties them to the authoritative
specs in `docs/specs/**`.

Use this as a cookbook when adding coverage: copy the patterns, tweak the snippets, and keep
tests small, direct, and behaviour‑focused.

## Contents (maps sections → specs/tests)

- [Harness: Execute Snippets Like a User](#s-harness) — specs: [VM architecture](./specs/vm-architecture.md); tests: [`src/test/utils/`](../src/test/utils/)
- [Always Reset VM State](#s-reset) — specs: [VM architecture](./specs/vm-architecture.md)
- [Decode Tagged Values (NaN‑Boxing)](#s-tagged) — specs: [tagged.md](./specs/tagged.md); tests: [`src/test/core/tagged.test.ts`](../src/test/core/tagged.test.ts)
- [Globals and Assignment](#s-globals) — specs: [variables-and-refs.md](./specs/variables-and-refs.md); tests: [`src/test/lang/globals.basic.test.ts`](../src/test/lang/globals.basic.test.ts)
- [Lists: Size, Addressing, Structure](#s-lists) — specs: [lists.md](./specs/lists.md); tests: [`src/test/ops/lists/**`](../src/test/ops/lists)
- [Stack Ops: Verify Stack Effects](#s-stack-ops) — primer: [specs/README.md](./specs/README.md); tests: [`src/test/ops/stack/**`](../src/test/ops/stack)
- [Printing and REPL Output](#s-printing) — tests: [`src/test/ops/print/print-operations.test.ts`](../src/test/ops/print/print-operations.test.ts)
- [VM State Snapshots (When You Need Them)](#s-snapshots) — tests: [`src/test/utils/vm-state-snapshot.test.ts`](../src/test/utils/vm-state-snapshot.test.ts)
- [Checklist (Spec‑First Workflow)](#s-checklist) — spec-first workflow summary
- [Common Pitfalls and How to Avoid Them](#s-pitfalls) — quick reference
- [Command cheatsheet (Jest/Yarn)](#s-commands) — quick Jest/Yarn invocations
- [Deep Dives](#s-deep-dives) — advanced, optional suites

<a id="s-prereq"></a>

## Prerequisites & Objectives

Before you start:

- Skim [Stack Primer](./specs/README.md) and [Core invariants](./specs/core-invariants.md).
- Know how to run tests (`yarn test`) and filter by name/path with Jest flags.

Objectives of this tutorial:

- Understand the stack model and fixed‑arity execution well enough to predict stack effects.
- Write end‑to‑end Tacit tests that mirror real usage and validate observable behaviour.
- Decode and assert on tagged values and heap records when needed (without brittle checks).
- Navigate and extend suites across core, lists, variables/refs, and printing.

<a id="s-harness"></a>

## Harness: Execute Snippets Like a User

Tacit tests are end‑to‑end by default. Drive behaviour by executing Tacit snippets instead of
poking internals.

- Core helpers (from `src/test/utils/vm-test-utils.ts`):
  - `executeTacitCode(code: string): number[]` — run a snippet and return the final data stack.
  - `testTacitCode(code: string, expected: number[])` — convenience assertion for final stack.
  - `executeTacitWithState(code: string)` — capture `stack`, `RSP`, `BP` after execution.
  - `captureTacitOutput(code: string)` — capture print output for CLI/REPL tests.

Example (globals; spec: `variables-and-refs.md`):

```ts
// src/test/lang/globals.basic.test.ts
const result = executeTacitCode(`
  100 global a
  a
`);
expect(result).toEqual([100]);
```

Integration sequence (locals; spec: `variables-and-refs.md §4–7`):

```ts
// src/test/lang/end-to-end-local-vars.test.ts
const state = executeTacitWithState(`
  : sum2  value var x  value var y  x y add ;
  3 4 sum2
`);
expect(state.stack).toEqual([7]);
```

Keep snippets minimal: one behaviour per test. Compose when you must, but reset between
scenarios (see next section).

Tips

- Prefer `testTacitCode` for single‑effect checks; use `executeTacitCode` when you’ll decode
  tags or inspect state.
- Keep snippets self‑contained. If you define a word (`: f … ;`), call it in the same snippet
  to avoid cross‑test coupling.
- Use Tacit comments (`#`) sparingly inside snippets to keep stack traces readable.
- For long flows, split into multiple tests with fresh resets so failures isolate cleanly.

### Failure diagnostics (fast feedback)

- Prefer black‑box capture first: `captureTacitOutput(code)` alongside expected stack to spot mismatches quickly.
- When a snippet fails, snapshot minimal state:

```ts
// Quick inspection pattern in a failing test
const state = executeTacitWithState('1 2 add');
// eslint-disable-next-line no-console
console.log({ stack: state.stack, rsp: state.rsp, bp: state.bp });
expect(state.stack).toEqual([3]);
```

- Use `raw` printing from Tacit to reveal tags/addresses without touching internals:

```ts
expect(captureTacitOutput('( 1 ( 2 3 ) ) raw').length).toBeGreaterThan(0);
```

- Iterate fast with targeted runs and test name filters (see Commands cheatsheet below).

### Practice: Harness + Reset

Read

- This tutorial sections above (Harness and Reset) and the Stack Primer in specs/README.

Do

- Add one new single‑behaviour test to a stack op suite (e.g., `src/test/ops/stack/dup.test.ts`) using `testTacitCode` or `executeTacitCode`.
- Ensure `beforeEach(resetVM)` is present and include a short comment why it’s required.

Verify

```bash
# Run the new suite, then the full run
yarn test src/test/ops/stack/dup.test.ts
yarn test
```

Tips

- Keep Tacit programs tiny (1–3 lines) so intent stays clear.
- Name tests by behaviour ("tuck places TOS under NOS"), not implementation ("calls tuckOp").

<a id="s-reset"></a>

## Always Reset VM State

The VM is a singleton; start each test with a clean slate.

```ts
// Pattern used across suites
beforeEach(() => {
  resetVM();
});
```

For isolated units (symbol table, digest), construct fresh instances:

```ts
// src/test/strings/symbol-table-shadowing.test.ts
const memory = new Memory();
const digest = new Digest(memory);
const symbolTable = new SymbolTable(digest);
```

Why it matters: Without a reset, GP/digest offsets drift and tests become flaky, especially
for heap/dictionary assertions (specs: `vm-architecture.md`).

What `resetVM()` resets (orientation)

- Pointers: `SP`, `RSP`, `BP`, `IP`, compiler pointers `BCP`/`CP`
- Flags/counters: `running`, `listDepth`
- Global window: clears the global segment and resets `GP`
- Compiler state: clears buffers and dictionary head sentinel

Tips

- If you mix direct VM pushes (`vm.push`) and Tacit execution, perform pushes immediately
  before the op under test; avoid interleaving with parser/compiler calls.
- Tests that intentionally leave state dirty should live in their own `describe` with explicit
  cleanup in `afterEach`.

See also: [Known Issues](../KNOWN_ISSUES.md) for context on isolation problems and why resets are mandatory.

<a id="s-tagged"></a>

## Decode Tagged Values (NaN‑Boxing)

Never compare raw NaN‑boxed floats. Decode first (spec: `tagged.md`).

```ts
// src/test/core/tagged.test.ts
const encoded = Tagged(123, Tag.CODE);
const { tag, value } = getTaggedInfo(encoded);
expect(tag).toBe(Tag.CODE);
expect(value).toBe(123);
```

Symbol table locals vs globals (compile‑time `LOCAL`):

```ts
// src/test/strings/symbol-table-shadowing.test.ts
const resolved = symbolTable.findTaggedValue('x');
expect(resolved).toBeDefined();
const { tag, value } = getTaggedInfo(resolved!);
expect(tag).toBe(Tag.LOCAL);
expect(value).toBe(0);
```

Prefer effect‑based assertions (stack contents, lengths) when possible to avoid NaN pitfalls.

Do / Don’t (tagged values)

- Do: `const { tag, value } = getTaggedInfo(v)` when asserting on type/payload.
- Do: `const { tag } = getTaggedInfo(v)` for a quick tag check when payload is irrelevant.
- Don’t: compare NaN‑boxed values directly with `toBe`/`toEqual` — payload bits collapse.
- Don’t: pass boxed values into helpers that compare numerics without decoding first.

Low‑level assertions (rare)

```ts
// Use raw cell reads only in low‑level suites
const cell = vm.memory.readFloat32(segment, cellIndex * CELL_SIZE);
const { tag, value } = getTaggedInfo(cell);
expect(tag).toBe(Tag.LIST);
```

Optional helper (keep local to tests)

```ts
// Tiny helper to assert tag/payload without repeating decode calls
const expectTagged = (v: number, tag: Tag, payload?: number) => {
  const decoded = getTaggedInfo(v);
  expect(decoded.tag).toBe(tag);
  if (payload !== undefined) expect(decoded.value).toBe(payload);
};

// Usage
const codeRef = Tagged(42, Tag.CODE);
expectTagged(codeRef, Tag.CODE, 42);
```

### Practice: Tagged values

Read

- [Tagged values spec](./specs/tagged.md).

Do

- Replicate a simple tag round‑trip from `src/test/core/tagged.test.ts` and add one more case (e.g., another SENTINEL boundary or CODE builtin upper bound).
- Add an effect‑based assertion to a list test using `src/test/ops/lists/list-spec-compliance.test.ts`; assert lengths/sizes for a new nested shape instead of raw structure.

Verify

```bash
# Quick focused run
yarn test src/test/core/tagged.test.ts
```

Tips

- Centralize any helper you need for tags; don’t re‑roll decoders in each test.
- When asserting payload boundaries, add both boundary and out‑of‑range cases.

<a id="s-globals"></a>

## Globals and Assignment

Spec: `variables-and-refs.md (§3, §5–6, §8)`

Declare, read, assign:

```ts
// src/test/lang/globals.basic.test.ts
expect(
  executeTacitCode(`
  5 global g
  200 -> g
  g
`),
).toEqual([200]);
```

Compound init, bracket‑path write, and compatibility errors:

```ts
// src/test/lang/globals.basic.test.ts
expect(
  executeTacitCode(`
  ( 1 2 ) global xs
  9 -> xs[0]
  xs length
`)[0],
).toBe(2); // length unchanged (in‑place update)

expect(() =>
  executeTacitCode(`
  ( 1 2 ) global xs
  ( 1 2 3 ) -> xs
`),
).toThrow(/Incompatible compound assignment/);

expect(() =>
  executeTacitCode(`
  ( 1 2 ) global xs
  42 -> xs
`),
).toThrow(/Cannot assign simple to compound/);
```

Heap structure assertions (dictionary node layout):

```ts
// src/test/lang/globals.basic.test.ts
resetVM();
parse(new Tokenizer(`100 global alpha`));
execute(vm.compiler.BCP);
const entryRef = vm.symbolTable.getDictionaryEntryRef('alpha');
const { segment, cellIndex } = decodeDataRef(entryRef!);
expect(segment).toBe(SEG_GLOBAL);
const payload = vm.memory.readFloat32(SEG_GLOBAL, (cellIndex - 3) * CELL_SIZE);
expect(payload).toBe(100);
```

Tips

- Reads are value‑by‑default; writes require an address. Model globals with `name`/`&name`
  to mirror compiler lowering.
- For bracket‑path writes, prefer destination forms that compile to an address:
  `value -> x[ … ]` (locals) and `value -> name[ … ]` (globals).
- When asserting errors, match a stable phrase with regex (e.g., `/Cannot assign simple/`).

Locals parity example (mirror globals semantics)

```ts
// src/test/ops/local-vars/locals-parity.test.ts
const stack = executeTacitCode(`
  : bump2  value var x  value var y
    10 -> x   20 -> y
    x y add
  ;
  bump2
`);
expect(stack).toEqual([30]);

// Read‑modify‑write with locals is explicit; prefer +> inside functions
const s2 = executeTacitCode(`
  : incx  value var x  1 x +> x  x ;
  5 incx
`);
expect(s2).toEqual([6]);
```

### Practice: Variables and Paths

Read

- [Variables and refs](./specs/variables-and-refs.md) (§3, §5–6, §8) and [Lists](./specs/lists.md) (§8–12).

Do

- Extend `src/test/lang/globals.basic.test.ts` with a new compatible compound write (same slot count) and an explicit mismatch error, mirroring existing expectations.
- Add a bracket‑path write targeting a nested element: e.g., initialize `( (1 2) (3 4) ) global xs`, then `9 -> xs[1 0]`; assert size unchanged and correct fetch via `elem`.

Verify

- Demonstrate both success and failure paths with precise error messages.

Tips

- For globals, prefer explicit RMW (`value name add -> name`) for numeric updates; reserve `+>` for locals inside functions.
- Add one case where a read path is liberal (returns `NIL`) but the write path errors for the same invalid selection to highlight semantics.

<a id="s-lists"></a>

## Lists: Size, Addressing, Structure

Spec: `lists.md (§9 size, §10 addressing, §12 structure, §20 laws)`

Size vs length:

```ts
// src/test/ops/lists/list-spec-compliance.test.ts
expect(executeTacitCode('( 1 ( 2 3 ) 4 ) length')[0]).toBe(5);
expect(executeTacitCode('( 1 ( 2 3 ) 4 ) size')[0]).toBe(3);
```

Addressing with `slot`/`elem` and `fetch`:

```ts
// src/test/ops/lists/query/addressing-slot-elem.test.ts
const stack = executeTacitCode('( 10 20 30 ) 1 slot fetch');
expect(stack.at(-1)).toBe(20);
```

Structural ops `head`/`tail`/`concat`:

```ts
// src/test/ops/lists/list-spec-compliance.test.ts
const head = executeTacitCode('( 1 2 3 ) head').at(-1)!;
expect(getTaggedInfo(head).value).toBe(1);

const packed = executeTacitCode('0 pack').at(-1)!;
expect(getTaggedInfo(packed).value).toBe(0);

const restored = executeTacitCode('1 2 3 3 pack unpack');
expect(restored).toEqual(executeTacitCode('1 2 3'));
```

Tips

- Length vs size: use `length` to test payload slot math; use `size` to test logical element
  traversal. Use both on nested lists.
- Addressing bounds: add negative and out‑of‑range indices; reads should yield `NIL` where
  specified, writes should throw for invalid destinations.
- Compound writes through paths: verify slot counts match; test both success and error paths.

### Practice: Lists

Read

- [Lists](./specs/lists.md) (§9 size, §10 addressing, §12 structure, §20 laws).

Do

- Add a `slot`/`elem` addressing test (see `src/test/ops/lists/query/addressing-slot-elem.test.ts`) that fetches a nested element and verifies its value.
- Add a simple algebraic law check: `1 ( 2 3 ) concat tail` restores `( 2 3 )` (template in `list-spec-compliance.test.ts`).

Verify

- Keep assertions to observable behaviour; avoid re‑creating list layout manually.

Tips

- For nested lists, sketch payload/header layout once to avoid index confusion.
- Add explicit out‑of‑bounds `elem` read and invalid `store` destination cases.

<a id="s-stack-ops"></a>

## Stack Ops: Verify Stack Effects

Spec orientation: `specs/README.md` Stack Primer.

Test the observable stack before/after, including lists:

```ts
// src/test/ops/stack/tuck.test.ts
resetVM();
vm.push(10);
vm.push(20);
vm.push(30);
tuckOp(vm);
expect(vm.getStackData()).toEqual([10, 30, 20, 30]);

// List + value
const s1 = executeTacitCode('( 10 20 ) 42 tuck');
expect(s1.filter(x => x === 42).length).toBe(2);
```

For stack ops, refs are opaque values; no implicit deref (spec: `variables-and-refs.md §5`).

Tips

- Add comments with stack effects near snippets (`# ( a b — b a )`).
- For underflow, also assert `SP` unchanged after the error to verify exception safety.
- Assert on final stack not intermediate states unless semantics require it.

<a id="s-printing"></a>

## Printing and REPL Output

Specs: Formatting is implementation‑defined; behaviour is captured by tests.

High‑level `.` prints values; low‑level `raw` prints tags/addresses:

```ts
// src/test/ops/print/print-operations.test.ts
expect(captureTacitOutput('123 .')).toEqual(['123']);
expect(captureTacitOutput('( 1 2 ) .')).toEqual(['( 1 2 )']);

const raw = captureTacitOutput('( 1 ( 2 3 ) 4 ) raw');
expect(raw.length).toBeGreaterThan(0); // tagged representation
```

Error handling keeps the stack consistent and reports clearly:

```ts
// when stack underflows for '.'
expect(captureTacitOutput('.')).toEqual(['[Error: Stack empty]']);
```

Tips

- Prefer `captureTacitOutput` for black‑box checks; use spies when you need call counts or to
  inject failures, restoring them in `afterEach`.
- Keep formatting expectations broad enough to tolerate small whitespace changes; assert on
  content/ordering rather than exact spacing.

### Practice: Printing & REPL

Read

- Printing is implementation‑defined; follow tests in `src/test/ops/print/print-operations.test.ts` and REPL suites.

Do

- Add a `captureTacitOutput` example mixing `raw` and `.`; assert lines and ordering.
- Add an error test (`.` on empty stack) and ensure the stack remains consistent in follow‑up operations.

Verify

- Prefer `captureTacitOutput` over ad‑hoc spies unless you need call counts.

Tips

- Ensure spies are restored in `afterEach` to avoid cross‑test coupling.
- Avoid asserting exact JSON/stringify forms that may evolve; assert key substrings.

<a id="s-snapshots"></a>

## VM State Snapshots (When You Need Them)

For deeper inspection (e.g., frames, RSP), snapshot helpers are available:

```ts
// src/test/utils/vm-state-snapshot.test.ts
const state = executeTacitWithState('1 2 add');
expect(state.stack).toEqual([3]);
expect(state.rsp).toBe(0);
expect(state.bp).toBe(0);
```

Prefer stack‑only checks unless frame/heap details matter.

Tips

- Snapshot when necessary (frame layout, RSP/BP invariants); over‑use adds noise.
- Return stack is cell‑indexed; use `CELL_SIZE` for byte computations and watch `BP`
  off‑by‑ones.

<a id="s-checklist"></a>

## Checklist (Spec‑First Workflow)

Follow this sequence for each new test:

1. Read the relevant spec (`docs/specs/**`) and note edge cases.
2. Reset state (`resetVM()` or fresh instances for isolated units).
3. Drive via Tacit snippets; keep one behaviour per test.
4. Decode tagged values (`getTaggedInfo`) — never compare boxed NaNs. Access tag/value via destructuring: `const { tag, value } = getTaggedInfo(tagged)`.
5. Inspect heap deliberately when needed (`decodeDataRef`, compute offsets carefully).
6. Cover success and failure paths (`expect(() => …).toThrow(/…/)`).
7. Run `yarn test` to catch regressions immediately.

Team habits and CI tips

- Use `yarn test -t "<name>"` or a file path during development for quick iteration.
- Before pushing, run `yarn test` and then `yarn lint && yarn format`.
- Aim for 80%+ coverage by adding behaviour‑oriented tests alongside features.

<a id="s-pitfalls"></a>

## Common Pitfalls and How to Avoid Them

- TOS is rightmost; stack grows upward (spec: `specs/README.md`). Draw before/after states.
- Variadics require explicit length/sentinel/list collection — fixed arity otherwise.
- Value‑by‑default: stack ops do not deref; structure‑aware ops and `load/fetch/store` do (spec: `variables-and-refs.md`).
- NaN collapse in Jest: decode before compare (spec: `tagged.md`).
- Missing resets: random GP/digest drift. Always call `resetVM()` in `beforeEach`.

More pitfalls

- Mixing direct VM API and Tacit in one test without careful ordering can invalidate
  parser/compiler state. Keep direct VM pushes adjacent to the op under test.
- Relying on absolute heap cell addresses is brittle; prefer relative offsets from decoded
  refs and assert only needed fields.
- Asserting exact error strings increases maintenance cost; match key phrases with regex.

---

<a id="s-commands"></a>

## Command cheatsheet (Jest/Yarn)

Common commands for fast iteration:

```bash
# Run a single suite
yarn test src/test/ops/stack/dup.test.ts

# Filter by test name substring
yarn test -t "tuck places TOS under NOS"

# Run everything
yarn test

# Watch mode (if enabled in your environment)
yarn test --watch
```

---

<a id="s-deep-dives"></a>

## Deep Dives (optional)

- Heap structures: replicate the dictionary entry walk from `src/test/lang/globals.basic.test.ts` and confirm `prev` chaining.
- Compiler/bytecode: study `src/test/lang/compiler-coverage.test.ts` and add a small opcode‑sequence assertion for a path or list literal.
- Capsules: follow `docs/specs/capsules.md` (if enabled) and mirror `src/test/lang/capsules/*.test.ts` to add a constructor/dispatch example.

Tips

- Deep‑dive suites are more sensitive to refactors; keep assertions high‑level and decode only what you need.

---

See also

- [Lists](./specs/lists.md) — stack representation, traversal, addressing, and structural laws
- [Tagged values](./specs/tagged.md) — NaN‑boxing layout, tags, payloads, invariants
- [Variables and refs](./specs/variables-and-refs.md) — locals/globals, addresses, assignment
- [VM architecture](./specs/vm-architecture.md) — memory model, stacks, frames, execution

---

Reference Map (by domain)

- Stack ops: `src/test/ops/stack/*.test.ts`
- Lists (build/query/structure): `src/test/ops/lists/**.test.ts`
- Variables/locals/globals: `src/test/ops/local-vars/*.test.ts`, `src/test/lang/globals.basic.test.ts`
- Printing/REPL: `src/test/ops/print/print-operations.test.ts`, `src/test/lang/repl.test.ts`
- Core/tagged/memory: `src/test/core/*.test.ts`
- Compiler/parser: `src/test/lang/compiler*.test.ts`, `src/test/lang/parser*.test.ts`

Success Criteria

- Each new test follows the spec‑first checklist, resets state, and asserts on observable
  behaviour with minimal internal poking.
- New tests reuse helpers and match existing assertion style.
- Coverage improves without introducing brittle heap/tag equality.
