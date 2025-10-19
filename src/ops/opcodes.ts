/**
 * @file src/ops/opcodes.ts
 * Operation codes for all built-in operations in the Tacit VM.
 */

/** Operation codes for built-in operations. */
export enum Op {
  /** No operation (used for immediate-only words). */
  Nop,

  /**  Pushes a literal number onto the stack. */
  LiteralNumber,

  /**  Unconditional jump to a different instruction. */
  Branch,

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
  Pow,

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

  /**  Canonical unary ops */
  Recip,
  Floor,
  Not,

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

  /**  Enlists a value as a single-element list. */
  Enlist,

  /**  Returns payload slot count from LIST header. */
  Length,

  /**  Returns element count by traversal. */
  Size,

  /**  Returns address of payload slot at slot index. */
  Slot,

  /**  Returns address of element start at logical index. */
  Elem,

  /**  Walks a list's payload cells one-by-one, returning value or ref. */
  Walk,

  /**  Fetches value at memory address. */
  Fetch,

  /**  Stores value at memory address (simple values only). */
  Store,

  /**  Polymorphic concatenation (all combinations). */
  Concat,

  /**  Removes last element from list (O(1)). */
  Tail,

  /**  Returns first element or nil. */
  Head,

  /**  Creates list from n stack items. */
  Pack,

  /**  Pushes list elements onto stack individually. */
  Unpack,

  /**  Reverses the elements of a list. */
  Reverse,

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

  /**  Exponentiation (power). */

  /**  Conditional if operation (ternary operator: condition ? then : else) based on immediate numeric condition. */
  SimpleIf,

  /**  New composite if operation that can defer condition evaluation using a code block. */
  If,

  IfFalseBranch,

  /**  Opens a list with '(' - pushes stack position onto return stack */
  OpenList,

  /**  Closes a list with ')' - creates list tag with size information */
  CloseList,

  /** Generic block-to-list converter: executes block and converts results to list */
  MakeList,

  /** Pushes a symbol reference (Tag.BUILTIN or Tag.CODE) onto the stack for metaprogramming */
  PushSymbolRef,
  /** Drop logical head element: ( list — list' ) */
  DropHead,

  /** Address-returning key lookup in maplist with default fallback - ( maplist key — maplist addr | default-addr | NIL ) */
  Find,
  /** Extract all keys from maplist - ( maplist — maplist keys ) */
  Keys,
  /** Extract all values from maplist - ( maplist — maplist values ) */
  Values,

  /** Allocates local variable slots on return stack - ( -- ) reads 16-bit slot count */
  Reserve,
  /** Initializes local variable slot with stack value - ( value -- ) reads 16-bit slot number */
  InitVar,
  /** Pushes local variable slot address - ( -- addr ) reads 16-bit slot number */
  VarRef,
  /** Debug: dumps current stack frame state - ( -- ) */
  DumpStackFrame,

  /** Converts list on data stack to DATA_REF - ( list -- DATA_REF ) */
  Ref,
  /** Path-based address access - ( target path -- target addr|NIL ) */
  Select,

  /** Value-by-default dereference - ( x -- v ) */
  Load,

  /** Ends a colon definition during compilation (invoked via generic `;`). */
  EndDefinition,

  /** Ends an IF/ELSE construct during compilation (invoked via generic `;`). */
  EndIf,

  /** Ends a `when` clause body during compilation (invoked via generic `;`). */
  EndDo,

  /** Ends a `when` construct during compilation (invoked via generic `;`). */
  EndWhen,

  /** Ends a `case` clause body during compilation (invoked via generic `;`). */
  EndOf,

  /** Ends a `case` construct during compilation (invoked via generic `;`). */
  EndCase,

  /** Ends a capsule dispatch body during compilation (invoked via generic `;`). */
  EndCapsule,

  /** Constructor exit: capture locals into capsule, push handle, restore caller. */
  ExitConstructor,

  /** Dispatch epilogue restoring caller without touching capsule payload. */
  ExitDispatch,

  /** Capsule dispatch runtime entry point. */
  Dispatch,

  /** Buffer allocation: buffer N -- list */
  Buffer,

  /** Buffer queries: buf-size/list/ref -- n */
  BufSize,
  /** Buffer empty check: buf-empty list/ref -- 1|NIL */
  BufEmpty,
  /** Buffer full check: buf-full list/ref -- 1|NIL */
  BufFull,

  /** Buffer mutations (non-throwing on under/overflow, return 1|NIL or v|NIL) */
  BufPush,
  BufPop,
  BufUnshift,
  BufShift,
}
