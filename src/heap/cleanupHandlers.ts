import { Heap, BLOCK_SIZE } from './heap';
import { SEG_HEAP } from '../core/memory';
import { INVALID } from '../core/constants';
// Import constants directly from vector.ts
import { VEC_SIZE, VEC_DATA } from './vector';
// Import decRef for recursive calls
import { decRef } from './heapUtils';
import { SequenceView } from '../seq/sequenceView';
// Import sequence constants
import {
  PROC_MAP,
  PROC_FILTER,
  PROC_SIFT, // Add other existing PROC_ types
  SEQ_SRC_RANGE,
  SEQ_SRC_VECTOR,
  SEQ_SRC_DICT,
  SEQ_SRC_CONSTANT,
  SEQ_SRC_PROCESSOR,
  PROC_DROP,
  PROC_MULTI,
  PROC_MULTI_SOURCE,
  PROC_TAKE, // Add other existing SEQ_SRC_ types
} from '../seq/sequence'; // Adjust path if needed

// Define CELL_SIZE based on 32-bit float tagged values
const CELL_SIZE = 4;

// --- Sequence Layout Constants ---
const SEQ_META_COUNT = 2; // Offset for number of meta elements (uint16)
const SEQ_META_START = 4; // Offset where meta elements begin (uint32/float32)

// --- Sequence Cleanup Helpers (Internal to this module) ---

/** Reads a metadata element at a given index */
function seqGetMetaValue(heap: Heap, address: number, metaIndex: number): number {
  const byteOffset = heap.blockToByteOffset(address);
  const metaValueOffset = byteOffset + SEQ_META_START + metaIndex * CELL_SIZE;
  // TODO: Handle block boundaries if metadata spans blocks
  return heap.memory.readFloat(SEG_HEAP, metaValueOffset);
}

// --- Exported Cleanup Handlers ---

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
        // read the Proc‐opcode and all children via SequenceView
        const procType = seq.processorType;
        switch (procType) {
          case PROC_MAP:
          case PROC_FILTER:
          case PROC_SIFT:
          case PROC_TAKE:
          case PROC_DROP:
          case PROC_MULTI:
          case PROC_MULTI_SOURCE:
            // decref every child (source, fn, etc.)
            for (const child of seq.children) {
              decRef(heap, child);
            }
            break;
          default:
            console.warn(
              `performSequenceCleanup: Unknown processor type ${procType} @ seq ${address}`
            );
        }
        break;
      }

      // … the other cases (VECTOR, DICT, CONSTANT, RANGE) remain unchanged …
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
