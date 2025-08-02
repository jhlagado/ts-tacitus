/**
 * @file src/ops/builtins.ts
 *
 * This file defines the built-in operations (functions) available in the Tacit language.
 * It serves as the central dispatcher for all VM operations, mapping opcodes to their
 * implementation functions.
 *
 * ## Architecture
 *
 * The executeOp fu      if (opcode >= 128) {
        // Direct addressing for user-defined words (colon definitions)
        // The opcode IS the bytecode address - set up call frame and jump there
        vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
        vm.rpush(vm.BP);
        vm.BP = vm.RP;
        vm.IP = opcode; // Direct jump to bytecode address
        return;
      } the core dispatch mechanism of the VM's execution engine.
 * When the interpreter encounters an opcode during bytecode execution, it calls
 * executeOp with the current VM state and the opcode to execute.
 *
 * Operations are organized into several categories, each implemented in separate files:
 * - Interpreter operations (control flow, literals)
 * - Math operations (arithmetic, comparisons)
 * - Stack operations (dup, drop, swap)
 * - List operations (list creation and manipulation)
 * - Unary operations (operations that work on a single value)
 * - Conditional operations (if/else logic)
 *
 * ## Extension Mechanism
 *
 * The system supports user-defined operations through the direct addressing system.
 * User-defined words are encoded with opcodes 128+ and jump directly to their bytecode addresses.
 */
import { VM } from '../core/vm';
import { fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

import {
  literalNumberOp,
  skipDefOp,
  skipBlockOp,
  callOp,
  abortOp,
  exitOp,
  evalOp,
  literalStringOp,
  pushSymbolRefOp,
} from './builtins-interpreter';
import {
  addOp,
  subtractOp,
  multiplyOp,
  divideOp,
  powerOp,
  modOp,
  minOp,
  maxOp,
  equalOp,
  lessThanOp,
  lessOrEqualOp,
  greaterThanOp,
  greaterOrEqualOp,
} from './builtins-math';
import {
  mNegateOp,
  mReciprocalOp,
  mFloorOp,
  mNotOp,
  mSignumOp,
  mEnlistOp,
} from './builtins-unary-op';
import { dupOp, dropOp, swapOp, rotOp, revrotOp, overOp, nipOp, tuckOp } from './builtins-stack';
import { printOp } from './builtins-print';
import { rawPrintOp } from './builtins-raw-print';

import {
  absOp,
  negOp,
  signOp,
  expOp,
  lnOp,
  logOp,
  sqrtOp,
  powOp,
  avgOp,
  prodOp,
} from './arithmetic-ops';
import { simpleIfOp } from './builtins-conditional';
import { openListOp, closeListOp } from './builtins-list';

import { Op } from './opcodes';
import { InvalidOpcodeError } from '../core/errors';

import { ifCurlyBranchFalseOp } from './builtins-conditional';
import { doOp } from './combinators/do';
import { repeatOp } from './combinators/repeat';

/**
 * Executes a specific operation based on the given opcode.
 *
 * This is the central dispatch function of the VM's execution engine. It takes an opcode
 * and routes execution to the appropriate implementation function. The function handles
 * both built-in operations (opcodes < 128) and user-defined operations (opcodes >= 128).
 *
 * @param {VM} vm - The virtual machine instance containing the current execution state.
 * @param {Op} opcode - The opcode representing the operation to execute.
 * @throws {Error} If the opcode is invalid or no implementation is found for a user-defined opcode.
 */

/**
 * Implements the LiteralCode operation.
 *
 * Reads a 16-bit address from the instruction stream, tags it as Tag.CODE, and pushes it onto the stack.
 * This is used for pushing quotations (code pointers) onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 */
export function literalCodeOp(vm: VM): void {
  const address = vm.read16();
  const tagged = toTaggedValue(address, Tag.CODE);
  vm.push(tagged);
}

export function executeOp(vm: VM, opcode: Op, isUserDefined = false) {
  // Check for user-defined words FIRST before the switch statement
  if (isUserDefined) {
    // Direct addressing: opcode IS the bytecode address for user-defined words
    // The 15-bit address was already decoded by nextOpcode(), just jump to it
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    vm.IP = opcode; // Direct jump to bytecode address
    return;
  }

  // Handle built-in operations
  switch (opcode) {
    case Op.LiteralNumber:
      literalNumberOp(vm);
      break;
    case Op.Branch:
      skipDefOp(vm);
      break;
    case Op.BranchCall:
      skipBlockOp(vm);
      break;
    case Op.Call:
      callOp(vm);
      break;
    case Op.Abort:
      abortOp(vm);
      break;
    case Op.Exit:
      exitOp(vm);
      break;
    case Op.Eval:
      evalOp(vm);
      break;
    case Op.RawPrint:
      rawPrintOp(vm);
      break;
    case Op.Print:
      printOp(vm);
      break;
    case Op.LiteralString:
      literalStringOp(vm);
      break;
    case Op.Add:
      addOp(vm);
      break;
    case Op.Minus:
      subtractOp(vm);
      break;
    case Op.Multiply:
      multiplyOp(vm);
      break;
    case Op.Divide:
      divideOp(vm);
      break;
    case Op.Power:
      powerOp(vm);
      break;
    case Op.Min:
      minOp(vm);
      break;
    case Op.Max:
      maxOp(vm);
      break;
    case Op.Equal:
      equalOp(vm);
      break;
    case Op.LessThan:
      lessThanOp(vm);
      break;
    case Op.LessOrEqual:
      lessOrEqualOp(vm);
      break;
    case Op.GreaterThan:
      greaterThanOp(vm);
      break;
    case Op.GreaterOrEqual:
      greaterOrEqualOp(vm);
      break;
    case Op.Match:
      equalOp(vm);
      break;
    case Op.Mod:
      modOp(vm);
      break;
    case Op.mNegate:
      mNegateOp(vm);
      break;
    case Op.mReciprocal:
      mReciprocalOp(vm);
      break;
    case Op.mFloor:
      mFloorOp(vm);
      break;
    case Op.mNot:
      mNotOp(vm);
      break;
    case Op.mSignum:
      mSignumOp(vm);
      break;
    case Op.mEnlist:
      mEnlistOp(vm);
      break;
    case Op.Dup:
      dupOp(vm);
      break;
    case Op.Drop:
      dropOp(vm);
      break;
    case Op.Swap:
      swapOp(vm);
      break;
    case Op.Rot:
      rotOp(vm);
      break;
    case Op.RevRot:
      revrotOp(vm);
      break;
    case Op.Over:
      overOp(vm);
      break;
    case Op.Nip:
      nipOp(vm);
      break;
    case Op.Tuck:
      tuckOp(vm);
      break;
    case Op.Abs:
      absOp(vm);
      break;
    case Op.Neg:
      negOp(vm);
      break;
    case Op.Sign:
      signOp(vm);
      break;
    case Op.Exp:
      expOp(vm);
      break;
    case Op.Ln:
      lnOp(vm);
      break;
    case Op.Log:
      logOp(vm);
      break;
    case Op.Sqrt:
      sqrtOp(vm);
      break;
    case Op.Pow:
      powOp(vm);
      break;
    case Op.Avg:
      avgOp(vm);
      break;
    case Op.Prod:
      prodOp(vm);
      break;
    case Op.If:
      simpleIfOp(vm);
      break;
    case Op.IfFalseBranch:
      ifCurlyBranchFalseOp(vm);
      break;
    case Op.Do:
      doOp(vm);
      break;
    case Op.Repeat:
      repeatOp(vm);
      break;
    case Op.LiteralAddress:
      literalAddressOp(vm);
      break;
    case Op.LiteralCode:
      literalCodeOp(vm);
      break;
    case Op.OpenList:
      openListOp(vm);
      break;
    case Op.CloseList:
      closeListOp(vm);
      break;
    case Op.PushSymbolRef:
      pushSymbolRefOp(vm);
      break;
    default:
      throw new InvalidOpcodeError(opcode, vm.getStackData());
  }
}

/**
 * Implements the LiteralAddress operation.
 *
 * Reads a 16-bit address from the instruction stream and pushes it onto the stack.
 * This operation is used for pushing memory addresses or function pointers onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 */
export function literalAddressOp(vm: VM): void {
  const address = vm.read16();
  vm.push(address);
}
