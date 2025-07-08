/**
 * @file src/ops/builtins-tuple.ts
 * This file implements the basic tuple operations for the Tacit VM.
 */
import { VM } from '../core/vm';
import { toTaggedValue, fromTaggedValue, Tag } from '../core/tagged';
import { SEG_STACK } from '../core/memory';
const BYTES_PER_ELEMENT = 4;

/**
 * Handles opening of a tuple with '('
 * - Increments tuple depth counter
 * - Pushes a placeholder tuple tag with size 0
 * - Pushes the tuple tag's position onto the return stack
 */

export function openTupleOp(vm: VM): void {
  vm.tupleDepth++;
  vm.push(toTaggedValue(0, Tag.TUPLE));
  vm.rpush(toTaggedValue(vm.SP - BYTES_PER_ELEMENT, Tag.INTEGER));
}

/**
 * Handles closing of a tuple with ')'
 * - Calculates tuple size
 * - Updates the placeholder tuple tag with the correct size
 * - For outermost tuples, also pushes a reference to the tuple tag
 */

export function closeTupleOp(vm: VM): void {
  const taggedTupleTagPos = vm.rpop();
  const { value: tupleTagPos } = fromTaggedValue(taggedTupleTagPos);
  const tupleSize = (vm.SP - tupleTagPos - BYTES_PER_ELEMENT) / BYTES_PER_ELEMENT;
  vm.memory.writeFloat32(SEG_STACK, tupleTagPos, toTaggedValue(tupleSize, Tag.TUPLE));

  if (vm.tupleDepth === 1) {
    const relativeElements = (vm.SP - tupleTagPos) / BYTES_PER_ELEMENT;
    vm.push(toTaggedValue(relativeElements, Tag.LINK));
  }
}
