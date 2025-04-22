import { Heap } from '../heap/heap';
import { decRef } from '../heap/heapUtils';
// Import internal sequence type constants using correct names
// REMOVED: ProcType.SCAN, ProcType.TAKE, ProcType.DROP, SeqSourceType.STRING as they are not exported/defined in sequence.ts
import { ProcType, SeqSourceType } from './sequence'; // Adjust path if needed
// Import SEG_HEAP
import { SEG_HEAP } from '../core/memory';
import { CELL_SIZE } from '../core/constants';
import { fromTaggedValue, HeapTag, CoreTag } from '../core/tagged';
import { VM } from '../core/vm';
import { vectorSource, dictionarySource, stringSource, constantSource } from './source';

// --- Constants for Sequence Layout (Based on sequence.ts) ---
const SEQ_TYPE = 0; // Offset for SeqSourceType.* type (uint16)
const SEQ_META_COUNT = 2; // Offset for number of meta elements (uint16)
const SEQ_META_START = 4; // Offset where meta elements begin (uint32/float32)
//-----------------------------------------------------------------------------


// --- Helper Functions ---

/** Reads the internal sequence source type identifier (e.g., SeqSourceType.RANGE) */
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

/** Reads the processor type (e.g., ProcType.MAP) for SeqSourceType.PROCESSOR sequences */
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
      case SeqSourceType.PROCESSOR: {
        const procType = seqGetProcessorType(heap, address);
        switch (procType) {
            case ProcType.MAP:
            case ProcType.FILTER:
            // REMOVED: ProcType.TAKE, ProcType.DROP cases
             {
                const innerSeq = seqGetMetaValue(heap, address, 0); // Arg 0 = inner sequence
                decRef(heap, innerSeq);
                break;
            }
            case ProcType.SIFT: { // Assuming meta[0]=innerSeq, meta[1]=maskSeq
                const innerSeq = seqGetMetaValue(heap, address, 0);
                const maskSeq = seqGetMetaValue(heap, address, 1);
                decRef(heap, innerSeq);
                decRef(heap, maskSeq);
                break;
            }
            // REMOVED: ProcType.SCAN case
            // TODO: Add existing ProcType.MULTI_SOURCE, ProcType.CHAIN cases based on their meta layout
            default:
                 console.warn(`cleanupSequence: Unknown or unhandled processor type ${procType} for SeqSourceType.PROCESSOR at address ${address}`);
                 break;
        }
        break; // End of SeqSourceType.PROCESSOR case
      }

      // --- Source Types ---
      case SeqSourceType.VECTOR: { // Assuming meta[0] = vectorPtr
        const vectorPtr = seqGetMetaValue(heap, address, 0);
        decRef(heap, vectorPtr);
        break;
      }
      case SeqSourceType.DICT: { // Assuming meta[0] = dictPtr
        const dictPtr = seqGetMetaValue(heap, address, 0);
        decRef(heap, dictPtr);
        break;
      }
       case SeqSourceType.CONSTANT: { // Assuming meta[0] = constant value
          const value = seqGetMetaValue(heap, address, 0);
          decRef(heap, value);
          break;
      }
      case SeqSourceType.RANGE:
      // REMOVED: SeqSourceType.STRING case
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
