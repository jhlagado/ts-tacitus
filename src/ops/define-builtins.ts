/**
 * @file src/ops/define-builtins.ts
 *
 * This file defines the mapping between symbolic function names and their corresponding
 * opcodes in the Tacit VM. It serves as the central registry for all built-in operations
 * that are available to Tacit programs.
 *
 * The defineBuiltins function populates the VM's symbol table with these mappings,
 * enabling the compiler to translate function names in source code to the appropriate
 * opcodes in bytecode.
 */

import { SymbolTable } from '../strings/symbol-table';

import { Op } from './opcodes';

/**
 * Defines the built-in functions in the given symbol table.
 *
 * This function maps symbolic names (strings) to their corresponding opcodes,
 * allowing the Tacit interpreter to recognize and execute these functions.
 * It is called during VM initialization to establish the core vocabulary
 * available to all Tacit programs.
 *
 * The built-in functions include:
 * - Stack manipulation operations (dup, drop, swap, rot, etc.)
 * - Arithmetic operations (add, sub, mul, div, etc.)
 * - Comparison operations (eq, lt, gt, etc.)
 * - Mathematical functions (abs, sqrt, exp, etc.)
 * - Monadic operations (neg, recip, floor, etc.)
 * - Control flow operations (if, eval)
 * - Output operations (print)
 *
 * @param {SymbolTable} dict - The symbol table to populate with built-in functions.
 *
 * @example
 *
 * const symbolTable = new SymbolTable();
 * defineBuiltins(symbolTable);
 *
 */
export const defineBuiltins = (dict: SymbolTable) => {
  dict.defineBuiltin('eval', Op.Eval);
  dict.defineBuiltin('.', Op.Print);
  dict.defineBuiltin('add', Op.Add);
  dict.defineBuiltin('sub', Op.Minus);
  dict.defineBuiltin('mul', Op.Multiply);
  dict.defineBuiltin('div', Op.Divide);
  dict.defineBuiltin('min', Op.Min);
  dict.defineBuiltin('max', Op.Max);
  dict.defineBuiltin('pow', Op.Power);
  dict.defineBuiltin('eq', Op.Equal);
  dict.defineBuiltin('lt', Op.LessThan);
  dict.defineBuiltin('le', Op.LessOrEqual);
  dict.defineBuiltin('gt', Op.GreaterThan);
  dict.defineBuiltin('ge', Op.GreaterOrEqual);
  dict.defineBuiltin('mod', Op.Mod);
  dict.defineBuiltin('neg', Op.mNegate);
  dict.defineBuiltin('recip', Op.mReciprocal);
  dict.defineBuiltin('floor', Op.mFloor);
  dict.defineBuiltin('not', Op.mNot);
  dict.defineBuiltin('sign', Op.mSignum);
  dict.defineBuiltin('enlist', Op.mEnlist);
  dict.defineBuiltin('dup', Op.Dup);
  dict.defineBuiltin('drop', Op.Drop);
  dict.defineBuiltin('swap', Op.Swap);
  dict.defineBuiltin('abs', Op.Abs);
  dict.defineBuiltin('neg', Op.Neg);
  dict.defineBuiltin('sign', Op.Sign);
  dict.defineBuiltin('exp', Op.Exp);
  dict.defineBuiltin('ln', Op.Ln);
  dict.defineBuiltin('log', Op.Log);
  dict.defineBuiltin('sqrt', Op.Sqrt);
  dict.defineBuiltin('pow', Op.Pow);
  dict.defineBuiltin('avg', Op.Avg);
  dict.defineBuiltin('prod', Op.Prod);
  dict.defineBuiltin('if', Op.If);
  dict.defineBuiltin('rot', Op.Rot);
  dict.defineBuiltin('revrot', Op.RevRot);
  dict.defineBuiltin('over', Op.Over);
};
