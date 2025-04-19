import { Heap } from './heap';
// Import constants directly from vector.ts
// Import decRef for recursive calls
import { decRef } from './heapUtils';
import { SequenceView } from '../seq/sequenceView';
// Import sequence constants
import {
  SEQ_SRC_PROCESSOR, // Add other existing SEQ_SRC_ types
  SEQ_SRC_VECTOR,
  SEQ_SRC_DICT,
  SEQ_SRC_CONSTANT,
  SEQ_SRC_RANGE,
} from '../seq/sequence'; // Adjust path if needed
import { VectorView } from './vectorView';

/**
 * Cleanup handler for SEQUENCE objects.
 * Determines the sequence type and calls decRef on internal references.
 * @param heap The heap instance.
 * @param address The starting address of the sequence object.
 */
export function performSequenceCleanup(heap: Heap, address: number): void {
  try {
    const seq = new SequenceView(heap, address);

    switch (seq.type) {
      case SEQ_SRC_PROCESSOR: {
        // decrement all meta slots except slot 0 (the opcode)
        const count = seq.metaCount;
        for (let i = 1; i < count; i++) {
          decRef(heap, seq.meta(i));
        }
        break;
      }

      case SEQ_SRC_VECTOR: {
        // release the underlying vector
        decRef(heap, seq.meta(0));
        break;
      }

      case SEQ_SRC_DICT: {
        // release the underlying dict (vector of pairs)
        decRef(heap, seq.meta(0));
        break;
      }

      case SEQ_SRC_CONSTANT: {
        // release the constant’s boxed value
        decRef(heap, seq.meta(0));
        break;
      }

      case SEQ_SRC_RANGE:
        // nothing to release
        break;

      default:
        console.warn(`performSequenceCleanup: Unknown sequence type ${seq.type} @ ${address}`);
        break;
    }
  } catch (err) {
    console.error(`Error during sequence cleanup @ ${address}:`, err);
  }
}

/** Cleanup handler for VECTOR objects */
export function performVectorCleanup(heap: Heap, address: number): void {
  try {
    const view = new VectorView(heap, address);
    for (let i = 0; i < view.length; i++) {
      decRef(heap, view.element(i));
    }
  } catch (error) {
    console.error(`Error during vector cleanup @ ${address}:`, error);
  }
}
