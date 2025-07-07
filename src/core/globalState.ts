import { VM } from './vm';
import { initFunctionTable } from '../ops/init-function-table';

// Create VM without immediate initialization to avoid circular dependencies
export let vm: VM;

export function initializeInterpreter(): void {
  vm = new VM();

  // Initialize function table after VM is fully created
  // This is done here to avoid circular dependencies
  initFunctionTable(vm);
}
