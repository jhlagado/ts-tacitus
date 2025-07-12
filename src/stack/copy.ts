import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { BYTES_PER_ELEMENT } from '../core/constants';

/**
 * Copies a range of elements in the stack.
 * @param vm - The VM instance
 * @param startAddr - The starting address of the range to reverse (in bytes)
 * @param slotCount - The number of slots to reverse
 */
export function copyRange(vm: VM, startAddr: number, slotCount: number): void {
  if (slotCount <= 0) return;
  let addr = startAddr;
  for (let i = 0; i < slotCount; i++) {
    const temp = vm.memory.readFloat32(SEG_STACK, addr);
    vm.push(temp);
    addr += BYTES_PER_ELEMENT;
  }
}
