import { executeOp } from '../ops/builtins';
import { vm } from '../core/globalState';
import { parse } from './parser';
import { toTaggedValue, Tag } from '../core/tagged';
import { Tokenizer } from './tokenizer';
import { Op } from '../ops/opcodes';
import { SEG_CODE } from '../core/memory';

export function execute(start: number, breakAtIP?: number): void {
  vm.IP = start;
  vm.running = true;
  while (vm.running) {
    // Check if we need to break before executing the next instruction
    if (breakAtIP !== undefined && vm.IP === breakAtIP) {
      vm.running = false; // Stop execution
      break; // Exit the loop
    }

    // Use our new nextOpcode method which handles both 1-byte and 2-byte opcodes
    const functionIndex = vm.nextOpcode();
    if (vm.debug) console.log({ functionIndex }, vm.IP - (functionIndex >= 128 ? 2 : 1));
    
    try {
      // Check for invalid opcodes (values that exceed the valid range)
      if (functionIndex < 0 || functionIndex >= 32768) {
        // Get the actual raw byte value from memory at the original IP position
        const originalIP = vm.IP - (functionIndex >= 128 ? 2 : 1);
        const rawValue = vm.memory.read8(SEG_CODE, originalIP);
        throw new Error(`Invalid opcode: ${rawValue}`);
      }
      
      // For backward compatibility during transition
      if (functionIndex < Op.IfFalseBranch) {
        // If it's a standard opcode (0-127), use the existing executeOp function
        executeOp(vm, functionIndex);
      } else {
        // Otherwise use the function table
        try {
          vm.functionTable.execute(vm, functionIndex);
        } catch (funcError) {
          // If the function table throws about missing functions, convert to invalid opcode error
          if (funcError instanceof Error && funcError.message.includes('No function registered')) {
            throw new Error(`Invalid opcode: ${functionIndex}`);
          }
          throw funcError;
        }
      }
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

  // 2. Push the return IP onto the VM's return stack, tagged as code.
  // This tells the Tacit code's 'exit' operation where to jump back to.
  vm.rpush(toTaggedValue(returnIP, Tag.CODE));
  
  // 3. Set the Instruction Pointer to the beginning of the Tacit function.
  vm.IP = codePtr;

  // 4. Ensure the VM is marked as running.
  vm.running = true;

  // 5. Call the main execution loop, providing the start IP and the IP to break at.
  // We explicitly don't provide a breakAtIP here, as we want to rely on Exit opcode
  execute(vm.IP);
  
  // 6. The Exit operation in the called function should have updated IP and popped the return stack
  // If we get here, the function has completed normally
  if (vm.IP !== returnIP) {
    console.warn(`Warning: IP mismatch after function call. Expected ${returnIP}, got ${vm.IP}`);
    vm.IP = returnIP; // Force IP back to expected return address
  }
}
