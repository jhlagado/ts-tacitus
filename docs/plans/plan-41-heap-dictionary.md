# Plan 41: Heap-Backed Dictionary Build-Out

## Status & Context

- **Stage:** In progress
- **Priority:** High — now that the global heap is live, migrate the dictionary itself.
- **Scope:** Move dictionary storage, lookup, and transient locals onto heap-backed structures using the primitives delivered in Plan 40.

---

## Phase 1 – Contracts & Design Sign-off

| Step | Description                                                                                                             | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| 1.1  | Canonicalise dictionary entry layout (`[payload name prev LIST:3]`) with sign-bit metadata for `IMMEDIATE`/`HIDDEN`     | ✅     |
| 1.2  | Define `vm.dictHead` semantics (initial `NIL`, shadowing rules, GP bump expectations)                                   | ✅     |
| 1.3  | Document transient-local lifecycle (mark/revert of `dictHead` + `GP`)                                                   | ✅     |
| 1.4  | Publish reference taxonomy tying heap dictionary payloads to `DATA_REF`, `STRING`, and `CODE` tags                     | ✅     |

_Exit criteria:_ Authoritative spec addendum describing heap dictionary behaviour and reference alignment.

---

## Phase 2 – Runtime Infrastructure Rewrite

| Step | Description                                                                               | Status |
| ---- | ----------------------------------------------------------------------------------------- | ------ |
| 2.1  | Build parallel Forth-style dictionary routines (head + stack pointer only) using heap entries | ☐      |
| 2.2  | Heap primitive for pushing `[payload name prev LIST:3]` and updating `dictHead`                | ✅     |
| 2.3  | Provide mark/revert that snapshots both `dictHead` and `GP` for transient allocations          | ✅     |
| 2.4  | Optional: dictionary introspection utility for debugging entry chains                          | ☐      |

_Exit criteria:_ Dictionary storage and updates run entirely on heap state.

---

## Phase 3 – Transient Locals During Definition

| Step | Description                                                                      | Status |
| ---- | -------------------------------------------------------------------------------- | ------ |
| 3.1  | Emit transient dictionary entries for locals (flagged `LOCAL`) during definition | ☐      |
| 3.2  | Ensure slot numbers remain BP-relative and recorded in entry payloads            | ☐      |
| 3.3  | On definition exit, revert `dictHead`/`GP` to remove transient locals            | ☐      |
| 3.4  | Backfill tests covering nested definitions, shadowing, and cleanup               | ☐      |

_Exit criteria:_ Local lookup leverages heap dictionary entries with deterministic cleanup.

---

## Phase 4 – Parser & Bytecode Integration

| Step | Description                                                                                 | Status |
| ---- | ------------------------------------------------------------------------------------------- | ------ |
| 4.1  | Rewrite `emitGlobalDecl`, assignment, and `&name` parsing to target heap dictionary entries | ☐      |
| 4.2  | Update bracket-path lowering to operate on dictionary-backed references                     | ☐      |
| 4.3  | Ensure runtime lookups traverse heap entries via `dictHead`                                 | ☐      |
| 4.4  | Remove legacy root-frame slot machinery                                                     | ☐      |

_Exit criteria:_ Compiler and interpreter run purely on heap dictionary abstractions.

---

## Phase 5 – Validation & Tests

| Step | Description                                                                         | Status |
| ---- | ----------------------------------------------------------------------------------- | ------ |
| 5.1  | Unit tests for dictionary creation, shadowing, and payload updates                  | ☐      |
| 5.2  | Integration tests: global declarations, compound assignments, locals mark/revert    | ☐      |
| 5.3  | Heap inspection tests ensuring entry linkage and `GP` discipline                    | ☐      |
| 5.4  | Capture baseline metrics (coverage, heap footprints)                                | ☐      |

_Exit criteria:_ Regression suite protects heap-backed dictionary behaviour end-to-end.

---

## Phase 6 – Documentation & Tooling

| Step | Description                                                                                                    | Status |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------ |
| 6.1  | Update `variables.md`, `variables-and-refs.md`, `vm-architecture.md`, `lists.md`, and `top-level-variables.md` | ☐      |
| 6.2  | Retire documentation describing return-stack root frames for globals                                           | ☐      |
| 6.3  | Document dictionary inspection workflow (if tooling added)                                                     | ☐      |

_Exit criteria:_ Specs and tooling describe the heap dictionary model and developer experience.

---

## Immediate Focus

1. Deliver Phase 2.1 by designing Forth-style dictionary routines driven solely by `dictHead` and `GP` (no heap-hosted Maps or classes).
2. Implement Phase 2.4 if diagnostic tooling proves necessary once heap dictionary lookups are live.

---

## Design Notes (Working Contract)

- **Heap layout**: every entry is `[ payload  name  prev  LIST:3 ]` where `payload` is one of:
  - `Tag.BUILTIN(opcode)` (sign bit set when immediate)
  - `Tag.CODE(address)` (sign bit set when immediate)
  - `Tag.DATA_REF(heapCell)` for globals
  - `Tag.LOCAL(slotNumber)` for locals (slot is BP-relative)
  `name` is an interned `Tag.STRING` offset; `prev` links to the prior entry; `LIST:3` is the header.
- **VM registers only**: `dictHead` (DATA_REF/`NIL`), `GP` (heap bump pointer), and `localSlots` counter. No GC-managed structures in the VM.
- **mark/revert semantics**: `mark()` snapshots `{ dictHead, GP, localSlots }`; `revert()` restores them so any entries defined inside a colon definition vanish on exit.
- **Functional helpers to implement** (all pure, manipulating heap + registers):
  - `dictInit(vm)`
  - `dictMark(vm)` / `dictRevert(vm, checkpoint)`
  - `dictDefineBuiltin(vm, nameOffset, opcode, isImmediate)`
  - `dictDefineCode(vm, nameOffset, address, isImmediate)`
  - `dictDefineGlobal(vm, nameOffset, value)`
  - `dictDefineLocal(vm, nameOffset)`
  - `dictLookup(vm, nameOffset)` / `dictLookupEntry(vm, nameOffset)`
  - `dictFind(opcode/name)` and `dictFindImplementation(opcode)` compat with existing call sites
  - `dictGetEntryRef(vm, nameOffset)` for tests
- **Shadowing & scoping**: linked-list order provides LIFO shadowing; locals are transient heap entries that disappear on `revert`.
- **Immediate flag**: carried in the sign bit of `Tag.BUILTIN`/`Tag.CODE`, matching current behaviour.
*** End Patch
