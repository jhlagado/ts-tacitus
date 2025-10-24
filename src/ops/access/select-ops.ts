/**
 * @file src/ops/select-ops.ts
 * Path-based address selection operations for the Tacit VM.
 */

import { VM, Verb, Tag, getTag, isNIL, NIL, SEG_DATA, CELL_SIZE } from '@src/core';
import { getListLength, isList } from '@src/core';
import { isRef, createDataRefAbs } from '@src/core';
import { enlistOp, elemOp, findOp } from '../lists';
import { nipOp, dropOp, findElement } from '../stack';

/**
 * Creates initial target reference for path traversal.
 * Stack: ( target path -- target target-ref path ) or ( target NIL ) on error
 */
export function createTargetRef(vm: VM): boolean {
  // Use findElement to locate target below path
  const [, pathSize] = findElement(vm, 0); // path is at TOS
  findElement(vm, pathSize); // target is below path

  // findElement examined the cell at: vm.SP - pathSize - 1
  // Use absolute addressing: vm.sp is absolute cell index (one past TOS)
  const targetAbsCellIndex = vm.sp - pathSize - 1;
  const targetByteAddr = targetAbsCellIndex * CELL_SIZE;
  const target = vm.memory.readFloat32(SEG_DATA, targetByteAddr);

  if (isList(target)) {
    // Create absolute DATA_REF to the list header cell
    const targetRef = createDataRefAbs(targetAbsCellIndex);
    vm.push(targetRef);
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
/**
 * Processes one path element step for multi-step traversal.
 * Stack: ( target path current-ref -- target path new-ref ) or ( target NIL ) on error
 * Returns false if NIL encountered (stack left as target NIL)
 */
export function processPathStep(vm: VM, pathElement: number): boolean {
  // Stack: ( target path current-ref )
  vm.push(pathElement);
  // Stack: ( target path current-ref path-element )

  if (getTag(pathElement) === Tag.NUMBER) {
    elemOp(vm); // ( ref index -- ref new-ref )
  } else {
    findOp(vm); // ( ref key -- ref new-ref )
  }
  // Stack: ( target path current-ref new-ref )

  const newRef = vm.pop();

  // Check only for actual NIL failure (not all NaN values!)
  if (isNIL(newRef)) {
    vm.pop(); // remove current-ref
    dropOp(vm); // remove path
    vm.push(NIL); // target NIL
    return false;
  }

  // Stack: ( target path current-ref )
  vm.push(newRef);
  // Stack: ( target path current-ref new-ref )
  nipOp(vm); // remove current-ref, keep new-ref
  // Stack: ( target path new-ref )
  return true;
}

export function traverseMultiPath(vm: VM): void {
  // Read path header using absolute cell-based indexing
  const pathHeaderAbsCell = vm.sp - 2;
  const pathHeader = vm.memory.readFloat32(SEG_DATA, pathHeaderAbsCell * CELL_SIZE);
  const pathLength = getListLength(pathHeader);
  let pathElementAbsCell = vm.sp - 3;

  for (let i = 0; i < pathLength; i++) {
    const pathElement = vm.memory.readFloat32(SEG_DATA, pathElementAbsCell * CELL_SIZE);
    pathElementAbsCell -= 1;

    if (!processPathStep(vm, pathElement)) {
      return; // NIL case handled in processPathStep
    }
  }

  // Stack: ( target path final-ref )
  // We need to remove the path that's in the middle, not the final-ref at the top
  const finalRef = vm.pop(); // Remove final-ref temporarily
  dropOp(vm); // remove path
  vm.push(finalRef); // Put final-ref back
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
