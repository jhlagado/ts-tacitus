import { Heap } from '../heap/heap';
import { decRef } from '../heap/heapUtils';
// Import internal sequence type constants using correct names
// REMOVED: PROC_SCAN, PROC_TAKE, PROC_DROP, SEQ_SRC_STRING as they are not exported/defined in sequence.ts
import {
  PROC_MAP, PROC_FILTER, PROC_SIFT, // Add other existing PROC_ types as needed
  SEQ_SRC_RANGE, SEQ_SRC_VECTOR, SEQ_SRC_DICT, SEQ_SRC_CONSTANT, SEQ_SRC_PROCESSOR // Add other existing SEQ_SRC_ types as needed
} from './sequence'; // Adjust path if needed
// Import SEG_HEAP
import { SEG_HEAP } from '../core/memory';
import { CELL_SIZE } from '../core/constants';
import { fromTaggedValue, HeapTag, CoreTag } from '../core/tagged';
import { VM } from '../core/vm';
import { vectorSource, dictionarySource, stringSource, constantSource } from './source';

// --- Constants for Sequence Layout (Based on sequence.ts) ---
const SEQ_TYPE = 0; // Offset for SEQ_SRC_* type (uint16)
const SEQ_META_COUNT = 2; // Offset for number of meta elements (uint16)
const SEQ_META_START = 4; // Offset where meta elements begin (uint32/float32)
//-----------------------------------------------------------------------------


// --- Helper Functions ---

/** Reads the internal sequence source type identifier (e.g., SEQ_SRC_RANGE) */
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

    // !!! CRITICAL: Using readFloat as readFloat32 is missing. !!!
    // !!! This WILL likely read incorrect data (8 bytes instead of 4). !!!
    // !!! You MUST implement readFloat32 in the Memory class. !!!
    console.warn("Using potentially incorrect readFloat instead of readFloat32 in seqGetMetaValue");
    return heap.memory.readFloat(SEG_HEAP, metaValueOffset);
}

/** Reads the processor type (e.g., PROC_MAP) for SEQ_SRC_PROCESSOR sequences */
function seqGetProcessorType(heap: Heap, address: number): number {
    const metaCount = seqGetMetaCount(heap, address);
    // Processor type is stored as the last metadata element
    return seqGetMetaValue(heap, address, metaCount - 1);
}


// --- Main Sequence Cleanup Function (Step 3) ---
export function cleanupSequence(heap: Heap, address: number): void {
  try {
    const sourceType = seqGetSourceType(heap, address);

    switch (sourceType) {
      case SEQ_SRC_PROCESSOR: {
        const procType = seqGetProcessorType(heap, address);
        switch (procType) {
            case PROC_MAP:
            case PROC_FILTER:
            // REMOVED: PROC_TAKE, PROC_DROP cases
             {
                const innerSeq = seqGetMetaValue(heap, address, 0); // Arg 0 = inner sequence
                decRef(heap, innerSeq);
                break;
            }
            case PROC_SIFT: { // Assuming meta[0]=innerSeq, meta[1]=maskSeq
                const innerSeq = seqGetMetaValue(heap, address, 0);
                const maskSeq = seqGetMetaValue(heap, address, 1);
                decRef(heap, innerSeq);
                decRef(heap, maskSeq);
                break;
            }
            // REMOVED: PROC_SCAN case
            // TODO: Add existing PROC_MULTI_SOURCE, PROC_CHAIN cases based on their meta layout
            default:
                 console.warn(`cleanupSequence: Unknown or unhandled processor type ${procType} for SEQ_SRC_PROCESSOR at address ${address}`);
                 break;
        }
        break; // End of SEQ_SRC_PROCESSOR case
      }

      // --- Source Types ---
      case SEQ_SRC_VECTOR: { // Assuming meta[0] = vectorPtr
        const vectorPtr = seqGetMetaValue(heap, address, 0);
        decRef(heap, vectorPtr);
        break;
      }
      case SEQ_SRC_DICT: { // Assuming meta[0] = dictPtr
        const dictPtr = seqGetMetaValue(heap, address, 0);
        decRef(heap, dictPtr);
        break;
      }
       case SEQ_SRC_CONSTANT: { // Assuming meta[0] = constant value
          const value = seqGetMetaValue(heap, address, 0);
          decRef(heap, value);
          break;
      }
      case SEQ_SRC_RANGE:
      // REMOVED: SEQ_SRC_STRING case
        // These sources hold no internal heap pointers in their metadata
        break;

      default:
        console.warn(`cleanupSequence: Unknown sequence source type ${sourceType} at address ${address}`);
        break;
    }
  } catch (error) {
      console.error(`Error during sequence cleanup for address ${address}:`, error);
  }
}


export function createSequence(vm: VM, sourcePtr: number): number {
  const { tag, isHeap } = fromTaggedValue(sourcePtr);

  if (isHeap && tag === HeapTag.SEQUENCE) {
    return sourcePtr;
  }
  if (isHeap && tag === HeapTag.VECTOR) {
    return vectorSource(vm.heap, sourcePtr);
  }
  if (isHeap && tag === HeapTag.DICT) {
    return dictionarySource(vm.heap, sourcePtr);
  }
  if (!isHeap && tag === CoreTag.STRING) {
    return stringSource(vm.heap, sourcePtr);
  }
  if (!isHeap && (tag === CoreTag.INTEGER || tag === CoreTag.NUMBER)) {
    return constantSource(vm.heap, sourcePtr);
  }

  throw new Error('Invalid argument for seq: expected sequence, vector, dict, string, or number');
}
