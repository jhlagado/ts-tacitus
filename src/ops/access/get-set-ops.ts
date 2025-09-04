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

import { VM, Verb, NIL, SEG_STACK } from '@src/core';
import { evalOp } from '../core';
import { getListLength, isList } from '../../core/list';
import { isRef, resolveReference } from '@src/core';

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
