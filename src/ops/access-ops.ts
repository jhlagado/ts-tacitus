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
import { swapOp } from './stack-ops';

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
 * Select operation: path-based address access (RPN).
 * Stack: ( target path -- target STACK_REF|NIL )
 * 
 * Path can be:
 * - Simple value (number/string) → treated as single-element path
 * - List of values → multi-element path for drilling down
 * 
 * For each path element:
 * - Number → use elem logic (list element access)  
 * - String/Symbol → use find logic (maplist key access)
 * 
 * Returns address that can be used with fetch/store.
 */
export const selectOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'select');
  const pathArg = vm.pop();
  let currentTarget = vm.peek(); // Keep original target on stack

  // Convert simple path to single-element list
  let path: number[];
  if (isList(pathArg)) {
    const pathLength = getListLength(pathArg);
    if (pathLength === 0) {
      vm.push(NIL);
      return;
    }
    // Extract path elements from stack
    path = [];
    for (let i = 0; i < pathLength; i++) {
      path.push(vm.memory.readFloat32(SEG_STACK, vm.SP - (pathLength - i) * CELL_SIZE));
    }
    // Pop path payload from stack
    vm.SP -= pathLength * CELL_SIZE;
  } else {
    // Simple value becomes single-element path
    path = [pathArg];
  }

  // Traverse path using elem/find logic
  for (const key of path) {
    if (isNIL(currentTarget)) {
      break; // Stop if any step failed
    }

    const keyTag = getTag(key);
    
    if (keyTag === Tag.NUMBER) {
      // Use elem logic for numeric indices
      vm.push(currentTarget);
      vm.push(key);
      elemOp(vm);
      const elemResult = vm.pop();
      currentTarget = vm.pop(); // elem leaves target on stack
      
      if (isNIL(elemResult)) {
        currentTarget = NIL;
        break;
      }
      
      // For intermediate steps, fetch the value to traverse deeper
      if (path.indexOf(key) < path.length - 1) {
        vm.push(elemResult);
        vm.push(currentTarget); // restore target
        swapOp(vm); // put ref on top
        fetchOp(vm); // get value at that address
        currentTarget = vm.pop();
      } else {
        // Final step - return the address
        currentTarget = elemResult;
      }
      
    } else {
      // Use find logic for string/symbol keys
      vm.push(currentTarget);
      vm.push(key);
      findOp(vm);
      const findResult = vm.pop();
      currentTarget = vm.pop(); // find leaves target on stack
      
      if (isNIL(findResult)) {
        currentTarget = NIL;
        break;
      }
      
      // For intermediate steps, fetch the value to traverse deeper
      if (path.indexOf(key) < path.length - 1) {
        vm.push(findResult);
        vm.push(currentTarget); // restore target
        swapOp(vm); // put ref on top
        fetchOp(vm); // get value at that address
        currentTarget = vm.pop();
      } else {
        // Final step - return the address
        currentTarget = findResult;
      }
    }
  }

  vm.push(currentTarget); // Push final reference or NIL
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
