import {
  VM,
  getTag,
  Tag,
  fromTaggedValue,
  getListBounds,
  getListLength,
  SEG_DATA,
  CELL_SIZE,
} from '@src/core';

/**
 * Asserts that the provided value is a well-formed capsule list.
 * Throws a descriptive error if invariants are violated.
 */
export function assertCapsuleShape(vm: VM, value: number, label = 'capsule'): void {
  const tag = getTag(value);
  if (tag !== Tag.LIST) {
    throw new Error(`Expected ${label} to be a LIST, found ${Tag[tag] ?? 'unknown tag'}`);
  }

  const info = getListBounds(vm, value);
  if (!info) {
    throw new Error(`Expected ${label} to reference a LIST on stack or via alias`);
  }

  if (getListLength(info.header) < 1) {
    throw new Error(`Expected ${label} payload to contain at least CODE_REF`);
  }

  const slotCount = getListLength(info.header);
  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  const codeCell = vm.memory.readFloat32(SEG_DATA, headerAbsAddr - CELL_SIZE);

  const { tag: codeTag } = fromTaggedValue(codeCell);
  if (codeTag !== Tag.CODE) {
    throw new Error(
      `Expected ${label} slot0 to be CODE_REF, found ${Tag[codeTag] ?? 'unknown tag'}`,
    );
  }
}
