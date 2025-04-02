import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { rangeSource } from '../seq/source';
import { fromTaggedValue, isNIL } from '../core/tagged';
import { vectorSource, stringSource } from '../seq/source';
import { HeapTag, CoreTag } from '../core/tagged';
import { constantSource, dictionarySource } from '../seq/source';

/**
 * @word range - Creates a sequence from a numerical range.
 * ( start end step -- seq )
 * Pops start, end, and step values, creates a range sequence, and pushes the sequence pointer.
 */
export const rangeOp: Verb = (vm: VM) => {
  const step = vm.pop();
  const end = vm.pop();
  const start = vm.pop();

  // TODO: Add type/value validation for start, end, step if needed

  const seqPtr = rangeSource(vm.heap, start, end, step);
  if (isNIL(seqPtr)) {
    // Handle potential allocation failure if rangeSource returns NIL
    throw new Error('Failed to create range sequence');
  }
  vm.push(seqPtr);
};

/**
 * @word seq - Creates a sequence from a vector or string.
 * ( vector|string -- seq )
 * Pops a vector pointer or string pointer and pushes the corresponding sequence pointer.
 */
export const seqOp: Verb = (vm: VM) => {
  const sourcePtr = vm.pop();
  const { tag, heap: isHeap } = fromTaggedValue(sourcePtr);

  let seqPtr: number;

  if (isHeap && tag === HeapTag.SEQ) {
    seqPtr = sourcePtr;
  } else if (isHeap && tag === HeapTag.VECTOR) {
    seqPtr = vectorSource(vm.heap, sourcePtr);
  } else if (isHeap && tag === HeapTag.DICT) {
    seqPtr = dictionarySource(vm.heap, sourcePtr);
  } else if (!isHeap && tag === CoreTag.STRING) {
    seqPtr = stringSource(vm.heap, sourcePtr);
  } else if (!isHeap && (tag === CoreTag.INTEGER || tag === CoreTag.NUMBER)) {
    // Handle integer (tagged) or float (untagged) input
    seqPtr = constantSource(vm.heap, sourcePtr);
  } else {
    throw new Error(
      'Invalid argument for seq: Expected vector, string, sequence, dictionary, or number'
    );
  }

  if (isNIL(seqPtr)) {
    throw new Error('Failed to create sequence from source');
  }
  vm.push(seqPtr);
};
