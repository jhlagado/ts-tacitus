import {
  VM,
  SEG_RSTACK,
  CELL_SIZE,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  getListBounds,
  getListLength,
} from '@src/core';

export interface CapsuleLayout {
  codeRef: number;
  slotCount: number;
  payloadStartAddr: number;
  segment: number;
}

export function freezeCapsule(vm: VM, entryAddr: number): void {
  const localCount = vm.RSP - vm.BP;
  for (let i = 0; i < localCount; i++) {
    const addr = (vm.BP + i) * CELL_SIZE;
    const value = vm.memory.readFloat32(SEG_RSTACK, addr);
    vm.push(value);
  }
  vm.push(toTaggedValue(entryAddr, Tag.CODE));
  vm.push(toTaggedValue(localCount + 1, Tag.LIST));
}

export function readCapsuleLayout(vm: VM, capsuleHeader: number): CapsuleLayout {
  const bounds = getListBounds(vm, capsuleHeader);
  if (!bounds) {
    throw new Error('capsule header not on accessible stack segment');
  }

  const slotCount = getListLength(bounds.header);
  if (slotCount < 1) {
    throw new Error('capsule payload must contain code reference');
  }

  const codeCell = vm.memory.readFloat32(bounds.segment, bounds.baseAddr);
  const { tag } = fromTaggedValue(codeCell);
  if (tag !== Tag.CODE) {
    throw new Error('capsule slot0 must be CODE reference');
  }

  return {
    codeRef: codeCell,
    slotCount,
    payloadStartAddr: bounds.baseAddr,
    segment: bounds.segment,
  };
}
