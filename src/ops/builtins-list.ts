/**
 * @file src/ops/builtins-list.ts
 * This file implements the basic list operations for the Tacit VM.
 */
import { VM } from '../core/vm';
import { toTaggedValue, fromTaggedValue, Tag } from '../core/tagged';

import { SEG_STACK } from '../core/memory';

const BYTES_PER_ELEMENT = 4;

/**
 * Handles opening of a list with '('
 * - Increments list depth counter
 * - Pushes a placeholder list tag with size 0
 * - Pushes the list tag's position onto the return stack
 */
export function openTupleOp(vm: VM): void {
  vm.listDepth++;
  vm.push(toTaggedValue(0, Tag.LIST));
  vm.rpush(toTaggedValue(vm.SP - BYTES_PER_ELEMENT, Tag.INTEGER));
}

/**
 * Handles closing of a list with ')'
 * - Calculates list size
 * - Updates the placeholder list tag with the correct size
 * - For outermost lists, also pushes a reference to the list tag
 */
export function closeTupleOp(vm: VM): void {
  const taggedTupleTagPos = vm.rpop();
  const { value: listTagPos } = fromTaggedValue(taggedTupleTagPos);
  const listSize = (vm.SP - listTagPos - BYTES_PER_ELEMENT) / BYTES_PER_ELEMENT;
  vm.memory.writeFloat32(SEG_STACK, listTagPos, toTaggedValue(listSize, Tag.LIST));
  if (vm.listDepth === 1) {
    const relativeElements = (vm.SP - listTagPos) / BYTES_PER_ELEMENT;
    vm.push(toTaggedValue(relativeElements, Tag.LINK));
  }
  vm.listDepth--;
}
