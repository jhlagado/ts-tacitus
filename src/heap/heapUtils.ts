import { fromTaggedValue } from '../core/tagged';
import { Heap } from './heap';

export function incRef(heap: Heap, tvalue: number) {
  const { value, heap: isHeap } = fromTaggedValue(tvalue);
  if (isHeap) {
    heap.incrementRef(value);
  }
}

export function decRef(heap: Heap, tvalue: number) {
  const { value, heap: isHeap } = fromTaggedValue(tvalue);
  if (isHeap) {
    heap.decrementRef(value); // 1 → 0 (frees if needed)
  }
}
