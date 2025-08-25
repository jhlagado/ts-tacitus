/**
 * @file src/ops/list-ops.ts
 * LIST operations for the Tacit VM.
 */

import { VM } from '../core/vm';
import {
  fromTaggedValue,
  toTaggedValue,
  Tag,
  isList,
  getStackRefAddress,
  getTag,
  createStackRef,
  isRef,
  NIL,
} from '../core/tagged';
import { evalOp } from './core-ops';
import { SEG_STACK, SEG_RSTACK } from '../core/constants';
import { Verb } from '../core/types';
import { ReturnStackUnderflowError } from '../core/errors';
import {
  getListSlotCount,
  validateListHeader,
  reverseSpan,
  getListElementAddress,
} from '../core/list';

const BYTES_PER_ELEMENT = 4;

/**
 * Opens LIST construction.
 */
export function openListOp(vm: VM): void {
  vm.listDepth++;
  vm.push(toTaggedValue(0, Tag.LIST));
  vm.rpush(toTaggedValue(vm.SP - BYTES_PER_ELEMENT, Tag.SENTINEL));
}

/**
 * Closes LIST construction.
 */
export function closeListOp(vm: VM): void {
  if (vm.RP < BYTES_PER_ELEMENT) {
    throw new ReturnStackUnderflowError('closeListOp', vm.getStackData());
  }

  const { value: headerPos } = fromTaggedValue(vm.rpop());
  const payloadSlots = (vm.SP - headerPos - BYTES_PER_ELEMENT) / BYTES_PER_ELEMENT;

  vm.memory.writeFloat32(SEG_STACK, headerPos, toTaggedValue(payloadSlots, Tag.LIST));

  const isOutermost = vm.listDepth === 1;
  if (isOutermost) {
    const totalSpan = (vm.SP - headerPos) / BYTES_PER_ELEMENT;
    if (totalSpan > 1) {
      reverseSpan(vm, totalSpan);
    }
  }

  vm.listDepth--;
}

/**
 * Gets slot count from LIST header.
 */
export function listSlotOp(vm: VM): void {
  vm.ensureStackSize(1, 'slots');
  const value = vm.peek();
  const tag = getTag(value);
  
  let header: number;
  
  if (tag === Tag.LIST) {
    header = value;
  } else if (isRef(value)) {
    if (tag === Tag.STACK_REF) {
      const byteAddr = getStackRefAddress(value);
      header = vm.memory.readFloat32(SEG_RSTACK, byteAddr);
    } else if (tag === Tag.LOCAL_REF) {
      const slot = fromTaggedValue(value).value;
      const slotAddr = vm.BP + slot * 4;
      const slotValue = vm.memory.readFloat32(SEG_RSTACK, slotAddr);
      
      if (getTag(slotValue) === Tag.STACK_REF) {
        const byteAddr = getStackRefAddress(slotValue);
        header = vm.memory.readFloat32(SEG_RSTACK, byteAddr);
      } else {
        header = slotValue;
      }
    } else {
      vm.push(NIL);
      return;
    }
  } else {
    throw new Error('slots expects LIST or reference');
  }
  
  if (!isList(header)) {
    vm.push(NIL);
    return;
  }
  
  const slotCount = getListSlotCount(header);
  vm.push(toTaggedValue(slotCount, Tag.SENTINEL));
}

/**
 * Returns element count by traversal.
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
    vm.push(toTaggedValue(0, Tag.SENTINEL));
    return;
  }

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

  vm.push(toTaggedValue(elementCount, Tag.SENTINEL));
}

/**
 * cons: ( list value — list' )
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
 */
export function dropHeadOp(vm: VM): void {
  vm.ensureStackSize(1, 'drop-head');
  const header = vm.pop();
  if (!isList(header)) {
    vm.push(header);
    vm.push(NIL);
    return;
  }
  const s = getListSlotCount(header);
  if (s === 0) {
    vm.push(header); // LIST:0
    return;
  }
  const topAddr = vm.SP - BYTES_PER_ELEMENT; // SP after popping header
  const topVal = vm.memory.readFloat32(SEG_STACK, topAddr);
  const isCompound = isList(topVal);
  const span = isCompound ? getListSlotCount(topVal) + 1 : 1;
  vm.SP -= span * BYTES_PER_ELEMENT;
  vm.push(toTaggedValue(s - span, Tag.LIST));
}

/**
 * concat: ( listA listB — listC )
 */
export function concatOp(vm: VM): void {
  vm.ensureStackSize(2, 'concat');
  const rhs = vm.pop(); // listB or value
  const lhs = vm.pop(); // listA

  if (!isList(lhs)) {
    vm.push(lhs);
    vm.push(rhs);
    vm.push(NIL);
    return;
  }

  if (!isList(rhs)) {
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
      const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - i * BYTES_PER_ELEMENT);
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
    vm.push(NIL); // nil head
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
      const slotValue = vm.memory.readFloat32(SEG_STACK, firstElementAddr - i * BYTES_PER_ELEMENT);
      vm.push(slotValue);
    }
  } else {
    // Simple head
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
  const target = vm.peek(); // Keep target on stack
  const tag = getTag(target);

  if (tag === Tag.LIST) {
    // Current behavior: stack-relative addressing
    const slotCount = getListSlotCount(target);
    if (idx < 0 || idx >= slotCount) {
      vm.push(NIL);
      return;
    }

    // Direct slot addressing: SP-1-idx (where SP-1 is first payload slot)
    const addr = vm.SP - 4 - idx * BYTES_PER_ELEMENT;
    const cellIndex = addr / 4;
    vm.push(createStackRef(cellIndex));
  } else if (tag === Tag.STACK_REF) {
    // New behavior: memory-based addressing
    const baseAddr = getStackRefAddress(target);
    const header = vm.memory.readFloat32(SEG_STACK, baseAddr);

    if (!isList(header)) {
      vm.push(NIL);
      return;
    }

    const slotCount = getListSlotCount(header);
    if (idx < 0 || idx >= slotCount) {
      vm.push(NIL);
      return;
    }

    // Memory slot addressing: base - (1 + idx) * 4
    const addr = baseAddr - (idx + 1) * BYTES_PER_ELEMENT;
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
  const target = vm.peek(); // Keep target on stack
  const tag = getTag(target);

  if (tag === Tag.LIST) {
    // Current behavior: stack-relative addressing
    const addr = getListElementAddress(vm, target, vm.SP - 4, idx);
    if (addr === -1) {
      vm.push(NIL);
      return;
    }
    const cellIndex = addr / 4;
    vm.push(createStackRef(cellIndex));
  } else if (tag === Tag.STACK_REF) {
    // New behavior: memory-based addressing
    const baseAddr = getStackRefAddress(target);
    const header = vm.memory.readFloat32(SEG_STACK, baseAddr);

    if (!isList(header)) {
      vm.push(NIL);
      return;
    }

    // Use traversal with memory base address instead of stack position
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
 * Polymorphic: accepts both INTEGER (legacy byte addresses) and STACK_REF (cell addresses)
 */
export function fetchOp(vm: VM): void {
  vm.ensureStackSize(1, 'fetch');
  const addressValue = vm.pop();

  let byteAddr: number;
  const tag = getTag(addressValue);

  if (tag === Tag.STACK_REF) {
    // Stack reference: cell-based addressing
    byteAddr = getStackRefAddress(addressValue);
  } else if (tag === Tag.LOCAL_REF) {
    // Local variable reference: return stack slot
    const slot = fromTaggedValue(addressValue).value;
    byteAddr = vm.BP + slot * 4;
  } else if (tag === Tag.GLOBAL_REF) {
    // Global variable reference: not yet implemented
    throw new Error('Global variable references not yet implemented');
  } else {
    throw new Error('fetch expects reference address (STACK_REF, LOCAL_REF, or GLOBAL_REF)');
  }

  // Read from appropriate memory segment
  let value: number;
  if (tag === Tag.LOCAL_REF) {
    value = vm.memory.readFloat32(SEG_RSTACK, byteAddr);
  } else {
    value = vm.memory.readFloat32(SEG_STACK, byteAddr);
  }

  if (isList(value)) {
    // Compound value: need to materialize entire structure
    const slotCount = getListSlotCount(value);

    // Copy compound structure: payload slots first, then header
    for (let i = slotCount - 1; i >= 0; i--) {
      const slotValue = vm.memory.readFloat32(SEG_STACK, byteAddr - (i + 1) * BYTES_PER_ELEMENT);
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
  const { value: addr } = fromTaggedValue(vm.pop());
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
 * Generic block-to-list converter.
 * Stack effect: ( {block} -- list )
 *
 * Executes the block and converts all pushed elements into a list.
 * Uses the same SP marking and list construction patterns as openListOp/closeListOp.
 */
export function makeListOp(vm: VM): void {
  vm.ensureStackSize(1, 'makeList');

  // 1. Pop block address from stack
  const blockAddr = vm.pop();

  if (vm.debug) console.log('makeList: got blockAddr', blockAddr, 'hex:', blockAddr.toString(16));

  // 2. Create placeholder header (like openListOp)
  const placeholderHeader = toTaggedValue(0, Tag.LIST);
  vm.push(placeholderHeader);
  const headerPos = vm.SP - BYTES_PER_ELEMENT;
  vm.rpush(toTaggedValue(headerPos, Tag.SENTINEL));

  if (vm.debug) console.log('makeList: placeholder header at', headerPos, 'SP now', vm.SP);

  // 3. Execute block (like do combinator)
  vm.push(blockAddr);
  if (vm.debug) console.log('makeList: pushing blockAddr back onto stack for eval, SP now', vm.SP);
  if (vm.debug) console.log('makeList: calling eval...');
  evalOp(vm);
  if (vm.debug) console.log('makeList: eval completed');

  if (vm.debug)
    console.log('makeList: after block exec, SP now', vm.SP, 'stack:', vm.getStackData());

  // 4. Calculate payload slots (like closeListOp)
  const taggedHeaderPos = vm.rpop();
  const { value: retrievedHeaderPos } = fromTaggedValue(taggedHeaderPos);
  const payloadSlots = (vm.SP - retrievedHeaderPos - BYTES_PER_ELEMENT) / BYTES_PER_ELEMENT;

  if (vm.debug)
    console.log('makeList: headerPos', retrievedHeaderPos, 'payloadSlots', payloadSlots);

  if (payloadSlots < 0) {
    throw new Error('makeList: negative payload slot count detected');
  }

  // 5. Update placeholder header in place with correct slot count (like closeListOp)
  const finalizedHeader = toTaggedValue(payloadSlots, Tag.LIST);
  vm.memory.writeFloat32(SEG_STACK, retrievedHeaderPos, finalizedHeader);

  if (vm.debug) console.log('makeList: updated header, stack before reverse:', vm.getStackData());

  // 6. Reverse span to get proper LIST format (like closeListOp)
  const totalSpan = (vm.SP - retrievedHeaderPos) / BYTES_PER_ELEMENT; // header + payload
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

/**
 * Implements the enlist operation.
 * Converts a single value into a single-element list.
 *
 * Stack effect: ( value — LIST:1 )
 */
export const mEnlistOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'enlist');
  const a = vm.pop();
  // LIST semantics: push value, then LIST header with slot count 1
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

  const slotCount = getListSlotCount(header);

  if (slotCount === 0) {
    // Empty list - return empty list
    vm.push(header);
    return;
  }

  if (slotCount === 1) {
    // Single element list - return as-is
    const element = vm.pop();
    vm.push(element);
    vm.push(header);
    return;
  }

  // Pop all elements from the list payload
  const elements: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    elements.push(vm.pop());
  }

  // In LIST format, elements are already stored in reverse order
  // To reverse the list logically, we need to reverse the order again
  // This requires pushing elements in reverse order from our array
  for (let i = elements.length - 1; i >= 0; i--) {
    vm.push(elements[i]);
  }

  // Push the header back
  vm.push(header);
}

// ============================================================================
// MAPLIST OPERATIONS (maplists.md specification)
// ============================================================================

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
  const target = vm.pop(); // Pop target (LIST or STACK_REF)
  const tag = getTag(target);

  if (tag === Tag.LIST) {
    // Current behavior: stack-relative addressing
    const slotCount = getListSlotCount(target);

    // Maplist must have even number of slots (key-value pairs)
    if (slotCount % 2 !== 0) {
      vm.push(target); // Restore target
      vm.push(NIL);
      return;
    }

    if (slotCount === 0) {
      vm.push(target); // Restore target
      vm.push(NIL);
      return;
    }

    let defaultValueAddr = -1;

    // Search through key-value pairs (stack-relative)
    // After popping header: slot 0 at SP-4, slot 1 at SP-8, etc.
    for (let i = 0; i < slotCount; i += 2) {
      const keyAddr = vm.SP - BYTES_PER_ELEMENT - i * BYTES_PER_ELEMENT;
      const valueAddr = vm.SP - BYTES_PER_ELEMENT - (i + 1) * BYTES_PER_ELEMENT;
      const currentKey = vm.memory.readFloat32(SEG_STACK, keyAddr);

      // Check for exact key match
      if (currentKey === key) {
        vm.push(target); // Restore target
        const cellIndex = valueAddr / 4;
        vm.push(createStackRef(cellIndex));
        return;
      }

      // Check for 'default' key (special fallback semantics)
      const { tag: keyTag, value: keyValue } = fromTaggedValue(currentKey);
      if (keyTag === Tag.STRING) {
        const keyStr = vm.digest.get(keyValue);
        if (keyStr === 'default') {
          defaultValueAddr = valueAddr;
        }
      }
    }

    // Key not found - check for default fallback
    if (defaultValueAddr !== -1) {
      vm.push(target); // Restore target
      vm.push(toTaggedValue(defaultValueAddr, Tag.SENTINEL));
      return;
    }

    // No key match and no default - return NIL
    vm.push(target); // Restore target
    vm.push(NIL);
  } else if (tag === Tag.STACK_REF) {
    // New behavior: memory-based addressing
    const baseAddr = getStackRefAddress(target);
    const header = vm.memory.readFloat32(SEG_STACK, baseAddr);

    if (!isList(header)) {
      vm.push(target); // Restore target
      vm.push(NIL);
      return;
    }

    const slotCount = getListSlotCount(header);

    // Maplist must have even number of slots (key-value pairs)
    if (slotCount % 2 !== 0) {
      vm.push(target); // Restore target
      vm.push(NIL);
      return;
    }

    if (slotCount === 0) {
      vm.push(target); // Restore target
      vm.push(NIL);
      return;
    }

    let defaultValueAddr = -1;

    // Search through key-value pairs (memory-relative)
    // Slots are at: baseAddr-4, baseAddr-8, baseAddr-12, etc.
    for (let i = 0; i < slotCount; i += 2) {
      const keyAddr = baseAddr - BYTES_PER_ELEMENT - i * BYTES_PER_ELEMENT;
      const valueAddr = baseAddr - BYTES_PER_ELEMENT - (i + 1) * BYTES_PER_ELEMENT;
      const currentKey = vm.memory.readFloat32(SEG_STACK, keyAddr);

      // Check for exact key match
      if (currentKey === key) {
        vm.push(target); // Restore target
        const cellIndex = valueAddr / 4;
        vm.push(createStackRef(cellIndex));
        return;
      }

      // Check for 'default' key (special fallback semantics)
      const { tag: keyTag, value: keyValue } = fromTaggedValue(currentKey);
      if (keyTag === Tag.STRING) {
        const keyStr = vm.digest.get(keyValue);
        if (keyStr === 'default') {
          defaultValueAddr = valueAddr;
        }
      }
    }

    // Key not found - check for default fallback
    if (defaultValueAddr !== -1) {
      vm.push(target); // Restore target
      vm.push(toTaggedValue(defaultValueAddr, Tag.SENTINEL));
      return;
    }

    // No key match and no default - return NIL
    vm.push(target); // Restore target
    vm.push(NIL);
  } else {
    // Invalid target type
    vm.push(target); // Restore target
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
  const header = vm.pop(); // Pop header like other operations

  if (!isList(header)) {
    vm.push(header); // Restore header
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);

  // Maplist must have even number of slots
  if (slotCount % 2 !== 0) {
    vm.push(header); // Restore header
    vm.push(NIL);
    return;
  }

  // Restore the header first
  vm.push(header);

  if (slotCount === 0) {
    // Empty maplist - return empty list
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const keyCount = slotCount / 2;

  // Extract keys from even positions (0, 2, 4, ...)
  // After restoring header: slot 0 at SP-8, slot 2 at SP-16, etc.
  for (let i = keyCount - 1; i >= 0; i--) {
    const keyAddr = vm.SP - BYTES_PER_ELEMENT - i * 2 * BYTES_PER_ELEMENT;
    const keyValue = vm.memory.readFloat32(SEG_STACK, keyAddr);
    vm.push(keyValue);
  }

  // Push LIST header for keys
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
  const header = vm.pop(); // Pop header like other operations

  if (!isList(header)) {
    vm.push(header); // Restore header
    vm.push(NIL);
    return;
  }

  const slotCount = getListSlotCount(header);

  // Maplist must have even number of slots
  if (slotCount % 2 !== 0) {
    vm.push(header); // Restore header
    vm.push(NIL);
    return;
  }

  // Restore the header first
  vm.push(header);

  if (slotCount === 0) {
    // Empty maplist - return empty list
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const valueCount = slotCount / 2;

  // Extract values from odd positions (1, 3, 5, ...)
  // After restoring header: slot 1 at SP-12, slot 3 at SP-20, etc.
  for (let i = valueCount - 1; i >= 0; i--) {
    const valueAddr = vm.SP - BYTES_PER_ELEMENT - (i * 2 + 1) * BYTES_PER_ELEMENT;
    const valueValue = vm.memory.readFloat32(SEG_STACK, valueAddr);
    vm.push(valueValue);
  }

  // Push LIST header for values
  vm.push(toTaggedValue(valueCount, Tag.LIST));
}
