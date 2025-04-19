import { Heap, BLOCK_SIZE } from './heap';
import { SEG_HEAP } from '../core/memory';
import { CELL_SIZE, INVALID } from '../core/constants';
// Import constants directly from vector.ts
import { VEC_SIZE, VEC_DATA } from './vector';
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

/**
 * Cleanup handler for VECTOR objects.
 * Iterates through the vector's elements and calls decRef on each.
 * @param heap The heap instance.
 * @param address The starting address of the vector object.
 */
export function performVectorCleanup(heap: Heap, address: number): void {
  try {
    const length = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(address) + VEC_SIZE);
    let currentBlock = address;
    let offsetInBlock = VEC_DATA;

    for (let i = 0; i < length; i++) {
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        currentBlock = heap.getNextBlock(currentBlock);
        if (currentBlock === INVALID) {
          console.error(
            `performVectorCleanup: Invalid block encountered at index ${i} for vector ${address}`
          );
          return;
        }
        offsetInBlock = VEC_DATA;
      }
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        console.error(
          `performVectorCleanup: Calculated offset ${offsetInBlock} still exceeds block size for vector ${address}, index ${i}`
        );
        return;
      }
      const element = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(currentBlock) + offsetInBlock
      );
      decRef(heap, element);
      offsetInBlock += CELL_SIZE;
    }
  } catch (error) {
    console.error(`Error during vector cleanup at address ${address}:`, error);
  }
}

/**
 * Cleanup handler for DICT objects.
 * Iterates through the underlying vector's elements (keys/values) and calls decRef on each.
 * @param heap The heap instance.
 * @param address The starting address of the dictionary object.
 */
export function performDictCleanup(heap: Heap, address: number): void {
  try {
    const totalElements = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(address) + VEC_SIZE);
    let currentBlock = address;
    let offsetInBlock = VEC_DATA;

    for (let i = 0; i < totalElements; i++) {
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        currentBlock = heap.getNextBlock(currentBlock);
        if (currentBlock === INVALID) {
          console.error(
            `performDictCleanup: Invalid block encountered at index ${i} for dict ${address}`
          );
          return;
        }
        offsetInBlock = VEC_DATA;
      }
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        console.error(
          `performDictCleanup: Calculated offset ${offsetInBlock} still exceeds block size for dict ${address}, index ${i}`
        );
        return;
      }
      const element = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(currentBlock) + offsetInBlock
      );
      decRef(heap, element);
      offsetInBlock += CELL_SIZE;
    }
  } catch (error) {
    console.error(`Error during dictionary cleanup at address ${address}:`, error);
  }
}
