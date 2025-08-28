/**
 * @file src/ops/local-vars-transfer.ts
 * Compound data transfer operations for local variables
 */

import { VM } from '../core/vm';
import { getTag, Tag } from '../core/tagged';
import { getListLength, validateListHeader, isList } from '../core/list';
import { SEG_RSTACK, SEG_STACK, BYTES_PER_ELEMENT } from '../core/constants';
import { dropList } from '../core/list';

/**
 * Transfers compound data from data stack to return stack.
 * Maintains TACIT's stack-native list encoding during transfer.
 *
 * Stack effect: ( list -- ) [transfers to return stack]
 * Returns: byte address of LIST header on return stack
 *
 * Example:
 * - Data stack: [3, 2, 1, LIST:3] ← TOS
 * - Transfer: rpush(3), rpush(2), rpush(1), rpush(LIST:3)
 * - Return stack result: [LIST:3, 1, 2, 3] ← LIST:3 at TOS
 */
export function transferCompoundToReturnStack(vm: VM): number {
  // 1. Validate LIST at TOS
  validateListHeader(vm);
  const header = vm.peek();
  const slotCount = getListLength(header);

  if (slotCount === 0) {
    // Empty list - just transfer header
    const headerAddr = vm.RP;
    vm.rpush(header);
    dropList(vm);
    return headerAddr;
  }

  // 2. Read elements directly from data stack and rpush in sequence
  // For list (1 2 3): stack is [3, 2, 1, LIST:3], read 1, 2, 3
  let elementAddr = vm.SP - (slotCount + 1) * BYTES_PER_ELEMENT; // Start at deepest item

  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readFloat32(SEG_STACK, elementAddr);
    vm.rpush(value);
    elementAddr += BYTES_PER_ELEMENT; // Move to next item
  }

  // 3. rpush header last (becomes accessible at return stack TOS)
  const headerAddr = vm.RP;
  vm.rpush(header);

  // 4. Drop list from data stack polymorphically
  dropList(vm);

  return headerAddr; // Return address of LIST header
}

/**
 * Transfers compound data from return stack back to data stack.
 * Used for materializing compound local variables.
 *
 * Parameters: headerAddr - byte address of LIST header on return stack
 * Stack effect: ( -- list ) [materializes from return stack]
 */
export function materializeCompoundFromReturnStack(vm: VM, headerAddr: number): void {
  // 1. Read LIST header from return stack
  const header = vm.memory.readFloat32(SEG_RSTACK, headerAddr);

  if (!isList(header)) {
    throw new Error('Expected LIST header at return stack address');
  }

  const slotCount = getListLength(header);

  if (slotCount === 0) {
    // Empty list - just push header
    vm.push(header);
    return;
  }

  // 2. Read payload elements from return stack and push in correct order
  // Return stack layout: [elem0, elem1, ..., elem(n-1), LIST:n]
  // We need to push them as: elem0, elem1, ..., elem(n-1), LIST:n
  // to get stack-native encoding: [elem(n-1), ..., elem1, elem0, LIST:n]

  for (let i = 0; i < slotCount; i++) {
    const elementAddr = headerAddr - (slotCount - i) * BYTES_PER_ELEMENT;
    const element = vm.memory.readFloat32(SEG_RSTACK, elementAddr);
    vm.push(element);
  }

  // 3. Push header last (becomes TOS)
  vm.push(header);
}

/**
 * Checks if a value is compound data that needs special transfer handling.
 */
export function isCompoundData(value: number): boolean {
  const tag = getTag(value);
  return tag === Tag.LIST;
  // Future: extend for other compound types (maplists, etc.)
}

/**
 * Checks if two compound values are compatible for mutation.
 * 
 * Compatibility requirements from lists.md §10:
 * - Same compound type (LIST can only replace LIST)
 * - Same total slot count (header + payload slots)
 * - No recursive analysis needed - just check outer header
 * 
 * @param existing The existing compound value at target location
 * @param newValue The new compound value being assigned
 * @returns true if compatible, false otherwise
 */
export function isCompatibleCompound(existing: number, newValue: number): boolean {
  const existingTag = getTag(existing);
  const newTag = getTag(newValue);
  
  // Must be same compound type
  if (existingTag !== newTag) {
    return false;
  }
  
  // Must be compound data (currently only LIST supported)
  if (existingTag !== Tag.LIST) {
    return false; // Future: add Tag.MAPLIST support
  }
  
  // Must have same total slot count
  const existingSlots = getListLength(existing);
  const newSlots = getListLength(newValue);
  
  return existingSlots === newSlots;
}

/**
 * Mutates compound data in-place at a specific memory location.
 * 
 * Key differences from transferCompoundToReturnStack:
 * - NO RP advancement (overwrites existing space)
 * - Uses provided targetAddr instead of current RP
 * - For variable mutation, not initialization
 * 
 * @param vm The VM instance
 * @param targetAddr Byte address of existing compound data header
 * @param segment Memory segment (SEG_RSTACK for local variables)
 * @param newValue The new compound value from data stack (LIST header at TOS)
 */
export function mutateCompoundInPlace(vm: VM, targetAddr: number, segment: number, newValue: number): void {
  // 1. Validate TOS has compound data
  vm.ensureStackSize(1, 'mutateCompoundInPlace');
  const header = vm.peek();
  
  if (!isCompoundData(header)) {
    throw new Error('mutateCompoundInPlace expects compound data');
  }
  
  validateListHeader(vm);
  const slotCount = getListLength(header);
  
  // 2. Verify compatibility with existing data
  const existingHeader = vm.memory.readFloat32(segment, targetAddr);
  if (!isCompatibleCompound(existingHeader, header)) {
    throw new Error('Incompatible compound assignment: slot count or type mismatch');
  }
  
  if (slotCount === 0) {
    // Empty list - just overwrite header
    vm.memory.writeFloat32(segment, targetAddr, header);
    dropList(vm);
    return;
  }
  
  // 3. Overwrite payload elements directly (NO RP advancement)
  // Read elements from data stack and write to existing memory locations
  let sourceAddr = vm.SP - (slotCount + 1) * BYTES_PER_ELEMENT; // Start at deepest item
  
  for (let i = 0; i < slotCount; i++) {
    const value = vm.memory.readFloat32(SEG_STACK, sourceAddr);
    const targetElementAddr = targetAddr - (slotCount - i) * BYTES_PER_ELEMENT;
    vm.memory.writeFloat32(segment, targetElementAddr, value);
    sourceAddr += BYTES_PER_ELEMENT; // Move to next item on stack
  }
  
  // 4. Overwrite header last
  vm.memory.writeFloat32(segment, targetAddr, header);
  
  // 5. Clean up data stack
  dropList(vm);
}
