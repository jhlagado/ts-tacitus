import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { rangeSource } from '../seq/source';
import { fromTaggedValue, isNIL } from '../core/tagged';
import { vectorSource, stringSource } from '../seq/source';
import { HeapTag, CoreTag } from '../core/tagged';
import { constantSource, dictionarySource } from '../seq/source';
import { mapSeq, siftSeq, filterSeq, takeSeq, dropSeq } from '../seq/processor';
import { toVector, count, last, forEach, reduce } from '../seq/sink';
import { decRef, getRefCount } from '../heap/heapUtils';

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
  console.warn('range', getRefCount(vm.heap, seqPtr));
};

/**
 * @word seq - Creates a sequence from a vector or string.
 * ( vector|string -- seq )
 * Pops a vector pointer or string pointer and pushes the corresponding sequence pointer.
 */
export const seqOp: Verb = (vm: VM) => {
  const sourcePtr = vm.pop();
  const { tag, isHeap } = fromTaggedValue(sourcePtr);

  let seqPtr: number;

  if (isHeap && tag === HeapTag.SEQUENCE) {
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
  console.warn('seq', getRefCount(vm.heap, seqPtr));
};

/**
 * @word map - Creates a map processor sequence.
 * ( source_seq func -- map_seq )
 */
export const mapOp: Verb = (vm: VM) => {
  const func = vm.pop();
  const sourceSeq = vm.pop(true);

  // TODO: Validate input types (source is SEQ, func is CODE)

  const mapSeqPtr = mapSeq(vm.heap, sourceSeq, func);
  decRef(vm.heap, sourceSeq);
  if (isNIL(mapSeqPtr)) {
    throw new Error('Failed to create map sequence');
  }
  vm.push(mapSeqPtr);
  console.warn('map', getRefCount(vm.heap, mapSeqPtr));
};

/**
 * @word sift - Creates a sift processor sequence (mask-based filter).
 * ( source_seq mask_seq -- sift_seq )
 */
export const siftOp: Verb = (vm: VM) => {
  const maskSeq = vm.pop(true);
  const sourceSeq = vm.pop(true);

  // TODO: Validate input types (both are SEQ)

  const siftSeqPtr = siftSeq(vm.heap, sourceSeq, maskSeq);
  decRef(vm.heap, maskSeq);
  decRef(vm.heap, sourceSeq);

  if (isNIL(siftSeqPtr)) {
    throw new Error('Failed to create sift sequence');
  }
  vm.push(siftSeqPtr);
};

/**
 * @word filter - Creates a filter processor sequence (predicate-based filter).
 * ( source_seq predicate_func -- filter_seq )
 */
export const filterOp: Verb = (vm: VM) => {
  const predicateFunc = vm.pop();
  const sourceSeq = vm.pop(true);

  // TODO: Validate input types (source is SEQ, predicate is CODE)

  const filterSeqPtr = filterSeq(vm.heap, sourceSeq, predicateFunc);
  decRef(vm.heap, sourceSeq);
  if (isNIL(filterSeqPtr)) {
    throw new Error('Failed to create filter sequence');
  }
  vm.push(filterSeqPtr);
};

/**
 * @word seq-take - Creates a take processor sequence.
 * ( source_seq count -- take_seq )
 */
export const seqTakeOp: Verb = (vm: VM) => {
  const count = vm.pop();
  const sourceSeq = vm.pop(true);

  // TODO: Validate input types (source is SEQ, count is number)

  const takeSeqPtr = takeSeq(vm.heap, sourceSeq, count);
  decRef(vm.heap, sourceSeq);
  if (isNIL(takeSeqPtr)) {
    throw new Error('Failed to create take sequence');
  }
  vm.push(takeSeqPtr);
};

/**
 * @word seq-drop - Creates a drop processor sequence.
 * ( source_seq count -- drop_seq )
 */
export const seqDropOp: Verb = (vm: VM) => {
  const count = vm.pop();
  const sourceSeq = vm.pop(true);

  // TODO: Validate input types (source is SEQ, count is number)

  const dropSeqPtr = dropSeq(vm.heap, sourceSeq, count);
  decRef(vm.heap, sourceSeq);
  if (isNIL(dropSeqPtr)) {
    throw new Error('Failed to create drop sequence');
  }
  vm.push(dropSeqPtr);
};

/**
 * @word to-vector - Consumes a sequence and collects its elements into a vector.
 * ( seq -- vector )
 */
export const toVectorOp: Verb = (vm: VM) => {
  const seq = vm.pop();
  // TODO: Validate input type (is SEQ)
  const vectorPtr = toVector(vm.heap, vm, seq);
  // toVector already handles NIL sequences, returning an empty vector
  vm.push(vectorPtr);
};

/**
 * @word count - Consumes a sequence and pushes the number of elements.
 * ( seq -- count )
 */
export const countOp: Verb = (vm: VM) => {
  const seq = vm.pop();
  // TODO: Validate input type (is SEQ)
  const countValue = count(vm.heap, vm, seq);
  vm.push(countValue);
};

/**
 * @word last - Consumes a sequence and pushes the last element (or NIL if empty).
 * ( seq -- last_element|NIL )
 */
export const lastOp: Verb = (vm: VM) => {
  const seq = vm.pop();
  // TODO: Validate input type (is SEQ)
  const lastValue = last(vm.heap, vm, seq);
  vm.push(lastValue);
};

/**
 * @word for-each - Consumes a sequence, applying a function to each element.
 * ( seq func -- )
 */
export const forEachOp: Verb = (vm: VM) => {
  const func = vm.pop();
  const seq = vm.pop();
  forEach(vm.heap, vm, seq, func);
};

/**
 * @word reduce - Reduces a sequence to a single value using a function.
 * ( seq initial_value func -- result )
 * func signature: ( accumulator current_value -- next_accumulator )
 */
export const reduceOp: Verb = (vm: VM) => {
  const func = vm.pop();
  const initialValue = vm.pop();
  const seq = vm.pop();

  // TODO: Validate input types (seq is SEQ, func is CODE)

  const result = reduce(vm.heap, vm, seq, func, initialValue, () => vm.eval());
  vm.push(result);
};
