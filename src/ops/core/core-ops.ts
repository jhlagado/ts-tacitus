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

import type { VM, Verb } from '@src/core';
import {
  ReturnStackUnderflowError,
  toTaggedValue,
  Tag,
  fromTaggedValue,
  SyntaxError,
  RSTACK_BASE,
} from '@src/core';
import { invokeEndDefinitionHandler } from '../../lang/compiler-hooks';
import { executeOp } from '../builtins';
import { Op } from '../opcodes';

import { formatValue } from '@src/core';
import {
  ensureRStackSize,
  nextFloat32,
  nextInt16,
  depth,
  getStackData,
  rpop,
  rpush,
  ensureStackSize,
  pop,
  push,
  peek,
  pushSymbolRef,
} from '../../core/vm';

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
  const num = nextFloat32(vm);
  push(vm, num);
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
  const address = nextInt16(vm);
  const taggedString = toTaggedValue(address, Tag.STRING);
  push(vm, taggedString);
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
  const offset = nextInt16(vm);
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
  const callAddress = nextInt16(vm);
  rpush(vm, vm.IP);
  // Save BP as relative cells on the return stack for compatibility
  rpush(vm, vm.bp - RSTACK_BASE);
  vm.bp = vm.rsp;
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
    // Require at least [returnAddr, savedBP] on return stack (depth in cells)
    if (vm.rsp - RSTACK_BASE < 2) {
      vm.running = false;
      return;
    }
    // Unified cell-only epilogue with corruption guard: if BP points outside
    // current return stack depth (or negative) treat as underflow corruption.
    const bpCells = vm.bp;
    if (bpCells < RSTACK_BASE || bpCells > vm.rsp) {
      throw new ReturnStackUnderflowError('exit', getStackData(vm));
    }
    vm.rsp = bpCells;
    // Saved BP is stored as relative cells; convert to absolute before restore
    vm.bp = rpop(vm) + RSTACK_BASE;
    vm.IP = rpop(vm);
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
  ensureStackSize(vm, 1, 'eval');
  const value = pop(vm);
  const { tag, value: addr, meta } = fromTaggedValue(value);

  switch (tag) {
    case Tag.CODE:
      if (meta === 1) {
        rpush(vm, vm.IP);
        vm.IP = addr;
      } else {
        rpush(vm, vm.IP);
        // Save BP as relative cells on the return stack for compatibility
        rpush(vm, vm.bp - RSTACK_BASE);
        vm.bp = vm.rsp;
        vm.IP = addr;
      }
      break;

    case Tag.BUILTIN:
      executeOp(vm, addr);
      break;

    default:
      push(vm, value);
      break;
  }
};

/**
 * Invokes the compiler hook that closes the current colon definition.
 *
 * At runtime this opcode should never be reached; it exists so that the generic
 * `;` immediate can call into the appropriate closer without dictionary lookups.
 */
export const endDefinitionOp: Verb = vm => {
  invokeEndDefinitionHandler(vm);
};

/**
 * Finalises an IF/ELSE construct by backpatching the most recent branch placeholder.
 *
 * Expects the branch placeholder address on the data stack (left there by the
 * immediate `if`/`else` words). Calculates the jump offset to the current compile
 * position and patches the placeholder before returning control to the parser.
 */
export const endIfOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 1, 'endif');

  const placeholder = pop(vm);
  if (!Number.isFinite(placeholder)) {
    throw new SyntaxError('ENDIF missing branch placeholder', getStackData(vm));
  }

  const branchPos = Math.trunc(placeholder);
  if (branchPos < 0) {
    throw new SyntaxError('Invalid branch placeholder for ENDIF', getStackData(vm));
  }

  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;
  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);
  vm.compiler.CP = prevCP;
};

/**
 * Closes a single `when` clause body during compilation.
 *
 * Expects the predicate skip placeholder on the data stack (left there by the
 * immediate `do`). Emits a forward branch to the shared exit, records that
 * branch on the return stack, patches the predicate’s skip to the current
 * compile pointer, and restores the stack to `[... savedRSP, EndWhen]`.
 */
export const endDoOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 1, 'enddo');

  const rawSkipPos = pop(vm);
  if (!Number.isFinite(rawSkipPos)) {
    throw new SyntaxError('enddo missing predicate placeholder', getStackData(vm));
  }

  const skipPos = Math.trunc(rawSkipPos);
  if (skipPos <= 0) {
    throw new SyntaxError('enddo invalid predicate placeholder', getStackData(vm));
  }

  vm.compiler.compileOpcode(Op.Branch);
  const exitOperandPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  rpush(vm, exitOperandPos);

  const fallthroughOffset = vm.compiler.CP - (skipPos + 2);
  const prevCP = vm.compiler.CP;
  vm.compiler.CP = skipPos;
  vm.compiler.compile16(fallthroughOffset);
  vm.compiler.CP = prevCP;
};

/**
 * Closes a single `case` clause body during compilation.
 *
 * Expects the predicate skip placeholder on the data stack (left there by the
 * immediate `of`). Emits a forward branch to the shared exit, records that
 * branch location on the return stack, and patches the predicate skip so failed
 * comparisons fall through to the next clause.
 */
export const endOfOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 1, 'endof');

  const rawSkipPos = pop(vm);
  if (!Number.isFinite(rawSkipPos)) {
    throw new SyntaxError('endof missing predicate placeholder', getStackData(vm));
  }

  const skipPos = Math.trunc(rawSkipPos);
  if (skipPos <= 0) {
    throw new SyntaxError('endof invalid predicate placeholder', getStackData(vm));
  }

  if (depth(vm) === 0) {
    throw new SyntaxError('clause closer without of', getStackData(vm));
  }

  const closer = peek(vm);
  const { tag, value } = fromTaggedValue(closer);
  if (tag !== Tag.BUILTIN || value !== Op.EndCase) {
    throw new SyntaxError('clause closer without of', getStackData(vm));
  }

  vm.compiler.compileOpcode(Op.Branch);
  const exitOperandPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  rpush(vm, exitOperandPos);

  const fallthroughOffset = vm.compiler.CP - (skipPos + 2);
  const prevCP = vm.compiler.CP;
  vm.compiler.CP = skipPos;
  vm.compiler.compile16(fallthroughOffset);
  vm.compiler.CP = prevCP;
};

/**
 * Closes an entire `when` construct during compilation.
 *
 * Expects the saved return-stack pointer snapshot on the data stack (pushed by
 * the immediate `when`). Pops it, then back-patches every pending exit branch
 * recorded by clause terminators so they land at the common exit after the
 * construct.
 */
export const endWhenOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 1, 'endwhen');

  const rawSavedRSP = pop(vm);
  if (!Number.isFinite(rawSavedRSP)) {
    throw new SyntaxError('endwhen missing saved RSP', getStackData(vm));
  }

  const savedRSPRel = Math.trunc(rawSavedRSP);
  const savedRSPAbs = RSTACK_BASE + savedRSPRel;

  while (vm.rsp > savedRSPAbs) {
    const rawExitPos = rpop(vm);
    if (!Number.isFinite(rawExitPos)) {
      throw new SyntaxError('endwhen invalid exit placeholder', getStackData(vm));
    }

    const exitPos = Math.trunc(rawExitPos);
    const exitOffset = vm.compiler.CP - (exitPos + 2);

    const prevCP = vm.compiler.CP;
    vm.compiler.CP = exitPos;
    vm.compiler.compile16(exitOffset);
    vm.compiler.CP = prevCP;
  }

  if (vm.rsp !== savedRSPAbs) {
    throw new SyntaxError('endwhen corrupted return stack', getStackData(vm));
  }
};

/**
 * Finalises an entire `case` construct during compilation.
 *
 * Expects the saved return-stack snapshot (left by the `case` opener). Emits a
 * final `drop` to consume the discriminant when no clause matched and back
 * patches every exit branch recorded by `endof` terminators so successful
 * clauses skip that drop.
 */
export const endCaseOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 1, 'endcase');

  const rawSavedRSP = pop(vm);
  if (!Number.isFinite(rawSavedRSP)) {
    throw new SyntaxError('endcase missing saved RSP', getStackData(vm));
  }

  const savedRSPRel = Math.trunc(rawSavedRSP);
  const savedRSPAbs = RSTACK_BASE + savedRSPRel;

  vm.compiler.compileOpcode(Op.Drop);
  const exitTarget = vm.compiler.CP;

  while (vm.rsp > savedRSPAbs) {
    const rawExitPos = rpop(vm);
    if (!Number.isFinite(rawExitPos)) {
      throw new SyntaxError('endcase invalid exit placeholder', getStackData(vm));
    }

    const exitPos = Math.trunc(rawExitPos);
    const exitOffset = exitTarget - (exitPos + 2);

    const prevCP = vm.compiler.CP;
    vm.compiler.CP = exitPos;
    vm.compiler.compile16(exitOffset);
    vm.compiler.CP = prevCP;
  }

  if (vm.rsp !== savedRSPAbs) {
    throw new SyntaxError('case corrupted return stack', getStackData(vm));
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
  // Save current data stack depth in cells (relative to STACK_BASE_BYTES)
  rpush(vm, depth(vm));
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
    ensureRStackSize(vm, 1, 'group-right');
    const sp0 = rpop(vm);
    const sp1 = depth(vm);
    const d = sp1 - sp0;
    push(vm, d);
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
  const d = pop(vm);
  // eslint-disable-next-line no-console
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
  ensureStackSize(vm, 1, 'pushSymbolRef');

  const stringTaggedValue = pop(vm);
  const { tag, value } = fromTaggedValue(stringTaggedValue);

  if (tag !== Tag.STRING) {
    throw new Error('pushSymbolRef expects a string on the stack');
  }

  const symbolName = vm.digest.get(value);
  if (symbolName === undefined) {
    throw new Error(`String not found in digest: ${value}`);
  }

  pushSymbolRef(vm, symbolName);
};
