import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';
import { BYTES_PER_ELEMENT } from '../core/constants';

export interface TupleInfo {
  start: number;       // Start address of the tuple (TUPLE tag) in bytes
  end: number;         // End address of the tuple (after LINK tag) in bytes
  size: number;        // Number of elements in the tuple (excluding TUPLE and LINK tags)
  totalSize: number;   // Total size in bytes including TUPLE tag and LINK tag
  linkOffset: number;  // Offset of the LINK tag from the start of the tuple
}

export type StackArgInfo = [number, number]; // [offset, size]

/**
 * Finds a tuple starting at the given offset from the stack pointer.
 * @param vm - The VM instance
 * @param offset - The offset in bytes from the current stack pointer
 * @returns Tuple information or null if not found
 */
export function findTuple(vm: VM, offset: number = 0): TupleInfo | null {
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

/**
 * Finds an element in the stack starting from a given slot.
 * @param vm - The VM instance
 * @param startSlot - The slot to start searching from (0 = top of stack)
 * @returns A tuple of [nextSlot, size] where:
 *   - nextSlot is the offset to the next element
 *   - size is the size of the current element in slots
 */
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
