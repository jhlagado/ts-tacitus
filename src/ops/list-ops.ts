/**
 * @file src/ops/list-ops.ts
 * LIST operations for the Tacit VM.
 */

import { VM } from '../core/vm';
import { fromTaggedValue, toTaggedValue, Tag, getTag, NIL } from '../core/tagged';
import { isRef, createStackRef, resolveReference, readReference, createSegmentRef } from '../core/refs';
import { evalOp } from './core-ops';
import { SEG_STACK, SEG_RSTACK } from '../core/constants';
import { Verb } from '../core/types';
import { ReturnStackUnderflowError } from '../core/errors';
import { getListLength, reverseSpan, getListElementAddress, isList } from '../core/list';
import { getListHeaderAndBase, computeHeaderAddr } from './lists/core-helpers';
import { dropOp, findElement, swapOp } from './stack-ops';
import { isCompoundData, isCompatibleCompound, mutateCompoundInPlace } from './local-vars-transfer';
import { areValuesEqual } from '../core/utils';

const CELL_SIZE = 4;

/**
 * Opens LIST construction.
 */
export function openListOp(vm: VM): void {
  vm.listDepth++;
  vm.push(toTaggedValue(0, Tag.LIST));
  vm.rpush(vm.SP - CELL_SIZE);
}

/**
 * Closes LIST construction.
 */
export function closeListOp(vm: VM): void {
  if (vm.RP < CELL_SIZE) {
    throw new ReturnStackUnderflowError('closeListOp', vm.getStackData());
  }

  const headerPos = vm.rpop();
  const payloadSlots = (vm.SP - headerPos - CELL_SIZE) / CELL_SIZE;

  vm.memory.writeFloat32(SEG_STACK, headerPos, toTaggedValue(payloadSlots, Tag.LIST));

  const isOutermost = vm.listDepth === 1;
  if (isOutermost) {
    const totalSpan = (vm.SP - headerPos) / CELL_SIZE;
    if (totalSpan > 1) {
      reverseSpan(vm, totalSpan);
    }
  }

  vm.listDepth--;
}

// getListHeaderAndBase now imported from './lists/core-helpers'

/**
 * Gets slot count from LIST header.
 * Returns the total number of stack slots occupied by the list (including nested lists).
 * See docs/specs/lists.md for slot vs element count semantics.
 * Renamed from slots to length.
 */
// lengthOp moved to src/ops/lists/query-ops.ts

/**
 * Returns element count by traversal.
 * Counts the number of top-level elements in the list (not stack slots).
 * See docs/specs/lists.md for slot vs element count semantics.
 */
// sizeOp moved to src/ops/lists/query-ops.ts

/**
 * cons: ( list value — list' )
 */

/**
 * tail: ( list — list' )
 * Removes the first element from a list (drops the head).
 */
export function tailOp(vm: VM): void {
  vm.ensureStackSize(1, 'tail');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    // Replace non-list with NIL
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    // Tail of empty is empty
    vm.pop();
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  const firstElemAddr = headerAddr - CELL_SIZE;
  const firstElem = vm.memory.readFloat32(info.segment, firstElemAddr);
  const firstElemSpan = isList(firstElem) ? getListLength(firstElem) + 1 : 1;
  const newSlotCount = slotCount - firstElemSpan;

  // Drop the original target
  vm.pop();

  if (newSlotCount <= 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  if (info.segment === SEG_STACK) {
    // Remove head span from stack payload then push reduced header
    vm.SP -= firstElemSpan * CELL_SIZE;
    vm.push(toTaggedValue(newSlotCount, Tag.LIST));
  } else {
    // Materialize tail payload from referenced memory
    for (let i = 0; i < newSlotCount; i++) {
      const elemAddr = firstElemAddr - firstElemSpan * CELL_SIZE - i * CELL_SIZE;
      const elem = vm.memory.readFloat32(info.segment, elemAddr);
      vm.push(elem);
    }
    vm.push(toTaggedValue(newSlotCount, Tag.LIST));
  }
}

export const dropHeadOp = tailOp;

/**
 * Concatenates two lists into a new combined list.
 * Stack effect: ( listA listB — listC )
 *
 * NOTE: Current implementation is incomplete - only creates combined headers
 * without properly copying payload data for list-to-list concatenation.
 *
 * Working fallback semantics:
 * - If listA is not a list: returns NIL
 * - If listB is not a list: performs cons(listA, listB)
 * - Empty list cases work correctly
 *
 * See docs/specs/lists.md for list concatenation semantics.
 */

/**
 * Polymorphic concatenation operation.
 * Stack effect: ( a b — result )
 * Dispatches to optimal implementation based on argument types:
 * - simple + simple → create 2-element list
 * - list + simple → O(1) append (increment header)
 * - simple + list → O(n) prepend
 * - list + list → O(n) concatenate
 */
export function concatOp(vm: VM): void {
  vm.ensureStackSize(2, 'concat');

  // Determine spans for RHS and LHS without mutating stack
  const [, rhsSize] = findElement(vm, 0);
  const [, lhsSize] = findElement(vm, rhsSize);

  const readCellAtOffset = (offsetSlots: number): number => {
    const addr = vm.SP - (offsetSlots + 1) * CELL_SIZE;
    return vm.memory.readFloat32(SEG_STACK, addr);
  };

  // Inspect operand kinds (LIST, REF->LIST, SIMPLE)
  const rhsTop = readCellAtOffset(0);
  const lhsTop = readCellAtOffset(rhsSize);

  const rhsInfo = isList(rhsTop) ? { kind: 'stack-list' as const, header: rhsTop, headerAddr: vm.SP - CELL_SIZE } : (isRef(rhsTop) ? getListHeaderAndBase(vm, rhsTop) : null);
  const lhsHeaderAddr = vm.SP - (rhsSize + 1) * CELL_SIZE;
  const lhsInfo = isList(lhsTop)
    ? { kind: 'stack-list' as const, header: lhsTop, headerAddr: lhsHeaderAddr }
    : (isRef(lhsTop) ? getListHeaderAndBase(vm, lhsTop) : null);

  const lhsIsList = !!lhsInfo;
  const rhsIsList = !!rhsInfo;

  // Helper to materialize payload slots for operand
  const materializeSlots = (op: { kind: 'stack-list'; header: number; headerAddr: number } | { header: number; baseAddr: number; segment: number } | null, size: number, topCell: number, topOffset: number): number[] => {
    if (op && 'kind' in op && op.kind === 'stack-list') {
      const s = getListLength(op.header);
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const addr = op.headerAddr - (i + 1) * CELL_SIZE;
        slots.push(vm.memory.readFloat32(SEG_STACK, addr));
      }
      return slots;
    }
    if (op && 'baseAddr' in op) {
      const s = getListLength(op.header);
      const headerAddr = op.baseAddr + s * CELL_SIZE;
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const addr = headerAddr - (i + 1) * CELL_SIZE;
        slots.push(vm.memory.readFloat32(op.segment, addr));
      }
      return slots;
    }
    // Simple single slot value
    return [readCellAtOffset(topOffset)];
  };

  const lhsSlots = materializeSlots(lhsInfo as any, lhsSize, lhsTop, rhsSize);
  const rhsSlots = materializeSlots(rhsInfo as any, rhsSize, rhsTop, 0);

  // Compute drop span in slots: for stack-lists, their actual span; for simple/ref, size from findElement
  const lhsDrop = lhsIsList && 'kind' in (lhsInfo as any) ? getListLength((lhsInfo as any).header) + 1 : lhsSize;
  const rhsDrop = rhsIsList && 'kind' in (rhsInfo as any) ? getListLength((rhsInfo as any).header) + 1 : rhsSize;

  // Remove inputs
  vm.SP -= (lhsDrop + rhsDrop) * CELL_SIZE;

  // Compose result according to cases
  if (!lhsIsList && !rhsIsList) {
    // simple + simple → logical [lhs, rhs]; push reverse: rhs then lhs
    for (let i = rhsSlots.length - 1; i >= 0; i--) vm.push(rhsSlots[i]);
    for (let i = lhsSlots.length - 1; i >= 0; i--) vm.push(lhsSlots[i]);
    vm.push(toTaggedValue(lhsSlots.length + rhsSlots.length, Tag.LIST));
    return;
  }

  if (lhsIsList && rhsIsList) {
    // list + list → logical [lhs..., rhs...]; push reverse: rhs then lhs
    for (let i = rhsSlots.length - 1; i >= 0; i--) vm.push(rhsSlots[i]);
    for (let i = lhsSlots.length - 1; i >= 0; i--) vm.push(lhsSlots[i]);
    vm.push(toTaggedValue(lhsSlots.length + rhsSlots.length, Tag.LIST));
    return;
  }

  if (lhsIsList && !rhsIsList) {
    // list + simple → logical [lhs..., rhs]; push reverse: rhs then lhs
    for (let i = rhsSlots.length - 1; i >= 0; i--) vm.push(rhsSlots[i]);
    for (let i = lhsSlots.length - 1; i >= 0; i--) vm.push(lhsSlots[i]);
    vm.push(toTaggedValue(lhsSlots.length + rhsSlots.length, Tag.LIST));
    return;
  }

  if (!lhsIsList && rhsIsList) {
    // simple + list → logical [lhs, rhs...]; push reverse: rhs then lhs
    for (let i = rhsSlots.length - 1; i >= 0; i--) vm.push(rhsSlots[i]);
    for (let i = lhsSlots.length - 1; i >= 0; i--) vm.push(lhsSlots[i]);
    vm.push(toTaggedValue(lhsSlots.length + rhsSlots.length, Tag.LIST));
    return;
  }

  vm.push(NIL);
}

/**
 * Sub-operation: simple + simple → create 2-element list
 */
function concatSimpleSimple(vm: VM): void {
  const rhs = vm.pop();
  const lhs = vm.pop();
  vm.push(rhs);
  vm.push(lhs);
  vm.push(toTaggedValue(2, Tag.LIST));
}

/**
 * Sub-operation: simple + list → O(n) prepend
 */
function concatSimpleList(vm: VM): void {
  // Deprecated; handled in concatOp unified path
  const rhs = vm.pop();
  const lhs = vm.pop();
  vm.push(NIL);
}

/**
 * Returns first element or nil.
 * Stack effect: ( list -- head | nil )
 * Spec: lists.md §12
 */
export function headOp(vm: VM): void {
  vm.ensureStackSize(1, 'head');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    // Remove target and return NIL
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  // Pop only the target (LIST header or ref), leave payload if it was a direct list
  vm.pop();

  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;
  const firstElementAddr = headerAddr - CELL_SIZE;
  const firstElement = vm.memory.readFloat32(info.segment, firstElementAddr);

  if (isList(firstElement)) {
    const elementSlotCount = getListLength(firstElement);

    // If the original target was a direct LIST, the element span is at TOS; remove it before pushing
    if (info.segment === SEG_STACK) {
      vm.SP -= (elementSlotCount + 1) * CELL_SIZE;
      for (let i = elementSlotCount; i >= 0; i--) {
        const slotValue = vm.memory.readFloat32(info.segment, firstElementAddr - i * CELL_SIZE);
        vm.push(slotValue);
      }
    } else {
      // Reference-based: materialize element to data stack
      for (let i = 0; i < elementSlotCount; i++) {
        const slotValue = vm.memory.readFloat32(
          info.segment,
          firstElementAddr - (elementSlotCount - 1 - i) * CELL_SIZE,
        );
        vm.push(slotValue);
      }
      vm.push(firstElement);
    }
  } else {
    if (info.segment === SEG_STACK) {
      vm.SP -= CELL_SIZE;
    }
    vm.push(firstElement);
  }
}


/**
 * Returns address of payload slot at slot index.
 * Stack effect: ( list_or_ref idx -- list_or_ref addr )
 * Spec: lists.md §10 - addr = SP - 1 - idx
 *
 * Polymorphic: accepts LIST (stack-relative) or STACK_REF (memory-based)
 */
// slotOp moved to src/ops/lists/query-ops.ts

/**
 * Returns address of element start at logical index.
 * Stack effect: ( list_or_ref idx -- list_or_ref addr )
 * Spec: lists.md §10 - uses traversal to find element start
 *
 * Polymorphic: accepts LIST (stack-relative) or STACK_REF (memory-based)
 */
// elemOp moved to src/ops/lists/query-ops.ts

/**
 * Fetches value at memory address.
 * Stack effect: ( addr -- value )
 * Spec: lists.md §10 - Simple values direct, compound values materialized
 *
 * Polymorphic: accepts STACK_REF and RSTACK_REF (cell addresses)
 */
// fetchOp moved to src/ops/lists/query-ops.ts

/**
 * Stores value at memory address (simple values only).
 * Stack effect: ( value addr -- )
 * Spec: lists.md §10 - Only simple values, compounds are no-op
 *
 * Polymorphic: accepts STACK_REF, RSTACK_REF, and GLOBAL_REF addresses
 */
// storeOp moved to src/ops/lists/query-ops.ts

/**
 * Generic block-to-list converter.
 * Stack effect: ( {block} -- list )
 *
 * Executes the block and converts all pushed elements into a list.
 * Uses the same SP marking and list construction patterns as openListOp/closeListOp.
 */
export function makeListOp(vm: VM): void {
  vm.ensureStackSize(1, 'makeList');

  const blockAddr = vm.pop();

  if (vm.debug) console.log('makeList: got blockAddr', blockAddr, 'hex:', blockAddr.toString(16));

  const placeholderHeader = toTaggedValue(0, Tag.LIST);
  vm.push(placeholderHeader);
  const headerPos = vm.SP - CELL_SIZE;
  vm.rpush(headerPos);

  if (vm.debug) console.log('makeList: placeholder header at', headerPos, 'SP now', vm.SP);

  vm.push(blockAddr);
  if (vm.debug) console.log('makeList: pushing blockAddr back onto stack for eval, SP now', vm.SP);
  if (vm.debug) console.log('makeList: calling eval...');
  evalOp(vm);
  if (vm.debug) console.log('makeList: eval completed');

  if (vm.debug)
    console.log('makeList: after block exec, SP now', vm.SP, 'stack:', vm.getStackData());

  const taggedHeaderPos = vm.rpop();
  const { value: retrievedHeaderPos } = fromTaggedValue(taggedHeaderPos);
  const payloadSlots = (vm.SP - retrievedHeaderPos - CELL_SIZE) / CELL_SIZE;

  if (vm.debug)
    console.log('makeList: headerPos', retrievedHeaderPos, 'payloadSlots', payloadSlots);

  if (payloadSlots < 0) {
    throw new Error('makeList: negative payload slot count detected');
  }

  const finalizedHeader = toTaggedValue(payloadSlots, Tag.LIST);
  vm.memory.writeFloat32(SEG_STACK, retrievedHeaderPos, finalizedHeader);

  if (vm.debug) console.log('makeList: updated header, stack before reverse:', vm.getStackData());

  const totalSpan = (vm.SP - retrievedHeaderPos) / CELL_SIZE;
  if (vm.debug) console.log('makeList: totalSpan to reverse:', totalSpan);
  if (totalSpan > 1) {
    reverseSpan(vm, totalSpan);
    if (vm.debug) console.log('makeList: after reverse, stack:', vm.getStackData());
  }
}

/**
 * Creates list from n stack items.
 * Stack effect: ( item-n ... item-0 n -- list )
 * Spec: glossary.md - Build list from n stack items
 */
export function packOp(vm: VM): void {
  vm.ensureStackSize(1, 'pack');
  const { value: count } = fromTaggedValue(vm.pop());

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
      vm.push(NIL);
      return;
    }
    values.push(vm.pop());
  }

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
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  // Drop the original target (list header or ref)
  vm.pop();

  if (slotCount === 0) {
    return;
  }

  if (info.segment === SEG_STACK) {
    // Direct list on stack: payload already remains on stack after popping header
    return;
  }

  // Reference case: materialize payload slots deep→TOS order
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  for (let i = slotCount - 1; i >= 0; i--) {
    const slotValue = vm.memory.readFloat32(info.segment, headerAddr - (i + 1) * CELL_SIZE);
    vm.push(slotValue);
  }
}

/**
 * Implements the enlist operation.
 * Converts a single value into a single-element list.
 *
 * Stack effect: ( value — LIST:1 )
 */
export const enlistOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'enlist');
  const a = vm.pop();
  vm.push(a);
  vm.push(toTaggedValue(1, Tag.LIST));
};

/**
 * Reverses the elements of a list.
 * Stack effect: ( list -- list' )
 * Spec: Returns a new list with elements in reverse order
 */
export function reverseOp(vm: VM): void {
  vm.ensureStackSize(1, 'reverse');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  vm.pop();

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  // Build element descriptors (start address and span)
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  let currentAddr = headerAddr - CELL_SIZE;
  let remainingSlots = slotCount;
  const elements: Array<{ start: number; span: number }> = [];
  while (remainingSlots > 0) {
    const v = vm.memory.readFloat32(info.segment, currentAddr);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elements.push({ start: currentAddr, span });
    currentAddr -= span * CELL_SIZE;
    remainingSlots -= span;
  }

  // If direct list on stack, remove original payload before writing result
  if (info.segment === SEG_STACK) {
    vm.SP -= slotCount * CELL_SIZE;
  }

  // Push elements in reversed order, preserving each element as a unit
  for (let e = elements.length - 1; e >= 0; e--) {
    const { start, span } = elements[e];
    if (span === 1) {
      const val = vm.memory.readFloat32(info.segment, start);
      vm.push(val);
    } else {
      const payloadSlots = span - 1;
      for (let i = payloadSlots - 1; i >= 0; i--) {
        const slotVal = vm.memory.readFloat32(info.segment, start - (i + 1) * CELL_SIZE);
        vm.push(slotVal);
      }
      const headerVal = vm.memory.readFloat32(info.segment, start);
      vm.push(headerVal);
    }
  }

  vm.push(toTaggedValue(slotCount, Tag.LIST));
}


/**
 * Implements maplist key lookup with address-returning semantics.
 * Stack effect: ( maplist_or_ref key -- maplist_or_ref addr | default-addr | NIL )
 * Spec: maplists.md §4 - Returns address of value by key comparison
 *
 * Maplist convention: ( key1 value1 key2 value2 ... )
 * Keys at even positions (0,2,4), values at odd positions (1,3,5)
 * On key match: returns address of corresponding value
 * On miss with 'default' key present: returns default value address
 * On miss without default: returns NIL
 *
 * Polymorphic: accepts LIST (stack-relative) or STACK_REF (memory-based)
 */
// findOp moved to src/ops/lists/query-ops.ts

/**
 * Extracts all keys from a maplist.
 * Stack effect: ( maplist -- maplist keys )
 * Spec: maplists.md §9 - Extract keys at positions 0,2,4...
 *
 * Returns a new list containing only the keys from even positions.
 * Invalid maplist (odd slot count) returns NIL.
 */
export function keysOp(vm: VM): void {
  vm.ensureStackSize(1, 'keys');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  // Preserve original target on the stack as per spec stack effect
  vm.pop();
  vm.push(info.header);

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const keyCount = slotCount / 2;
  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;

  for (let i = keyCount - 1; i >= 0; i--) {
    const keyAddr = headerAddr - CELL_SIZE - i * 2 * CELL_SIZE;
    const keyValue = vm.memory.readFloat32(info.segment, keyAddr);
    vm.push(keyValue);
  }

  vm.push(toTaggedValue(keyCount, Tag.LIST));
}

/**
 * Extracts all values from a maplist.
 * Stack effect: ( maplist -- maplist values )
 * Spec: maplists.md §9 - Extract values at positions 1,3,5...
 *
 * Returns a new list containing only the values from odd positions.
 * Invalid maplist (odd slot count) returns NIL.
 */
export function valuesOp(vm: VM): void {
  vm.ensureStackSize(1, 'values');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount % 2 !== 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  // Preserve original target on the stack as per spec stack effect
  vm.pop();
  vm.push(info.header);

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const valueCount = slotCount / 2;
  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;

  for (let i = valueCount - 1; i >= 0; i--) {
    const valueAddr = headerAddr - CELL_SIZE - (i * 2 + 1) * CELL_SIZE;
    const valueValue = vm.memory.readFloat32(info.segment, valueAddr);
    vm.push(valueValue);
  }

  vm.push(toTaggedValue(valueCount, Tag.LIST));
}

/**
 * Creates a STACK_REF pointing to a list on the data stack.
 * Stack effect: ( list -- list STACK_REF )
 * Spec: polymorphic-operations.md §84 - Convert list to reference
 *
 * The list remains on the stack, the STACK_REF points to its header location.
 * Only works with LIST values on the data stack.
 */
export function refOp(vm: VM): void {
  vm.ensureStackSize(1, 'ref');
  const value = vm.peek();
  const tag = getTag(value);

  if (tag === Tag.LIST) {
    const headerCellIndex = (vm.SP - 4) / 4;
    vm.push(createSegmentRef(SEG_STACK, headerCellIndex));
  }
}

/**
 * Materializes any reference to the data stack.
 * Stack effect: ( ref -- value )
 * Spec: polymorphic-operations.md §95 - Polymorphic reference materialization
 *
 * Works with STACK_REF, RSTACK_REF, and GLOBAL_REF (when implemented).
 * For compound data (lists), materializes the entire structure.
 * For simple values, copies the value directly.
 */
export function resolveOp(vm: VM): void {
  vm.ensureStackSize(1, 'resolve');
  const value = vm.pop();

  if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const referencedValue = vm.memory.readFloat32(segment, address);

    if (getTag(referencedValue) === Tag.LIST) {
      const slotCount = getListLength(referencedValue);

      for (let i = 0; i < slotCount; i++) {
        const slotValue = vm.memory.readFloat32(segment, address - (slotCount - i) * CELL_SIZE);
        vm.push(slotValue);
      }
      vm.push(referencedValue);
    } else {
      vm.push(referencedValue);
    }
  } else {
    vm.push(value);
  }
}

// Forward exports for moved query ops (Phase 2)
export { lengthOp, sizeOp, slotOp, elemOp, fetchOp, storeOp, findOp } from './lists/query-ops';
