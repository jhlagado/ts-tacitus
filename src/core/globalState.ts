import { VM } from './vm';
import { registerCleanupHandler } from '../heap/heapUtils'; // Import the single registration function
import { HeapTag } from './tagged'; // Import HeapTag enum/type
import { performVectorCleanup } from '../heap/vectorCleanup'; // Import the specific handlers
import { performSequenceCleanup } from '../seq/seqCleanup';

export let vm = new VM();

// --- Register specific cleanup handlers ---
console.log('Registering heap cleanup handlers...'); // Add log for confirmation

// Register the handler for VECTOR types
registerCleanupHandler(HeapTag.VECTOR, performVectorCleanup);

// Register the handler for DICT types
registerCleanupHandler(HeapTag.DICT, performVectorCleanup);

// Register the handler for SEQUENCE types
registerCleanupHandler(HeapTag.SEQUENCE, performSequenceCleanup);

// Add registrations for any other HeapTag types that require specific cleanup
// registerCleanupHandler(HeapTag.SOME_OTHER_TYPE, performSomeOtherCleanup);

console.log('Heap cleanup handlers registered.'); // Add log for confirmation
// --- End of registration ---

export function initializeInterpreter(): void {
  vm = new VM();
}
