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
  // Register all built-in operations in the symbol table
  // Each operation has a pre-assigned opcode value from the Op enum
  // and an implementation function that manipulates the VM state

  // Control flow operations - handle execution flow, literals, and I/O
  symbolTable.define('lit', Op.LiteralNumber, literalNumberOp);      // Push literal number onto stack
  symbolTable.define('branch', Op.Branch, skipDefOp);                // Branch to address
  symbolTable.define('branch-call', Op.BranchCall, skipBlockOp);     // Branch to code block
  symbolTable.define('call', Op.Call, callOp);                       // Call function at address
  symbolTable.define('abort', Op.Abort, abortOp);                    // Abort execution
  symbolTable.define('exit', Op.Exit, exitOp);                       // Exit current function
  symbolTable.define('eval', Op.Eval, evalOp);                       // Evaluate code pointer
  symbolTable.define('print', Op.Print, printOp);                    // Print formatted value
  symbolTable.define('.', Op.RawPrint, rawPrintOp);                  // Print raw tagged value
  symbolTable.define('str', Op.LiteralString, literalStringOp);      // Push literal string
  symbolTable.define('addr', Op.LiteralAddress, literalAddressOp);   // Push literal address

  // List operations - handle list creation and manipulation
  symbolTable.define('(', Op.OpenList, openListOp);                  // Begin list definition
  symbolTable.define(')', Op.CloseList, closeListOp);                // End list definition

  // Math operations - basic arithmetic and comparison operations
  symbolTable.define('+', Op.Add, addOp);                           // Addition
  symbolTable.define('add', Op.Add, addOp);                         // Alias for test compatibility
  symbolTable.define('-', Op.Minus, subtractOp);                    // Subtraction
  symbolTable.define('sub', Op.Minus, subtractOp);                  // Alias for test compatibility
  symbolTable.define('*', Op.Multiply, multiplyOp);                 // Multiplication
  symbolTable.define('mul', Op.Multiply, multiplyOp);               // Alias for test compatibility
  symbolTable.define('/', Op.Divide, divideOp);                     // Division
  symbolTable.define('div', Op.Divide, divideOp);                   // Alias for test compatibility
  symbolTable.define('^', Op.Power, powerOp);                       // Power operation
  symbolTable.define('mod', Op.Mod, modOp);                         // Modulo operation
  symbolTable.define('min', Op.Min, minOp);                         // Minimum of two values
  symbolTable.define('max', Op.Max, maxOp);                         // Maximum of two values
  symbolTable.define('<', Op.LessThan, lessThanOp);                 // Less than comparison
  symbolTable.define('lt', Op.LessThan, lessThanOp);               // Alias for test compatibility
  symbolTable.define('<=', Op.LessOrEqual, lessOrEqualOp);          // Less than or equal comparison
  symbolTable.define('le', Op.LessOrEqual, lessOrEqualOp);         // Alias for test compatibility
  symbolTable.define('>', Op.GreaterThan, greaterThanOp);           // Greater than comparison
  symbolTable.define('gt', Op.GreaterThan, greaterThanOp);         // Alias for test compatibility
  symbolTable.define('>=', Op.GreaterOrEqual, greaterOrEqualOp);    // Greater than or equal comparison
  symbolTable.define('ge', Op.GreaterOrEqual, greaterOrEqualOp);   // Alias for test compatibility
  symbolTable.define('=', Op.Equal, equalOp);                       // Equality comparison
  symbolTable.define('eq', Op.Equal, equalOp);                     // Alias for test compatibility

  // Unary operations - operations that take a single value and transform it
  symbolTable.define('negate', Op.mNegate, mNegateOp);              // Negate a value
  symbolTable.define('reciprocal', Op.mReciprocal, mReciprocalOp);  // 1/x
  symbolTable.define('recip', Op.mReciprocal, mReciprocalOp);       // Alias for test compatibility
  symbolTable.define('floor', Op.mFloor, mFloorOp);                // Round down to integer
  symbolTable.define('not', Op.mNot, mNotOp);                       // Logical NOT
  symbolTable.define('signum', Op.mSignum, mSignumOp);              // Sign of value (-1, 0, 1)
  symbolTable.define('enlist', Op.mEnlist, mEnlistOp);              // Create single-element list

  // Stack operations - manipulate the data stack directly
  symbolTable.define('dup', Op.Dup, dupOp);                        // Duplicate top value
  symbolTable.define('drop', Op.Drop, dropOp);                      // Remove top value
  symbolTable.define('swap', Op.Swap, swapOp);                      // Swap top two values
  symbolTable.define('rot', Op.Rot, rotOp);                         // Rotate top three values
  symbolTable.define('revrot', Op.RevRot, revrotOp);                // Reverse rotate top three values
  symbolTable.define('over', Op.Over, overOp);                      // Copy second value to top

  // Arithmetic operations - advanced mathematical functions
  symbolTable.define('abs', Op.Abs, absOp);                        // Absolute value
  symbolTable.define('neg', Op.Neg, negOp);                        // Negate value
  symbolTable.define('sign', Op.Sign, signOp);                      // Sign of value (-1, 0, 1)
  symbolTable.define('exp', Op.Exp, expOp);                        // e^x
  symbolTable.define('ln', Op.Ln, lnOp);                           // Natural logarithm
  symbolTable.define('log', Op.Log, logOp);                        // Base-10 logarithm
  symbolTable.define('sqrt', Op.Sqrt, sqrtOp);                      // Square root
  symbolTable.define('pow', Op.Pow, powOp);                        // Power function
  symbolTable.define('avg', Op.Avg, avgOp);                        // Average of values
  symbolTable.define('prod', Op.Prod, prodOp);                      // Product of values

  // Conditional operations - control flow based on conditions
  symbolTable.define('if', Op.SimpleIf, simpleIfOp);                // Simple if-then-else
  symbolTable.define('ifcurlybf', Op.IfFalseBranch, ifCurlyBranchFalseOp); // Branch if false
}
