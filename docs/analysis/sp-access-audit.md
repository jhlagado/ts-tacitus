# Stack Pointer Access Audit (Plan 34 — Phase 0)

_Audit date:_ 2025-02-14

## Methodology
- Automated sweeps (executed from repository root):
  - `rg "vm\\.SP" -n` — catch every direct byte-oriented accessor site.
  - `rg "vm\\.SPCells" -n` — enumerate cell-oriented call sites.
  - `rg "vm\\.SPBytes" -n` — locate explicit byte helpers already in use.
  - `rg "vm.SP /" -n` — highlight manual division patterns (e.g. `/ 4`).
- Each hit was classified by file into one of four buckets:
  - **Byte math (prod)** — production/runtime code consuming `vm.SP` as a byte offset.
  - **Cell math (prod)** — production/runtime code already using cell semantics.
  - **Raw memory IO** — intentional byte-level manipulation (e.g., writing via `Memory`).
  - **Tests / tooling** — fixtures, debug scripts, or expectations.
- Ambiguous or design-sensitive spots are called out explicitly below.

## Findings summary

### Byte-oriented `vm.SP` usage in production code
| File | Lines | Notes |
| --- | --- | --- |
| `src/ops/lists/build-ops.ts` | 27, 39, 45, 65, 73, 82 | Heavy mix of byte and cell math; pushes byte addresses onto return stack (`vm.rpush(vm.SP - CELL_SIZE)`). Requires a design decision on whether future stored offsets stay in bytes or switch to helper that derives byte address from cell pointer. |
| `src/ops/lists/structure-ops.ts` | 170, 178, 182 | Computes element headers via `vm.SP - … * CELL_SIZE`. Will need refactor to pure cell arithmetic with a shared helper. |
| `src/ops/broadcast.ts` | 262 | Single header address calculation in bytes. |

_No other runtime modules reference `vm.SP` directly; they already rely on `SPCells`/`SPBytes`._

### Byte-oriented `vm.SP` usage in tests & tooling
| File | Lines | Notes |
| --- | --- | --- |
| `src/test/stack/slots.test.ts` | 14, 24 | Uses `vm.SP / 4` to assert cell counts. Straightforward swap to `SPCells` once accessor flips. |
| `src/test/stack/find.test.ts` | 6-14, 97 | Writes raw bytes to memory and increments `vm.SP` manually; classified as **raw memory IO** fixture but kept here because it mutates the accessor directly. Will need to switch to `SPBytes` for clarity. |
| `src/test/core/list.test.ts` | 87-185 | Reads payload via `vm.SP - n`. Assertions should move to helper that converts `SPCells` to byte addresses. |
| `src/test/utils/core-test-utils.ts` | 40-41 | Computes byte spans for validation. |
| `src/test/utils/vm-test-utils.ts` | 21, 351 | Resets `vm.SP = 0`; safe to convert to `vm.SPBytes = 0` during migration. |
| `src/test/ops/access/select-op.test.ts` | 82, 127, 142 | Derives counts via `vm.SP / 4`; migrate to `SPCells`. |
| `src/test/ops/lists/list-ops-coverage.test.ts` | 172-181 | Stores initial `vm.SP` for delta checks. |
| `src/test/ops/interpreter/interpreter-operations.test.ts` | 126 | Captures initial stack depth. |
| `src/test/ops/local-vars/in-place-mutation.test.ts` | 44, 70, 107 | Ensures SP returns to zero. |
| `src/test/core/vm-*.test.ts` (constructor, symbol-resolution, comprehensive) | various | Similar zero-depth assertions. |
| `src/test/core/vm-push-symbol-ref.test.ts` | already uses `SPCells`; listed here for completeness. |
| `src/test/ops/stack/stack-utils.test.ts` | 37-38 | Uses `vm.SP` when writing specific tagged values; best moved to `SPBytes` helper. |
| `scripts/debug-base-addr.js` | 13-24 | Developer debug script; keeps byte math intentionally. |

### Cell-oriented usage already in place (production)
The following modules exclusively use cell semantics via `vm.SPCells` / `vm.SPBytes` and require no behavioural change, only mechanical renames in Phase 3:
- `src/core/list.ts`
- `src/core/format-utils.ts`
- `src/ops/builtins.ts`
- `src/ops/local-vars-transfer.ts`
- `src/ops/print/print-ops.ts`
- `src/ops/lists/query-ops.ts`
- `src/ops/lists/structure-ops.ts` (for decrement paths — noted above for byte arithmetic spots)
- `src/ops/access/select-ops.ts`
- `src/ops/stack/data-move-ops.ts`
- `src/lang/meta/conditionals.ts`
- `src/lang/meta/when-do.ts`
- `src/ops/core/core-ops.ts` (already using `SPBytes` for return-stack pushes)

### Manual `CELL_SIZE` arithmetic of note
- `(vm.SP - headerPos - CELL_SIZE) / CELL_SIZE` and similar constructs (primarily in `src/ops/lists/build-ops.ts`) mix byte deltas with cell results. These should be rewritten around cell counts and a shared helper that converts to bytes only when interacting with raw memory.
- `vm.SP / 4` idioms appear in several tests; once `vm.SP` returns cells these divisions disappear.

## Ambiguities / design considerations
1. **Return stack payload format in list ops** — `vm.rpush(vm.SP - CELL_SIZE)` currently records raw byte addresses. Decide whether future implementations keep return-stack operands in bytes (and therefore use `SPBytes`) or switch to cell indices plus a conversion at branch resolution time.
2. **Low-level fixtures writing raw memory** — Tests that directly poke `vm.memory` likely need byte offsets; introduce explicit helpers (e.g., `stackByteOffset(vm, slotIndex)`) to keep intent obvious while the canonical accessor exposes cells.
3. **Documentation footprints** — Multiple historical plan docs (`docs/plans/done/plan-08-*`) reference `vm.SP` byte semantics. They are archived but should be annotated or left untouched? (Probably safe to leave as historical context; flagging here for awareness.)

## Next steps (Phase 1 prerequisites)
- Create helper sketches for list-building math before refactors begin.
- Draft regression suite selection (stack + list ops) for quick reruns during incremental rewrites.
- Coordinate with documentation update owners so Phase 4 changes stay in sync with the refreshed naming.
