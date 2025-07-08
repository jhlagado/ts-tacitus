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
    if (breakAtIP !== undefined && vm.IP === breakAtIP) {
      vm.running = false;
      break;
    }

    const functionIndex = vm.nextOpcode();
    if (vm.debug) console.log({ functionIndex }, vm.IP - (functionIndex >= 128 ? 2 : 1));

    try {
      if (functionIndex < 0 || functionIndex >= 32768) {
        const originalIP = vm.IP - (functionIndex >= 128 ? 2 : 1);
        const rawValue = vm.memory.read8(SEG_CODE, originalIP);
        throw new Error(`Invalid opcode: ${rawValue}`);
      }

      if (functionIndex < Op.IfFalseBranch) {
        executeOp(vm, functionIndex);
      } else {
        try {
          vm.functionTable.execute(vm, functionIndex);
        } catch (funcError) {
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

      vm.compiler.reset();
      vm.compiler.preserve = false;
      console.log((error as Error).stack);
      throw new Error(errorMessage);
    }
  }
  vm.compiler.reset();
  vm.compiler.preserve = false;
}

export function executeProgram(code: string): void {
  parse(new Tokenizer(code));
  execute(vm.compiler.BCP);
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
  const returnIP = vm.IP;

  vm.rpush(toTaggedValue(returnIP, Tag.CODE));

  vm.rpush(vm.BP);

  vm.BP = vm.RP;

  vm.IP = codePtr;

  vm.running = true;

  execute(vm.IP);

  if (vm.IP !== returnIP) {
    console.warn(`Warning: IP mismatch after function call. Expected ${returnIP}, got ${vm.IP}`);
    vm.IP = returnIP;
  }
}
