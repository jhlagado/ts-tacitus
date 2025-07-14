/**
 * @file builtins-register.ts
 * Registers all builtin operations for the Tacit VM
 * This replaces the old function table initialization approach
 */
import { VM } from '../core/vm';
import { Op } from './opcodes';
import { SymbolTable } from '../strings/symbol-table';

// Import all the operation implementations
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

import { literalAddressOp } from './builtins';

import { openListOp, closeListOp } from './builtins-list';

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

import {
  dupOp,
  dropOp,
  swapOp,
  rotOp,
  revrotOp,
  overOp
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
  simpleIfOp,
  ifCurlyBranchFalseOp
} from './builtins-conditional';

import { printOp } from './builtins-print';
import { rawPrintOp } from './builtins-raw-print';

/**
 * Registers all built-in operations in the symbol table
 * This replaces the old function table initialization
 */
export function registerBuiltins(vm: VM, symbolTable: SymbolTable): void {
  // Register all built-in operations in the symbol table
  // These operations have pre-assigned opcode values from the Op enum

  // Control flow operations
  symbolTable.define('lit', Op.LiteralNumber, literalNumberOp);
  symbolTable.define('branch', Op.Branch, skipDefOp);
  symbolTable.define('branch-call', Op.BranchCall, skipBlockOp);
  symbolTable.define('call', Op.Call, callOp);
  symbolTable.define('abort', Op.Abort, abortOp);
  symbolTable.define('exit', Op.Exit, exitOp);
  symbolTable.define('eval', Op.Eval, evalOp);
  symbolTable.define('print', Op.Print, printOp);
  symbolTable.define('.', Op.RawPrint, rawPrintOp);
  symbolTable.define('str', Op.LiteralString, literalStringOp);
  symbolTable.define('addr', Op.LiteralAddress, literalAddressOp);

  // List operations
  symbolTable.define('(', Op.OpenList, openListOp);
  symbolTable.define(')', Op.CloseList, closeListOp);

  // Math operations
  symbolTable.define('+', Op.Add, addOp);
  symbolTable.define('add', Op.Add, addOp); // Alias for test compatibility
  symbolTable.define('-', Op.Minus, subtractOp);
  symbolTable.define('sub', Op.Minus, subtractOp); // Alias for test compatibility
  symbolTable.define('*', Op.Multiply, multiplyOp);
  symbolTable.define('mul', Op.Multiply, multiplyOp); // Alias for test compatibility
  symbolTable.define('/', Op.Divide, divideOp);
  symbolTable.define('div', Op.Divide, divideOp); // Alias for test compatibility
  symbolTable.define('^', Op.Power, powerOp);
  symbolTable.define('mod', Op.Mod, modOp);
  symbolTable.define('min', Op.Min, minOp);
  symbolTable.define('max', Op.Max, maxOp);
  symbolTable.define('<', Op.LessThan, lessThanOp);
  symbolTable.define('lt', Op.LessThan, lessThanOp); // Alias for test compatibility
  symbolTable.define('<=', Op.LessOrEqual, lessOrEqualOp);
  symbolTable.define('le', Op.LessOrEqual, lessOrEqualOp); // Alias for test compatibility
  symbolTable.define('>', Op.GreaterThan, greaterThanOp);
  symbolTable.define('gt', Op.GreaterThan, greaterThanOp); // Alias for test compatibility
  symbolTable.define('>=', Op.GreaterOrEqual, greaterOrEqualOp);
  symbolTable.define('ge', Op.GreaterOrEqual, greaterOrEqualOp); // Alias for test compatibility
  symbolTable.define('=', Op.Equal, equalOp);
  symbolTable.define('eq', Op.Equal, equalOp); // Alias for test compatibility

  // Unary operations
  symbolTable.define('negate', Op.mNegate, mNegateOp);
  symbolTable.define('reciprocal', Op.mReciprocal, mReciprocalOp);
  symbolTable.define('recip', Op.mReciprocal, mReciprocalOp); // Alias for test compatibility
  symbolTable.define('floor', Op.mFloor, mFloorOp);
  symbolTable.define('not', Op.mNot, mNotOp);
  symbolTable.define('signum', Op.mSignum, mSignumOp);
  symbolTable.define('enlist', Op.mEnlist, mEnlistOp);

  // Stack operations
  symbolTable.define('dup', Op.Dup, dupOp);
  symbolTable.define('drop', Op.Drop, dropOp);
  symbolTable.define('swap', Op.Swap, swapOp);
  symbolTable.define('rot', Op.Rot, rotOp);
  symbolTable.define('revrot', Op.RevRot, revrotOp);
  symbolTable.define('over', Op.Over, overOp);

  // Arithmetic operations
  symbolTable.define('abs', Op.Abs, absOp);
  symbolTable.define('neg', Op.Neg, negOp);
  symbolTable.define('sign', Op.Sign, signOp);
  symbolTable.define('exp', Op.Exp, expOp);
  symbolTable.define('ln', Op.Ln, lnOp);
  symbolTable.define('log', Op.Log, logOp);
  symbolTable.define('sqrt', Op.Sqrt, sqrtOp);
  symbolTable.define('pow', Op.Pow, powOp);
  symbolTable.define('avg', Op.Avg, avgOp);
  symbolTable.define('prod', Op.Prod, prodOp);

  // Conditional operations
  symbolTable.define('if', Op.SimpleIf, simpleIfOp);
  symbolTable.define('ifcurlybf', Op.IfFalseBranch, ifCurlyBranchFalseOp);
}
