/**
 * @file src/ops/select-ops.ts
 * Path-based address selection operations for the Tacit VM.
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { getListLength, isList } from '../core/list';
import { SEG_STACK, CELL_SIZE } from '../core/constants';
import { isRef, createStackRef } from '../core/refs';
import { Tag, getTag, isNIL, NIL } from '../core/tagged';
import { elemOp, findOp, enlistOp } from './list-ops';
import { nipOp, findElement } from './stack-ops';

/**
 * Creates initial target reference for path traversal.
 * Stack: ( target path -- target target-ref path ) or ( target NIL ) on error
 */
export function createTargetRef(vm: VM): boolean {
  // Use findElement to locate target below path
  const [, pathSize] = findElement(vm, 0); // path is at TOS
  findElement(vm, pathSize); // target is below path
  
  // findElement examined the cell at: vm.SP / CELL_SIZE - pathSize - 1
  const targetCellIndex = vm.SP / CELL_SIZE - pathSize - 1;
  const targetByteAddr = targetCellIndex * CELL_SIZE;
  const target = vm.memory.readFloat32(SEG_STACK, targetByteAddr);

  if (isList(target)) {
    // Create STACK_REF from absolute cell index
    const targetRef = createStackRef(targetCellIndex);
    vm.push(targetRef); // push after path
    return true;
  } else if (isRef(target)) {
    // Copy existing ref
    vm.push(target);
    return true;
  } else {
    // Simple target - can't traverse
    return false;
  }
}


/**
 * Iterates through multi-element path.
 * Stack: ( target path current-ref -- target final-ref ) or ( target NIL ) on error
 */
export function traverseMultiPath(vm: VM): void {
  const pathHeader = vm.memory.readFloat32(SEG_STACK, vm.SP - 2 * CELL_SIZE);
  const pathLength = getListLength(pathHeader);
  let pathElementAddr = vm.SP - 3 * CELL_SIZE;

  for (let i = 0; i < pathLength; i++) {
    const pathElement = vm.memory.readFloat32(SEG_STACK, pathElementAddr);
    pathElementAddr -= CELL_SIZE;

    // Stack: ( target path current-ref )
    vm.push(pathElement);
    // Stack: ( target path current-ref path-element )

    if (getTag(pathElement) === Tag.NUMBER) {
      elemOp(vm);
    } else {
      findOp(vm);
    }

    // Stack: ( target path current-ref result-ref )
    const resultRef = vm.pop();

    if (isNIL(resultRef)) {
      // Cleanup and return NIL
      vm.pop(); // remove current-ref
      vm.pop(); // remove path
      vm.push(NIL);
      return;
    }

    // Stack: ( target path current-ref )
    nipOp(vm); // remove current-ref
    // Stack: ( target path result-ref )
  }

  // Stack: ( target path final-ref )
  nipOp(vm); // remove path
  // Stack: ( target final-ref )
}

/**
 * Select operation: path-based address access.
 * Stack: ( target path -- target address|NIL )
 */
export const selectOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'select');

  const path = vm.peek();

  // Convert simple path to single-element list
  if (!isList(path)) {
    enlistOp(vm); // simple-path → simple-path LIST:1
  }

  // Now we always have a list path
  const pathLength = getListLength(vm.peek());
  if (pathLength === 0 || !createTargetRef(vm)) {
    vm.pop(); // remove empty path
    vm.push(NIL);
    return;
  }

  // Stack: ( target target-ref path )
  traverseMultiPath(vm);
};
