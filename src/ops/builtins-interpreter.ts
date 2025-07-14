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
import { Verb } from '../core/types';
import { toTaggedValue, Tag, fromTaggedValue, isCode } from '../core/tagged';

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
 * // When the compiler encounters a number literal like 42.5, it generates:
 * // [Op.LITERAL_NUMBER, <32-bit float representation of 42.5>]
 * // 
 * // When executed:
 * literalNumberOp(vm)
 * // Stack after: [... 42.5]
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
 * // When the compiler encounters a string literal like "hello", it:
 * // 1. Adds "hello" to the string table at address X
 * // 2. Generates: [Op.LITERAL_STRING, <16-bit representation of X>]
 * // 
 * // When executed:
 * literalStringOp(vm)
 * // Stack after: [... STRING:X] where X is the address in the string table
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
 * // When the compiler encounters a function definition, it generates:
 * // [Op.SKIP_DEF, <16-bit offset to skip the function body>]
 * // [... function body bytecode ...]
 * // 
 * // When executed during normal code flow:
 * skipDefOp(vm)
 * // Result: VM's instruction pointer jumps past the function body
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
 * // When the compiler encounters a code block like { ... }, it generates:
 * // [Op.SKIP_BLOCK, <16-bit offset to skip the block>]
 * // [... block bytecode ...]
 * // 
 * // When executed:
 * skipBlockOp(vm)
 * // Stack after: [... CODE:X] where X points to the block's bytecode
 * // Result: VM's instruction pointer jumps past the block
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
 * // When the compiler encounters a function call, it generates:
 * // [Op.CALL, <16-bit address of the function>]
 * // 
 * // When executed:
 * callOp(vm)
 * // Return stack after: [... return_address base_pointer]
 * // Result: VM jumps to the function's bytecode and sets up a new stack frame
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
 * // When executed:
 * abortOp(vm)
 * // Result: VM execution stops
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
 * // When a function completes execution:
 * exitOp(vm)
 * // Return stack before: [... return_address base_pointer]
 * // Return stack after: [... ]
 * // Result: VM jumps back to the caller and restores the previous stack frame
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
    vm.RP = vm.BP;
    if (vm.RP > 0) {
      vm.BP = vm.rpop();
    }

    if (vm.RP > 0) {
      const returnAddr = vm.rpop();
      if (isCode(returnAddr)) {
        const { value: returnIP } = fromTaggedValue(returnAddr);
        vm.IP = returnIP;
      } else {
        vm.IP = Math.floor(returnAddr);
      }
    } else {
      vm.running = false;
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
 * // Stack before: [... CODE:X] where X points to some bytecode
 * evalOp(vm)
 * // Return stack after: [... return_address base_pointer]
 * // Result: VM jumps to the code at X and sets up a new stack frame
 * 
 * @example
 * // Stack before: [... 42] (a non-code value)
 * evalOp(vm)
 * // Stack after: [... 42]
 * // Result: The value is simply pushed back onto the stack
 * 
 * @remarks
 * This operation is used to implement higher-order functions and dynamic code execution.
 * It allows code blocks to be passed around as values and executed on demand.
 */
export const evalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'eval');
  const value = vm.pop();
  if (isCode(value)) {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    const { value: pointer } = fromTaggedValue(value);
    vm.IP = pointer;
  } else {
    vm.push(value);
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
 * // Stack before: [... a b c]
 * // Return stack before: [... ]
 * groupLeftOp(vm)
 * // Stack after: [... a b c]
 * // Return stack after: [... SP] where SP points to the current stack position
 * 
 * @remarks
 * This operation is typically used in conjunction with groupRightOp to count
 * the number of items pushed onto the stack between the two operations.
 */
export const groupLeftOp: Verb = (vm: VM) => {
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
 * // After groupLeftOp, some values are pushed:
 * // Stack before: [... a b c d e]
 * // Return stack before: [... SP0] where SP0 points to position after 'c'
 * groupRightOp(vm)
 * // Stack after: [... a b c d e 2]
 * // Return stack after: [... ]
 * // The 2 indicates that 2 items (d and e) were pushed since groupLeftOp
 * 
 * @remarks
 * This operation works with groupLeftOp to implement dynamic stack counting,
 * which is useful for operations that need to know how many items were produced
 * by a preceding computation.
 */
export const groupRightOp: Verb = (vm: VM) => {
  if (vm.RP < BYTES_PER_ELEMENT) {
    throw new Error(`Return stack underflow: 'group-right' requires at least one item on the return stack`);
  }
  const sp0 = vm.rpop();
  const sp1 = vm.SP;
  const d = (sp1 - sp0) / BYTES_PER_ELEMENT;
  vm.push(d);
};

/**
 * Implements the print operation.
 * 
 * Pops a value from the stack and prints it to the console in a formatted way.
 * 
 * @param {VM} vm - The virtual machine instance.
 * 
 * @example
 * // Stack before: [... 42]
 * printOp(vm)
 * // Stack after: [... ]
 * // Console output: "42"
 * 
 * @example
 * // Stack before: [... LIST:3 1 2 3 LINK:4]
 * printOp(vm)
 * // Stack after: [... ]
 * // Console output: "(1 2 3)"
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
