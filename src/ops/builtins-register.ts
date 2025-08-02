/**
 * @file src/ops/builtins-register.ts
 * Registers all built-in operations for the Tacit VM.
 *
 * This module serves as the central registry for all VM operations, connecting
 * operation names (as used in Tacit code) with their implementation functions and
 * opcode values. It replaces the old function table initialization approach with
 * a more flexible symbol table-based system.
 *
 * The operations are organized into several categories:
 * - Control flow operations (lit, branch, call, eval, etc.)
 * - List operations (open list, close list)
 * - Math operations (+, -, *, /, etc.)
 * - Unary operations (negate, reciprocal, floor, etc.)
 * - Stack operations (dup, drop, swap, etc.)
 * - Arithmetic operations (abs, exp, sqrt, etc.)
 * - Conditional operations (if, ifcurlybf)
 */
import { VM } from '../core/vm';
import { Op } from './opcodes';
import { SymbolTable } from '../strings/symbol-table';

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
  overOp,
  pickOp,
  nipOp,
  tuckOp,
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

import { simpleIfOp, ifCurlyBranchFalseOp } from './builtins-conditional';

import { printOp } from './builtins-print';
import { doOp } from './combinators/do';
import { repeatOp } from './combinators/repeat';
import { rawPrintOp } from './builtins-raw-print';

/**
 * Registers all built-in operations in the VM's symbol table.
 *
 * This function maps operation names to their implementation functions and opcode values.
 * Each operation is defined in the symbol table with:
 * - A name string (used in Tacit source code)
 * - An opcode value (from the Op enum)
 * - An implementation function (that manipulates the VM state)
 *
 * Many operations have multiple names (aliases) for compatibility with different
 * coding styles or for backward compatibility with test cases.
 *
 * @param vm - The virtual machine instance
 * @param symbolTable - The symbol table to register operations in
 */
export function registerBuiltins(vm: VM, symbolTable: SymbolTable): void {
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

  symbolTable.define('(', Op.OpenList, openListOp);
  symbolTable.define(')', Op.CloseList, closeListOp);

  symbolTable.define('add', Op.Add, addOp);
  symbolTable.define('sub', Op.Minus, subtractOp);
  symbolTable.define('mul', Op.Multiply, multiplyOp);
  symbolTable.define('div', Op.Divide, divideOp);
  symbolTable.define('pow', Op.Power, powerOp);
  symbolTable.define('mod', Op.Mod, modOp);
  symbolTable.define('min', Op.Min, minOp);
  symbolTable.define('max', Op.Max, maxOp);
  symbolTable.define('lt', Op.LessThan, lessThanOp);
  symbolTable.define('le', Op.LessOrEqual, lessOrEqualOp);
  symbolTable.define('gt', Op.GreaterThan, greaterThanOp);
  symbolTable.define('ge', Op.GreaterOrEqual, greaterOrEqualOp);
  symbolTable.define('eq', Op.Equal, equalOp);

  symbolTable.define('neg', Op.mNegate, mNegateOp);
  symbolTable.define('recip', Op.mReciprocal, mReciprocalOp);
  symbolTable.define('floor', Op.mFloor, mFloorOp);
  symbolTable.define('not', Op.mNot, mNotOp);
  symbolTable.define('signum', Op.mSignum, mSignumOp);
  symbolTable.define('enlist', Op.mEnlist, mEnlistOp);

  symbolTable.define('dup', Op.Dup, dupOp);
  symbolTable.define('drop', Op.Drop, dropOp);
  symbolTable.define('swap', Op.Swap, swapOp);
  symbolTable.define('rot', Op.Rot, rotOp);
  symbolTable.define('revrot', Op.RevRot, revrotOp);
  symbolTable.define('over', Op.Over, overOp);
  symbolTable.define('pick', Op.Pick, pickOp);
  symbolTable.define('nip', Op.Nip, nipOp);
  symbolTable.define('tuck', Op.Tuck, tuckOp);

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

  symbolTable.define('if', Op.SimpleIf, simpleIfOp);
  symbolTable.define('ifcurlybf', Op.IfFalseBranch, ifCurlyBranchFalseOp);

  symbolTable.define('do', Op.Do, doOp);
  symbolTable.define('repeat', Op.Repeat, repeatOp);
}
