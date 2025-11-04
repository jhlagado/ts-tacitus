# Tacit VM Tagged-Value Refactor — Detailed Preamble

This plan exists because the Tacit VM currently stores every stack/heap cell as a 32‑bit IEEE‑754 float (via NaN boxing), and **`DataView.setFloat32` can canonically rewrite NaNs, collapsing payload bits**. This was observed when the global pointer `gp` exceeded 39—dictionary entries beyond certain cell indices lost their `DATA_REF` payload, causing lookups to fail.

The root cause: we're treating TAGGED values (which must never be decoded as floats) the same as genuine numbers in our storage layer. We need to separate these concerns.

We have four distinct logical value classes that all masquerade as JavaScript `number`s today:

- **NUM** — a genuine numeric value (JavaScript number). These are the actual float values used in calculations. Example: the result of `42 + 3` or `Math.sqrt(16)`.
- **ENCNUM** — an IEEE-754 float32 encoded as a 32-bit word. These bits must round-trip through `DataView.setFloat32`/`getFloat32` without loss. Example: literal `42` stored on the stack.
- **TAGGED** — our NaN-boxed tagged values (BUILTIN, LIST, STRING, DATA_REF, etc.). The sign/exponent/mantissa encode tag + payload. They _must never_ be decoded with float32 semantics; doing so destroys the tag.
- **UINT32** — raw 32-bit words (the actual memory representation). Every cell in memory is _physically_ a UINT32 (either ENCNUM or TAGGED); it only becomes NUM after the appropriate guard/decoder.

JavaScript has only one runtime number type (`number`), so the TypeScript type system must help us keep these four logical domains straight. We will introduce branded-type aliases to prevent accidental conversion or mixing:

```typescript
/**
 * Distinct branded types for the three logical representations:
 * - NUM: decoded JavaScript numeric value (compatible with `number`)
 * - ENCNUM: IEEE-754 float32 encoded as 32-bit word
 * - TAGGED: NaN-boxed tagged value
 * - UINT32: raw 32-bit word as stored in memory (union of TAGGED | ENCNUM)
 */
export type NUM = number & { readonly __kind: 'number' };
export type ENCNUM = number & { readonly __kind: 'encoded_number' };
export type TAGGED = number & { readonly __kind: 'tagged' };
export type UINT32 = TAGGED | ENCNUM;
```

The bare `number` type becomes transitional—used only for intermediate calculations before casting to NUM.

Key lessons from the abandoned migration attempt:

1. **Incremental scope** — switching everything to `writeUint32`/`readUint32` in one sweep caused cascaded regressions (formatters, tests, REPL printing). Each subsystem must be migrated in isolation with targeted verification before touching the next.
2. **Explicit decoding APIs** — callers need separate helpers for raw vs decoded views (`getStackDataRaw()` vs `getStackDataDecoded()`); otherwise tests reach into the raw storage and expect floats.
3. **Tests must assert, not log** — numerous suites relied on console output to eyeball results. Once storage changed, they seemed to pass even when behaviour regressed. Before migration, convert every "debug log" or manual inspection to explicit `expect(...)` statements.
4. **Branded types with explicit casting** — use TypeScript branded types (NUM, ENCNUM, TAGGED, UINT32) to force explicit intent at every assignment. Developers must cast `as NUM` to create numeric values, preventing accidental mixing of representations.
5. **Guard rails at runtime** — define `isTagged()`, `isEncNum()` type guards and refuse to decode float values unless the guard passes. Attempting to treat a tagged word as ENCNUM should throw instead of silently decoding garbage.
6. **Document conversion rules** — we only convert `UINT32 → NUM` when `isEncNum(word)` (i.e., not NaN-boxed). Tagged words are moved/stored as raw UINT32, never decoded as numbers.

This preamble must _not_ be trimmed during context window compression; it is the authoritative reminder of the separation between runtime representations and the staged approach we must follow.

#

## Status

- Stage: Draft (pending review)
- Owner: Core Runtime
- Last Updated: 2025-11-04

## 1. Context

- Current tagged-value encoding relies on IEEE-754 NaN boxing.
- JS `DataView.setFloat32` can canonically rewrite NaNs, collapsing payload bits (observed when `gp` exceeded 39).
- Result: dictionary entries beyond certain cell indices lose their `DATA_REF` payload and lookups fail.
- Objective: retain single-word 32-bit layout while eliminating dependence on float conversions for tagged values.
- Previous exploratory work attempted a direct flip to raw `uint32` writes and exposed a number of regressions (stack printers, tests that snapshot floats, etc.). This plan captures the lessons learned:
  - Tread incrementally, validating after each sub-step with focused suites before touching downstream helpers.
  - Keep NaN-boxed behaviour available until a caller has explicitly opted into the new helpers (e.g. provide both `getStackDataRaw()` and `getStackDataDecoded()` during migration).
  - Identify and remove console-based “debug” assertions before changing storage so that failing tests surface via expectations instead of noisy logs.

## 2. Goals

- Store tagged values as raw 32-bit integers end-to-end; only convert to/from NUM when operating on genuine numbers.
- Use branded TypeScript types (NUM, ENCNUM, TAGGED, UINT32) to enforce explicit casting and prevent accidental mixing.
- Preserve compatibility with existing tag layout (sign bit/meta, tag bits, payload).
- Avoid double registration regressions by maintaining deterministic dictionary state.
- Ensure approach is portable to C/asm implementation later.

## 3. Non-Goals

- Do not redesign tag ranges or payload semantics.
- No change to Tacit language-level behavior.
- No change to memory segment sizes.
- Avoid tackling performance tuning until correctness is restored.

## 4. High-Level Strategy

1. Introduce branded types (NUM, ENCNUM, TAGGED, UINT32) to `src/core/tagged.ts`.
2. Audit all code paths that write/read tagged values (stack, heap, dictionary, arithmetic ops, debug tools, tests).
3. Introduce new encode/decode helpers that operate on UINT32 (raw bitpack) and only call float conversion when `isEncNum()` returns true.
4. Replace `DataView.setFloat32/getFloat32` usage for tagged values with `setUint32/getUint32`.
5. Update arithmetic/compare helpers to work with NUM type explicitly (`toNUM`/`fromENCNUM`) when needed.
6. Adjust tests & utilities (e.g., `extractListFromStack`, dictionary dumps) to work with raw UINT32 arrays.
7. Remove ad-hoc logging instrumentation once stability is verified.

## 5. Detailed Steps

### Phase A — Inventory & Audit

- [ ] Build inventory of all `writeFloat32`, `readFloat32`, `push`, `gpush`, `registerBuiltins` usage (src/core, ops, test utils).
- [ ] Trace stack operations (`VM.push`, `VM.pop`, `VM.getStackData`) to understand data flow and document which callers expect decoded floats vs raw words.
- [ ] Catalogue tests or debug helpers that rely on console output or direct comparisons with NaN-tagged sentinels; convert them to assertion-based expectations before storage work starts.
- [ ] Identify any direct JS arithmetic done on raw stack values.
- [ ] Document interactions in `docs/plans/draft/plan-45-tagged-values-integer-storage.md` (this file).

#### Phase A Inventory Snapshot

- **Core runtime**
  - `src/core/vm.ts` – `push`, `pop`, `peek`, `gpush`, `rpush`, etc. all route through `memory.writeFloat32/readFloat32`.
  - `src/core/memory.ts` – sole implementation of `writeFloat32`/`readFloat32`.
  - `src/core/global-heap.ts`, `src/core/refs.ts`, `src/core/dictionary.ts`, `src/core/list.ts`, `src/core/format-utils.ts`, `src/core/units.ts` all read/write cells via float32 APIs today.
- **Ops layer**
  - Stack shuffles (`src/ops/stack/data-move-ops.ts`), list builders/query/structure (`src/ops/lists/**`), broadcast helpers (`src/ops/broadcast.ts`), dictionary ops (`src/ops/dict.ts`), capsules/local-vars (`src/ops/capsules/**`, `src/ops/local-vars-transfer.ts`), builtins (`src/ops/builtins.ts`) all manipulate stack/global cells with float reads/writes.
  - Compiler emits bytecode using `memory.writeFloat32` (`src/lang/compiler.ts`).
- **Tests & utilities**
  - `src/test/utils/core-test-utils.ts`, `src/test/utils/vm-test-utils.ts`, and numerous suites under `src/test/core/**`, `src/test/ops/**`, `src/test/lang/**` call `readFloat32`/`writeFloat32` directly to seed fixtures or assert on raw cells.
  - Many tests snapshot stack contents via `vm.getStackData()` and assume decoded floats.
- **Push/register usage**
  - All opcode implementations call `vm.push`/`vm.pop` which in turn rely on float32 writes.
  - Builtins are registered through `src/op/builtins-register.ts`, which today pushes float-based tagged values.

### Phase B — Helper Refactor

- [ ] Add branded type definitions to `src/core/tagged.ts`:
  ```typescript
  export type NUM = number & { readonly __kind: 'number' };
  export type ENCNUM = number & { readonly __kind: 'encoded_number' };
  export type TAGGED = number & { readonly __kind: 'tagged' };
  export type UINT32 = TAGGED | ENCNUM;
  ```
- [ ] Provide type guard helpers:
  - `isTagged(u: UINT32): u is TAGGED` — checks if UINT32 is NaN-boxed
  - `isEncNum(u: UINT32): u is ENCNUM` — checks if UINT32 is encoded number
- [ ] Provide conversion helpers:
  - `toENCNUM(n: NUM): ENCNUM` — encode NUM to ENCNUM (DataView.setFloat32)
  - `fromENCNUM(e: ENCNUM): NUM` — decode ENCNUM to NUM (DataView.getFloat32)
- [ ] Modify `toTaggedValue` to return TAGGED (raw UINT32, no float conversion).
- [ ] Modify `fromTaggedValue` to accept UINT32 and return `{tag, value, meta}` without intermediate float (use float only if `isEncNum()`).
- [ ] Ensure `Tag.NUMBER` path stores canonical ENCNUM representation.
- [ ] Update all numeric operation signatures to use NUM instead of bare `number`.

### Phase C — Memory API Update

- [ ] Introduce `writeUint32`/`readUint32` helpers in `memory.ts` without replacing existing float APIs; migrate call sites one subsystem at a time.
- [ ] Update `VM#gpush`, `VM#push`, dictionary defines, heap-copy routines to use UINT32, validating after each migration with focused suites (e.g. dictionary, lists, local-vars).
- [ ] Add explicit stack-accessors (`getStackDataRaw(): UINT32[]`, `getStackDataDecoded(): NUM[]`) so tests can opt-in to decoded views while production code moves to raw words.
- [ ] Update `VM#getStackData` clients & tests to decode as needed, favouring helper utilities rather than ad-hoc conversions inside tests.

### Phase D — Arithmetic & Ops

- [ ] Audit all math ops in `src/ops/**` to make sure they decode to NUM before arithmetic (using `fromENCNUM`) and re-encode afterwards (using `toENCNUM`); gate each cluster with targeted tests before continuing.
- [ ] Update comparison/logic ops similarly to work with NUM.
- [ ] Ensure broadcast helpers, list ops decode/encode correctly, documenting any shared helpers created to avoid future duplication.

### Phase E — Tests & Utilities

- [ ] Update `vm-test-utils` (such as `extractListFromStack`, `dumpDictionaryHead`) to operate on raw bits.
- [ ] Adjust test assertions that compared floats directly; convert via helper before comparing.
- [ ] Add targeted regression tests documenting the 39→47 failure.
- [ ] Remove temporary logging instrumentation.

### Phase F — Verification & Cleanup

- [ ] Run entire test suite; add targeted test covering dictionary entries at `gp` > 39.
- [ ] Validate that `lookup` works for deep dictionary entries and capsules.
- [ ] Update docs (`docs/specs/tagged.md`) to describe raw integer storage model.
- [ ] Clean up plan & promote from draft once validated.

## 6. Risks & Mitigations

- **Risk:** Missing a float conversion path => silent regressions.  
  _Mitigation:_ exhaustive inventory, branded types force explicit casting (`as NUM`, `as ENCNUM`, `as TAGGED`).
- **Risk:** Performance regression due to extra conversions.  
  _Mitigation:_ profile critical loops; inline helpers where necessary.
- **Risk:** Test brittleness with raw ints.  
  _Mitigation:_ centralize decode helpers in test utilities; provide both raw and decoded views.
- **Risk:** Incomplete removal of debug instrumentation (e.g., `dumpDictionaryHead`).  
  _Mitigation:_ track clean-up in Phase F checklist.
- **Risk:** Tests that rely on console logging or implicit NaN comparisons will pass silently while functionality regresses.  
  _Mitigation:_ convert those tests to explicit expectations during Phase A so later phases surface real regressions.

## 7. Open Questions

- Should stack internally store UINT32 or keep dual views (`Float32Array` + `Uint32Array`)? (Default plan: `Uint32Array` only.)
- Do we need a transitional adapter for existing modules to prevent double conversion?
- Should we provide escape hatches for legacy code during migration, or force complete cutover per subsystem?

## 8. Next Actions

- [ ] Review this plan with maintainers, highlighting the incremental checkpoints and lessons from the previous attempt.
- [ ] Once approved, promote to active plan (docs/plans) and begin Phase A inventory, keeping changes scoped to a single subsystem per PR with verification before and after each step.
