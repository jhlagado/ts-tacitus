import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';
import { BYTES_PER_ELEMENT } from '../core/constants';

export type StackArgInfo = [number, number]; // [offset, size]

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

/**
 * Finds a tuple starting at the given slot offset from the stack pointer.
 * @param vm - The VM instance
 * @param startSlot - The slot offset from the current stack pointer (0 = top of stack)
 * @returns A tuple of [nextSlot, size] where:
 *   - nextSlot is the offset to the next element
 *   - size is the size of the current element in slots (1 for non-tuples, n+2 for tuples)
 */
export function findTupleSlots(vm: VM, startSlot: number = 0): [number, number] {
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
        const elementSize = tupleSize + 2; // TUPLE tag + elements + LINK
        return [startSlot + elementSize, elementSize];
      }
    }
  }

  return [startSlot + 1, 1];
}
