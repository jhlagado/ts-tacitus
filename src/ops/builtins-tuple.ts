/**
 * @file src/ops/builtins-tuple.ts
 * This file implements the basic tuple operations for the Tacit VM.
 */
import { VM } from '../core/vm';
import { toTaggedValue, fromTaggedValue, Tag } from '../core/tagged';
import { SEG_STACK } from '../core/memory';

/**
 * Handles opening of a tuple with '('
 * - Increments tuple depth counter
 * - Pushes a placeholder tuple tag with size 0
 * - Pushes the tuple tag's position onto the return stack
 */
export function openTupleOp(vm: VM): void {
  vm.tupleDepth++;
  
  // Push placeholder tuple tag - will be updated when the tuple is closed
  vm.push(toTaggedValue(0, Tag.TUPLE));
  
  // Push current stack position onto return stack (we'll use this to calculate element count)
  // We're storing the current SP value for later comparison, not as a reference
  vm.rpush(toTaggedValue(vm.SP - 4, Tag.INTEGER));
}

/**
 * Handles closing of a tuple with ')'
 * - Calculates tuple size
 * - Updates the placeholder tuple tag with the correct size
 * - For outermost tuples, also pushes a reference to the tuple tag
 */
export function closeTupleOp(vm: VM): void {
  // Get the saved position of the tuple tag (with stack segment reference tag)
  const taggedTupleTagPos = vm.rpop();
  
  // Extract the position value from the tagged reference
  const { value: tupleTagPos } = fromTaggedValue(taggedTupleTagPos);
  
  // Calculate tuple size in elements (4 bytes per element)
  // Size is (current position - tuple tag position - 4) / 4
  // The -4 accounts for the tuple tag itself
  const tupleSize = (vm.SP - tupleTagPos - 4) / 4;
  
  // Update the tuple tag with the correct size
  // This directly modifies the memory at the tuple tag position
  vm.memory.writeFloat32(SEG_STACK, tupleTagPos, toTaggedValue(tupleSize, Tag.TUPLE));
  
  // For outermost tuples, also push a link to the tuple tag
  // When vm.tupleDepth === 1, this is definitely the outermost tuple being closed
  // Note: tupleDepth will be decremented by the parser after this op is executed
  if (vm.tupleDepth === 1) {
    // Calculate relative element count from current SP to the tuple start position
    // This is the number of elements to go backward to reach the tuple tag
    const relativeElements = (vm.SP - tupleTagPos) / 4;
    vm.push(toTaggedValue(relativeElements, Tag.LINK));
  }
  
  // Note: We don't decrement tupleDepth here because that's handled by the parser in endTuple()
}
