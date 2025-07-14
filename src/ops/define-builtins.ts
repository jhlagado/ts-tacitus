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
 * // During VM initialization:
 * const symbolTable = new SymbolTable();
 * defineBuiltins(symbolTable);
 * // Now symbolTable contains mappings like 'add' -> Op.Add
 */
export const defineBuiltins = (dict: SymbolTable) => {
  dict.define('eval', Op.Eval);
  dict.define('.', Op.Print);
  dict.define('add', Op.Add);
  dict.define('sub', Op.Minus);
  dict.define('mul', Op.Multiply);
  dict.define('div', Op.Divide);
  dict.define('min', Op.Min);
  dict.define('max', Op.Max);
  dict.define('pow', Op.Power);
  dict.define('eq', Op.Equal);
  dict.define('lt', Op.LessThan);
  dict.define('le', Op.LessOrEqual);
  dict.define('gt', Op.GreaterThan);
  dict.define('ge', Op.GreaterOrEqual);
  dict.define('mod', Op.Mod);
  dict.define('neg', Op.mNegate);
  dict.define('recip', Op.mReciprocal);
  dict.define('floor', Op.mFloor);
  dict.define('not', Op.mNot);
  dict.define('sign', Op.mSignum);
  dict.define('enlist', Op.mEnlist);
  dict.define('dup', Op.Dup);
  dict.define('drop', Op.Drop);
  dict.define('swap', Op.Swap);
  dict.define('abs', Op.Abs);
  dict.define('neg', Op.Neg);
  dict.define('sign', Op.Sign);
  dict.define('exp', Op.Exp);
  dict.define('ln', Op.Ln);
  dict.define('log', Op.Log);
  dict.define('sqrt', Op.Sqrt);
  dict.define('pow', Op.Pow);
  dict.define('avg', Op.Avg);
  dict.define('prod', Op.Prod);
  dict.define('if', Op.If);
  dict.define('rot', Op.Rot);
  dict.define('revrot', Op.RevRot);
  dict.define('over', Op.Over);
};
