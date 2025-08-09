/**
 * @file src/ops/builtins-list.ts
 *
 * This file implements the LIST operations for the Tacit VM.
 *
 * LISTs (Reverse Lists) are stack-native compound data structures that store
 * elements in reverse order with the header at top-of-stack. This enables
 * O(1) prepend operations and O(1) skip/drop of entire structures while
 * maintaining contiguous memory layout for cache efficiency.
 *
 * The LIST operations include:
 * - Construction: openListOp, closeListOp
 * - Inspection: listSlotOp
 * - Manipulation: listSkipOp, listPrependOp, listAppendOp
 * - Access: listGetAtOp, listSetAtOp
 */

import { VM } from '../core/vm';
import { fromTaggedValue, toTaggedValue, Tag, isInteger, isList } from '../core/tagged';
import { SEG_STACK } from '../core/constants';
import { ReturnStackUnderflowError } from '../core/errors';
import {
  getListSlotCount,
  skipList,
  validateListHeader,
  reverseSpan,
  getListElementAddress,
} from '../core/list';

const BYTES_PER_ELEMENT = 4;
const NIL = toTaggedValue(0, Tag.INTEGER);

/**
 * Opens an LIST construction with '[' token.
 * Stack effect: ( — )
 * Return stack: Pushes current SP position for later span calculation.
 */
export function openListOp(vm: VM): void {
  if (vm.debug) console.log('openListOp: listDepth before', vm.listDepth);
  vm.listDepth++;

  // Push placeholder LIST header at current top and remember its address
  const placeholderHeader = toTaggedValue(0, Tag.LIST);
  vm.push(placeholderHeader);
  const headerPos = vm.SP - BYTES_PER_ELEMENT;
  vm.rpush(toTaggedValue(headerPos, Tag.INTEGER));

  if (vm.debug)
    console.log(
      'openListOp: pushed placeholder header at',
      headerPos,
      'listDepth after',
      vm.listDepth,
    );
}

/**
 * Closes an LIST construction with ']' token.
 * Stack effect: ( values... — list )
 * Reverses the accumulated values and pushes LIST header.
 */
export function closeListOp(vm: VM): void {
  if (vm.RP < BYTES_PER_ELEMENT) {
    throw new ReturnStackUnderflowError('closeListOp', vm.getStackData());
  }

  // Retrieve header position from return stack
  const taggedHeaderPos = vm.rpop();
  const { value: headerPos } = fromTaggedValue(taggedHeaderPos);

  // Compute payload size (number of elements after header)
  const payloadSlots = (vm.SP - headerPos - BYTES_PER_ELEMENT) / BYTES_PER_ELEMENT;

  if (vm.debug)
    console.log(
      'closeListOp: headerPos',
      headerPos,
      'payloadSlots',
      payloadSlots,
      'listDepth',
      vm.listDepth,
    );

  // Update placeholder header in place with correct slot count
  const finalizedHeader = toTaggedValue(payloadSlots, Tag.LIST);
  vm.memory.writeFloat32(SEG_STACK, headerPos, finalizedHeader);

  // Reverse header + payload to bring header to TOS.
  // Preferred behavior: reverse only at outermost depth.
  // Backward-compatibility fallback: if listDepth is not present, reverse unconditionally.
  const anyVm = vm as unknown as { listDepth?: number };
  const hasRDepth = typeof anyVm.listDepth === 'number';
  const isOutermost = hasRDepth ? anyVm.listDepth === 1 : true;

  if (isOutermost) {
    const totalSpan = (vm.SP - headerPos) / BYTES_PER_ELEMENT; // header + payload
    if (totalSpan > 1) {
      reverseSpan(vm, totalSpan);
    }
  }

  vm.listDepth--;

  if (vm.debug)
    console.log(
      'closeListOp: finalized LIST with',
      payloadSlots,
      'slots, listDepth now',
      vm.listDepth,
    );
}

/**
 * Gets the slot count from an LIST header.
 * Stack effect: ( list — list n )
 */
export function listSlotOp(vm: VM): void {
  validateListHeader(vm);

  const header = vm.peek();
  const slotCount = getListSlotCount(header);

  vm.push(toTaggedValue(slotCount, Tag.INTEGER));
}

/**
 * Skips (drops) an entire LIST from the stack.
 * Stack effect: ( list — )
 */
export function listSkipOp(vm: VM): void {
  skipList(vm);
}

/**
 * Prepends a value to an LIST.
 * Stack effect: ( val list — list' )
 * This is an O(1) operation - just push value and increment header.
 */
export function listPrependOp(vm: VM): void {
  vm.ensureStackSize(2, 'list prepend');

  const header = vm.pop(); // LIST header at TOS
  const value = vm.pop(); // Value to prepend

  if (!isList(header)) {
    vm.push(value); // Restore stack
    vm.push(header);
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);

  // Push value (becomes new payload-0), then updated header
  vm.push(value);
  const newHeader = toTaggedValue(slotCount + 1, Tag.LIST);
  vm.push(newHeader);
}

/**
 * Appends a value to an LIST.
 * Stack effect: ( val list — list' )
 * This is an O(s) operation requiring payload shift to insert at bottom.
 */
export function listAppendOp(vm: VM): void {
  vm.ensureStackSize(2, 'list append');

  const header = vm.pop(); // LIST header at TOS
  const value = vm.pop(); // Value to append

  if (!isList(header)) {
    vm.push(value); // Restore stack
    vm.push(header);
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);

  if (slotCount === 0) {
    // Empty LIST - just push value and header
    vm.push(value);
    vm.push(toTaggedValue(1, Tag.LIST));
    return;
  }

  // Shift all payload down by one slot to make room at bottom
  // Copy existing payload
  const payload: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    payload.push(vm.pop());
  }

  // Push appended value first (goes to bottom of payload)
  vm.push(value);

  // Push existing payload back (in reverse order to maintain LIST layout)
  for (let i = payload.length - 1; i >= 0; i--) {
    vm.push(payload[i]);
  }

  // Push updated header
  const newHeader = toTaggedValue(slotCount + 1, Tag.LIST);
  vm.push(newHeader);
}

/**
 * Gets a value at a specific index from an LIST.
 * Stack effect: ( list i — val )
 * Returns NIL if index is out of bounds.
 */
export function listGetAtOp(vm: VM): void {
  vm.ensureStackSize(2, 'list get-at');

  const indexValue = vm.pop();
  const header = vm.peek(); // Keep LIST on stack

  if (!isList(header) || !isInteger(indexValue)) {
    vm.push(NIL);
    return;
  }

  const index = fromTaggedValue(indexValue).value;
  const slotCount = getListSlotCount(header);

  if (index < 0 || index >= slotCount) {
    vm.push(NIL);
    return;
  }

  // Use traversal to find element address (handles compound values)
  const targetAddr = getListElementAddress(vm, header, vm.SP - 4, index);

  if (targetAddr === -1) {
    vm.pop(); // Remove LIST header
    vm.push(NIL);
    return;
  }

  const value = vm.memory.readFloat32(SEG_STACK, targetAddr);

  vm.pop(); // Remove LIST header
  vm.push(value);
}

/**
 * Sets a value at a specific index in an LIST.
 * Stack effect: ( list i val — list )
 * Returns original LIST if index out of bounds or trying to overwrite compound.
 */
export function listSetAtOp(vm: VM): void {
  vm.ensureStackSize(3, 'list set-at');

  const newValue = vm.pop();
  const indexValue = vm.pop();
  const header = vm.peek(); // Keep LIST on stack

  if (!isList(header) || !isInteger(indexValue)) {
    vm.pop(); // Remove invalid header
    vm.push(NIL);
    return;
  }

  const index = fromTaggedValue(indexValue).value;
  const slotCount = getListSlotCount(header);

  if (index < 0 || index >= slotCount) {
    vm.pop(); // Remove LIST header
    vm.push(NIL);
    return;
  }

  // Use traversal to find element address (handles compound values)
  const headerAddr = vm.SP - 4; // Header is at TOS
  const targetAddr = getListElementAddress(vm, header, headerAddr, index);

  if (targetAddr === -1) {
    vm.pop(); // Remove LIST header
    vm.push(NIL);
    return;
  }

  // Check if target location contains a compound value
  const oldValue = vm.memory.readFloat32(SEG_STACK, targetAddr);

  if (isList(oldValue)) {
    vm.pop(); // Remove LIST header from stack
    vm.push(NIL); // Refuse to overwrite compound values
    return;
  }

  // Perform in-place update
  vm.memory.writeFloat32(SEG_STACK, targetAddr, newValue);

  // Return the modified LIST (header already on stack)
}
