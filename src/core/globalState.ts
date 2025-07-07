import { VM } from './vm';

export let vm = new VM();

export function initializeInterpreter(): void {
  vm = new VM();
}
