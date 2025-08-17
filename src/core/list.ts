/**
 * @file src/core/list.ts
 * Core utilities for TACIT Reverse Lists.
 */

import { VM } from './vm';
import { fromTaggedValue, isList } from './tagged';
import { SEG_STACK } from './constants';


/**
 * Extracts slot count from LIST header.
 * @param header Tagged LIST header value
 * @returns Number of slots in payload
 * @throws Error if header is not valid LIST
 */
export function getListSlotCount(header: number): number {
  if (!isList(header)) {
    throw new Error('Value is not an LIST header');
  }
  return fromTaggedValue(header).value;
}

/**
 * Skips entire LIST from stack.
 * @param vm The virtual machine instance
 */
export function skipList(vm: VM): void {
  validateListHeader(vm);

  const header = vm.peek();
  const slotCount = getListSlotCount(header);

  for (let i = 0; i < slotCount + 1; i++) {
    vm.pop();
  }
}

/**
 * Returns memory address of first payload slot.
 * @param vm The virtual machine instance
 * @returns Memory address of payload[0]
 */
export function getListPayloadStart(vm: VM): number {
  validateListHeader(vm);
  const header = vm.peek();
  const slotCount = getListSlotCount(header);
  if (slotCount === 0) {
    return vm.SP;
  }
  return vm.SP - 4;
}

/**
 * Validates LIST header at TOS.
 * @param vm The virtual machine instance
 * @throws Error if TOS is not valid LIST
 */
export function validateListHeader(vm: VM): void {
  vm.ensureStackSize(1, 'LIST header validation');

  const header = vm.peek();
  if (!isList(header)) {
    throw new Error('Expected LIST header at TOS');
  }

  const slotCount = getListSlotCount(header);
  vm.ensureStackSize(slotCount + 1, 'LIST payload validation');

  if (slotCount > 65535) {
    throw new Error(`LIST slot count ${slotCount} exceeds maximum of 65535`);
  }
}

/**
 * Finds memory address of logical element in LIST.
 * @param vm The virtual machine instance
 * @param header The LIST header value
 * @param headerAddr Memory address of LIST header
 * @param logicalIndex The logical index (0-based)
 * @returns Memory address or -1 if out of bounds
 */
export function getListElementAddress(
  vm: VM,
  header: number,
  headerAddr: number,
  logicalIndex: number,
): number {
  if (!isList(header)) {
    throw new Error('Invalid LIST header provided to getListElementAddress');
  }

  const totalSlots = getListSlotCount(header);

  if (logicalIndex < 0) return -1;

  let currentAddr = headerAddr - 4;
  let currentLogicalIndex = 0;
  let remainingSlots = totalSlots;

  while (remainingSlots > 0 && currentLogicalIndex <= logicalIndex) {
    const currentValue = vm.memory.readFloat32(SEG_STACK, currentAddr);
    let stepSize = 1;
    let elementStartAddr = currentAddr;

    if (isList(currentValue)) {
      elementStartAddr = currentAddr;
      stepSize = getListSlotCount(currentValue) + 1;
    }

    if (currentLogicalIndex === logicalIndex) {
      return elementStartAddr;
    }

    currentAddr -= stepSize * 4;
    remainingSlots -= stepSize;
    currentLogicalIndex++;
  }

  return -1;
}

/**
 * Reverses span of values on stack in-place.
 * @param vm The virtual machine instance
 * @param spanSize Number of stack slots to reverse
 */
export function reverseSpan(vm: VM, spanSize: number): void {
  if (spanSize <= 1) return;

  vm.ensureStackSize(spanSize, 'reverse span operation');

  const startAddr = vm.SP - spanSize * 4;
  const endAddr = vm.SP - 4;

  for (let i = 0; i < Math.floor(spanSize / 2); i++) {
    const leftAddr = startAddr + i * 4;
    const rightAddr = endAddr - i * 4;

    const leftValue = vm.memory.readFloat32(SEG_STACK, leftAddr);
    const rightValue = vm.memory.readFloat32(SEG_STACK, rightAddr);

    vm.memory.writeFloat32(SEG_STACK, leftAddr, rightValue);
    vm.memory.writeFloat32(SEG_STACK, rightAddr, leftValue);
  }
}
