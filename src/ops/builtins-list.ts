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
export function openListOp(vm: VM): void {
  if (vm.debug) console.log('openListOp: listDepth before', vm.listDepth);
  vm.listDepth++;
  const listTag = toTaggedValue(0, Tag.LIST);
  vm.push(listTag);
  const listPos = vm.SP - BYTES_PER_ELEMENT;
  vm.rpush(toTaggedValue(listPos, Tag.INTEGER));
  if (vm.debug) console.log('openListOp: pushed LIST tag at position', listPos, 'listDepth after', vm.listDepth);
}

/**
 * Handles closing of a list with ')'
 * - Calculates list size
 * - Updates the placeholder list tag with the correct size
 * - For outermost lists, also pushes a reference to the list tag
 */
export function closeListOp(vm: VM): void {
  if (vm.debug) console.log('closeListOp: listDepth before', vm.listDepth);
  const taggedListTagPos = vm.rpop();
  const { value: listTagPos } = fromTaggedValue(taggedListTagPos);
  const listSize = (vm.SP - listTagPos - BYTES_PER_ELEMENT) / BYTES_PER_ELEMENT;
  const newListTag = toTaggedValue(listSize, Tag.LIST);
  vm.memory.writeFloat32(SEG_STACK, listTagPos, newListTag);
  if (vm.debug) console.log('closeListOp: updated LIST tag at position', listTagPos, 'with size', listSize);
  
  if (vm.listDepth === 1) {
    const relativeElements = (vm.SP - listTagPos) / BYTES_PER_ELEMENT;
    const linkTag = toTaggedValue(relativeElements, Tag.LINK);
    vm.push(linkTag);
    if (vm.debug) console.log('closeListOp: pushed LINK tag with offset', relativeElements);
  }
  
  vm.listDepth--;
  if (vm.debug) console.log('closeListOp: listDepth after', vm.listDepth);
}
