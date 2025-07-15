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
import { SEG_STACK } from '../core/constants';
import { fromTaggedValue, Tag } from '../core/tagged'; // Tag enum for identifying value types
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
 * @param vm - The `VM` instance containing the stack to search.
 * @param startSlot - The slot offset from the current stack pointer (0 = top of stack).
 * @returns A tuple `[nextSlot, size]` where:
 *   - `nextSlot`: The offset to the next element after the current one.
 *   - `size`: The size of the current element in slots (1 for simple values, n+2 for lists). An element's size includes its tag and any associated data (e.g., list elements, link tags).
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
  // Calculate the absolute memory address of the element based on the current stack pointer (SP)
  // and the relative startSlot. The stack grows downwards, so we subtract from SP.
  const slotAddr = vm.SP / BYTES_PER_ELEMENT - startSlot - 1;

  // If the calculated slot address is out of bounds (below 0 or beyond the current stack boundary),
  // it implies an attempt to access an invalid stack position. In such cases, we return a default
  // size of 1 and advance the startSlot by 1, treating it as a single-element access.
  if (slotAddr < 0 || slotAddr * BYTES_PER_ELEMENT >= vm.SP) {
    return [startSlot + 1, 1];
  }

  // Convert the slot address to a byte address for memory access.
  const addr = slotAddr * BYTES_PER_ELEMENT;
  // Read the 32-bit float value from the stack at the calculated address.
  const value = vm.memory.readFloat32(SEG_STACK, addr);
  // Decode the tagged value to extract its tag and internal value.
  const { tag, value: tagValue } = fromTaggedValue(value);

  // Check if the current element is a Tag.LINK. A LINK tag indicates the end of a list
  // and points back to the corresponding Tag.LIST element, which contains the list's size.
  if (tag === Tag.LINK) {
    // Calculate the slot address of the corresponding Tag.LIST element.
    // The `tagValue` of a LINK tag stores the relative offset to its LIST tag.
    const listSlot = slotAddr - tagValue;
    // Ensure the calculated list slot is valid (non-negative).
    if (listSlot >= 0) {
      // Convert the list slot to a byte address.
      const listAddr = listSlot * BYTES_PER_ELEMENT;
      // Read the value at the list's address.
      const listValue = vm.memory.readFloat32(SEG_STACK, listAddr);
      // Decode the list's tagged value to get its tag and the actual list size.
      const { tag: listTag, value: listSize } = fromTaggedValue(listValue);

      // If the element at `listSlot` is indeed a Tag.LIST, then we have found a complete list.
      if (listTag === Tag.LIST) {
        // The total size of the list on the stack includes the LIST tag itself, all its elements,
        // and the LINK tag. Hence, `listSize + 2` (1 for LIST tag, 1 for LINK tag).
        const elementSize = listSize + 2;
        // Return the next slot after this list and its total size.
        return [startSlot + elementSize, elementSize];
      }
    }
  }

  // If the element is not a LINK tag (i.e., it's a simple value like NUMBER, INTEGER, CODE, STRING, etc.),
  // it occupies a single slot on the stack. Advance the startSlot by 1 and return a size of 1.
  return [startSlot + 1, 1];
}
