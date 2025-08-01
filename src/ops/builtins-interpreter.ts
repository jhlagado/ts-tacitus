/**
 * @file src/ops/builtins-interpreter.ts
 *
 * This file implements core interpreter control operations for the Tacit VM.
 *
 * These operations handle fundamental aspects of VM execution including:
 * - Literal value handling (numbers, strings)
 * - Control flow (skipping, calling, exiting)
 * - Code evaluation
 * - Stack group operations
 *
 * These operations form the backbone of the VM's execution model and are essential
 * for implementing higher-level language constructs.
 */

import { VM } from '../core/vm';
import { ReturnStackOverflowError, ReturnStackUnderflowError } from '../core/errors';
import { Verb } from '../core/types';
import { toTaggedValue, Tag, fromTaggedValue, isCode } from '../core/tagged';
import { RSTACK_SIZE } from '../core/constants';
import { executeOp } from './builtins';

import { formatValue } from '../core/utils';

/** Number of bytes per stack element */
const BYTES_PER_ELEMENT = 4;

/**
 * Implements the literal number operation.
 *
 * Reads a 32-bit floating point number from the bytecode stream and pushes it onto the stack.
 * This operation is used by the compiler to embed numeric literals in the bytecode.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 *
 *
 * literalNumberOp(vm)
 *
 */
export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.nextFloat32();
  vm.push(num);
};

/**
 * Implements the literal string operation.
 *
 * Reads a 16-bit address from the bytecode stream, creates a tagged string value
 * referencing that address in the string table, and pushes it onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 *
 *
 *
 * literalStringOp(vm)
 *
 */
export const literalStringOp: Verb = (vm: VM) => {
  const address = vm.next16();
  const taggedString = toTaggedValue(address, Tag.STRING);
  vm.push(taggedString);
};

/**
 * Implements the skip definition operation.
 *
 * Reads a 16-bit offset from the bytecode stream and advances the instruction pointer
 * by that offset. This is used to skip over function definitions during normal execution.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 *
 *
 *
 * skipDefOp(vm)
 *
 */
export const skipDefOp: Verb = (vm: VM) => {
  const offset = vm.next16();
  vm.IP += offset;
};

/**
 * Implements the skip block operation.
 *
 * Reads a 16-bit offset from the bytecode stream, pushes the current instruction pointer
 * as a CODE tag onto the stack, and then advances the instruction pointer by the offset.
 * This is used to create code blocks that can be executed later.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 *
 *
 *
 * skipBlockOp(vm)
 *
 *
 */
export const skipBlockOp: Verb = (vm: VM) => {
  const offset = vm.next16();
  vm.push(toTaggedValue(vm.IP, Tag.CODE));
  vm.IP += offset;
};

/**
 * Implements the function call operation.
 *
 * Reads a 16-bit address from the bytecode stream, saves the current execution context
 * (instruction pointer and base pointer) on the return stack, and jumps to the specified address.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 *
 *
 * callOp(vm)
 *
 *
 *
 * @remarks
 * The call operation sets up a new stack frame by:
 * 1. Pushing the return address (current IP) onto the return stack
 * 2. Pushing the current base pointer (BP) onto the return stack
 * 3. Setting the new base pointer to the current return stack pointer
 * 4. Jumping to the function's address
 */
export const callOp: Verb = (vm: VM) => {
  const callAddress = vm.next16();
  vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
  vm.rpush(vm.BP);
  vm.BP = vm.RP;
  vm.IP = callAddress;
};

/**
 * Implements the abort operation.
 *
 * Stops the VM execution immediately by setting the running flag to false.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 * abortOp(vm)
 *
 *
 * @remarks
 * This operation is typically used for error handling or to terminate
 * execution in response to a user command.
 */
export const abortOp: Verb = (vm: VM) => {
  vm.running = false;
};

/**
 * Implements the function exit operation.
 *
 * Restores the previous execution context from the return stack and returns to the caller.
 * If there is no caller (empty return stack), stops the VM execution.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 * exitOp(vm)
 *
 *
 *
 *
 * @remarks
 * The exit operation tears down the current stack frame by:
 * 1. Resetting the return stack pointer to the current base pointer
 * 2. Popping the previous base pointer from the return stack
 * 3. Popping the return address from the return stack
 * 4. Jumping to the return address
 *
 * If the return stack is empty after popping the base pointer, the VM execution stops.
 * This handles the case of returning from the main program.
 *
 * @throws {Error} If an error occurs during the exit operation, the VM is stopped
 * and the error is propagated.
 */
export const exitOp: Verb = (vm: VM) => {
  try {
    if (vm.RP < 2 * BYTES_PER_ELEMENT) {
      vm.running = false;
      return;
    }

    vm.BP = vm.rpop();
    const returnAddr = vm.rpop();

    if (isCode(returnAddr)) {
      const { value: returnIP } = fromTaggedValue(returnAddr);
      vm.IP = returnIP;
    } else {
      vm.IP = Math.floor(returnAddr);
    }
  } catch (e) {
    vm.running = false;
    throw e;
  }
};

/**
 * Implements the evaluate operation.
 *
 * Pops a value from the stack. If it's a code reference, executes it by setting up
 * a new stack frame and jumping to the code. Otherwise, pushes the value back onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 * evalOp(vm)
 *
 *
 *
 * @example
 *
 * evalOp(vm)
 *
 *
 *
 * @remarks
 * This operation is used to implement higher-order functions and dynamic code execution.
 * It allows code blocks to be passed around as values and executed on demand.
 */
export const evalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'eval');
  const value = vm.pop();
  const { tag, value: addr } = fromTaggedValue(value);
  
  switch (tag) {
    case Tag.CODE:
    case Tag.CODE_BLOCK:
      // Bytecode execution: set up call frame and jump to address
      vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
      vm.rpush(vm.BP);
      vm.BP = vm.RP;
      vm.IP = addr;
      break;
      
    case Tag.BUILTIN:
      // Built-in execution: direct JS function dispatch
      executeOp(vm, addr);
      break;
      
    default:
      // Not executable - push back onto stack
      vm.push(value);
      break;
  }
};

/**
 * Implements the group left operation.
 *
 * Pushes the current stack pointer onto the return stack, marking the beginning
 * of a stack group operation.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 * groupLeftOp(vm)
 *
 *
 *
 * @remarks
 * This operation is typically used in conjunction with groupRightOp to count
 * the number of items pushed onto the stack between the two operations.
 */
export const groupLeftOp: Verb = (vm: VM) => {
  if (vm.RP + BYTES_PER_ELEMENT > RSTACK_SIZE) {
    throw new ReturnStackOverflowError('group-left', vm.getStackData());
  }
  vm.rpush(vm.SP);
};

/**
 * Implements the group right operation.
 *
 * Pops the starting stack pointer from the return stack (previously saved by groupLeftOp),
 * calculates how many items have been pushed onto the stack since then,
 * and pushes that count onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 *
 * groupRightOp(vm)
 *
 *
 *
 *
 * @remarks
 * This operation works with groupLeftOp to implement dynamic stack counting,
 * which is useful for operations that need to know how many items were produced
 * by a preceding computation.
 */
export const groupRightOp: Verb = (vm: VM) => {
  try {
    if (vm.RP < BYTES_PER_ELEMENT) {
      throw new ReturnStackUnderflowError('group-right', vm.getStackData());
    }
    const sp0 = vm.rpop();
    const sp1 = vm.SP;
    const d = (sp1 - sp0) / BYTES_PER_ELEMENT;
    vm.push(d);
  } catch (e) {
    vm.running = false;
    throw e;
  }
};

/**
 * Implements the print operation.
 *
 * Pops a value from the stack and prints it to the console in a formatted way.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 * printOp(vm)
 *
 *
 *
 * @example
 *
 * printOp(vm)
 *
 *
 *
 * @remarks
 * This operation uses the formatValue utility to properly format different types
 * of values, including lists and other complex data structures.
 */
export const printOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'print');
  const d = vm.pop();
  console.log(formatValue(vm, d));
};
