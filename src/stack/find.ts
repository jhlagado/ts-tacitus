/**
 * @file src/stack/find.ts
 * 
 * This file implements stack element finding utilities for the Tacit VM.
 * 
 * The stack in Tacit can contain both simple values and complex data structures like lists.
 * Finding elements on the stack requires understanding their structure and size.
 * This module provides utilities to navigate the stack and identify elements
 * regardless of their complexity.
 */

import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';
import { BYTES_PER_ELEMENT } from '../core/constants';

/**
 * Type representing information about a stack argument.
 * A tuple containing [nextSlot, size] where:
 * - nextSlot: The offset to the next element after the current one
 * - size: The size of the current element in slots
 */
export type StackArgInfo = [number, number];

/**
 * Finds an element in the stack starting from a given slot.
 *
 * This function can identify both simple values and lists. For lists, it will
 * return the total size including the LIST tag, elements, and LINK tag.
 * 
 * The function works by examining the tagged value at the specified slot:
 * 1. For simple values (numbers, integers, etc.), it returns a size of 1
 * 2. For lists, it identifies the LIST tag and LINK tag structure and returns
 *    the total size of the list (LIST tag + elements + LINK tag)
 *
 * @param vm - The VM instance containing the stack to search
 * @param startSlot - The slot offset from the current stack pointer (0 = top of stack)
 * @returns A tuple of [nextSlot, size] where:
 *   - nextSlot: The offset to the next element after the current one
 *   - size: The size of the current element in slots (1 for simple values, n+2 for lists)
 *
 * @example
 * // For a simple value at the top of the stack
 * const [next, size] = findElement(vm, 0);
 * // Result: next = 1, size = 1
 *
 * @example
 * // For a list like (1 2 3) at the top of the stack
 * const [next, size] = findElement(vm, 0);
 * // Result: next = 5, size = 5 (LIST tag + 3 elements + LINK tag)
 *
 * @example
 * // Traversing multiple elements
 * const [next1, size1] = findElement(vm, 0);
 * const [next2, size2] = findElement(vm, next1);
 * // This pattern allows walking through the entire stack
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
    const listSlot = slotAddr - tagValue;
    if (listSlot >= 0) {
      const listAddr = listSlot * BYTES_PER_ELEMENT;
      const listValue = vm.memory.readFloat32(SEG_STACK, listAddr);
      const { tag: listTag, value: listSize } = fromTaggedValue(listValue);

      if (listTag === Tag.LIST) {
        const elementSize = listSize + 2;
        return [startSlot + elementSize, elementSize];
      }
    }
  }

  return [startSlot + 1, 1];
}
