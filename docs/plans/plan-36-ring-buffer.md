# Plan 36 — LIST-backed Ring Buffer Primitives

Status: Draft (Phase 0 in progress)
Owner: Runtime + Ops Team
Last updated: 2025-09-11

## Goals
- Implement the buffer construct described in `docs/specs/buffers.md` as first-class Tacit words.
- Provide fixed-capacity ring buffer behaviour with O(1) write/unwrite/read operations using raw memory access.
- Expose query helpers (`buf-size`, `is-empty`, `is-full`) and mutation helpers (`write`, `unwrite`, `read`, with `push`/`pop` as aliases) that operate on buffers or refs to buffers.
- Ensure buffers integrate cleanly with locals, globals, and bracket-path addressing without introducing new data structures.

## Non-Goals
- Auto-resizing buffers or dynamic allocation beyond the preallocated ring capacity.
- Blocking/async semantics or timestamp metadata.
- Compiler transformations beyond registering the new words in the dictionary.

## Design Summary
- Buffers use LIST header for allocation only; after allocation, treat as raw memory with array semantics (address-increasing order).
- Payload layout: `[ readPtr, writePtr, data0 … data(N-1) ]` where data is in address-increasing order (data[0] at lowest address).
- All arithmetic is integer math using existing arithmetic ops (`+`, `-`, `mod`).
- Mutators consume buffer/ref input and return values (buffers stored in locals/globals, not kept on stack).
- Error handling throws exceptions for overflow/underflow (strict error handling).

## Phases

### Phase 0 — Spec finalisation & planning ✅ COMPLETE
- [x] Promote `docs/specs/buffers.md` to normative status (completed).
- [x] Confirm arithmetic helpers (`mod`, `+`, `-`) suffice for wrap-around (documented in spec).
- [x] Decide final word names/aliases (`write`/`unwrite`/`read` with `push`/`pop` as aliases) (completed).

### Phase 1 — Core implementation
- [ ] Add `buffer` word to allocate LIST layout (readPtr/writePtr initialized to 0, data slots not initialized).
- [ ] Implement helper verbs (`buf-size`, `is-empty`, `is-full`, `write`, `unwrite`, `read`, with `push`/`pop` aliases) in stack ops module.
- [ ] Use direct memory access (`vm.memory.readCell`/`writeCell`) with absolute addresses, not `slot`/`fetch`/`store`.
- [ ] Ensure mutators operate both on direct LIST headers and refs (`STACK_REF`, `RSTACK_REF`, `GLOBAL_REF`).
- [ ] Register new words in `builtins-register` with appropriate stack effects and doc strings.

### Phase 2 — Testing & validation
- [ ] Unit tests covering creation edge cases (capacity 0/1/N, pointer initialization).
- [ ] Behavioural tests for wrap-around scenarios, underflow/overflow throwing exceptions.
- [ ] Ref integration tests (locals, globals, bracket paths) to confirm in-place mutation works via refs.
- [ ] Property-like test ensuring pointer slots stay simple numbers after mutations.
- [ ] Test address-increasing order: verify sequential reads yield correct order for text buffers.

### Phase 3 — Documentation & teaching material ✅ COMPLETE
- [x] Update buffer spec (now normative) with final stack effects and examples (completed).
- [x] Update `docs/learn/buffers.md` to match new spec design (completed).
- [ ] Add concise examples to `docs/learn/local-vars.md` (embedding buffers in locals/globals) — optional enhancement.

### Phase 4 — Wrap-up
- [ ] `yarn lint` and targeted `yarn test --runTestsByPath …`, followed by the full suite (acknowledging coverage gate status).
- [ ] Move this plan to `docs/plans/done` with outcomes and remaining caveats, if any.

## Success Criteria
- `buffer N` produces a LIST whose payload matches the documented layout (readPtr, writePtr, data in address-increasing order).
- All helpers behave deterministically: size queries accurate, mutators respect full/empty guard and throw exceptions.
- Works transparently through refs (no special cases needed).
- Data is stored in address-increasing order (data[0] at lowest address, data[N-1] at highest).
- Documentation and learn materials clearly explain usage; spec is normative.

## Open Questions (resolved)
- ✅ Aliases: `push`/`pop` are aliases for `write`/`unwrite` (documented in spec).
- ✅ Minimum capacity: Spec requires `N ≥ 1` (throws if invalid).
- ✅ Error handling: Strict throwing exceptions (not returning NIL).

## References
- `docs/specs/buffers.md` — normative specification.
- `docs/specs/lists.md` — LIST allocation rules (buffers use LIST only for allocation).
- `src/ops/stack/data-move-ops.ts` — likely home for mutator verbs.
- `src/test/ops/stack` — target directory for new behavioural tests.
- `docs/learn/buffers.md` — learning materials (updated to match new spec).
