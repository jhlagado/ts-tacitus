import { Heap, BLOCK_SIZE } from './heap';
import { SEG_HEAP } from '../core/memory';
import { INVALID } from '../core/constants';
// Import constants directly from vector.ts
import { VEC_SIZE, VEC_DATA } from './vector';
// Import decRef for recursive calls
import { decRef } from './heapUtils';
// Import sequence constants
import {
  PROC_MAP,
  PROC_FILTER,
  PROC_SIFT, // Add other existing PROC_ types
  SEQ_SRC_RANGE,
  SEQ_SRC_VECTOR,
  SEQ_SRC_DICT,
  SEQ_SRC_CONSTANT,
  SEQ_SRC_PROCESSOR, // Add other existing SEQ_SRC_ types
} from '../seq/sequence'; // Adjust path if needed

// Define CELL_SIZE based on 32-bit float tagged values
const CELL_SIZE = 4;

// --- Sequence Layout Constants ---
const SEQ_TYPE = 0; // Offset for SEQ_SRC_* type (uint16)
const SEQ_META_COUNT = 2; // Offset for number of meta elements (uint16)
const SEQ_META_START = 4; // Offset where meta elements begin (uint32/float32)

// --- Sequence Cleanup Helpers (Internal to this module) ---

/** Reads the internal sequence source type identifier */
function seqGetSourceType(heap: Heap, address: number): number {
  const byteOffset = heap.blockToByteOffset(address);
  return heap.memory.read16(SEG_HEAP, byteOffset + SEQ_TYPE);
}

/** Reads the number of metadata elements stored */
function seqGetMetaCount(heap: Heap, address: number): number {
  const byteOffset = heap.blockToByteOffset(address);
  return heap.memory.read16(SEG_HEAP, byteOffset + SEQ_META_COUNT);
}

/** Reads a metadata element at a given index */
function seqGetMetaValue(heap: Heap, address: number, metaIndex: number): number {
  const byteOffset = heap.blockToByteOffset(address);
  const metaValueOffset = byteOffset + SEQ_META_START + metaIndex * CELL_SIZE;
  // TODO: Handle block boundaries if metadata spans blocks
  return heap.memory.readFloat(SEG_HEAP, metaValueOffset);
}

/** Reads the processor type for SEQ_SRC_PROCESSOR sequences */
function seqGetProcessorType(heap: Heap, address: number): number {
  const metaCount = seqGetMetaCount(heap, address);
  // Processor type is stored as the last metadata element
  return seqGetMetaValue(heap, address, metaCount - 1);
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
    const sourceType = seqGetSourceType(heap, address);
    switch (sourceType) {
      case SEQ_SRC_PROCESSOR: {
        const procType = seqGetProcessorType(heap, address);
        switch (procType) {
          case PROC_MAP:
          case PROC_FILTER: {
            const innerSeq = seqGetMetaValue(heap, address, 0);
            decRef(heap, innerSeq);
            break;
          }
          case PROC_SIFT: {
            const innerSeq = seqGetMetaValue(heap, address, 0);
            const maskSeq = seqGetMetaValue(heap, address, 1);
            decRef(heap, innerSeq);
            decRef(heap, maskSeq);
            break;
          }
          // TODO: Add other existing PROC_ cases
          default:
            console.warn(
              `performSequenceCleanup: Unknown processor type ${procType} for SEQ_SRC_PROCESSOR at address ${address}`
            );
            break;
        }
        break;
      }
      case SEQ_SRC_VECTOR: {
        const vectorPtr = seqGetMetaValue(heap, address, 0);
        decRef(heap, vectorPtr);
        break;
      }
      case SEQ_SRC_DICT: {
        const dictPtr = seqGetMetaValue(heap, address, 0);
        decRef(heap, dictPtr);
        break;
      }
      case SEQ_SRC_CONSTANT: {
        const value = seqGetMetaValue(heap, address, 0);
        decRef(heap, value);
        break;
      }
      case SEQ_SRC_RANGE:
        break; // No internal heap objects
      default:
        console.warn(
          `performSequenceCleanup: Unknown sequence source type ${sourceType} at address ${address}`
        );
        break;
    }
  } catch (error) {
    console.error(`Error during sequence cleanup for address ${address}:`, error);
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

// Add other cleanup handlers here if needed (e.g., for specific complex types)
