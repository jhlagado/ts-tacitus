/**
 * @file src/ops/core/core-ops.ts
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

import {
  VM,
  ReturnStackOverflowError,
  ReturnStackUnderflowError,
  Verb,
  toTaggedValue,
  Tag,
  fromTaggedValue,
  isCode,
  RSTACK_SIZE,
} from '@src/core';
import { executeOp } from '../builtins';

import { formatValue } from '@src/core';

/** Number of bytes per stack element. */
const CELL_SIZE = 4;

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
  const address = vm.nextInt16();
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
  const offset = vm.nextInt16();
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
  const offset = vm.nextInt16();
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
  const callAddress = vm.nextInt16();
  vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
  if (vm.frameBpInCells) {
    vm.rpush(vm.BPCells);
    vm.BPCells = vm.RSP;
  } else {
  // Save caller BP (cells)
  vm.rpush(vm.BP);
  // Base pointer remains byte-based; align to current return stack (cells -> bytes)
  vm.BP = vm.RSP; // BP now in cells
  }
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
    if (vm.RSP < 2) {
      vm.running = false;
      return;
    }

    if (vm.frameBpInCells) {
      vm.RSP = vm.BPCells;
      vm.BPCells = vm.rpop();
    } else {
      // Transitional (Plan 26 Phase 1): legacy frame stored BP in bytes.
      // Validate alignment then convert to cells. Once Phase 2 flips fully
      // to cell representation this branch will be removed.
  const bpBytes = vm.BPBytes; // explicit legacy byte-form
      if (bpBytes < 0 || (bpBytes & (CELL_SIZE - 1)) !== 0 || bpBytes > RSTACK_SIZE) {
        throw new ReturnStackUnderflowError('exit', vm.getStackData());
      }
      vm.RSP = bpBytes / CELL_SIZE; // division is safe after alignment check
  vm.BP = vm.rpop(); // restored value is cells
    }
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
 * Implements the exit code operation.
 *
 * This operation has exactly the same implementation as exitOp, handling the
 * return from a subroutine call by:
 * 1. Checking if there's enough data on the return stack
 * 2. Popping the base pointer from the return stack
 * 3. Popping the return address from the return stack
 * 4. Jumping to the return address
 *
 * If the return stack is empty after popping the base pointer, the VM execution stops.
 * This handles the case of returning from the main program.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @throws {Error} If an error occurs during the exit operation, the VM is stopped
 * and the error is propagated.
 */
export const exitCodeOp: Verb = (vm: VM) => {
  try {
    if (vm.RSP < 1) {
      vm.running = false;
      return;
    }
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
  const { tag, value: addr, meta } = fromTaggedValue(value);

  switch (tag) {
    case Tag.CODE:
      if (meta === 1) {
        vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
        vm.IP = addr;
      } else {
        vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
  vm.rpush(vm.BP); // save caller BP (cells)
  // Convert RSP (cells) to bytes for BP
  vm.BP = vm.RSP; // BP in cells
        vm.IP = addr;
      }
      break;

    case Tag.BUILTIN:
      executeOp(vm, addr);
      break;

    default:
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
  if ((vm.RSP + 1) * CELL_SIZE > RSTACK_SIZE) {
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
    if (vm.RSP < 1) {
      throw new ReturnStackUnderflowError('group-right', vm.getStackData());
    }
    const sp0 = vm.rpop();
    const sp1 = vm.SP;
    const d = (sp1 - sp0) / CELL_SIZE;
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

/**
 * Implements the pushSymbolRef operation for @symbol syntax support.
 *
 * Expects a string on the stack containing the symbol name.
 * Resolves the symbol to a tagged value (Tag.BUILTIN or Tag.CODE) and pushes it.
 * This enables metaprogramming by creating references to operations and colon definitions.
 *
 * Stack effect: ( string -- tagged_value )
 *
 * Examples:
 * - "add" pushSymbolRef → Tag.BUILTIN(Op.Add)
 * - "square" pushSymbolRef → Tag.CODE(bytecode_addr)
 *
 * @param {VM} vm - The virtual machine instance
 */
export const pushSymbolRefOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'pushSymbolRef');

  const stringTaggedValue = vm.pop();
  const { tag, value } = fromTaggedValue(stringTaggedValue);

  if (tag !== Tag.STRING) {
    throw new Error('pushSymbolRef expects a string on the stack');
  }

  const symbolName = vm.digest.get(value);
  if (symbolName === undefined) {
    throw new Error(`String not found in digest: ${value}`);
  }

  vm.pushSymbolRef(symbolName);
};
