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
  groupLeftOp,
  groupRightOp,
  literalStringOp,
  vecLeftOp,
  vecRightOp,
  dictLeftOp,
  dictRightOp,
} from './builtins-interpreter';

import {
  plusOp,
  minusOp,
  multiplyOp,
  divideOp,
  powerOp,
  modOp,
  minOp,
  maxOp,
  equalOp,
  lessThanOp,
  greaterThanOp,
  matchOp,
} from './builtins-math';

import {
  mNegateOp,
  mReciprocalOp,
  mFloorOp,
  mNotOp,
  mSignumOp,
  mEnlistOp,
} from './builtins-monadic';

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

// Import sequence operations
import {
  rangeOp,
  seqOp,
  mapOp,
  siftOp,
  filterOp,
  seqTakeOp,
  seqDropOp,
  toVectorOp,
  countOp,
  lastOp,
  forEachOp,
  reduceOp,
} from './builtins-sequence';
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
    // Control Flow
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
    case Op.GroupLeft:
      groupLeftOp(vm);
      break;
    case Op.GroupRight:
      groupRightOp(vm);
      break;
    case Op.Print:
      const value = vm.pop();
      console.log(formatValue(vm, value));
      break;
    case Op.LiteralString:
      literalStringOp(vm);
      break;
    case Op.VecLeft:
      vecLeftOp(vm);
      break;
    case Op.VecRight:
      vecRightOp(vm);
      break;
    case Op.DictLeft:
      dictLeftOp(vm);
      break;
    case Op.DictRight:
      dictRightOp(vm);
      break;

    // Dyadic Arithmetic
    case Op.Plus:
      plusOp(vm);
      break;
    case Op.Minus:
      minusOp(vm);
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
    case Op.GreaterThan:
      greaterThanOp(vm);
      break;
    case Op.Match:
      matchOp(vm);
      break;
    case Op.Mod:
      modOp(vm);
      break;

    // Monadic Arithmetic
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

    // Stack Operations
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

    // Arithmetic Operators
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

    // Conditional Operations
    case Op.If:
      simpleIfOp(vm);
      break;
    case Op.IfFalseBranch: 
      ifCurlyBranchFalseOp(vm);
      break;

    // Sequence Operations
    case Op.Range:
      rangeOp(vm);
      break;
    case Op.Seq:
      seqOp(vm);
      break;

    // Sequence Processors
    case Op.Map:
      mapOp(vm);
      break;
    case Op.Sift:
      siftOp(vm);
      break;
    case Op.Filter:
      filterOp(vm);
      break;
    case Op.SeqTake:
      seqTakeOp(vm);
      break;
    case Op.SeqDrop:
      seqDropOp(vm);
      break;

    // Sequence Sinks
    case Op.ToVector:
      toVectorOp(vm);
      break;
    case Op.Count:
      countOp(vm);
      break;
    case Op.Last:
      lastOp(vm);
      break;
    case Op.ForEach:
      forEachOp(vm);
      break;
    case Op.Reduce:
      reduceOp(vm);
      break;

    default:
      throw new Error(`Invalid opcode: ${opcode} (stack: ${JSON.stringify(vm.getStackData())})`);
  }
}
