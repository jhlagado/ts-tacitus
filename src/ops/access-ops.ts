/**
 * @file src/ops/access-ops.ts
 *
 * High-level access combinators for Tacit VM.
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
import { getListLength, isList } from '../core/list';
import { SEG_STACK, CELL_SIZE } from '../core/constants';
import { isRef, resolveReference } from '../core/refs';
import { Tag, getTag, isNIL } from '../core/tagged';
import { elemOp, findOp } from './list-ops';
import { fetchOp } from './list-ops';

/**
 * Get combinator: path-based value access.
 * Stack: ( target get { path } -- target value ).
 * Note: currently supports single-key maplist lookup and returns NIL for multi-element paths.
 */
export const getOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'get');
  const blockAddr = vm.pop();
  const target = vm.peek();
  vm.push(blockAddr);

  const beforeSP = vm.SP - 4;
  evalOp(vm);
  const afterSP = vm.SP;
  const elementCount = (afterSP - beforeSP) / 4;

  if (elementCount === 0) {
    vm.push(target);
    return;
  }

  if (elementCount === 1) {
    const key = vm.pop();

    if (!isList(target)) {
      vm.push(NIL);
      return;
    }
    const slotCount = getListLength(target);
    if (slotCount % 2 !== 0) {
      vm.push(NIL);
      return;
    }

    if (isRef(target)) {
      const { address, segment } = resolveReference(vm, target);
      for (let i = 0; i < slotCount; i += 2) {
        const keyAddr = address - (slotCount - i) * 4;
        const valueAddr = keyAddr - 4;
        const currentKey = vm.memory.readFloat32(segment, keyAddr);

        if (currentKey === key) {
          const value = vm.memory.readFloat32(segment, valueAddr);
          vm.push(value);
          return;
        }
      }
    } else {
      for (let i = 0; i < slotCount; i += 2) {
        const keyAddr = vm.SP - 8 - i * 4;
        const valueAddr = keyAddr - 4;
        const currentKey = vm.memory.readFloat32(SEG_STACK, keyAddr);

        if (currentKey === key) {
          const value = vm.memory.readFloat32(SEG_STACK, valueAddr);
          vm.push(value);
          return;
        }
      }
    }

    vm.push(NIL);
  } else {
    for (let i = 0; i < elementCount; i++) {
      vm.pop();
    }
    vm.push(NIL);
  }
};

/**
 * Select operation: path-based address access.
 * Stack: ( target path -- target address|NIL )
 */
export const selectOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'select');
  const pathArg = vm.pop();
  const originalTarget = vm.peek();
  
  // Handle simple values as single-element paths
  let pathElements: number[];
  if (isList(pathArg)) {
    const pathLength = getListLength(pathArg);
    if (pathLength === 0) {
      vm.push(NIL);
      return;
    }
    pathElements = [];
    for (let i = 0; i < pathLength; i++) {
      pathElements.push(vm.memory.readFloat32(SEG_STACK, vm.SP - (pathLength - i) * CELL_SIZE));
    }
    vm.SP -= pathLength * CELL_SIZE;
    pathElements.reverse(); // Lists are stored in reverse order on stack
  } else {
    pathElements = [pathArg];
  }

  // Start with target already on stack
  for (let i = 0; i < pathElements.length; i++) {
    const key = pathElements[i];
    const isLastElement = i === pathElements.length - 1;
    
    // Stack: ( target )
    vm.push(key);
    // Stack: ( target key )
    
    if (getTag(key) === Tag.NUMBER) {
      elemOp(vm);
    } else {
      findOp(vm);
    }
    
    // Stack: ( target address )
    const address = vm.pop();
    
    if (isNIL(address)) {
      vm.pop(); // remove target
      vm.push(originalTarget);
      vm.push(NIL);
      return;
    }
    
    if (isLastElement) {
      // Keep original target, return final address
      vm.pop(); // remove current target
      vm.push(originalTarget);
      vm.push(address);
      return;
    }
    
    // Not last element - fetch value for next iteration
    vm.pop(); // remove target from stack
    vm.push(address);
    fetchOp(vm);
    // Stack: ( nextTarget )
  }
};

/**
 * Set combinator (stub).
 * Stack: ( value target { path } -- nil ).
 * Note: placeholder implementation — always returns NIL.
 */
export const setOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'set');

  vm.pop();
  vm.pop();
  vm.pop();
  vm.push(NIL);
};
