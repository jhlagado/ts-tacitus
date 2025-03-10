import { VM } from "../../core/vm";
import { SymbolTable } from "../../core/symbol-table";

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
import { formatValue } from "../../core/utils";

export enum Op {
  LiteralNumber,
  Branch,
  BranchCall,
  Call,
  Abort,
  Exit,
  Eval,
  GroupLeft,
  GroupRight,
  Print,

  Plus,
  Minus,
  Multiply,
  Divide,
  Power,
  Mod,
  Min,
  Max,
  LessThan,
  GreaterThan,
  Equal,
  Match,

  mNegate,
  mReciprocal,
  mFloor,
  mCeiling,
  mSignum,
  mAbsolute,
  mExp,
  mLn,
  mSqrt,
  mLog,

  Dup,
  Drop,
  Swap,
  Rot,
  Over,

  And,
  Or,
  Xor,
  Nand,

  mNot,
  mWhere,
  mReverse,

  mType,
  mString,
  mGroup,
  mDistinct,

  Join,
  Take,
  DropN,
  mEnlist,
  mCount,

  mIn,
  mKey,

  Abs,
  Neg,
  Sign,
  Exp,
  Ln,
  Log,
  Sqrt,
  Pow,
  Avg,
  Prod,
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
    case Op.GroupLeft:
      groupLeftOp(vm);
      break;
    case Op.GroupRight:
      groupRightOp(vm);
      break;
    case Op.Print:
      const value = vm.pop();
      console.log(formatValue(vm, value)); // or use console.log(formatValue(vm, value));
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

export const defineBuiltins = (dict: SymbolTable) => {
  const compileOpcode = (opcode: number) => (vm: VM) => {
    vm.compiler.compile8(opcode);
  };

  // Control Flow
  dict.define("eval", compileOpcode(Op.Eval));
  dict.define("{", compileOpcode(Op.GroupLeft));
  dict.define("}", compileOpcode(Op.GroupRight));
  dict.define(".", compileOpcode(Op.Print));

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
