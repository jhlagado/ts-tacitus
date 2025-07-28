/**
 * @file src/ops/builtins-list.ts
 *
 * This file implements the basic list operations for the Tacit VM.
 *
 * Lists in Tacit are a fundamental data structure that allow grouping multiple values
 * together. They are implemented using a combination of LIST and LINK tagged values
 * on the stack. The implementation uses the return stack to track list boundaries during
 * construction.
 *
 * The list creation process involves:
 * 1. Opening a list with openListOp (triggered by '(' in source code)
 * 2. Pushing list elements onto the stack
 * 3. Closing the list with closeListOp (triggered by ')' in source code)
 *
 * Lists support nesting, and the VM maintains a listDepth counter to track nesting levels.
 * When a list is closed, a LINK tag is created that points to the list's contents on the stack.
 */
import { VM } from '../../src/core/vm';
import { fromTaggedValue, toTaggedValue, Tag } from '../../src/core/tagged';
import { toTaggedValueRaw } from '../../src/core/tagged-raw';
import { SEG_STACK } from '../../src/core/constants';
import { ReturnStackUnderflowError } from '../../src/core/errors';

/** Number of bytes per stack element */
const BYTES_PER_ELEMENT = 4;

/**
 * Implements the list opening operation.
 *
 * This operation is triggered by the '(' token in Tacit code and marks the beginning
 * of a list construction. It performs the following steps:
 * 1. Increments the VM's list depth counter to track nesting level
 * 2. Pushes a placeholder LIST tag with size 0 onto the stack
 * 3. Stores the position of this tag on the return stack for later reference
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 * openListOp(vm)
 *
 *
 *
 */
export function openListOp(vm: VM): void {
  if (vm.debug) console.log('openListOp: listDepth before', vm.listDepth);
  vm.listDepth++;
  const listTagRaw = toTaggedValueRaw(0, Tag.LIST);
  vm.pushRawBits(listTagRaw);
  const listPos = vm.SP - BYTES_PER_ELEMENT;
  vm.rpush(toTaggedValue(listPos, Tag.INTEGER));
  if (vm.debug)
    console.log(
      'openListOp: pushed LIST tag at position',
      listPos,
      'listDepth after',
      vm.listDepth,
    );
}

/**
 * Implements the list closing operation.
 *
 * This operation is triggered by the ')' token in Tacit code and finalizes a list
 * construction. It performs the following steps:
 * 1. Retrieves the list tag position from the return stack
 * 2. Calculates the actual size of the list based on stack positions
 * 3. Updates the placeholder LIST tag with the correct size
 * 4. For outermost lists (listDepth=1), pushes a LINK tag that references the list
 * 5. Decrements the VM's list depth counter
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 * closeListOp(vm)
 *
 *
 *
 *
 */
export function closeListOp(vm: VM): void {
  if (vm.RP < BYTES_PER_ELEMENT) {
    throw new ReturnStackUnderflowError('closeListOp', vm.getStackData());
  }

  const taggedListTagPos = vm.rpop();
  const { value: listTagPos } = fromTaggedValue(taggedListTagPos);
  const listSize = (vm.SP - listTagPos - BYTES_PER_ELEMENT) / BYTES_PER_ELEMENT;
  const newListTagRaw = toTaggedValueRaw(listSize, Tag.LIST);
  vm.memory.writeRawBits32(SEG_STACK, listTagPos, newListTagRaw);

  if (vm.listDepth === 1) {
    const relativeElements = (vm.SP - listTagPos) / BYTES_PER_ELEMENT;
    const linkTagRaw = toTaggedValueRaw(relativeElements, Tag.LINK);
    vm.pushRawBits(linkTagRaw);
  }

  vm.listDepth--;
}
