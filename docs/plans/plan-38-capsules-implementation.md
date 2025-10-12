# Plan 38: Capsules Implementation (Revised)

## Status & Context

- **Stage:** Draft (seeking approval)
- **Priority:** High — feature enables object/coroutine patterns relied upon by upcoming plans.
- **Spec Reference:** `docs/specs/capsules.md` (latest revision, formerly in drafts).
- **Dependencies (must remain green):**
  - ✅ `case/of` immediate control flow (Plan 35)
  - ✅ Local-variable frames & `var` semantics (Plan 10)
  - ✅ Stack-frame invariants (Plan 26)
  - ✅ Symbol lookup & CODE references (Plan 04)
- **Non-Goals:** Constructor sugar (`defcapsule`), automatic argument packaging, capsule inheritance. These can be follow-up plans once the core runtime support is stable.

## Goals

1. Implement the `methods` command exactly as specified: constructor terminates immediately, capsule list frozen to the data stack (or wherever locals reside), slot 0 holds re-entry CODE reference.
2. Provide a robust `dispatch` operation with a custom epilogue (`Op.ExitDispatch`) that restores the caller without touching capsule payload cells.
3. Build a thin capsule runtime layer (helper utilities, assertions) with exhaustive unit/integration tests.
4. Update docs/tests/tooling so capsules are safe to use by Tacit programs.

## Deliverables

- New opcodes (`Op.EndCapsule`, `Op.Dispatch`, `Op.ExitDispatch`) with TypeScript implementations.
- Capsule helper module (frame capture, validation asserts).
- Integration in builtin registry and parser.
- Comprehensive tests (unit + integration + negative cases).
- Documentation updates (`capsules.md`, `metaprogramming.md`, examples).

---

## Phase 0 – Groundwork & Instrumentation

**Objective:** Freeze assumptions and add safety rails before coding.

| Item | Description                                                                                                  | Owner      | Tests                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------- |
| 0.1  | Lock spec wording by syncing `docs/specs/capsules.md` with stakeholders (done this review).                  | Docs       | —                                                        |
| 0.2  | Add reusable debug helpers (e.g., `assertCapsuleShape(vm, value)`) under `src/ops/capsules/assertions.ts`.   | Runtime    | New tests to ensure assertions fire on malformed values. |
| 0.3  | Extend test harness with helper to execute Tacit snippet and return raw stack/frames (see `src/test/utils`). | Test infra | Smoke test to ensure helpers produce consistent output.  |

_Exit criteria:_ Spec stable, assertion helpers ready, harness supports targeted stack inspections.

---

## Phase 1 – Opcode Plumbing

**Objective:** Introduce opcodes and parser hooks without feature logic.

| Step | Description                                                                                          | Tests                                                             |
| ---- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1.1  | Add enums (`Op.Methods`, `Op.EndCapsule`, `Op.Dispatch`, `Op.ExitDispatch`) in `src/ops/opcodes.ts`. | Enum smoke test ensuring values assigned & exported.              |
| 1.2  | Register new opcodes in opcode → verb map (even if verb is stub throwing “Not implemented”).         | Unit test expecting stub throw.                                   |
| 1.3  | Register the builtin word `methods` as an immediate command (no opcode) pointing to the new handler. | Parser/builtin test verifying `methods` is flagged `isImmediate`. |

_Exit criteria:_ Build succeeds; any use of the commands throws “Not implemented” gracefully.

---

## Phase 2 – Frame Capture Utilities

**Objective:** Provide low-level helpers with standalone tests before wiring them into `methods`.

### Implementation

- New module `src/ops/capsules/frame-utils.ts` exporting:
  - `freezeFrame(vm: VM, { includeBP?: boolean } = {})`
    - Push locals (oldest first) to current stack, then CODE ref, then header value.
    - Must not mutate RSTACK, only read.
  - `readCapsuleLayout(vm: VM, capsule: number)`
    - Returns `{ codeRef, payloadStartAddr, slotCount, segment }` and validates tags.

### Tests

- `src/test/ops/capsules/frame-utils.test.ts`
  - **Capture simple frame:** Setup VM with locals `[count=2, step=5]`; assert resulting stack `[2,5,CODE,LIST:3]`.
  - **Zero locals:** Ensure output is `[CODE, LIST:1]`.
  - **Validation errors:** Passing non-LIST or LIST without CODE ref throws descriptive error.

_Exit criteria:_ Utilities thoroughly tested; no integration yet.

---

## Phase 3 – `methods` Command

**Objective:** Implement the immediate command behaviour exactly as specified.

### Steps

1. **Opener (`beginMethodsImmediate`)**
   - Validate TOS has `Op.EndDef` closer (confirms we're inside colon definition).
   - Compute dispatch entry: `dispatchAddr = vm.compiler.CP + size(Op.Exit)`.
   - Emit `Op.Exit` (constructor terminator).
   - Swap closer: pop `Op.EndDef` and push `createBuiltinRef(Op.EndCapsule)`.
   - Freeze frame with `dispatchAddr` as CODE_REF (call `freezeFrame(vm, dispatchAddr)`).

2. **Closer verb (`endCapsuleOp`)**
   - Emit actual `Op.ExitDispatch`

### Tests

- `methods-basic.test.ts`
  - Compiles `: counter 0 var count methods ... ;`
  - After running `counter`, stack contains capsule list.
  - Ensures `Op.Exit` inserted once.
- Negative tests:
  - `methods` outside definition → syntax error.
  - Multiple `methods` (incorrect closer) → fail fast.

_Exit criteria:_ Constructors produce capsule list (`[locals…, CODE, LIST]`) and return.

---

## Phase 4 – Dispatch Runtime

**Objective:** `dispatch` runtime semantics with custom epilogue.

### Implementation

- `dispatchOp(vm: VM)`
  - Ensure top-of-stack order matches spec (`receiver`).
  - Read capsule layout with helper (slot 0 is CODE ref).
  - Push return IP and caller BP.
  - Set `BP = payloadBase` (no copying).
  - Set `IP = dispatchAddr`.
  - Leave arguments/method symbol beneath.

- `exitDispatchOp` (`Op.ExitDispatch`)
  - Pop BP, pop return address, set `IP`.
  - Do not modify payload or data stack.

### Tests

- Unit: `dispatchOp` error on malformed capsule, missing CODE, etc.
- Integration: compile and run snippet verifying:
  - `'inc` increments internal state.
  - `'get` returns latest.
  - Capsule can be stored in global/local, reused.
- Negative: calling `dispatch` with non-capsule raises descriptive error.

_Exit criteria:_ `dispatch` respects calling convention, tests pass.

---

## Phase 5 – Builtin Wiring & Parser

**Objective:** Expose commands to users.

| Step | Description                                                                                | Tests                                                         |
| ---- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 5.1  | Register `methods` (immediate) and `dispatch` (regular) in `src/ops/builtins-register.ts`. | Integration test that executing Tacit snippet uses new words. |
| 5.2  | Update any alias tables or compatibility layers if needed.                                 | Existing tests remain green.                                  |
| 5.3  | Ensure assembler/disassembler output handles new opcodes (if tools exist).                 | Tooling smoke test.                                           |

_Exit criteria:_ Users can write capsules in Tacit snippet.

---

## Phase 6 – Comprehensive Testing

**Objective:** Build a rigorous test suite that exercises each behaviour individually before combined scenarios.

### Unit Suites

- `frame-utils.test.ts` (Phase 2).
- `methods.test.ts`
- `dispatch.test.ts`
- `exit-dispatch.test.ts` (ensures no locals cleaned up accidentally).

### Integration Suites

1. **Counter Capsule** — ensures multiple dispatches mutate state and return values correctly.
2. **Point Capsule** — nested `case`, list arguments `( 'move 10 20 )`.
3. **Degenerate Capsule** — no `case`, single routine (ensures dispatch works without symbol use).
4. **Failure Paths** — dispatch on non-capsule, methods without definition.

### Property Tests (Optional but recommended)

- Random locals count (0..N) to ensure freeze/dispatch stable across sizes.
- Random message forms (symbol vs list) to catch argument handling.

_Exit criteria:_ `yarn test` (full suite) + targeted `capsules` suite star green. Introduce coverage checkpoint focusing on new files.

---

## Phase 7 – Documentation & Examples

**Objective:** Ensure developer guidance matches implementation.

| Deliverable                                                                                         | Description |
| --------------------------------------------------------------------------------------------------- | ----------- |
| Update `docs/specs/capsules.md` (already current; just confirm final behaviour).                    |
| Update `docs/specs/metaprogramming.md` to include `methods` + `dispatch` in immediate command list. |
| Add tutorial snippet under `docs/learn/` demonstrating a simple capsule (counter).                  |
| Provide example in `docs/learn/refs.md` showing `&alias` usage with capsules.                       |

---

## Phase 8 – Roll-out Checklist

1. ✅ All phases merged with review signoff.
2. ✅ Final `yarn test` & `yarn lint`.
3. ✅ Update changelog / release notes.
4. ✅ Announce ready-to-use capsules in developer docs.

---

## Key Risks & Mitigations (Revisited)

- **BP rebinding mistakes:** Heavy use of assertions, unit tests specifically checking `BP`/`RSP`.
- **Capsule payload integrity:** Prop tests ensuring no copying; debugging helper `assertCapsuleShape`.
- **Spec drift:** Keep spec doc referenced in unit tests (e.g., comment linking to section numbers).
- **User confusion:** Provide thorough examples showing canonical call order (`args … method receiver dispatch`) and explaining why `&alias` is required.

---

## Summary

- Constructors: run normal colon prologue, push locals, execute `methods`, which freezes the frame (`freezeFrame`) and emits `Op.Exit`, leaving `[locals…, CODE_REF, LIST:(N+1)]` on the stack.
- Dispatch: call pattern `args … method receiver dispatch`; runtime sets `BP` to the capsule payload, jumps to CODE ref, and `Op.ExitDispatch` restores BP/IP without modifying the payload.
