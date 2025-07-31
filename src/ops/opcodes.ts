/**
 * @file src/ops/opcodes.ts
 *
 * This file defines the operation codes (opcodes) for all built-in operations in the Tacit VM.
 * Each opcode represents a specific operation that can be executed by the VM's interpreter.
 *
 * Opcodes are organized into several functional categories:
 * - Control flow operations (LiteralNumber, Branch, Call, etc.)
 * - Stack manipulation operations (Dup, Drop, Swap, etc.)
 * - Arithmetic operations (Add, Subtract, Multiply, etc.)
 * - Comparison operations (Equal, LessThan, etc.)
 * - List operations (OpenList, CloseList)
 * - Unary operations (prefixed with 'm', e.g., mNegate, mFloor)
 *
 * The VM uses these opcodes to dispatch to the appropriate implementation functions
 * during bytecode execution.
 */

/**
 * Operation codes for all built-in operations in the Tacit VM.
 *
 * Each opcode corresponds to a specific operation that can be executed by the VM.
 * The numeric values are assigned sequentially starting from 0, and these values
 * are used in the compiled bytecode to identify operations.
 */
export enum Op {
  /**  Pushes a literal number onto the stack. */
  LiteralNumber,

  /**  Unconditional jump to a different instruction. */
  Branch,

  /**  Conditional jump to a different instruction based on the top of the stack. */
  BranchCall,

  /**  Calls a function. */
  Call,

  /**  Aborts the program execution. */
  Abort,

  /**  Exits the program. */
  Exit,

  /**  Evaluates the expression on the top of the stack. */
  Eval,

  /**  Prints the value on the top of the stack to the console. */
  Print,

  /**  Prints the raw tagged value on top of the stack (TAG:VALUE) */
  RawPrint,

  /**  Pushes a literal string onto the stack. */
  LiteralString,

  /**  Pushes a literal address onto the stack. */
  LiteralAddress,

  /**  Pushes a tagged code pointer (quotation) onto the stack. */
  LiteralCode,

  /**  Performs addition of the top two values on the stack. */
  Add,

  /**  Performs subtraction of the top two values on the stack. */
  Minus,

  /**  Performs multiplication of the top two values on the stack. */
  Multiply,

  /**  Performs division of the top two values on the stack. */
  Divide,

  /**  Performs exponentiation (power) of the top two values on the stack. */
  Power,

  /**  Performs modulo operation of the top two values on the stack. */
  Mod,

  /**  Returns the minimum of the top two values on the stack. */
  Min,

  /**  Returns the maximum of the top two values on the stack. */
  Max,

  /**  Checks if the second value from the top of the stack is less than the top value. */
  LessThan,

  /**  Checks if the second value from the top of the stack is less than or equal to the top value. */
  LessOrEqual,

  /**  Checks if the second value from the top of the stack is greater than the top value. */
  GreaterThan,

  /**  Checks if the second value from the top of the stack is greater than or equal to the top value. */
  GreaterOrEqual,

  /**  Checks if the top two values on the stack are equal. */
  Equal,

  /**  Checks if the top two values on the stack match (have the same structure). */
  Match,

  /**  Unary Op negation (negates the value on the top of the stack). */
  mNegate,

  /**  Unary Op reciprocal (calculates the reciprocal of the value on the top of the stack). */
  mReciprocal,

  /**  Unary Op floor (rounds the value on the top of the stack down to the nearest integer). */
  mFloor,

  /**  Unary Op ceiling (rounds the value on the top of the stack up to the nearest integer). */
  mCeiling,

  /**  Unary Op signum (returns the sign of the value on the top of the stack: -1, 0, or 1). */
  mSignum,

  /**  Unary Op absolute value (returns the absolute value of the value on the top of the stack). */
  mAbsolute,

  /**  Unary Op exponential (calculates e raised to the power of the value on the top of the stack). */
  mExp,

  /**  Unary Op natural logarithm (calculates the natural logarithm of the value on the top of the stack). */
  mLn,

  /**  Unary Op square root (calculates the square root of the value on the top of the stack). */
  mSqrt,

  /**  Unary Op base-10 logarithm (calculates the base-10 logarithm of the value on the top of the stack). */
  mLog,

  /**  Duplicates the value on the top of the stack. */
  Dup,

  /**  Removes the value on the top of the stack. */
  Drop,

  /**  Swaps the top two values on the stack. */
  Swap,

  /**  Rotates the top three values on the stack (the third value moves to the top). */
  Rot,

  /**  Reverse rotates the top three values on the stack (transforming [a, b, c] into [c, a, b]). */
  RevRot,

  /**  Duplicates the second value from the top of the stack and pushes it onto the top. */
  Over,

  /**  Picks the nth element from the stack (n on TOS) and pushes it onto the top. */
  Pick,

  /**  Removes the second element from the stack (NOS), leaving only the top element. */
  Nip,

  /**  Duplicates the top element and inserts the copy under the second element. */
  Tuck,

  /**  Performs a bitwise AND operation on the top two values of the stack */
  And,

  /**  Performs a bitwise OR operation on the top two values of the stack */
  Or,

  /**  Performs a bitwise XOR operation on the top two values of the stack */
  Xor,

  /**  Performs a bitwise NAND operation on the top two values of the stack */
  Nand,

  /**  Unary Op NOT (performs a logical NOT on the value on the top of the stack). */
  mNot,

  /**  Unary Op where (returns the indices where the value on the top of the stack is non-zero). */
  mWhere,

  /**  Unary Op reverse (reverses the elements of a vector on the top of the stack). */
  mReverse,

  /**  Unary Op type (returns the type of the value on the top of the stack). */
  mType,

  /**  Unary Op string (converts the value on the top of the stack to a string). */
  mString,

  /**  Unary Op group (groups elements of a vector based on unique values). */
  mGroup,

  /**  Unary Op distinct (returns the unique elements of a vector). */
  mDistinct,

  /**  Joins two vectors into a single vector. */
  Join,

  /**  Enlists a value as a single-element vector. */
  mEnlist,

  /**  Counts the elements in a vector. */
  mCount,

  /**  Checks if a value is present in a vector. */
  mIn,

  /**  Returns the keys of a dictionary. */
  mKey,

  /**  Calculates the absolute value. */
  Abs,

  /**  Negates a numeric value. */
  Neg,

  /**  Returns the sign of a numeric value (-1, 0, or 1). */
  Sign,

  /**  Calculates the exponential function (e^x). */
  Exp,

  /**  Calculates the natural logarithm (base e). */
  Ln,

  /**  Calculates the base-10 logarithm. */
  Log,

  /**  Calculates the square root. */
  Sqrt,

  /**  Calculates the power of a number (x^y). */
  Pow,

  /**  Calculates the average of a vector. */
  Avg,

  /**  Calculates the product of elements in a vector. */
  Prod,

  /**  Conditional if operation (ternary operator: condition ? then : else) based on immediate numeric condition. */
  SimpleIf,

  /**  New composite if operation that can defer condition evaluation using a code block. */
  If,

  IfFalseBranch,

  /**  Opens a list with '(' - pushes stack position onto return stack */
  OpenList,

  /**  Closes a list with ')' - creates list tag with size information */
  CloseList,

  /** Do combinator: applies a quotation to a value */
  Do,

  /** Repeat combinator: executes a quotation a specified number of times */
  Repeat,
}
