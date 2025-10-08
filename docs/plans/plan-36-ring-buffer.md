# Plan 36 — LIST-backed Ring Buffer Primitives

Status: Draft (Phase 0 in progress)
Owner: Runtime + Ops Team
Last updated: 2025-09-11

## Goals
- Implement the buffer construct described in `docs/specs/drafts/buffers.md` as first-class Tacit words.
- Provide fixed-capacity ring buffer behaviour with O(1) push/pop/shift/unshift using existing LIST semantics.
- Expose query helpers (`buf-size`, `is-empty`, `is-full`) and mutation helpers (`push`, `pop`, `unshift`, `shift`) that operate on buffers or refs to buffers.
- Ensure buffers integrate cleanly with locals, globals, and bracket-path addressing without introducing new data structures.

## Non-Goals
- Auto-resizing buffers or dynamic allocation beyond the preallocated ring capacity.
- Blocking/async semantics or timestamp metadata.
- Compiler transformations beyond registering the new words in the dictionary.

## Design Summary
- Buffers remain LISTs with payload layout `[ start, end, data0 … dataN ]`, matching the draft spec.
- All arithmetic is integer math using existing arithmetic ops (`+`, `-`, `mod`).
- Mutators return either `1`/`NIL` (for push/unshift success) or the removed value/`NIL` (for pop/shift) while leaving the buffer on stack.
- Error handling is non-throwing for overflow/underflow; callers compose eviction policies explicitly.

## Phases

### Phase 0 — Spec finalisation & planning (current)
- [ ] Promote `docs/specs/drafts/buffers.md` to normative status once wording is settled (explicit stack effects, error notes).
- [ ] Confirm arithmetic helpers (`mod`, `+`, `-`) suffice for wrap-around; document expectations in spec.
- [ ] Decide final word names/aliases (push/pop/unshift/shift vs read/write). Update spec accordingly.

### Phase 1 — Core implementation
- [ ] Add `buffer` word to allocate LIST layout (payload initialised to `NIL`, start/end zeroed).
- [ ] Implement helper verbs (`buf-size`, `is-empty`, `is-full`, `push`, `pop`, `unshift`, `shift`) in stack ops module.
- [ ] Ensure mutators operate both on direct LIST headers and refs (`STACK_REF`, `RSTACK_REF`, `GLOBAL_REF`).
- [ ] Register new words in `builtins-register` with appropriate stack effects and doc strings.

### Phase 2 — Testing & validation
- [ ] Unit tests covering creation edge cases (capacity 0/1/N, payload initialisation).
- [ ] Behavioural tests for wrap-around scenarios, underflow/overflow returning `NIL`, and success flags.
- [ ] Ref integration tests (locals, globals, bracket paths) to confirm in-place mutation works via refs.
- [ ] Property-like test ensuring meta slots stay simple numbers after mutations.

### Phase 3 — Documentation & teaching material
- [ ] Update buffer spec (now normative) with final stack effects and examples.
- [ ] Extend `docs/learn/control-flow.md` or create a new learn doc section showcasing buffer use cases.
- [ ] Add concise examples to `docs/learn/local-vars.md` (embedding buffers in locals/globals).

### Phase 4 — Wrap-up
- [ ] `yarn lint` and targeted `yarn test --runTestsByPath …`, followed by the full suite (acknowledging coverage gate status).
- [ ] Move this plan to `docs/plans/done` with outcomes and remaining caveats, if any.

## Success Criteria
- `buffer N` produces a LIST whose payload matches the documented layout and capacity formula.
- All helpers behave deterministically: size queries accurate, mutators respect full/empty guard without throwing.
- Works transparently through refs and bracket-path updates (no special cases needed).
- Documentation and learn materials clearly explain usage; spec is promoted from draft.

## Open Questions
- Should we expose aliases like `read/write` formally or leave them as documentation guidance?
- Minimum capacity: do we want to accept `N = 0` by throwing, or allow a buffer that can only ever be empty? (spec currently requires `N ≥ 1`).
- Would a future `buffer-clear` helper be desirable, or do we leave such policies to the caller (`buf-size drop` loops)?

## References
- `docs/specs/drafts/buffers.md` — draft specification to be promoted.
- `docs/specs/lists.md` — canonical LIST layout rules used by the buffer design.
- `src/ops/stack/data-move-ops.ts` — likely home for mutator verbs.
- `src/test/ops/stack` — target directory for new behavioural tests.
- `docs/learn/*` — existing learning materials to cross-link once buffers ship.
