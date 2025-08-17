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
import { toTaggedValue, Tag } from '../core/tagged';

import {
  literalNumberOp,
  skipDefOp,
  skipBlockOp,
  callOp,
  abortOp,
  exitOp,
  exitCodeOp,
  evalOp,
  literalStringOp,
  pushSymbolRefOp,
} from './core-ops';
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
} from './math-ops';
import { mNegateOp, mReciprocalOp, mFloorOp, mNotOp, mSignumOp } from './math-ops';
import { mEnlistOp, findOp, keysOp, valuesOp } from './list-ops';
import { dupOp, dropOp, swapOp, rotOp, revrotOp, overOp, nipOp, tuckOp } from './stack-ops';
import { printOp, rawPrintOp } from './print-ops';
import { simpleIfOp } from './control-ops';
// LIST operations following lists.md specification
import {
  openListOp,
  closeListOp,
  listSlotOp,
  lengthOp,
  slotOp,
  elemOp,
  fetchOp,
  storeOp,
  headOp,
  unconsOp,
} from './list-ops';
import { consOp, concatOp, dropHeadOp, packOp, unpackOp, reverseOp, makeListOp } from './list-ops';

import { Op } from './opcodes';
import { InvalidOpcodeError } from '../core/errors';

import { ifCurlyBranchFalseOp } from './control-ops';
import { doOp } from './combinators/do';
import { repeatOp } from './combinators/repeat';
import { getOp, setOp } from './access-ops';

// Temp register operations for macro expansion
// Pops the top of the stack and stores it in vm.tempRegister
export function saveTempOp(vm: VM): void {
  vm.ensureStackSize(1, 'saveTemp');
  vm.tempRegister = vm.pop();
}

// Pushes the value in vm.tempRegister onto the stack
export function restoreTempOp(vm: VM): void {
  vm.push(vm.tempRegister);
}

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
  const tagged = toTaggedValue(address, Tag.CODE, 1); // meta=1 for code blocks
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
    case Op.ExitCode:
      exitCodeOp(vm);
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
    case Op.Get:
      getOp(vm);
      break;
    case Op.Set:
      setOp(vm);
      break;
    case Op.MakeList:
      makeListOp(vm);
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
    // Lists.md spec operations
    case Op.Slots:
      listSlotOp(vm);
      break;
    case Op.Length:
      lengthOp(vm);
      break;
    case Op.Slot:
      slotOp(vm);
      break;
    case Op.Elem:
      elemOp(vm);
      break;
    case Op.Fetch:
      fetchOp(vm);
      break;
    case Op.Store:
      storeOp(vm);
      break;
    case Op.Head:
      headOp(vm);
      break;
    case Op.Uncons:
      unconsOp(vm);
      break;
    case Op.Pack:
      packOp(vm);
      break;
    case Op.Unpack:
      unpackOp(vm);
      break;
    case Op.Reverse:
      reverseOp(vm);
      break;
    case Op.Cons:
      consOp(vm);
      break;
    case Op.Concat:
      concatOp(vm);
      break;
    case Op.Tail:
      dropHeadOp(vm);
      break;
    case Op.DropHead:
      dropHeadOp(vm);
      break;
    case Op.PushSymbolRef:
      pushSymbolRefOp(vm);
      break;
    case Op.Find:
      findOp(vm);
      break;
    case Op.Keys:
      keysOp(vm);
      break;
    case Op.Values:
      valuesOp(vm);
      break;
    case Op.SaveTemp:
      saveTempOp(vm);
      break;
    case Op.RestoreTemp:
      restoreTempOp(vm);
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
