import { VM } from "./vm";

export const vm = new VM();

export function initializeInterpreter(): void {
  // Reset the VM state
  Object.assign(vm, new VM());
}
