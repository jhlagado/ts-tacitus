import { type VM, Tag, getTaggedInfo, getListBounds, getListLength, memoryReadCell } from '@src/core';

export type CapsuleLayout = {
  baseCell: number; // cell index of slot0 (first payload cell)
  headerCell: number; // cell index of LIST header cell
  slotCount: number; // total payload slots (locals… + CODE)
  codeRef: number; // the CODE reference stored at slot0
};

/**
 * Reads and validates a capsule layout from a REF handle.
 * Ensures the referenced value is a LIST header and that slot0 contains a CODE reference.
 */
export function readCapsuleLayoutFromHandle(vm: VM, handle: number): CapsuleLayout {
  // Resolve list header/payload bounds via generic list bounds helper (absolute-only).
  const info = getListBounds(vm, handle);
  if (!info) {
    throw new Error('capsule handle does not reference a LIST');
  }

  const { header, baseCell, headerCell } = info;

  if (getListLength(header) < 1) {
    throw new Error('capsule payload must include CODE slot');
  }

  const codeCell = memoryReadCell(vm.memory, headerCell - 1);
  const { tag: codeTag } = getTaggedInfo(codeCell);
  if (codeTag !== Tag.CODE) {
    throw new Error('capsule slot0 must be a CODE reference');
  }

  return { baseCell, headerCell, slotCount: getListLength(header), codeRef: codeCell };
}
