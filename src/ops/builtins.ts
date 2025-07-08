/**
 * @file src/ops/builtins.ts
 * This file defines the built-in operations (functions) available in the Tacit language.
 * It maps symbolic names to their corresponding opcodes and provides an execution function
 * to handle these operations during program execution.
 * Architectural Observations: This file acts as a central registry for all built-in functions,
 * linking the symbolic representation used in Tacit code with the underlying execution logic.
 */
import { VM } from '../core/vm';

import {
  literalNumberOp,
  skipDefOp,
  skipBlockOp,
  callOp,
  abortOp,
  exitOp,
  evalOp,
  literalStringOp,
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
import { dupOp, dropOp, swapOp } from './builtins-stack';

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
import { formatValue } from '../core/utils';

import { rotOp, negRotOp } from './builtins-stack';

import { Op } from './opcodes';

import { ifCurlyBranchFalseOp } from './builtins-conditional';

/**
 * Executes a specific operation based on the given opcode.
 * @param {VM} vm The virtual machine instance.
 * @param {Op} opcode The opcode representing the operation to execute.
 * @throws {Error} If the opcode is invalid.
 */
export function executeOp(vm: VM, opcode: Op) {
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
    case Op.Print:
      const value = vm.pop();
      console.log(formatValue(vm, value));
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
    case Op.NegRot:
      negRotOp(vm);
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
    case Op.LiteralAddress:
      literalAddressOp(vm);
      break;
    default:
      throw new Error(`Invalid opcode: ${opcode} (stack: ${JSON.stringify(vm.getStackData())})`);
  }
}

export function literalAddressOp(vm: VM): void {
  const address = vm.read16();
  vm.push(address);
}
