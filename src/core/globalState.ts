import { VM } from './vm';
import { registerCleanupHandler } from '../heap/heapUtils'; // Import the single registration function
import { HeapTag } from './tagged'; // Import HeapTag enum/type
import { performVectorCleanup } from '../heap/vectorCleanup'; // Import the specific handlers

export let vm = new VM();

// --- Register specific cleanup handlers ---
console.log('Registering heap cleanup handlers...'); // Add log for confirmation

// Register the handler for VECTOR types
registerCleanupHandler(HeapTag.VECTOR, performVectorCleanup);


console.log('Heap cleanup handlers registered.'); // Add log for confirmation

export function initializeInterpreter(): void {
  vm = new VM();
}
