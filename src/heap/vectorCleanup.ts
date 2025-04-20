import { Heap } from './heap';
import { decRef } from './heapUtils';
import { VectorView } from './vectorView';

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
