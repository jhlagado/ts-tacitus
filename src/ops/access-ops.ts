/**
 * @file src/ops/access-ops.ts
 *
 * High-level access combinators for TACIT VM.
 * Provides path-based navigation through nested list/maplist structures.
 *
 * Stack Effects:
 * - get: ( target { path } -- value | nil )
 * - set: ( value target { path } -- ok | nil )
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { NIL } from '../core/tagged';
import { evalOp } from './core-ops';
import { getListSlotCount, isList } from '../core/list';

/**
 * Get combinator: path-based value access
 * Stack effect: ( target get { path } -- target value )
 * Syntax: target get { key1 index1 key2 ... }
 */
export const getOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'get'); // Need target and block address

  // Pop block address and target
  const blockAddr = vm.pop();
  const target = vm.peek(); // Keep target on stack

  if (vm.debug) console.log('getOp: target =', target, 'blockAddr =', blockAddr);

  // Execute block to get path elements
  vm.push(blockAddr);

  const beforeSP = vm.SP - 4; // SP before block execution (after pushing blockAddr)
  evalOp(vm);
  const afterSP = vm.SP;

  // Calculate how many elements the block produced
  const elementCount = (afterSP - beforeSP) / 4;

  if (vm.debug) console.log('getOp: block produced', elementCount, 'elements');

  if (elementCount === 0) {
    // Empty path - return target itself
    vm.push(target);
    return;
  }

  // For now, just implement simple single-key lookup
  if (elementCount === 1) {
    const key = vm.pop();

    if (!isList(target)) {
      vm.push(NIL);
      return;
    }

    // Simple maplist lookup - find key in target
    const slotCount = getListSlotCount(target);
    if (slotCount % 2 !== 0) {
      vm.push(NIL); // Invalid maplist
      return;
    }

    // Search for key in maplist (basic implementation)
    for (let i = 0; i < slotCount; i += 2) {
      const keyAddr = vm.SP - 8 - i * 4; // target at SP-4, first key at SP-8
      const valueAddr = keyAddr - 4;
      const currentKey = vm.memory.readFloat32(0, keyAddr);

      if (currentKey === key) {
        const value = vm.memory.readFloat32(0, valueAddr);
        vm.push(value);
        return;
      }
    }

    vm.push(NIL); // Key not found
  } else {
    // Multiple path elements - not implemented yet
    // Pop all elements and return NIL
    for (let i = 0; i < elementCount; i++) {
      vm.pop();
    }
    vm.push(NIL);
  }
};

/**
 * Set combinator stub - Step 2 minimal implementation
 *
 * Stack effect: ( value target blockAddr -- nil )
 *
 * This is a placeholder that ensures syntax works without crashing.
 * Full implementation will be added in Step 3.
 */
export const setOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'set');

  // Pop the path block, target, and value (ignore for now)
  vm.pop(); // path block
  vm.pop(); // target
  vm.pop(); // value

  // Always return NIL for Step 2
  vm.push(NIL);
};
