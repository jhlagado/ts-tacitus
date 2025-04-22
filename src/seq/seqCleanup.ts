import { Heap } from '../heap/heap';
// Import constants directly from vector.ts
// Import decRef for recursive calls
import { decRef } from '../heap/heapUtils';
import { SequenceView } from './sequenceView';
// Import sequence constants
import {
  SeqSourceType,
} from './sequence'; // Adjust path if needed

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
      case SeqSourceType.PROCESSOR: {
        // decrement all meta slots except slot 0 (the opcode)
        const count = seq.metaCount;
        for (let i = 1; i < count; i++) {
          decRef(heap, seq.meta(i));
        }
        break;
      }

      case SeqSourceType.VECTOR: {
        // release the underlying vector
        decRef(heap, seq.meta(0));
        break;
      }

      case SeqSourceType.DICT: {
        // release the underlying dict (vector of pairs)
        decRef(heap, seq.meta(0));
        break;
      }

      case SeqSourceType.CONSTANT: {
        // release the constant’s boxed value
        decRef(heap, seq.meta(0));
        break;
      }

      case SeqSourceType.RANGE:
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
