/**
 * @file src/core/vm-core.ts
 * Core VM data structure creation and initialization.
 * Replaces VM class constructor with simple factory function.
 */

import { VMCore } from './vm-types';
import { STACK_SIZE, RSTACK_SIZE, CODE_SIZE, STRING_SIZE } from './constants';

/**
 * Creates a new VMCore instance with initialized memory and state.
 * Direct mapping target for C function: vm_init(tacit_vm_t* vm)
 * 
 * @returns Initialized VMCore structure
 */
export function createVMCore(): VMCore {
  return {
    memory: new Uint8Array(STACK_SIZE + RSTACK_SIZE + CODE_SIZE + STRING_SIZE),
    SP: 0,
    RP: 0,
    IP: 0,
    BP: 0,
    receiver: 0,
    listDepth: 0,
    running: true,
    debug: false
  };
}

/**
 * Resets VM core state to initial values.
 * Direct mapping target for C function: vm_reset(tacit_vm_t* vm)
 * 
 * @param vm VM core instance to reset
 */
export function resetVMCore(vm: VMCore): void {
  vm.SP = 0;
  vm.RP = 0;
  vm.IP = 0;
  vm.BP = 0;
  vm.receiver = 0;
  vm.listDepth = 0;
  vm.running = true;
  vm.debug = false;
}