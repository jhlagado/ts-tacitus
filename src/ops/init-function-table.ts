/**
 * @file init-function-table.ts
 * Initializes the function table with all built-in opcode implementations
 */

import { VM } from '../core/vm';
import { Op } from './opcodes';
import { 
  literalNumberOp, 
  skipDefOp,
  skipBlockOp, 
  callOp, 
  abortOp, 
  exitOp, 
  evalOp, 
  literalStringOp 
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
import { 
  dupOp, 
  dropOp, 
  swapOp, 
  rotOp, 
  negRotOp 
} from './builtins-stack';
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
import { 
  simpleIfOp 
} from './builtins-conditional';
import { 
  ifCurlyBranchFalseOp 
} from './builtins-conditional';
import { literalAddressOp } from './builtins';

/**
 * Initializes the function table with all built-in operations
 */
export function initFunctionTable(vm: VM): void {
  const ft = vm.functionTable;
  
  // Register all built-in operations by their opcode values
  // Control Flow
  ft.registerBuiltin(Op.LiteralNumber, literalNumberOp);
  ft.registerBuiltin(Op.Branch, skipDefOp);
  ft.registerBuiltin(Op.BranchCall, skipBlockOp);
  ft.registerBuiltin(Op.Call, callOp);
  ft.registerBuiltin(Op.Abort, abortOp);
  ft.registerBuiltin(Op.Exit, exitOp);
  ft.registerBuiltin(Op.Eval, evalOp);
  ft.registerBuiltin(Op.Print, (vm: VM) => {
    const value = vm.pop();
    console.log(value);
  });
  ft.registerBuiltin(Op.LiteralString, literalStringOp);
  ft.registerBuiltin(Op.LiteralAddress, literalAddressOp);
  
  // Dyadic Arithmetic
  ft.registerBuiltin(Op.Plus, plusOp);
  ft.registerBuiltin(Op.Minus, minusOp);
  ft.registerBuiltin(Op.Multiply, multiplyOp);
  ft.registerBuiltin(Op.Divide, divideOp);
  ft.registerBuiltin(Op.Power, powerOp);
  ft.registerBuiltin(Op.Mod, modOp);
  ft.registerBuiltin(Op.Min, minOp);
  ft.registerBuiltin(Op.Max, maxOp);
  ft.registerBuiltin(Op.LessThan, lessThanOp);
  ft.registerBuiltin(Op.GreaterThan, greaterThanOp);
  ft.registerBuiltin(Op.Equal, equalOp);
  ft.registerBuiltin(Op.Match, matchOp);
  
  // Monadic Arithmetic
  ft.registerBuiltin(Op.mNegate, mNegateOp);
  ft.registerBuiltin(Op.mReciprocal, mReciprocalOp);
  ft.registerBuiltin(Op.mFloor, mFloorOp);
  ft.registerBuiltin(Op.mNot, mNotOp);
  ft.registerBuiltin(Op.mSignum, mSignumOp);
  ft.registerBuiltin(Op.mEnlist, mEnlistOp);
  
  // Stack Operations
  ft.registerBuiltin(Op.Dup, dupOp);
  ft.registerBuiltin(Op.Drop, dropOp);
  ft.registerBuiltin(Op.Swap, swapOp);
  ft.registerBuiltin(Op.Rot, rotOp);
  ft.registerBuiltin(Op.NegRot, negRotOp);
  
  // Arithmetic Operators
  ft.registerBuiltin(Op.Abs, absOp);
  ft.registerBuiltin(Op.Neg, negOp);
  ft.registerBuiltin(Op.Sign, signOp);
  ft.registerBuiltin(Op.Exp, expOp);
  ft.registerBuiltin(Op.Ln, lnOp);
  ft.registerBuiltin(Op.Log, logOp);
  ft.registerBuiltin(Op.Sqrt, sqrtOp);
  ft.registerBuiltin(Op.Pow, powOp);
  ft.registerBuiltin(Op.Avg, avgOp);
  ft.registerBuiltin(Op.Prod, prodOp);
  
  // Conditional Operations
  ft.registerBuiltin(Op.If, simpleIfOp);
  ft.registerBuiltin(Op.IfFalseBranch, ifCurlyBranchFalseOp);
}
