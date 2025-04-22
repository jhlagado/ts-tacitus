import { Heap } from '../heap/heap';
import { decRef } from '../heap/heapUtils';
import { ProcType, SeqSourceType } from './sequence';
import { fromTaggedValue, HeapTag, CoreTag } from '../core/tagged';
import { VM } from '../core/vm';
import { vectorSource, dictionarySource, stringSource, constantSource } from './source';
import { SequenceView } from './sequenceView';

export function cleanupSequence(heap: Heap, address: number): void {
  try {
    const seqv = new SequenceView(heap, address);
    switch (seqv.type) {
      case SeqSourceType.PROCESSOR: {
        const p = seqv.processorType;
        switch (p) {
          case ProcType.MAP:
          case ProcType.FILTER:
            decRef(heap, seqv.meta(0));
            break;
          case ProcType.SIFT:
            decRef(heap, seqv.meta(0));
            decRef(heap, seqv.meta(1));
            break;
          default:
            break;
        }
        break;
      }
      case SeqSourceType.VECTOR:
        decRef(heap, seqv.meta(0));
        break;
      case SeqSourceType.DICT:
        decRef(heap, seqv.meta(0));
        break;
      case SeqSourceType.CONSTANT:
        decRef(heap, seqv.meta(0));
        break;
      default:
        break;
    }
  } catch {}
}

export function createSequence(vm: VM, sourcePtr: number): number {
  const { tag, isHeap } = fromTaggedValue(sourcePtr);
  if (isHeap && tag === HeapTag.SEQUENCE) return sourcePtr;
  if (isHeap && tag === HeapTag.VECTOR) return vectorSource(vm.heap, sourcePtr);
  if (isHeap && tag === HeapTag.DICT) return dictionarySource(vm.heap, sourcePtr);
  if (!isHeap && tag === CoreTag.STRING) return stringSource(vm.heap, sourcePtr);
  if (!isHeap && (tag === CoreTag.INTEGER || tag === CoreTag.NUMBER))
    return constantSource(vm.heap, sourcePtr);
  throw new Error('Invalid argument for seq: expected sequence, vector, dict, string, or number');
}
