import { VM } from './vm';
import { registerCleanupHandler } from '../heap/heapUtils'; // Import the single registration function
import { HeapTag } from './tagged'; // Import HeapTag enum/type
import {
  performSequenceCleanup,
  performVectorCleanup,
} from '../heap/cleanupHandlers'; // Import the specific handlers

export const vm = new VM();

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
  // Reset the VM state
  Object.assign(vm, new VM());
  // NOTE: The handlers are registered once globally when this module loads.
  // Re-assigning vm properties in initializeInterpreter does NOT re-run the registration code above.
  // This is generally the desired behavior for global handlers.
}
