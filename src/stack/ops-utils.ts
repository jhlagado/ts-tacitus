import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';
import { TupleInfo } from './types';

const BYTES_PER_ELEMENT = 4;

/**
 * Operations-specific stack utilities with additional functionality
 * used by the VM's opcode implementations.
 */

export function findTuple(vm: VM, offset: number = 0): TupleInfo | null {
  // This is the more complete version used by ops
  try {
    const linkAddr = vm.SP - offset - BYTES_PER_ELEMENT;

    if (linkAddr < 0 || linkAddr >= vm.SP) {
      return null;
    }

    const linkValue = vm.memory.readFloat32(SEG_STACK, linkAddr);
    const linkDecoded = fromTaggedValue(linkValue);

    if (linkDecoded.tag !== Tag.LINK) {
      return null;
    }

    const totalElements = linkDecoded.value;
    const tupleStart = linkAddr - (totalElements * BYTES_PER_ELEMENT);

    if (tupleStart < 0) {
      return null;
    }

    const tupleTagValue = vm.memory.readFloat32(SEG_STACK, tupleStart);
    const tupleDecoded = fromTaggedValue(tupleTagValue);

    if (tupleDecoded.tag !== Tag.TUPLE) {
      return null;
    }

    const dataElements = tupleDecoded.value;

    if (totalElements !== dataElements + 1) {
      return null;
    }

    const totalSize = (dataElements + 2) * BYTES_PER_ELEMENT;
    const tupleEnd = tupleStart + totalSize;

    return {
      start: tupleStart,
      end: tupleEnd,
      size: dataElements,
      totalSize,
      linkOffset: totalSize - BYTES_PER_ELEMENT
    };
  } catch (_e) {
    return null;
  }
}

export function findElement(vm: VM, startSlot: number = 0): [number, number] {
  const slotAddr = vm.SP / BYTES_PER_ELEMENT - startSlot - 1;

  if (slotAddr < 0 || slotAddr * BYTES_PER_ELEMENT >= vm.SP) {
    return [startSlot + 1, 1];
  }

  const addr = slotAddr * BYTES_PER_ELEMENT;
  const value = vm.memory.readFloat32(SEG_STACK, addr);
  const { tag, value: tagValue } = fromTaggedValue(value);

  if (tag === Tag.LINK) {
    const tupleSlot = slotAddr - tagValue;
    if (tupleSlot >= 0) {
      const tupleAddr = tupleSlot * BYTES_PER_ELEMENT;
      const tupleValue = vm.memory.readFloat32(SEG_STACK, tupleAddr);
      const { tag: tupleTag, value: tupleSize } = fromTaggedValue(tupleValue);

      if (tupleTag === Tag.TUPLE) {
        const elementSize = tupleSize + 2;
        return [startSlot + elementSize, elementSize];
      }
    }
  }

  return [startSlot + 1, 1];
}

function reverseRange(vm: VM, startAddr: number, slotCount: number): void {
  if (slotCount <= 1) return;

  const lastIndex = slotCount - 1;
  const endAddr = startAddr + (slotCount * BYTES_PER_ELEMENT);

  if (startAddr < 0 || endAddr > vm.SP) {
    throw new Error(`Range [${startAddr}, ${endAddr}) is outside stack bounds [0, ${vm.SP})`);
  }

  for (let i = 0; i < slotCount / 2; i++) {
    const leftAddr = startAddr + (i * BYTES_PER_ELEMENT);
    const rightAddr = startAddr + ((lastIndex - i) * BYTES_PER_ELEMENT);

    if (leftAddr >= rightAddr) break;

    try {
      const leftValue = vm.memory.readFloat32(SEG_STACK, leftAddr);
      const rightValue = vm.memory.readFloat32(SEG_STACK, rightAddr);

      vm.memory.writeFloat32(SEG_STACK, leftAddr, rightValue);
      vm.memory.writeFloat32(SEG_STACK, rightAddr, leftValue);
    } catch (e) {
      throw new Error(`Failed to reverse range: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// Original rangeRoll implementation
export function rangeRoll(vm: VM, startSlot: number, rangeSize: number, shiftSlots: number): void {
  if (rangeSize <= 0 || shiftSlots === 0) return;
  
  // Convert shift to positive and take modulo rangeSize
  shiftSlots = ((shiftSlots % rangeSize) + rangeSize) % rangeSize;
  if (shiftSlots === 0) return;
  
  const baseAddr = startSlot * BYTES_PER_ELEMENT;
  
  // Use three reverse algorithm for rotation:
  // rotate(arr, n) = reverse(reverse(arr[0..n-1]) + reverse(arr[n..m-1]))
  const leftSize = rangeSize - shiftSlots;
  const rightSize = shiftSlots;

  if (leftSize > 0) {
    reverseRange(vm, baseAddr, leftSize);
  }

  // Second, reverse the right part
  if (rightSize > 0) {
    reverseRange(vm, baseAddr + (leftSize * BYTES_PER_ELEMENT), rightSize);
  }

  // Finally, reverse the entire range
  reverseRange(vm, baseAddr, rangeSize);
}


