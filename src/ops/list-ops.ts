/**
 * @file src/ops/list-ops.ts
 * LIST operations for the Tacit VM.
 */

import { VM } from '../core/vm';
import { fromTaggedValue, toTaggedValue, Tag, getTag, NIL } from '../core/tagged';
import { isRef, createStackRef, resolveReference } from '../core/refs';
import { evalOp } from './core-ops';
import { SEG_STACK } from '../core/constants';
import { Verb } from '../core/types';
import { ReturnStackUnderflowError } from '../core/errors';
import { getListLength, reverseSpan, getListElementAddress, isList } from '../core/list';
import { dropOp, findElement, swapOp } from './stack-ops';
import { isCompoundData, isCompatibleCompound, mutateCompoundInPlace } from './local-vars-transfer';

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

/**
 * Helper to extract list header and base address from stack or reference.
 * Returns { header, baseAddr, segment } or null if not a valid list/ref.
 */
function getListHeaderAndBase(
  vm: VM,
  value: number,
): { header: number; baseAddr: number; segment: number } | null {
  const tag = getTag(value);
  if (tag === Tag.LIST) {
    return { header: value, baseAddr: vm.SP - 8, segment: SEG_STACK };
  } else if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const header = vm.memory.readFloat32(segment, address);
    const slotCount = getListLength(header);
    return { header, baseAddr: address - slotCount * 4, segment };
  }
  return null;
}

/**
 * Gets slot count from LIST header.
 * Returns the total number of stack slots occupied by the list (including nested lists).
 * See docs/specs/lists.md for slot vs element count semantics.
 * Renamed from slots to length.
 */
export function lengthOp(vm: VM): void {
  vm.ensureStackSize(1, 'length');
  const value = vm.peek();
  const info = getListHeaderAndBase(vm, value);
  let slotCount = -1;
  if (info && isList(info.header)) {
    slotCount = getListLength(info.header);
  }
  dropOp(vm);
  vm.push(slotCount);
}

/**
 * Returns element count by traversal.
 * Counts the number of top-level elements in the list (not stack slots).
 * See docs/specs/lists.md for slot vs element count semantics.
 */
export function sizeOp(vm: VM): void {
  vm.ensureStackSize(1, 'size');
  const value = vm.peek();
  const info = getListHeaderAndBase(vm, value);
  if (!info || !isList(info.header)) {
    dropOp(vm);
    vm.push(-1);
    return;
  }
  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    dropOp(vm);
    vm.push(slotCount);
    return;
  }
  let elementCount = 0;
  let currentAddr = info.baseAddr;
  let remainingSlots = slotCount;
  while (remainingSlots > 0) {
    const v = vm.memory.readFloat32(info.segment, currentAddr);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elementCount++;
    remainingSlots -= span;
    currentAddr -= span * CELL_SIZE;
  }
  dropOp(vm);
  vm.push(elementCount);
}

/**
 * cons: ( list value — list' )
 */

/**
 * tail: ( list — list' )
 * Removes the first element from a list (drops the head).
 */
export function tailOp(vm: VM): void {
  vm.ensureStackSize(1, 'tail');
  const header = vm.pop();
  if (!isList(header)) {
    vm.push(header);
    vm.push(NIL);
    return;
  }
  const s = getListLength(header);
  if (s === 0) {
    vm.push(header);
    return;
  }
  const topAddr = vm.SP - CELL_SIZE;
  const topVal = vm.memory.readFloat32(SEG_STACK, topAddr);
  const isCompound = isList(topVal);
  const span = isCompound ? getListLength(topVal) + 1 : 1;
  vm.SP -= span * CELL_SIZE;
  vm.push(toTaggedValue(s - span, Tag.LIST));
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

  const [, rhsSize] = findElement(vm, 0);
  const [, lhsSize] = findElement(vm, rhsSize);

  const peekBySlots = (offsetSlots: number): number => {
    const addr = vm.SP - (offsetSlots + 1) * CELL_SIZE;
    return vm.memory.readFloat32(SEG_STACK, addr);
  };

  const rhsHeaderVal = peekBySlots(0);
  const lhsHeaderVal = peekBySlots(rhsSize);
  const rhsIsList = isList(rhsHeaderVal);
  const lhsIsList = isList(lhsHeaderVal);
  const rhsIsSimple = !rhsIsList && rhsSize === 1;
  const lhsIsSimple = !lhsIsList && lhsSize === 1;

  if (lhsIsSimple && rhsIsSimple) {
    concatSimpleSimple(vm);
    return;
  }

  if (!lhsIsSimple && rhsIsSimple) {
    const lhsHeader = peekBySlots(rhsSize);
    if (!isList(lhsHeader)) {
      throw new Error('concat: left compound must be LIST when appending simple');
    }

    const currentSlots = getListLength(lhsHeader);
    if (currentSlots === 0) {
      const simple = vm.pop();
      vm.pop();
      vm.push(simple);
      vm.push(toTaggedValue(1, Tag.LIST));
      return;
    }

    swapOp(vm);
    vm.pop();
    vm.push(toTaggedValue(currentSlots + 1, Tag.LIST));
    return;
  }

  if (lhsIsSimple && !rhsIsSimple) {
    const rhsHeader = peekBySlots(0);
    if (!isList(rhsHeader)) {
      throw new Error('concat: right compound must be LIST when prepending simple');
    }
    concatSimpleList(vm);
    return;
  }

  if (lhsIsList && rhsIsList) {
    const rhsHeader = vm.pop();
    const sB = getListLength(rhsHeader);
    const rhsElems: number[] = [];
    for (let i = 0; i < sB; i++) {
      rhsElems.push(vm.pop());
    }
    const lhsHeader = vm.pop();
    const sA = getListLength(lhsHeader);
    const lhsElems: number[] = [];
    for (let i = 0; i < sA; i++) {
      lhsElems.push(vm.pop());
    }
    for (let i = rhsElems.length - 1; i >= 0; i--) {
      vm.push(rhsElems[i]);
    }
    for (let i = lhsElems.length - 1; i >= 0; i--) {
      vm.push(lhsElems[i]);
    }
    vm.push(toTaggedValue(sA + sB, Tag.LIST));
  } else {
    vm.pop();
    vm.pop();
    vm.push(NIL);
  }
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
  const rhsHeaderAddr = vm.SP - CELL_SIZE;
  const rhsHeader = vm.memory.readFloat32(SEG_STACK, rhsHeaderAddr);
  const currentSlots = getListLength(rhsHeader);
  swapOp(vm);
  const simple = vm.pop();
  vm.pop();
  vm.push(simple);
  vm.push(toTaggedValue(currentSlots + 1, Tag.LIST));
}

/**
 * Returns first element or nil.
 * Stack effect: ( list -- head | nil )
 * Spec: lists.md §12
 */
export function headOp(vm: VM): void {
  vm.ensureStackSize(1, 'head');
  const value = vm.pop();
  const tag = getTag(value);

  if (tag === Tag.LIST) {
    if (getListLength(value) === 0) {
      vm.push(NIL);
      return;
    }

    const firstElementAddr = vm.SP - CELL_SIZE;
    const firstElement = vm.memory.readFloat32(SEG_STACK, firstElementAddr);

    if (isList(firstElement)) {
      const slotCount = getListLength(firstElement);
      vm.SP -= (slotCount + 1) * CELL_SIZE;
      for (let i = slotCount; i >= 0; i--) {
        const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - i * CELL_SIZE);
        vm.push(slotValue);
      }
    } else {
      vm.SP -= CELL_SIZE;
      vm.push(firstElement);
    }
  } else if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const header = vm.memory.readFloat32(segment, address);

    if (!isList(header) || getListLength(header) === 0) {
      vm.push(NIL);
      return;
    }
    const slotCount = getListLength(header);
    const firstElementAddr = address - slotCount * CELL_SIZE;
    const firstElement = vm.memory.readFloat32(segment, firstElementAddr);

    if (isList(firstElement)) {
      const elementSlotCount = getListLength(firstElement);

      for (let i = 0; i < elementSlotCount; i++) {
        const slotValue = vm.memory.readFloat32(
          segment,
          firstElementAddr - (elementSlotCount - 1 - i) * CELL_SIZE,
        );
        vm.push(slotValue);
      }
      vm.push(firstElement);
    } else {
      vm.push(firstElement);
    }
  } else {
    vm.push(NIL);
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
    vm.push(toTaggedValue(0, Tag.LIST));
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(header);
  if (slotCount === 0) {
    vm.push(header);
    vm.push(NIL);
    return;
  }

  const firstElementAddr = vm.SP - CELL_SIZE;
  const firstElement = vm.memory.readFloat32(SEG_STACK, firstElementAddr);
  const span = isList(firstElement) ? getListLength(firstElement) + 1 : 1;

  const tailSlotCount = slotCount - span;
  const tailHeader = toTaggedValue(tailSlotCount, Tag.LIST);

  vm.SP -= span * CELL_SIZE;
  vm.push(tailHeader);

  if (isList(firstElement)) {
    for (let i = span - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - i * CELL_SIZE);
      vm.push(slotValue);
    }
  } else {
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
export function slotOp(vm: VM): void {
  vm.ensureStackSize(2, 'slot');
  const { value: idx } = fromTaggedValue(vm.pop());
  const target = vm.peek();
  const tag = getTag(target);

  if (tag === Tag.LIST) {
    const slotCount = getListLength(target);
    if (idx < 0 || idx >= slotCount) {
      vm.push(NIL);
      return;
    }

    const addr = vm.SP - 4 - idx * CELL_SIZE;
    const cellIndex = addr / 4;
    vm.push(createStackRef(cellIndex));
  } else if (tag === Tag.STACK_REF) {
    const { address: baseAddr, segment } = resolveReference(vm, target);
    const header = vm.memory.readFloat32(segment, baseAddr);

    if (!isList(header)) {
      vm.push(NIL);
      return;
    }

    const slotCount = getListLength(header);
    if (idx < 0 || idx >= slotCount) {
      vm.push(NIL);
      return;
    }

    const addr = baseAddr - (idx + 1) * CELL_SIZE;
    const cellIndex = addr / 4;
    vm.push(createStackRef(cellIndex));
  } else {
    vm.push(NIL);
  }
}

/**
 * Returns address of element start at logical index.
 * Stack effect: ( list_or_ref idx -- list_or_ref addr )
 * Spec: lists.md §10 - uses traversal to find element start
 *
 * Polymorphic: accepts LIST (stack-relative) or STACK_REF (memory-based)
 */
export function elemOp(vm: VM): void {
  vm.ensureStackSize(2, 'elem');
  const { value: idx } = fromTaggedValue(vm.pop());
  const target = vm.peek();
  const tag = getTag(target);

  if (tag === Tag.LIST) {
    const addr = getListElementAddress(vm, target, vm.SP - 4, idx);
    if (addr === -1) {
      vm.push(NIL);
      return;
    }
    const cellIndex = addr / 4;
    vm.push(createStackRef(cellIndex));
  } else if (tag === Tag.STACK_REF) {
    const { address: baseAddr, segment } = resolveReference(vm, target);
    const header = vm.memory.readFloat32(segment, baseAddr);

    if (!isList(header)) {
      vm.push(NIL);
      return;
    }

    const addr = getListElementAddress(vm, header, baseAddr - 4, idx);
    if (addr === -1) {
      vm.push(NIL);
      return;
    }
    const cellIndex = addr / 4;
    vm.push(createStackRef(cellIndex));
  } else {
    vm.push(NIL);
  }
}

/**
 * Fetches value at memory address.
 * Stack effect: ( addr -- value )
 * Spec: lists.md §10 - Simple values direct, compound values materialized
 *
 * Polymorphic: accepts STACK_REF and RSTACK_REF (cell addresses)
 */
export function fetchOp(vm: VM): void {
  vm.ensureStackSize(1, 'fetch');
  const addressValue = vm.pop();

  if (!isRef(addressValue)) {
    throw new Error('fetch expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)');
  }

  const { address, segment } = resolveReference(vm, addressValue);
  const value = vm.memory.readFloat32(segment, address);

  if (isList(value)) {
    const slotCount = getListLength(value);

    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(segment, address - (i + 1) * CELL_SIZE);
      vm.push(slotValue);
    }
    vm.push(value);
  } else {
    vm.push(value);
  }
}

/**
 * Stores value at memory address (simple values only).
 * Stack effect: ( value addr -- )
 * Spec: lists.md §10 - Only simple values, compounds are no-op
 *
 * Polymorphic: accepts STACK_REF, RSTACK_REF, and GLOBAL_REF addresses
 */
export function storeOp(vm: VM): void {
  vm.ensureStackSize(2, 'store');
  const addressValue = vm.pop();
  const value = vm.peek();
  if (!isRef(addressValue)) {
    throw new Error('store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)');
  }

  const { address, segment } = resolveReference(vm, addressValue);
  const valueInSlot = vm.memory.readFloat32(segment, address);

  let existingValue = valueInSlot;
  if (isRef(valueInSlot)) {
    const resolved = resolveReference(vm, valueInSlot);
    existingValue = vm.memory.readFloat32(resolved.segment, resolved.address);
  }

  const valueIsCompound = isCompoundData(value);
  const existingIsCompound = isCompoundData(existingValue);

  if (valueIsCompound && existingIsCompound) {
    if (isCompatibleCompound(existingValue, value)) {
      const { address: targetAddress, segment: targetSegment } = resolveReference(vm, valueInSlot);
      mutateCompoundInPlace(vm, targetAddress, targetSegment);
    } else {
      vm.pop();
      throw new Error('Incompatible compound assignment: slot count or type mismatch');
    }
  } else if (!valueIsCompound && !existingIsCompound) {
    vm.pop();
    vm.memory.writeFloat32(segment, address, value);
  } else {
    vm.pop();
    throw new Error('Cannot assign simple to compound or compound to simple');
  }
}

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
  const header = vm.pop();

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(header);

  if (slotCount === 0) {
    return;
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
  const header = vm.pop();

  if (!isList(header)) {
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(header);

  if (slotCount === 0) {
    vm.push(header);
    return;
  }

  if (slotCount === 1) {
    const element = vm.pop();
    vm.push(element);
    vm.push(header);
    return;
  }

  const elements: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    elements.push(vm.pop());
  }

  for (let i = elements.length - 1; i >= 0; i--) {
    vm.push(elements[i]);
  }

  vm.push(header);
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
export function findOp(vm: VM): void {
  vm.ensureStackSize(2, 'find');
  const key = vm.pop();
  const target = vm.pop();
  const tag = getTag(target);

  if (tag === Tag.LIST) {
    const slotCount = getListLength(target);

    if (slotCount % 2 !== 0) {
      vm.push(target);
      vm.push(NIL);
      return;
    }

    if (slotCount === 0) {
      vm.push(target);
      vm.push(NIL);
      return;
    }

    let defaultValueAddr = -1;

    for (let i = 0; i < slotCount; i += 2) {
      const keyAddr = vm.SP - CELL_SIZE - i * CELL_SIZE;
      const valueAddr = vm.SP - CELL_SIZE - (i + 1) * CELL_SIZE;
      const currentKey = vm.memory.readFloat32(SEG_STACK, keyAddr);

      if (currentKey === key) {
        vm.push(target);
        const cellIndex = valueAddr / 4;
        vm.push(createStackRef(cellIndex));
        return;
      }

      const { tag: keyTag, value: keyValue } = fromTaggedValue(currentKey);
      if (keyTag === Tag.STRING) {
        const keyStr = vm.digest.get(keyValue);
        if (keyStr === 'default') {
          defaultValueAddr = valueAddr;
        }
      }
    }

    if (defaultValueAddr !== -1) {
      vm.push(target);
      vm.push(defaultValueAddr);
      return;
    }

    vm.push(target);
    vm.push(NIL);
  } else if (tag === Tag.STACK_REF) {
    const { address: baseAddr, segment } = resolveReference(vm, target);
    const header = vm.memory.readFloat32(segment, baseAddr);

    if (!isList(header)) {
      vm.push(target);
      vm.push(NIL);
      return;
    }

    const slotCount = getListLength(header);

    if (slotCount % 2 !== 0) {
      vm.push(target);
      vm.push(NIL);
      return;
    }

    if (slotCount === 0) {
      vm.push(target);
      vm.push(NIL);
      return;
    }

    let defaultValueAddr = -1;

    for (let i = 0; i < slotCount; i += 2) {
      const keyAddr = baseAddr - CELL_SIZE - i * CELL_SIZE;
      const valueAddr = baseAddr - CELL_SIZE - (i + 1) * CELL_SIZE;
      const currentKey = vm.memory.readFloat32(segment, keyAddr);

      if (currentKey === key) {
        vm.push(target);
        const cellIndex = valueAddr / 4;
        vm.push(createStackRef(cellIndex));
        return;
      }

      const { tag: keyTag, value: keyValue } = fromTaggedValue(currentKey);
      if (keyTag === Tag.STRING) {
        const keyStr = vm.digest.get(keyValue);
        if (keyStr === 'default') {
          defaultValueAddr = valueAddr;
        }
      }
    }

    if (defaultValueAddr !== -1) {
      vm.push(target);
      vm.push(defaultValueAddr);
      return;
    }

    vm.push(target);
    vm.push(NIL);
  } else {
    vm.push(target);
    vm.push(NIL);
  }
}

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
  const header = vm.pop();
  if (!isList(header)) {
    vm.push(header);
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(header);

  if (slotCount % 2 !== 0) {
    vm.push(header);
    vm.push(NIL);
    return;
  }

  vm.push(header);

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const keyCount = slotCount / 2;

  for (let i = keyCount - 1; i >= 0; i--) {
    const keyAddr = vm.SP - CELL_SIZE - i * 2 * CELL_SIZE;
    const keyValue = vm.memory.readFloat32(SEG_STACK, keyAddr);
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
  const header = vm.pop();
  if (!isList(header)) {
    vm.push(header);
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(header);

  if (slotCount % 2 !== 0) {
    vm.push(header);
    vm.push(NIL);
    return;
  }

  vm.push(header);

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const valueCount = slotCount / 2;

  for (let i = valueCount - 1; i >= 0; i--) {
    const valueAddr = vm.SP - CELL_SIZE - (i * 2 + 1) * CELL_SIZE;
    const valueValue = vm.memory.readFloat32(SEG_STACK, valueAddr);
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
    const stackRef = createStackRef(headerCellIndex);
    vm.push(stackRef);
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
export function unrefOp(vm: VM): void {
  vm.ensureStackSize(1, 'unref');
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
