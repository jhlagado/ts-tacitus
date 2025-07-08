
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
  /** Prints the value on the top of the stack to the console. */
  Print,
  /** Pushes a literal string onto the stack. */
  LiteralString,
  /** Pushes a literal address onto the stack. */
  LiteralAddress,

  /** Performs addition of the top two values on the stack. */
  Add,
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
  /** Checks if the second value from the top of the stack is less than or equal to the top value. */
  LessOrEqual,
  /** Checks if the second value from the top of the stack is greater than the top value. */
  GreaterThan,
  /** Checks if the second value from the top of the stack is greater than or equal to the top value. */
  GreaterOrEqual,
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

  // Sequence operations have been removed
  IfFalseBranch, 
  
  /** Opens a tuple with '(' - pushes stack position onto return stack */
  OpenTuple,
  /** Closes a tuple with ')' - creates tuple tag with size information */
  CloseTuple,
}
