/**
 * @file src/ops/builtins-rlist.ts
 *
 * This file implements the RLIST operations for the Tacit VM.
 *
 * RLISTs (Reverse Lists) are stack-native compound data structures that store
 * elements in reverse order with the header at top-of-stack. This enables
 * O(1) prepend operations and O(1) skip/drop of entire structures while
 * maintaining contiguous memory layout for cache efficiency.
 *
 * The RLIST operations include:
 * - Construction: openRListOp, closeRListOp
 * - Inspection: rlistSlotOp
 * - Manipulation: rlistSkipOp, rlistPrependOp, rlistAppendOp
 * - Access: rlistGetAtOp, rlistSetAtOp
 */

import { VM } from '../core/vm';
import { fromTaggedValue, toTaggedValue, Tag, isInteger, isRList } from '../core/tagged';
import { SEG_STACK } from '../core/constants';
import { ReturnStackUnderflowError } from '../core/errors';
import {
  createRList,
  getRListSlotCount,
  skipRList,
  validateRListHeader,
  reverseSpan,
  getRListElementAddress,
} from '../core/rlist';

const BYTES_PER_ELEMENT = 4;
const NIL = toTaggedValue(0, Tag.INTEGER);

/**
 * Opens an RLIST construction with '[' token.
 * Stack effect: ( — )
 * Return stack: Pushes current SP position for later span calculation.
 */
export function openRListOp(vm: VM): void {
  if (vm.debug) console.log('openRListOp: listDepth before', vm.listDepth);
  vm.listDepth++;
  
  // Push current SP position to return stack to track RLIST boundary
  vm.rpush(toTaggedValue(vm.SP, Tag.INTEGER));
  
  if (vm.debug) console.log('openRListOp: pushed SP', vm.SP, 'listDepth after', vm.listDepth);
}

/**
 * Closes an RLIST construction with ']' token.
 * Stack effect: ( values... — rlist )
 * Reverses the accumulated values and pushes RLIST header.
 */
export function closeRListOp(vm: VM): void {
  if (vm.RP < BYTES_PER_ELEMENT) {
    throw new ReturnStackUnderflowError('closeRListOp', vm.getStackData());
  }

  const taggedStartSP = vm.rpop();
  const { value: startSP } = fromTaggedValue(taggedStartSP);
  const spanSize = (vm.SP - startSP) / BYTES_PER_ELEMENT;
  
  if (vm.debug) console.log('closeRListOp: span size', spanSize);
  
  // Reverse the span to achieve RLIST layout
  if (spanSize > 1) {
    reverseSpan(vm, spanSize);
  }
  
  // Push RLIST header with slot count
  const rlistHeader = toTaggedValue(spanSize, Tag.RLIST);
  vm.push(rlistHeader);
  
  vm.listDepth--;
  
  if (vm.debug) console.log('closeRListOp: created RLIST with', spanSize, 'slots');
}

/**
 * Gets the slot count from an RLIST header.
 * Stack effect: ( rlist — rlist n )
 */
export function rlistSlotOp(vm: VM): void {
  validateRListHeader(vm);
  
  const header = vm.peek();
  const slotCount = getRListSlotCount(header);
  
  vm.push(toTaggedValue(slotCount, Tag.INTEGER));
}

/**
 * Skips (drops) an entire RLIST from the stack.
 * Stack effect: ( rlist — )
 */
export function rlistSkipOp(vm: VM): void {
  skipRList(vm);
}

/**
 * Prepends a value to an RLIST.
 * Stack effect: ( val rlist — rlist' )
 * This is an O(1) operation - just push value and increment header.
 */
export function rlistPrependOp(vm: VM): void {
  vm.ensureStackSize(2, 'rlist prepend');
  
  const header = vm.pop();   // RLIST header at TOS
  const value = vm.pop();    // Value to prepend
  
  if (!isRList(header)) {
    vm.push(value);  // Restore stack
    vm.push(header);
    vm.push(NIL);
    return;
  }
  
  const slotCount = getRListSlotCount(header);
  
  // Push value (becomes new payload-0), then updated header
  vm.push(value);
  const newHeader = toTaggedValue(slotCount + 1, Tag.RLIST);
  vm.push(newHeader);
}

/**
 * Appends a value to an RLIST.
 * Stack effect: ( val rlist — rlist' )
 * This is an O(s) operation requiring payload shift to insert at bottom.
 */
export function rlistAppendOp(vm: VM): void {
  vm.ensureStackSize(2, 'rlist append');
  
  const header = vm.pop();  // RLIST header at TOS
  const value = vm.pop();   // Value to append
  
  if (!isRList(header)) {
    vm.push(value);  // Restore stack
    vm.push(header);
    vm.push(NIL);
    return;
  }
  
  const slotCount = getRListSlotCount(header);
  
  if (slotCount === 0) {
    // Empty RLIST - just push value and header
    vm.push(value);
    vm.push(toTaggedValue(1, Tag.RLIST));
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
  
  // Push existing payload back (in reverse order to maintain RLIST layout)
  for (let i = payload.length - 1; i >= 0; i--) {
    vm.push(payload[i]);
  }
  
  // Push updated header
  const newHeader = toTaggedValue(slotCount + 1, Tag.RLIST);
  vm.push(newHeader);
}

/**
 * Gets a value at a specific index from an RLIST.
 * Stack effect: ( rlist i — val )
 * Returns NIL if index is out of bounds.
 */
export function rlistGetAtOp(vm: VM): void {
  vm.ensureStackSize(2, 'rlist get-at');
  
  const indexValue = vm.pop();
  const header = vm.peek(); // Keep RLIST on stack
  
  if (!isRList(header) || !isInteger(indexValue)) {
    vm.push(NIL);
    return;
  }
  
  const index = fromTaggedValue(indexValue).value;
  const slotCount = getRListSlotCount(header);
  
  if (index < 0 || index >= slotCount) {
    vm.push(NIL);
    return;
  }
  
  // Use traversal to find element address (handles compound values)  
  const targetAddr = getRListElementAddress(vm, header, vm.SP - 4, index);
  
  if (targetAddr === -1) {
    vm.pop(); // Remove RLIST header  
    vm.push(NIL);
    return;
  }
  
  const value = vm.memory.readFloat32(SEG_STACK, targetAddr);
  
  vm.pop(); // Remove RLIST header
  vm.push(value);
}

/**
 * Sets a value at a specific index in an RLIST.
 * Stack effect: ( rlist i val — rlist )
 * Returns original RLIST if index out of bounds or trying to overwrite compound.
 */
export function rlistSetAtOp(vm: VM): void {
  vm.ensureStackSize(3, 'rlist set-at');
  
  const newValue = vm.pop();
  const indexValue = vm.pop();
  const header = vm.peek(); // Keep RLIST on stack
  
  if (!isRList(header) || !isInteger(indexValue)) {
    vm.pop(); // Remove invalid header
    vm.push(NIL);
    return;
  }
  
  const index = fromTaggedValue(indexValue).value;
  const slotCount = getRListSlotCount(header);
  
  if (index < 0 || index >= slotCount) {
    vm.pop(); // Remove RLIST header
    vm.push(NIL);
    return;
  }
  
  // Use traversal to find element address (handles compound values)
  const headerAddr = vm.SP - 4; // Header is at TOS
  const targetAddr = getRListElementAddress(vm, header, headerAddr, index);
  
  if (targetAddr === -1) {
    vm.pop(); // Remove RLIST header
    vm.push(NIL);
    return;
  }
  
  // Check if target location contains a compound value
  const oldValue = vm.memory.readFloat32(SEG_STACK, targetAddr);
  
  if (isRList(oldValue) || fromTaggedValue(oldValue).tag === Tag.LIST) {
    vm.pop(); // Remove RLIST header from stack
    vm.push(NIL); // Refuse to overwrite compound values
    return;
  }
  
  // Perform in-place update
  vm.memory.writeFloat32(SEG_STACK, targetAddr, newValue);
  
  // Return the modified RLIST (header already on stack)
}