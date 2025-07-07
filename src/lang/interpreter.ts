import { executeOp } from '../ops/builtins';
import { vm } from '../core/globalState';
import { parse } from './parser';
import { toTaggedValue, Tag } from '../core/tagged';
import { Tokenizer } from './tokenizer';

export function execute(start: number, breakAtIP?: number): void {
  vm.IP = start;
  vm.running = true;
  while (vm.running) {
    // Check if we need to break before executing the next instruction
    if (breakAtIP !== undefined && vm.IP === breakAtIP) {
      vm.running = false; // Stop execution
      break; // Exit the loop
    }

    const opcode = vm.next8(); // Read the 8-bit opcode
    if (vm.debug) console.log({ opcode }, vm.IP - 1);
    try {
      executeOp(vm, opcode);
    } catch (error) {
      const stackState = JSON.stringify(vm.getStackData());
      const errorMessage =
        `Error executing word (stack: ${stackState})` +
        (error instanceof Error ? `: ${error.message}` : '');
      if (vm.debug) console.log((error as Error).stack);

      // Reset compiler state when an error occurs
      vm.compiler.reset();
      vm.compiler.preserve = false;
      console.log((error as Error).stack);
      throw new Error(errorMessage);
    }
  }
  vm.compiler.reset();
  vm.compiler.preserve = false; // Reset preserve flag
}

export function executeProgram(code: string): void {
  parse(new Tokenizer(code));
  execute(vm.compiler.BP);
}

/**
 * Executes a specific block of Tacit code using the current global VM state
 * without resetting the interpreter. Control returns to the caller
 * after the Tacit code executes its 'exit' operation.
 * Assumes the global vm state is already set up as needed (e.g., stack prepared).
 *
 * @param codePtr The starting address (instruction pointer) of the Tacit code to execute.
 */
export function callTacitFunction(codePtr: number): void {
  // 1. Store the IP where TypeScript execution should resume conceptually.
  const returnIP = vm.IP;

  // 2. Push the IP onto the VM's return stack, tagged as code.
  // This tells the Tacit code's 'exit' operation where to jump back to.
  vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
  vm.rpush(vm.BP);
  vm.BP = vm.RP;

  // 3. Set the Instruction Pointer to the beginning of the Tacit function.
  vm.IP = codePtr;

  // 4. Ensure the VM is marked as running.
  vm.running = true;

  // 5. Call the main execution loop, providing the start IP and the IP to break at.
  execute(vm.IP, returnIP);

  // 6. Execution returns here once the loop breaks (because vm.IP became returnIP).
  // The results of the Tacit function are now on the vm's data stack.
  // vm.IP should be equal to the original returnIP.
}
