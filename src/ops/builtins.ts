/**
 * @file src/ops/builtins.ts
 * This file defines the built-in operations (functions) available in the Tacit language.
 * It maps symbolic names to their corresponding opcodes and provides an execution function
 * to handle these operations during program execution.
 * Architectural Observations: This file acts as a central registry for all built-in functions,
 * linking the symbolic representation used in Tacit code with the underlying execution logic.
 */
import { VM } from '../core/vm';
import { SymbolTable } from '../core/symbol-table';

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
import { rangeOp, seqOp } from './builtins-sequence';

/**
 * @enum {number} Op
 * This enum defines the opcodes for all built-in operations in Tacit.
 * Each member represents a specific operation that can be executed by the VM.
 */
export enum Op {
  /** Pushes a literal number onto the stack. */
  LiteralNumber,
  /** Unconditional jump to a different instruction. */
  Branch,
  /** Conditional jump to a different instruction based on the top of the stack. */
  BranchCall,
  /** Calls a function. */
  Call,
  /** Aborts the program execution. */
  Abort,
  /** Exits the program. */
  Exit,
  /** Evaluates the expression on the top of the stack. */
  Eval,
  /** Marks the beginning of a group (used for parsing). */
  GroupLeft,
  /** Marks the end of a group (used for parsing). */
  GroupRight,
  /** Prints the value on the top of the stack to the console. */
  Print,
  /** Pushes a literal string onto the stack. */
  LiteralString,
  /** Marks the beginning of a vector (array) literal. */
  VecLeft,
  /** Marks the end of a vector literal. */
  VecRight,
  /** Marks the beginning of a dictionary literal. */
  DictLeft,
  /** Marks the end of a dictionary literal. */
  DictRight,

  /** Performs addition of the top two values on the stack. */
  Plus,
  /** Performs subtraction of the top two values on the stack. */
  Minus,
  /** Performs multiplication of the top two values on the stack. */
  Multiply,
  /** Performs division of the top two values on the stack. */
  Divide,
  /** Performs exponentiation (power) of the top two values on the stack. */
  Power,
  /** Performs modulo operation of the top two values on the stack. */
  Mod,
  /** Returns the minimum of the top two values on the stack. */
  Min,
  /** Returns the maximum of the top two values on the stack. */
  Max,
  /** Checks if the second value from the top of the stack is less than the top value. */
  LessThan,
  /** Checks if the second value from the top of the stack is greater than the top value. */
  GreaterThan,
  /** Checks if the top two values on the stack are equal. */
  Equal,
  /** Checks if the top two values on the stack match (have the same structure). */
  Match,

  /** Monadic negation (negates the value on the top of the stack). */
  mNegate,
  /** Monadic reciprocal (calculates the reciprocal of the value on the top of the stack). */
  mReciprocal,
  /** Monadic floor (rounds the value on the top of the stack down to the nearest integer). */
  mFloor,
  /** Monadic ceiling (rounds the value on the top of the stack up to the nearest integer). */
  mCeiling,
  /** Monadic signum (returns the sign of the value on the top of the stack: -1, 0, or 1). */
  mSignum,
  /** Monadic absolute value (returns the absolute value of the value on the top of the stack). */
  mAbsolute,
  /** Monadic exponential (calculates e raised to the power of the value on the top of the stack). */
  mExp,
  /** Monadic natural logarithm (calculates the natural logarithm of the value on the top of the stack). */
  mLn,
  /** Monadic square root (calculates the square root of the value on the top of the stack). */
  mSqrt,
  /** Monadic base-10 logarithm (calculates the base-10 logarithm of the value on the top of the stack). */
  mLog,

  /** Duplicates the value on the top of the stack. */
  Dup,
  /** Removes the value on the top of the stack. */
  Drop,
  /** Swaps the top two values on the stack. */
  Swap,
  /** Rotates the top three values on the stack (the third value moves to the top). */
  Rot,
  /** Reverse rotates the top three values on the stack (i.e., -rot, transforming [a, b, c] into [c, a, b]). */
  NegRot,
  /** Duplicates the second value from the top of the stack and pushes it onto the top. */
  Over,

  /** Performs a bitwise AND operation on the top two values of the stack */
  And,
  /** Performs a bitwise OR operation on the top two values of the stack */
  Or,
  /** Performs a bitwise XOR operation on the top two values of the stack */
  Xor,
  /** Performs a bitwise NAND operation on the top two values of the stack */
  Nand,

  /** Monadic NOT (performs a logical NOT on the value on the top of the stack). */
  mNot,
  /** Monadic where (returns the indices where the value on the top of the stack is non-zero). */
  mWhere,
  /** Monadic reverse (reverses the elements of a vector on the top of the stack). */
  mReverse,

  /** Monadic type (returns the type of the value on the top of the stack). */
  mType,
  /** Monadic string (converts the value on the top of the stack to a string). */
  mString,
  /** Monadic group (groups elements of a vector based on unique values). */
  mGroup,
  /** Monadic distinct (returns the unique elements of a vector). */
  mDistinct,

  /** Joins two vectors into a single vector. */
  Join,
  /** Takes the first n elements from a vector. */
  Take,
  /** Drops the first n elements from a vector. */
  DropN,
  /** Enlists a value as a single-element vector. */
  mEnlist,
  /** Counts the elements in a vector. */
  mCount,

  /** Checks if a value is present in a vector. */
  mIn,
  /** Returns the keys of a dictionary. */
  mKey,

  /** Calculates the absolute value. */
  Abs,
  /** Negates a numeric value. */
  Neg,
  /** Returns the sign of a numeric value (-1, 0, or 1). */
  Sign,
  /** Calculates the exponential function (e^x). */
  Exp,
  /** Calculates the natural logarithm (base e). */
  Ln,
  /** Calculates the base-10 logarithm. */
  Log,
  /** Calculates the square root. */
  Sqrt,
  /** Calculates the power of a number (x^y). */
  Pow,
  /** Calculates the average of a vector. */
  Avg,
  /** Calculates the product of elements in a vector. */
  Prod,

  /** Conditional if operation (ternary operator: condition ? then : else) based on immediate numeric condition. */
  SimpleIf,

  /** New composite if operation that can defer condition evaluation using a code block. */
  If,

  // Sequence Operations
  Range, // Create a range sequence
  Seq, // Create a sequence from vector/string
}

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

    // Sequence Operations
    case Op.Range:
      rangeOp(vm);
      break;
    case Op.Seq:
      seqOp(vm);
      break;

    default:
      throw new Error(`Invalid opcode: ${opcode} (stack: ${JSON.stringify(vm.getStackData())})`);
  }
}

/**
 * Defines the built-in functions in the given symbol table.
 * This function maps symbolic names (strings) to their corresponding opcodes,
 * allowing the Tacit interpreter to recognize and execute these functions.
 * @param {SymbolTable} dict The symbol table to populate with built-in functions.
 */
export const defineBuiltins = (dict: SymbolTable) => {
  /**
   * Creates a compiler function for a given opcode.
   * This function, when called by the interpreter, will emit the specified opcode
   * into the program's bytecode.
   * @param {number} opcode The opcode to compile.
   * @returns {(vm: VM) => void} A function that, when executed, compiles the opcode.
   */
  const compileOpcode = (opcode: number) => (vm: VM) => {
    vm.compiler.compile8(opcode);
  };

  dict.define('{', compileOpcode(Op.DictLeft));
  dict.define('}', compileOpcode(Op.DictRight));
  dict.define('[', (vm: VM) => vm.compiler.compile8(Op.VecLeft));
  dict.define(']', (vm: VM) => vm.compiler.compile8(Op.VecRight));

  // Control Flow
  dict.define('eval', compileOpcode(Op.Eval));
  dict.define('.', compileOpcode(Op.Print));

  // Dyadic Arithmetic
  dict.define('+', compileOpcode(Op.Plus));
  dict.define('-', compileOpcode(Op.Minus));
  dict.define('*', compileOpcode(Op.Multiply));
  dict.define('/', compileOpcode(Op.Divide));
  dict.define('&', compileOpcode(Op.Min));
  dict.define('|', compileOpcode(Op.Max));
  dict.define('^', compileOpcode(Op.Power));
  dict.define('=', compileOpcode(Op.Equal));
  dict.define('<', compileOpcode(Op.LessThan));
  dict.define('>', compileOpcode(Op.GreaterThan));
  dict.define('~', compileOpcode(Op.Match));
  dict.define('!', compileOpcode(Op.Mod));

  // Monadic Arithmetic
  dict.define('m-', compileOpcode(Op.mNegate));
  dict.define('m%', compileOpcode(Op.mReciprocal));
  dict.define('m_', compileOpcode(Op.mFloor));
  dict.define('m~', compileOpcode(Op.mNot));
  dict.define('m*', compileOpcode(Op.mSignum));
  dict.define('m,', compileOpcode(Op.mEnlist));

  // Stack Operations
  dict.define('dup', compileOpcode(Op.Dup));
  dict.define('drop', compileOpcode(Op.Drop));
  dict.define('swap', compileOpcode(Op.Swap));

  // Arithmetic Operators
  dict.define('abs', compileOpcode(Op.Abs));
  dict.define('neg', compileOpcode(Op.Neg));
  dict.define('sign', compileOpcode(Op.Sign));
  dict.define('exp', compileOpcode(Op.Exp));
  dict.define('ln', compileOpcode(Op.Ln));
  dict.define('log', compileOpcode(Op.Log));
  dict.define('sqrt', compileOpcode(Op.Sqrt));
  dict.define('pow', compileOpcode(Op.Pow));
  dict.define('avg', compileOpcode(Op.Avg));
  dict.define('prod', compileOpcode(Op.Prod));

  // Conditional Operations
  dict.define('if', (vm: VM) => {
    vm.compiler.compile8(Op.Rot);
    vm.compiler.compile8(Op.Eval);
    vm.compiler.compile8(Op.NegRot);
    vm.compiler.compile8(Op.If);
  });

  // Sequence Operations
  dict.define('range', compileOpcode(Op.Range));
  dict.define('seq', compileOpcode(Op.Seq));

  // Add other built-ins here
};
