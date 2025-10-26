import {
  VM,
  Tag,
  fromTaggedValue,
  getListBounds,
  getListLength,
  CELL_SIZE,
  SEG_DATA,
} from '@src/core';

export interface CapsuleLayout {
  absBaseAddrBytes: number; // absolute byte address of slot0 (first payload cell)
  headerAbsAddrBytes: number; // absolute byte address of LIST header cell
  slotCount: number; // total payload slots (locals… + CODE)
  codeRef: number; // the CODE reference stored at slot0
}

/**
 * Reads and validates a capsule layout from a DATA_REF handle.
 * Ensures the referenced value is a LIST header and that slot0 contains a CODE reference.
 */
export function readCapsuleLayoutFromHandle(vm: VM, handle: number): CapsuleLayout {
  // Resolve list header/payload bounds via generic list bounds helper (absolute-only).
  const info = getListBounds(vm, handle);
  if (!info) {
    throw new Error('capsule handle does not reference a LIST');
  }

  const { header, absBaseAddrBytes } = info;

  const slotCount = getListLength(header);
  if (slotCount < 1) {
    throw new Error('capsule payload must include CODE slot');
  }

  // Compute header address and read slot0 (immediately beneath the header).
  const headerAbsAddr = absBaseAddrBytes + slotCount * CELL_SIZE;
  const codeCell = vm.memory.readFloat32(SEG_DATA, headerAbsAddr - CELL_SIZE);
  const { tag: codeTag } = fromTaggedValue(codeCell);
  if (codeTag !== Tag.CODE) {
    throw new Error('capsule slot0 must be a CODE reference');
  }

  return { absBaseAddrBytes, headerAbsAddrBytes: headerAbsAddr, slotCount, codeRef: codeCell };
}
