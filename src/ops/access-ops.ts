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
import { isRef, resolveReference, createStackRef } from '../core/refs';
import { Tag, fromTaggedValue } from '../core/tagged';

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
 * Select combinator: path-based address access.
 * Stack: ( target path -- target STACK_REF|RSTACK_REF|NIL )
 * Returns an address that can be used with fetch/store, not the value itself.
 * Traverses nested structures based on key type in the path list.
 */
export const selectOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'select');
  const pathList = vm.pop();
  let currentTarget = vm.peek(); // Keep original target on stack

  if (!isList(pathList)) {
    vm.push(NIL); // Path must be a list
    return;
  }

  const pathSlotCount = getListLength(pathList);
  if (pathSlotCount === 0) {
    vm.push(NIL); // Empty path is not a valid selection
    return;
  }

  // Extract path elements from the stack
  const path = [];
  const pathStartAddr = vm.SP - pathSlotCount * CELL_SIZE;
  for (let i = 0; i < pathSlotCount; i++) {
    path.push(vm.memory.readFloat32(SEG_STACK, pathStartAddr + i * CELL_SIZE));
  }
  vm.SP -= pathSlotCount * CELL_SIZE; // Pop path payload

  for (const key of path) {
    if (currentTarget === NIL) break; // Stop traversal if any step fails

    let header, baseAddr, segment;

    // 1. Resolve the current target to get its header and memory location
    if (isRef(currentTarget)) {
      const resolved = resolveReference(vm, currentTarget);
      header = vm.memory.readFloat32(resolved.segment, resolved.address);
      baseAddr = resolved.address;
      segment = resolved.segment;
    } else if (isList(currentTarget)) {
      // Handle transient list on the stack by creating a temporary reference to it
      const listSize = getListLength(currentTarget) + 1;
      // The target list is now below the original path list that was popped.
      // Its header is at SP - listSize * 4
      const headerAddr = vm.SP - listSize * CELL_SIZE;
      header = currentTarget;
      baseAddr = headerAddr;
      segment = SEG_STACK;
    } else {
      currentTarget = NIL;
      continue; // Not a traversable type
    }

    if (!isList(header)) {
      currentTarget = NIL;
      continue;
    }

    const slotCount = getListLength(header);
    const { tag: keyTag, value: keyValue } = fromTaggedValue(key);

    // 2. Dispatch traversal logic based on the key's type
    if (keyTag === Tag.NUMBER) {
      // --- Elem-like traversal for numeric indices ---
      let elemAddr = -1;
      let currentAddr = baseAddr - CELL_SIZE;
      let logicalIndex = 0;
      let slotsRemaining = slotCount;
      while (slotsRemaining > 0) {
        if (logicalIndex === keyValue) {
          elemAddr = currentAddr;
          break;
        }
        const currentVal = vm.memory.readFloat32(segment, currentAddr);
        const step = isList(currentVal) ? getListLength(currentVal) + 1 : 1;
        currentAddr -= step * CELL_SIZE;
        slotsRemaining -= step;
        logicalIndex++;
      }
      currentTarget = elemAddr !== -1 ? createStackRef(elemAddr / CELL_SIZE) : NIL;

    } else {
      // --- Find-like traversal for string/symbol keys ---
      if (slotCount % 2 !== 0) {
        currentTarget = NIL;
        continue; // Not a valid maplist
      }
      let foundAddr = -1;
      for (let i = 0; i < slotCount; i += 2) {
        const currentKeyAddr = baseAddr - (i + 1) * CELL_SIZE;
        const currentKey = vm.memory.readFloat32(segment, currentKeyAddr);
        if (currentKey === key) {
          foundAddr = baseAddr - (i + 2) * CELL_SIZE;
          break;
        }
      }
      currentTarget = foundAddr !== -1 ? createStackRef(foundAddr / CELL_SIZE) : NIL;
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
