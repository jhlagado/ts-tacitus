# Plan 40: Global Heap Primitives & Global Variable Runtime

## Status & Context

- **Stage:** Complete
- **Priority:** Closed — foundational infrastructure now available for downstream dictionary plan.
- **Scope:** Implement global heap primitives, migrate globals onto the heap, and lock down tests.

Global variables and dictionary payloads now rely on the global heap. The VM owns a heap bump pointer (`GP`) plus a `dictHead` reference, and heap helpers handle compound copying and allocation safety.

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
| 1.1  | Implement `gmark`, `gsweep`, `gpush`, `gpeek`, `gpop` builtins                                    | ✅     |
| 1.2  | Expose helpers for copying simple values and list payloads into the heap (`pushSimple`, `pushList`) | ✅     |
| 1.3  | Guard heap capacity and ensure rewinds validate bounds                                            | ✅     |

_Exit criteria:_ Heap behaves like a disciplined stack with Tacit-facing primitives.

---

## Phase 2 – Global Runtime Integration

| Step | Description                                                                                               | Status |
| ---- | --------------------------------------------------------------------------------------------------------- | ------ |
| 2.1  | VM tracks `dictHead` and uses global heap helpers for global variable declarations                        | ✅     |
| 2.2  | Symbol table emits heap-backed dictionary entries and retains entry handles for lookups                   | ✅     |
| 2.3  | `store`/assignment paths update heap payloads and enforce compound compatibility                          | ✅     |
| 2.4  | Rebuild global initialisation to copy simple values inline and compounds into heap                        | ✅     |

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
- Global variables store their payloads on the heap; dictionary entries reference heap-resident lists.
- The runtime now exposes `dictHead`, setting the stage for the dedicated dictionary build (Plan 41).
