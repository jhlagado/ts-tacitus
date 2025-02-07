import { VM } from "../vm";
import { Dictionary } from "../lang/dictionary";

import {
  literalNumberOp,
  skipDefOp,
  skipBlockOp,
  callOp,
  abortOp,
  exitOp,
  evalOp,
} from "./builtins-interpreter";

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
} from "./builtins-math";

import {
  mNegateOp,
  mReciprocalOp,
  mFloorOp,
  mNotOp,
  mSignumOp,
  mEnlistOp,
} from "./builtins-monadic";

import { dupOp, dropOp, swapOp } from "./builtins-stack";

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
} from "./arithmetic-ops";

export enum Op {
  // Control Flow (0-6)
  LiteralNumber, // 0
  Branch, // 1
  BranchCall, // 2
  Call, // 3
  Abort, // 4
  Exit, // 5
  Eval, // 6

  // Dyadic Arithmetic (7-18)
  Plus, // 7  +
  Minus, // 8  -
  Multiply, // 9  *
  Divide, // 10 /
  Power, // 11 ^
  Mod, // 12 !
  Min, // 13 &
  Max, // 14 |
  LessThan, // 15 <
  GreaterThan, // 16 >
  Equal, // 17 =
  Match, // 18 ~

  // Monadic Arithmetic (19-28)
  mNegate, // 19 m-
  mReciprocal, // 20 m%
  mFloor, // 21 m_
  mCeiling, // 22 m^
  mSignum, // 23 m*
  mAbsolute, // 24 m|
  mExp, // 25 me
  mLn, // 26 ml
  mSqrt, // 27 mq
  mLog, // 28 mb

  // Stack Operations (29-33)
  Dup, // 29 dup
  Drop, // 30 drop
  Swap, // 31 swap
  Rot, // 32 rot
  Over, // 33 over

  // Dyadic Logical (34-37)
  And, // 34 &&
  Or, // 35 ||
  Xor, // 36 xor
  Nand, // 37 nand

  // Monadic Logical (38-40)
  mNot, // 38 m~
  mWhere, // 39 m&
  mReverse, // 40 m|

  // Type Operations (41-44)
  mType, // 41 m@
  mString, // 42 m$
  mGroup, // 43 m=
  mDistinct, // 44 m?

  // List Operations (45-49)
  Join, // 45 ,
  Take, // 46 #
  DropN, // 47 _
  mEnlist, // 48 m,
  mCount, // 49 m#

  // Special Forms (50-51)
  mIn, // 50 in
  mKey, // 51 m!

  // Arithmetic Operators (52-63)
  Abs, // 52 abs
  Neg, // 53 neg
  Sign, // 54 sign
  Exp, // 55 exp
  Ln, // 56 ln
  Log, // 57 log
  Sqrt, // 58 sqrt
  Pow, // 59 pow
  Avg, // 60 avg
  Prod, // 61 prod
}

export const executeOp = (vm: VM, opcode: Op) => {
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
    case Op.Min:
      minOp(vm);
      break;
    case Op.Max:
      maxOp(vm);
      break;
    case Op.Power:
      powerOp(vm);
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

    default:
      throw new Error(
        `Invalid opcode: ${opcode} (stack: ${JSON.stringify(
          vm.getStackData()
        )})`
      );
  }
};

export const defineBuiltins = (dict: Dictionary) => {
  const compileOpcode = (opcode: number) => (vm: VM) => {
    vm.compiler.compile8(opcode);
  };

  // Control Flow
  dict.define("eval", compileOpcode(Op.Eval));

  // Dyadic Arithmetic
  dict.define("+", compileOpcode(Op.Plus));
  dict.define("-", compileOpcode(Op.Minus));
  dict.define("*", compileOpcode(Op.Multiply));
  dict.define("/", compileOpcode(Op.Divide));
  dict.define("&", compileOpcode(Op.Min));
  dict.define("|", compileOpcode(Op.Max));
  dict.define("^", compileOpcode(Op.Power));
  dict.define("=", compileOpcode(Op.Equal));
  dict.define("<", compileOpcode(Op.LessThan));
  dict.define(">", compileOpcode(Op.GreaterThan));
  dict.define("~", compileOpcode(Op.Match));
  dict.define("!", compileOpcode(Op.Mod));

  // Monadic Arithmetic
  dict.define("m-", compileOpcode(Op.mNegate));
  dict.define("m%", compileOpcode(Op.mReciprocal));
  dict.define("m_", compileOpcode(Op.mFloor));
  dict.define("m~", compileOpcode(Op.mNot));
  dict.define("m*", compileOpcode(Op.mSignum));
  dict.define("m,", compileOpcode(Op.mEnlist));

  // Stack Operations
  dict.define("dup", compileOpcode(Op.Dup));
  dict.define("drop", compileOpcode(Op.Drop));
  dict.define("swap", compileOpcode(Op.Swap));

  // Arithmetic Operators
  dict.define("abs", compileOpcode(Op.Abs));
  dict.define("neg", compileOpcode(Op.Neg));
  dict.define("sign", compileOpcode(Op.Sign));
  dict.define("exp", compileOpcode(Op.Exp));
  dict.define("ln", compileOpcode(Op.Ln));
  dict.define("log", compileOpcode(Op.Log));
  dict.define("sqrt", compileOpcode(Op.Sqrt));
  dict.define("pow", compileOpcode(Op.Pow));
  dict.define("avg", compileOpcode(Op.Avg));
  dict.define("prod", compileOpcode(Op.Prod));
};
