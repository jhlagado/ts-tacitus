# Plan 40: Global Heap Primitives & Global Variable Runtime

## Status & Context

- **Stage:** Complete
- **Priority:** Closed — foundational infrastructure now available for downstream dictionary plan.
- **Scope:** Implement global heap primitives, migrate globals onto the heap, and lock down tests.

Dictionary payloads now rely on the global heap. The VM exposes the global heap bump pointer (`gp`). Dictionary composition and traversal live in the heap‑backed dictionary chain (via `vm.newDictHead`) and are not coupled to the heap helpers themselves. Global variables are currently disabled pending a separate revisit.

---

## Phase 0 – Data Reference Unification

| Step | Description                                                                                                                 | Status |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0.1  | Audit all consumers of `STACK_REF`, `RSTACK_REF`, and `GLOBAL_REF` to capture segment semantics and edge cases              | ✅     |
| 0.2  | Define unified `DATA_REF` encoding (absolute cell index payload + window classification, bounds checks, mutation rules)     | ✅     |
| 0.3  | Provide helpers for constructing/decoding `DATA_REF` values (`createDataRef`, `decodeDataRef`, `createGlobalRef`, etc.)     | ✅     |
| 0.4  | Publish migration playbook covering parser, runtime, and tests so legacy tags can be retired without breaking isolation     | ✅     |

_Exit criteria:_ Unified reference encoding available across the runtime.

---

## Phase 1 – Global Heap Primitives

| Step | Description                                                                                       | Status |
| ---- | ------------------------------------------------------------------------------------------------- | ------ |
| 1.1  | Implement `gmark`, `gsweep`, `gpush`, `gpeek`, `gpop` builtins (stack‑like semantics; `gpush` does not return a value) | ✅     |
| 1.2  | Expose helpers for copying simple values and list payloads into the heap (`pushSimple`, `pushList`) | ✅     |
| 1.3  | Guard heap capacity and ensure rewinds validate bounds                                            | ✅     |

_Exit criteria:_ Heap behaves like a disciplined stack with Tacit-facing primitives.

---

## Phase 2 – Global Runtime Integration

| Step | Description                                                                                               | Status |
| ---- | --------------------------------------------------------------------------------------------------------- | ------ |
| 2.1  | VM integrates heap helpers; dictionary composition is maintained independently via `vm.newDictHead`       | ✅     |
| 2.2  | Symbol table mirrors definitions into the heap‑backed dictionary and retains heap handles as needed       | ✅     |
| 2.3  | `store`/assignment paths update heap payloads and enforce compound compatibility                          | ✅     |
| 2.4  | Global variable keyword removed; future global variable design deferred                                   | ✅     |

_Exit criteria:_ Globals live entirely on the heap with stable `DATA_REF` payloads.

---

## Phase 3 – Validation & Tests

| Step | Description                                                                                  | Status |
| ---- | -------------------------------------------------------------------------------------------- | ------ |
| 3.1  | Unit tests for heap primitives (marks, sweeps, nested refs, exhaustion paths)                | ✅     |
| 3.2  | Integration tests covering global declarations, compound assignments, and dictionary chaining | ✅     |
| 3.3  | Full suite run (`yarn test`, `yarn lint`) to capture baseline metrics                         | ✅     |

_Exit criteria:_ Regression suite locks in heap semantics and global behaviour.

---

## Summary

- Global heap primitives are available and validated.
- Heap‑backed dictionary entries reference heap‑resident lists; symbol lookups can be served directly from heap.
- The runtime and plans no longer mention a separate `dictHead` field owned by the heap; dictionary state is tracked via `vm.newDictHead` and managed by dictionary ops (see Plan 41).
