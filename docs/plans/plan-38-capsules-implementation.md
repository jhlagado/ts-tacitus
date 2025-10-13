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

1. Implement the `does` command (formerly `methods`) exactly as specified: constructor extends caller's RSTACK frame with capsule list, returns RSTACK_REF handle to data stack, slot 0 holds re-entry CODE reference.
2. Provide a robust `dispatch` operation with a custom epilogue (`Op.ExitDispatch`) that restores the caller without touching capsule payload cells.
3. Build a thin capsule runtime layer (helper utilities, assertions) with exhaustive unit/integration tests.
4. Update docs/tests/tooling so capsules are safe to use by Tacit programs.

## Deliverables

- Capsule helper module (frame capture, validation asserts).
- Integration in builtin registry and parser.
- Comprehensive tests (unit + integration + negative cases).
- Documentation updates (`capsules.md`, `metaprogramming.md`, examples).

---

## Phase 0 – Groundwork & Instrumentation

**Objective:** Freeze assumptions and add safety rails before coding.

| Item | Description                                                                                                  | Owner      | Tests                                           | Status      |
| ---- | ------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------ | ------------ |
| 0.1  | Lock spec wording by syncing `docs/specs/capsules.md` with stakeholders (done this review).                  | Docs       | —                                               | ✅ Complete |
| 0.2  | Add reusable debug helpers (e.g., `assertCapsuleShape(vm, value)`) under `src/ops/capsules/assertions.ts`.   | Runtime    | `capsule assertions` unit suite                 | ✅ Complete |
| 0.3  | Extend test harness with helper to execute Tacit snippet and return raw stack/frames (see `src/test/utils`). | Test infra | `vm state snapshot` helper tests                | ✅ Complete |

_Exit criteria:_ Spec stable, assertion helpers ready, harness supports targeted stack inspections.

---

## Phase 1 – Opcode Plumbing

**Objective:** Introduce opcodes and parser hooks without feature logic.

| Step | Description                                                                                          | Tests                                                             |
| ---- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1.1  | Register new opcodes in opcode → verb map (even if verb is stub throwing "Not implemented").         | Capsule opcode stub tests                                        |
| 1.2  | Register the builtin word `methods` as an immediate command (no opcode) pointing to the new handler. | Capsule word registration tests                                   |

_Exit criteria:_ Build succeeds; any use of the commands throws “Not implemented” gracefully.

Status: ✅ Complete

- Opcodes present: `EndCapsule`, `ExitConstructor` (renamed from old `FreezeCapsule`), `ExitDispatch`, `Dispatch`.
- Builtin registry: `dispatch` registered as regular op; `methods` registered as immediate (stub) with tests in `src/test/lang/capsules/methods-registration.test.ts`.

---

## Phase 2 – Layout Helpers (Revised)

**Objective:** Replace the old frame-capture helpers with handle‑based utilities aligned to the revised capsule semantics.

### Implementation (new)

| Step | Description                                                                                          | Tests                                  |
| ---- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 2.1  | Add `src/ops/capsules/layout.ts` with `readCapsuleLayoutFromHandle(vm, handle:RSTACK_REF)` that validates the LIST header lives on RSTACK, slot 0 is CODE, and returns payload bounds. | `capsule layout (handle)` unit suite   |

### Tests (new)

| Case                       | Coverage                                            |
| -------------------------- | --------------------------------------------------- |
| Valid handle               | Resolves header on RSTACK; slot0 is CODE            |
| Non‑capsule handle         | Errors (header not LIST or missing CODE slot0)      |
| Non‑RSTACK_REF input       | Errors (type mismatch)                              |

_Exit criteria:_ Utilities refer to handles (RSTACK_REF) rather than copying locals; all tests reflect revised calling convention.

Status: ✅ Complete

- Removed legacy `frame-utils.ts` and its tests as they relied on the old model.
- Implemented `readCapsuleLayoutFromHandle` and corresponding unit tests; full test suite passes.

---

## Phase 3 – `does` Command (was `methods`)

**Objective:** Implement the immediate command behaviour exactly as specified.

### Steps

1. **Opener (`beginMethodsImmediate`)**
   - Validate TOS has `Op.EndDef` (we are inside a colon definition).
   - Swap closer: replace `Op.EndDef` with `createBuiltinRef(Op.EndCapsule)` so the shared terminator emits the dispatch epilogue.
   - Emit `Op.ExitConstructor` (single opcode that appends `[CODE_REF(vm.IP), LIST]` to the current frame, pushes an `RSTACK_REF`, and unwinds to the caller).

2. **Closer verb (`endCapsuleOp`)**
   - Emit `Op.ExitDispatch` (pops the saved BP and return address pushed by the dispatch prologue).

### Tests

- `does-basic.test.ts`
  - Compiles `: counter 0 var count does ... ;`
  - After invocation, data stack contains the `RSTACK_REF` handle and return stack shows `[locals…, CODE_REF, LIST]` above the caller frame.
  - Ensures `Op.ExitConstructor` is emitted exactly once.
- Negative tests:
- `does` outside definition → syntax error.
  - Multiple `methods` (incorrect closer) → fail fast.

_Exit criteria:_ Constructors append `[locals…, CODE_REF, LIST]` in place, push an `RSTACK_REF` handle to the data stack, and unwind via `Op.ExitConstructor`.

Status: ✅ Complete

- Implemented `beginMethodsImmediate` (opener) with validation, closer swap to `EndCapsule`, and emission of `Op.ExitConstructor`.
- Implemented `endCapsuleOp` (closer) to emit `Op.ExitDispatch` then finalize the definition via the compiler hook.
- Tests added/updated:
  - Registration + opener behavior (closer swap, constructor exit compiled): `src/test/lang/capsules/methods-registration.test.ts`
  - Closer behavior guarded outside parser context: `src/test/ops/capsules/stubs.test.ts`
  - Capsule layout helper unit suite (Phase 2): `src/test/ops/capsules/layout.test.ts` (expanded error cases)
- Full test suite passes with broadcast WIP cases explicitly skipped per policy.

---

## Phase 4 – Dispatch Runtime

**Objective:** `dispatch` runtime semantics with custom epilogue.

### Implementation

- `dispatchOp(vm: VM)`
  - Expect `(args… method capsule-ref)` with `capsule-ref` tagged as `RSTACK_REF`.
  - Resolve the handle, push caller return address and BP, set `BP` to the capsule payload base, and jump to the patched entry (`CODE_REF` in slot 0).

- `exitDispatchOp` (`Op.ExitDispatch`)
  - Pop the saved BP and return address pushed by the prologue and resume the caller without touching the capsule payload.

### Tests

- Unit: `dispatchOp` error on malformed capsule handle, missing CODE slot, etc.
- Integration: compile and run snippet verifying:
  - `inc` increments internal state.
  - `get` returns latest.
  - Capsule can be stored in global/local, reused.
- Negative: calling `dispatch` with non-capsule raises descriptive error.

_Exit criteria:_ `dispatch` respects calling convention, tests pass.

Status: ✅ Complete

- Implemented `dispatchOp` prologue (consume receiver only, save caller IP/BP, rebind BP, jump to CODE slot0).
- Implemented `exitDispatchOp` epilogue (restore BP/IP only).
- Added unit tests and updated stubs to reflect runtime behavior.

---

## Phase 5 – Comprehensive Testing & Integration

**Objective:** Build exhaustive test suite and wire into builtin registry.

### Unit Suites
- `frame-utils.test.ts` (Phase 2)
- `methods.test.ts`
- `dispatch.test.ts`
- `exit-dispatch.test.ts` (ensures no locals cleaned up accidentally)

### Integration Suites
1. **Counter Capsule** — multiple dispatches mutate state and return values correctly
2. **Point Capsule** — nested `case`, list arguments
3. **Degenerate Capsule** — no `case`, single routine
4. **Failure Paths** — dispatch on non-capsule, methods without definition

### Builtin Wiring
- Register `does` as immediate command (keep `methods` as alias temporarily) in `src/ops/builtins-register.ts`
- Register `dispatch` as regular operation in `src/ops/builtins-register.ts`
- Integration test: execute full Tacit snippet using both words

_Exit criteria:_ `yarn test` (full suite) passes, targeted capsules suite green.

Status: ⏳ Pending

---

## Phase 6 – Documentation & Release

**Objective:** Update docs and prepare for release.

- Update `docs/specs/metaprogramming.md` to include `methods` + `dispatch`
- Add tutorial snippet under `docs/learn/` demonstrating a simple capsule (counter)
- Provide example in `docs/learn/refs.md` showing `&alias` usage with capsules

_Exit criteria:_ All phases merged, `yarn test` & `yarn lint` pass, docs complete, ready to announce.

Progress:

- Learn doc updated: `docs/learn/capsules.md` rewritten with counter and point capsule examples, call order, and safety notes.
- Remaining: update `docs/specs/metaprogramming.md` with `methods` + `dispatch`; add `&alias` capsule example to `docs/learn/refs.md`.

---

## Key Risks & Mitigations (Revisited)

- **BP rebinding mistakes:** Heavy use of assertions, unit tests specifically checking `BP`/`RSP`.
- **Capsule payload integrity:** Prop tests ensuring no copying; debugging helper `assertCapsuleShape`.
- **Spec drift:** Keep spec doc referenced in unit tests (e.g., comment linking to section numbers).
- **User confusion:** Provide thorough examples showing canonical call order (`args … method receiver dispatch`) and explaining why `&alias` is required.

---

## Summary

- Constructors: run normal colon prologue, push locals, execute `methods`, which emits a single `Op.ExitConstructor`. The opcode wraps the current `vm.IP` as a `CODE_REF`, `rpush`es `[CODE_REF(entryAddr), LIST:(N+1)]` onto the RSTACK (extending the caller's frame), pushes an `RSTACK_REF` handle to the data stack, then restores the caller BP (from BP-1) and return address (from BP-2) while leaving RSP untouched.
- Dispatch: call pattern `args … method receiver dispatch`; runtime resolves the RSTACK_REF handle, sets `BP` to the capsule payload base (in the caller's frame), jumps to CODE ref, and `Op.ExitDispatch` restores BP/IP without modifying the payload.
