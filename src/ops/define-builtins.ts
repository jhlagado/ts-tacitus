import { SymbolTable } from '../strings/symbol-table';
import { Op } from './opcodes';

/**
 * Defines the built-in functions in the given symbol table.
 * This function maps symbolic names (strings) to their corresponding opcodes,
 * allowing the Tacit interpreter to recognize and execute these functions.
 * 
 * This function also populates the VM's function table with built-in operations.
 * 
 * @param {SymbolTable} dict The symbol table to populate with built-in functions.
 */
export const defineBuiltins = (dict: SymbolTable) => {
  // With the unified addressing scheme, we now directly use opcode numbers
  // instead of functions in the symbol table

  // Control Flow
  dict.define('eval', Op.Eval);
  dict.define('.', Op.Print);

  // Dyadic Arithmetic
  dict.define('+', Op.Plus);
  dict.define('-', Op.Minus);
  dict.define('*', Op.Multiply);
  dict.define('/', Op.Divide);
  dict.define('&', Op.Min);
  dict.define('|', Op.Max);
  dict.define('^', Op.Power);
  dict.define('=', Op.Equal);
  dict.define('<', Op.LessThan);
  dict.define('>', Op.GreaterThan);
  dict.define('~', Op.Match);
  dict.define('!', Op.Mod);

  // Monadic Arithmetic with English word names
  // Note: Removed old symbolic versions (m-, m%, m_, m~, m*, m,)
  dict.define('neg', Op.mNegate);      // Formerly m-
  dict.define('recip', Op.mReciprocal); // Formerly m%
  dict.define('floor', Op.mFloor);     // Formerly m_
  dict.define('not', Op.mNot);         // Formerly m~
  dict.define('sign', Op.mSignum);     // Formerly m*
  dict.define('enlist', Op.mEnlist);   // Formerly m,

  // Stack Operations
  dict.define('dup', Op.Dup);
  dict.define('drop', Op.Drop);
  dict.define('swap', Op.Swap);

  // Arithmetic Operators
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

  // Conditional Operations
  // For 'if' operation, we'll define a special internal opcode
  // Using a standard opcode value directly to avoid circular dependencies
  dict.define('if', Op.If); // We'll handle the special logic in the interpreter

  // Sequence operations have been removed

  // Add other built-ins here
};
