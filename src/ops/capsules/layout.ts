import {
  VM,
  Tag,
  fromTaggedValue,
  getListBounds,
  getListLength,
  SEG_RSTACK,
  CELL_SIZE,
} from '@src/core';

export interface CapsuleLayout {
  segment: number;
  baseAddr: number; // address of slot0 (first payload cell)
  headerAddr: number; // address of LIST header cell
  slotCount: number; // total payload slots (locals… + CODE)
  codeRef: number; // the CODE reference stored at slot0
}

/**
 * Reads and validates a capsule layout from a DATA_REF handle.
 * Ensures the referenced value is a LIST header and that slot0 contains a CODE reference.
 */
export function readCapsuleLayoutFromHandle(vm: VM, handle: number): CapsuleLayout {
  // Resolve list header/payload bounds via generic list bounds helper (segment‑aware).
  const info = getListBounds(vm, handle);
  if (!info) {
    throw new Error('capsule handle does not reference a LIST');
  }

  const { header, baseAddr, segment } = info;

  const slotCount = getListLength(header);
  if (slotCount < 1) {
    throw new Error('capsule payload must include CODE slot');
  }

  // Compute header address and read slot0 (immediately beneath the header).
  const headerAddr = baseAddr + slotCount * CELL_SIZE;
  const codeCell = vm.memory.readFloat32(segment, headerAddr - CELL_SIZE);
  const { tag: codeTag } = fromTaggedValue(codeCell);
  if (codeTag !== Tag.CODE) {
    throw new Error('capsule slot0 must be a CODE reference');
  }

  return { segment, baseAddr, headerAddr, slotCount, codeRef: codeCell };
}
