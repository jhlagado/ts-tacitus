/**
 * @file src/ops/select-ops.ts
 * Path-based address selection operations for the Tacit VM.
 */

import { type VM, type Verb, Tag, getTaggedInfo, isNIL, NIL, getListLength, isList, isRef, createRef } from '@src/core';
import { enlistOp, elemOp, findOp } from '../lists';
import { nipOp, dropOp, findElement } from '../stack';
import { push, pop, peek, ensureStackSize } from '../../core/vm';

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
  const targetCell = vm.sp - pathSize - 1;
  const target = vm.memory.readCell(targetCell);

  if (isList(target)) {
    // Create absolute REF to the list header cell
    const targetRef = createRef(targetCell);
    push(vm, targetRef);
    return true;
  } else if (isRef(target)) {
    // Copy existing ref
    push(vm, target);
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
  push(vm, pathElement);
  // Stack: ( target path current-ref path-element )

  const { tag } = getTaggedInfo(pathElement);
  if (tag === Tag.NUMBER) {
    elemOp(vm); // ( ref index -- ref new-ref )
  } else {
    findOp(vm); // ( ref key -- ref new-ref )
  }
  // Stack: ( target path current-ref new-ref )

  const newRef = pop(vm);

  // Check only for actual NIL failure (not all NaN values!)
  if (isNIL(newRef)) {
    pop(vm); // remove current-ref
    dropOp(vm); // remove path
    push(vm, NIL); // target NIL
    return false;
  }

  // Stack: ( target path current-ref )
  push(vm, newRef);
  // Stack: ( target path current-ref new-ref )
  nipOp(vm); // remove current-ref, keep new-ref
  // Stack: ( target path new-ref )
  return true;
}

export function traverseMultiPath(vm: VM): void {
  // Read path header using absolute cell-based indexing
  const pathHeaderCell = vm.sp - 2;
  const pathHeader = vm.memory.readCell(pathHeaderCell);
  const pathLength = getListLength(pathHeader);
  let pathElemCell = vm.sp - 3;

  for (let i = 0; i < pathLength; i++) {
    const pathElement = vm.memory.readCell(pathElemCell);
    pathElemCell -= 1;

    if (!processPathStep(vm, pathElement)) {
      return; // NIL case handled in processPathStep
    }
  }

  // Stack: ( target path final-ref )
  // We need to remove the path that's in the middle, not the final-ref at the top
  const finalRef = pop(vm); // Remove final-ref temporarily
  dropOp(vm); // remove path
  push(vm, finalRef); // Put final-ref back
  // Stack: ( target final-ref )
}

/**
 * Select operation: path-based address access.
 * Stack: ( target path -- target address|NIL )
 */
export const selectOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 2, 'select');

  const path = peek(vm);

  // Convert simple path to single-element list
  if (!isList(path)) {
    enlistOp(vm); // simple-path → simple-path LIST:1
  }

  // Now we always have a list path
  const pathLength = getListLength(peek(vm));
  if (pathLength === 0 || !createTargetRef(vm)) {
    pop(vm); // remove empty path
    push(vm, NIL);
    return;
  }

  // Stack: ( target target-ref path )
  traverseMultiPath(vm);
};
