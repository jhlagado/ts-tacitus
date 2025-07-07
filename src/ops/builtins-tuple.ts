/**
 * @file src/ops/builtins-tuple.ts
 * This file implements the basic tuple operations for the Tacit VM.
 */
import { VM } from '../core/vm';
import { toTaggedValue, fromTaggedValue, Tag } from '../core/tagged';

/**
 * Handles opening of a tuple with '('
 * - Increments tuple depth counter
 * - Pushes the current stack position onto the return stack with STACK_REF tag
 */
export function openTupleOp(vm: VM): void {
  vm.tupleDepth++;
  
  // Push tagged stack position reference to return stack
  vm.rpush(toTaggedValue(vm.SP, Tag.STACK_REF));
}

/**
 * Handles closing of a tuple with ')'
 * - Calculates tuple size
 * - Pushes tuple tag with size information
 * - For outermost tuples, also pushes a reference to the tuple start
 */
export function closeTupleOp(vm: VM): void {
  // Get the saved position (with stack segment reference tag)
  const taggedStartPos = vm.rpop();
  
  // Extract the stack position value from the tagged reference
  const { value: startPos } = fromTaggedValue(taggedStartPos);
  
  // Calculate tuple size in elements (4 bytes per element)
  const tupleSize = (vm.SP - startPos) / 4;
  
  // Push tuple tag with size information
  vm.push(toTaggedValue(tupleSize, Tag.TUPLE));
  
  // For outermost tuples, also push a reference to the start position
  if (vm.tupleDepth === 1) {
    vm.push(toTaggedValue(startPos, Tag.STACK_REF));
  }
  
  // Note: We don't decrement tupleDepth here because that's handled by the parser in endTuple()
}
