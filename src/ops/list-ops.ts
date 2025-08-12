/**
 * @file src/ops/list-ops.ts
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
 * - Access: slotOp, elemOp, fetchOp, storeOp (spec-compliant)
 */

import { VM } from '../core/vm';
import { fromTaggedValue, toTaggedValue, Tag, isList } from '../core/tagged';
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
 * Returns logical element count by traversal.
 * Stack effect: ( list -- list n )
 * Spec: lists.md §9.2
 */
export function lengthOp(vm: VM): void {
  vm.ensureStackSize(1, 'length');
  const header = vm.peek(); // Keep list on stack

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);
  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.INTEGER));
    return;
  }

  // Traverse payload and count elements
  let elementCount = 0;
  let currentAddr = vm.SP - 8; // Start at first payload slot (SP-4-4)
  let remainingSlots = slotCount;

  while (remainingSlots > 0) {
    const value = vm.memory.readFloat32(SEG_STACK, currentAddr);
    const span = isList(value) ? getListSlotCount(value) + 1 : 1;
    
    elementCount++;
    remainingSlots -= span;
    currentAddr -= span * BYTES_PER_ELEMENT;
  }

  vm.push(toTaggedValue(elementCount, Tag.INTEGER));
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

  const value = vm.pop(); // list-first ordering requires value be second
  const header = vm.pop(); // LIST header at TOS (list-first: list is atop value)

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
 * cons (list-first): ( list value — list' )
 * Thin wrapper to enforce list-first ordering using listPrependOp semantics.
 */
export function consOp(vm: VM): void {
  vm.ensureStackSize(2, 'cons');
  const value = vm.pop();
  const header = vm.pop();
  if (!isList(header)) {
    vm.push(header);
    vm.push(value);
    vm.push(NIL);
    return;
  }
  const slotCount = getListSlotCount(header);
  vm.push(value);
  vm.push(toTaggedValue(slotCount + 1, Tag.LIST));
}

/**
 * drop-head: ( list — list' )
 * Removes the logical head element in O(1) by using span at SP-1.
 */
export function dropHeadOp(vm: VM): void {
  vm.ensureStackSize(1, 'drop-head');
  const header = vm.pop();
  if (!isList(header)) {
    // Not a list: restore and push NIL
    vm.push(header);
    vm.push(NIL);
    return;
  }
  const s = getListSlotCount(header);
  if (s === 0) {
    // Already empty: remains empty
    vm.push(header); // LIST:0
    return;
  }
  // Element 0 starts at SP-1; read its header/span
  const topAddr = vm.SP - BYTES_PER_ELEMENT; // SP after popping header
  const topVal = vm.memory.readFloat32(SEG_STACK, topAddr);
  const isCompound = isList(topVal);
  const span = isCompound ? getListSlotCount(topVal) + 1 : 1;
  // Remove head payload by moving SP
  vm.SP -= span * BYTES_PER_ELEMENT;
  // Push updated header with reduced payload slots
  vm.push(toTaggedValue(s - span, Tag.LIST));
}

/**
 * concat: ( listA listB — listC )
 * Flattens: merges elements of listB after listA.
 * If listB is not a list, behaves as cons (listA value).
 */
export function concatOp(vm: VM): void {
  vm.ensureStackSize(2, 'concat');
  const rhs = vm.pop(); // listB or value
  const lhs = vm.pop(); // listA
  
  if (!isList(lhs)) {
    // invalid lhs: restore and NIL
    vm.push(lhs);
    vm.push(rhs);
    vm.push(NIL);
    return;
  }
  
  if (!isList(rhs)) {
    // Fallback to cons(list, value)
    vm.push(lhs);
    vm.push(rhs);
    consOp(vm);
    return;
  }
  
  const sA = getListSlotCount(lhs);
  const sB = getListSlotCount(rhs);
  
  // Create new header with combined slot count
  // The payload slots should already be properly arranged on the stack
  vm.push(toTaggedValue(sA + sB, Tag.LIST));
}

/**
 * Returns first element or nil.
 * Stack effect: ( list -- head | nil )
 * Spec: lists.md §12
 */
export function headOp(vm: VM): void {
  vm.ensureStackSize(1, 'head');
  const header = vm.pop();

  if (!isList(header) || getListSlotCount(header) === 0) {
    vm.push(NIL);
    return;
  }

  // First element is at SP-4 (first payload slot after popping header)
  const firstElementAddr = vm.SP - BYTES_PER_ELEMENT;
  const firstElement = vm.memory.readFloat32(SEG_STACK, firstElementAddr);
  
  if (isList(firstElement)) {
    // Compound element: materialize full structure
    const slotCount = getListSlotCount(firstElement);
    
    // Skip past the compound element in original list
    vm.SP -= (slotCount + 1) * BYTES_PER_ELEMENT;
    
    // Push compound element to new position
    for (let i = slotCount; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - (i * BYTES_PER_ELEMENT));
      vm.push(slotValue);
    }
  } else {
    // Simple element: direct access
    vm.SP -= BYTES_PER_ELEMENT; // Skip past first element
    vm.push(firstElement);
  }
}

/**
 * Splits list into tail and head.
 * Stack effect: ( list -- tail head )
 * Spec: lists.md §12
 */
export function unconsOp(vm: VM): void {
  vm.ensureStackSize(1, 'uncons');
  const header = vm.pop();

  if (!isList(header)) {
    vm.push(toTaggedValue(0, Tag.LIST)); // empty list
    vm.push(NIL); // nil head
    return;
  }

  const slotCount = getListSlotCount(header);
  if (slotCount === 0) {
    vm.push(header); // empty list
    vm.push(NIL);    // nil head
    return;
  }

  // Determine first element span (first element is at SP-4)
  const firstElementAddr = vm.SP - BYTES_PER_ELEMENT;
  const firstElement = vm.memory.readFloat32(SEG_STACK, firstElementAddr);
  const span = isList(firstElement) ? getListSlotCount(firstElement) + 1 : 1;

  // Create tail list (remaining payload)
  const tailSlotCount = slotCount - span;
  const tailHeader = toTaggedValue(tailSlotCount, Tag.LIST);
  
  // Move SP past first element to position tail
  vm.SP -= span * BYTES_PER_ELEMENT;
  vm.push(tailHeader);
  
  // Materialize head element
  if (isList(firstElement)) {
    // Compound head: push full structure
    for (let i = span - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - (i * BYTES_PER_ELEMENT));
      vm.push(slotValue);
    }
  } else {
    // Simple head
    vm.push(firstElement);
  }
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
 * Returns address of payload slot at slot index.
 * Stack effect: ( list idx -- list addr )
 * Spec: lists.md §10 - addr = SP - 1 - idx
 */
export function slotOp(vm: VM): void {
  vm.ensureStackSize(2, 'slot');
  const {value: idx} = fromTaggedValue(vm.pop());
  const header = vm.peek(); // Keep list on stack

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);
  if (idx < 0 || idx >= slotCount) {
    vm.push(NIL);
    return;
  }

  // Direct slot addressing: SP-1-idx (where SP-1 is first payload slot)  
  const addr = vm.SP - 4 - (idx * BYTES_PER_ELEMENT);
  vm.push(toTaggedValue(addr, Tag.INTEGER));
}

/**
 * Returns address of element start at logical index.
 * Stack effect: ( list idx -- list addr )
 * Spec: lists.md §10 - uses traversal to find element start
 */
export function elemOp(vm: VM): void {
  vm.ensureStackSize(2, 'elem');
  const {value: idx} = fromTaggedValue(vm.pop());
  const header = vm.peek(); // Keep list on stack

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const addr = getListElementAddress(vm, header, vm.SP - 4, idx);
  if (addr === -1) {
    vm.push(NIL);
    return;
  }

  vm.push(toTaggedValue(addr, Tag.INTEGER));
}

/**
 * Fetches value at memory address.
 * Stack effect: ( addr -- value )
 * Spec: lists.md §10 - Simple values direct, compound values materialized
 */
export function fetchOp(vm: VM): void {
  vm.ensureStackSize(1, 'fetch');
  const {value: addr} = fromTaggedValue(vm.pop());

  const value = vm.memory.readFloat32(SEG_STACK, addr);
  
  if (isList(value)) {
    // Compound value: need to materialize entire structure
    const slotCount = getListSlotCount(value);
    
    // Copy compound structure: payload slots first, then header
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, addr - ((i + 1) * BYTES_PER_ELEMENT));
      vm.push(slotValue);
    }
    // Push header last (becomes TOS)
    vm.push(value);
  } else {
    // Simple value: direct copy
    vm.push(value);
  }
}

/**
 * Stores value at memory address (simple values only).
 * Stack effect: ( value addr -- )
 * Spec: lists.md §10 - Only simple values, compounds are no-op
 */
export function storeOp(vm: VM): void {
  vm.ensureStackSize(2, 'store');
  const {value: addr} = fromTaggedValue(vm.pop());
  const value = vm.pop();

  const existing = vm.memory.readFloat32(SEG_STACK, addr);
  
  // Only allow simple value storage per spec
  if (isList(existing)) {
    // Silent no-op for compound targets (spec requirement)
    return;
  }

  // Store simple value
  vm.memory.writeFloat32(SEG_STACK, addr, value);
}

/**
 * Creates list from n stack items.
 * Stack effect: ( item-n ... item-0 n -- list )
 * Spec: glossary.md - Build list from n stack items
 */
export function packOp(vm: VM): void {
  vm.ensureStackSize(1, 'pack');
  const {value: count} = fromTaggedValue(vm.pop());

  if (count < 0 || count > vm.getStackData().length) {
    vm.push(NIL);
    return;
  }

  if (count === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    if (vm.getStackData().length === 0) {
      // Not enough items on stack
      vm.push(NIL);
      return;
    }
    values.push(vm.pop());
  }

  // Push values back in reverse order (they were popped in reverse)
  for (let i = values.length - 1; i >= 0; i--) {
    vm.push(values[i]);
  }

  vm.push(toTaggedValue(count, Tag.LIST));
}

/**
 * Pushes list elements onto stack individually.
 * Stack effect: ( list -- item-n ... item-0 )
 * Spec: glossary.md - Push elements; inverse of pack (without count)
 */
export function unpackOp(vm: VM): void {
  vm.ensureStackSize(1, 'unpack');
  const header = vm.pop();

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);
  
  if (slotCount === 0) {
    // Empty list - nothing to unpack
    return;
  }

  // The payload elements are already on the stack in the correct order
  // for LIST semantics (reversed), so we don't need to do anything else.
  // The elements are now available on the stack as individual items.
}
