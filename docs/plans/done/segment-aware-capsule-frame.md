# Segment-Aware Capsule Dispatch — Code Study & Proposal

## 1. Current Implementation (Code Pointers)

- Capsule construction (`src/ops/capsules/capsule-ops.ts`, `exitConstructorOp`)
  - Assumes locals live on `SEG_RSTACK`
  - Pushes `[payload..., CODE_REF, LIST header]`
  - Leaves an `RSTACK_REF` handle on the data stack
- Dispatch (`dispatchOp` in the same file)
  - Pops receiver + method, saves IP and BP, binds BP to `layout.baseAddr / CELL_SIZE`
  - Restores BP on exit
- `getVarRef` (`src/core/refs.ts`)
  - Returns `createSegmentRef(segment, base + slot)` based on BP
  - Works only when BP reflects the segment where the payload lives (currently assumes `SEG_RSTACK`)
- Global compounds (`initializeGlobalCompound` in `src/ops/lists/query-ops.ts`)
  - Copy payload into `SEG_GLOBAL`
  - Slot stores a `GLOBAL_REF` pointing to the header
  - No case where a slot contains the LIST header directly: compounds are always referenced
- Tests showing the gap
  - `capsule-integration.frame-extend.test.ts`: locals path (`'inc &c dispatch`) works because the capsule stays on `SEG_RSTACK`
  - `capsule-dispatch.global-ref.test.ts`: `'inc &gc dispatch` fails (currently skipped)

## 2. Issue Summary

- Dispatch binds BP assuming the capsule payload behaves like a colon frame on `SEG_RSTACK`.
- When the capsule payload lives on `SEG_GLOBAL` (e.g. after `global` storage), `+>` in the capsule body reads the wrong cell, resulting in “broadcast type mismatch”.
- The specs (docs/specs/capsules.md §3) state that dispatch “rebinds BP to the capsule payload” but do not restrict capsules to `SEG_RSTACK`.

## 3. Observations

1. Handles already carry segment information (ref tags).
2. Slots never contain the header directly; alias-follow (`resolveReference` once) is enough to recover a header handle.
3. Colon frames only ever bind `BP` to a numeric cell index (`vm.BP = vm.RSP` in call prologues).

## 4. Proposed Approach (Spec-Aligned, No Extra VM State)

### 4.1 Normalise receiver to a header ref

In `dispatchOp`:
```ts
if (isRef(receiver)) {
  const { address, segment } = resolveReference(vm, receiver);   // slot address
  const cellValue = vm.memory.readFloat32(segment, address);     // slot contents
  if (isRef(cellValue)) {
    receiver = cellValue;                                       // alias → header ref
  } else {
    throw new Error('capsule handle does not reference a LIST');
  }
}
```
(We never see a LIST header stored directly in the slot.)

### 4.2 Bind the frame base to that ref

Instead of treating BP as “cells”, let it hold either:
- a plain number (colon frames, current behaviour), or
- a capsule handle (tagged ref).

Concrete steps:
1. **Save caller base:** push `vm.BP` as-is onto the return stack (`vm.rpush(vm.BP)`).
2. **Bind capsule base:** assign `vm.BP = receiver` (the header ref).
3. **Restore:** pop the saved value; if `isRef(value)` return true, keep the ref; otherwise set BP back to the numeric cell index.

### 4.3 Update `getVarRef`

```ts
const base = vm.BP;
if (isRef(base)) {
  const { address, segment } = resolveReference(vm, base);
  const baseCell = address / CELL_SIZE;
  return createSegmentRef(segment, baseCell + slotNumber);
}

const baseCell = Math.trunc(base); // numeric colon frame
return toTaggedValue(baseCell + slotNumber, Tag.RSTACK_REF);
```

Other sites that read/write locals (e.g. `initVarOp`, diagnostics) should use the same branch: resolve when BP is a ref; otherwise treat BP as the traditional cell index.

## 5. Tests & Docs

- Re-enable `capsule-dispatch.global-ref.test.ts`: `'inc &gc dispatch` should now work without extra `fetch`/`ref`.
- Existing tests for locals and data-stack refs must remain green.
- Add a sanity capsule test that exposes `&slot` via dispatch to ensure the returned ref has the correct segment/cell when the capsule lives in SEG_GLOBAL.
- Update docs to note that BP is interpreted as a ref during capsule dispatch.

## 6. Rationale

- Works entirely with refs (already part of the tag system); no GC or hidden state.
- Colon definitions keep using numeric BP with no behaviour change.
- Dispatch simply binds the capsule base to the handle we already have; locals resolve via `resolveReference + createSegmentRef`.
- Directly honours the “rebinds BP to the capsule payload” wording in the spec.
