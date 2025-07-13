/**
 * @file init-function-table.ts
 * Initializes the function table with all built-in opcode implementations
 */
import { VM } from '../core/vm';
import { Op } from './opcodes';
import { formatAtomicValue } from '../core/format-utils';
import { fromTaggedValue, Tag } from '../core/tagged';
import { BYTES_PER_ELEMENT } from '../core/constants';

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
import { dupOp, dropOp, swapOp, rotOp, revrotOp, overOp } from './builtins-stack';

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
import { ifCurlyBranchFalseOp } from './builtins-conditional';

import { literalAddressOp } from './builtins';

/**
 * Initializes the function table with all built-in operations
 */
export function initFunctionTable(vm: VM): void {
  const ft = vm.functionTable;
  ft.registerBuiltin(Op.LiteralNumber, literalNumberOp);
  ft.registerBuiltin(Op.Branch, skipDefOp);
  ft.registerBuiltin(Op.BranchCall, skipBlockOp);
  ft.registerBuiltin(Op.Call, callOp);
  ft.registerBuiltin(Op.Abort, abortOp);
  ft.registerBuiltin(Op.Exit, exitOp);
  ft.registerBuiltin(Op.Eval, evalOp);
  ft.registerBuiltin(Op.Print, (vm: VM) => {
    try {
      if (vm.SP < BYTES_PER_ELEMENT) {
        console.log('[Error: Stack empty]');
        return;
      }

      const topValue = vm.peek();
      const { tag, value: tagValue } = fromTaggedValue(topValue);

      let formatted: string;

      if (tag === Tag.LINK) {
        if (tagValue > 0 && vm.SP >= tagValue * BYTES_PER_ELEMENT) {
          const stackData = vm.getStackData();
          const currentIndex = stackData.length - 1;
          const listIndex = currentIndex - tagValue;

          if (listIndex >= 0) {
            const listTagValue = stackData[listIndex];
            const { tag: listTag, value: listSize } = fromTaggedValue(listTagValue);

            if (listTag === Tag.LIST || (Number.isNaN(listTagValue) && listSize >= 0)) {
              const items = [];
              for (let i = 0; i < listSize; i++) {
                if (listIndex + i + 1 < stackData.length) {
                  const elemValue = stackData[listIndex + i + 1];
                  const elemFormatted = formatAtomicValue(vm, elemValue);
                  items.push(elemFormatted);
                }
              }
              formatted = `( ${items.join(' ')} )`;
            } else {
              formatted = '( invalid list )';
            }
          } else {
            formatted = '( invalid link )';
          }
        } else {
          formatted = '( link )';
        }

        vm.pop();
      } else if (tag === Tag.LIST || (Number.isNaN(topValue) && tagValue >= 0)) {
        const size = Number.isNaN(topValue) ? tagValue : Number(tagValue);
        const stackData = vm.getStackData();
        const items = [];

        for (let i = 0; i < size; i++) {
          if (stackData.length > i + 1) {
            const elemValue = stackData[stackData.length - size + i];

            const { tag: elemTag } = fromTaggedValue(elemValue);
            if (elemTag !== Tag.LINK) {
              items.push(formatAtomicValue(vm, elemValue));
            }
          }
        }

        formatted = `( ${items.join(' ')} )`;

        vm.pop();

        for (let i = 0; i < size && vm.SP >= BYTES_PER_ELEMENT; i++) {
          vm.pop();
        }

        if (vm.SP >= BYTES_PER_ELEMENT) {
          const possibleLink = vm.peek();
          const { tag: nextTag } = fromTaggedValue(possibleLink);
          if (nextTag === Tag.LINK) {
            vm.pop();
          }
        }
      } else {
        formatted = formatAtomicValue(vm, topValue);
        vm.pop();
      }

      console.log(formatted);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Print error: ${errorMessage}]`);

      if (vm.SP >= BYTES_PER_ELEMENT) {
        try {
          vm.pop();
        } catch (_) {
          /* Ignore */
        }
      }
    }
  });
  ft.registerBuiltin(Op.LiteralString, literalStringOp);
  ft.registerBuiltin(Op.LiteralAddress, literalAddressOp);
  ft.registerBuiltin(Op.Add, addOp);
  ft.registerBuiltin(Op.Minus, subtractOp);
  ft.registerBuiltin(Op.Multiply, multiplyOp);
  ft.registerBuiltin(Op.Divide, divideOp);
  ft.registerBuiltin(Op.Power, powerOp);
  ft.registerBuiltin(Op.Mod, modOp);
  ft.registerBuiltin(Op.Min, minOp);
  ft.registerBuiltin(Op.Max, maxOp);
  ft.registerBuiltin(Op.LessThan, lessThanOp);
  ft.registerBuiltin(Op.LessOrEqual, lessOrEqualOp);
  ft.registerBuiltin(Op.GreaterThan, greaterThanOp);
  ft.registerBuiltin(Op.GreaterOrEqual, greaterOrEqualOp);
  ft.registerBuiltin(Op.Equal, equalOp);
  ft.registerBuiltin(Op.mNegate, mNegateOp);
  ft.registerBuiltin(Op.mReciprocal, mReciprocalOp);
  ft.registerBuiltin(Op.mFloor, mFloorOp);
  ft.registerBuiltin(Op.mNot, mNotOp);
  ft.registerBuiltin(Op.mSignum, mSignumOp);
  ft.registerBuiltin(Op.mEnlist, mEnlistOp);
  ft.registerBuiltin(Op.Dup, dupOp);
  ft.registerBuiltin(Op.Drop, dropOp);
  ft.registerBuiltin(Op.Swap, swapOp);
  ft.registerBuiltin(Op.Rot, rotOp);
  ft.registerBuiltin(Op.RevRot, revrotOp);
  ft.registerBuiltin(Op.Over, overOp);
  ft.registerBuiltin(Op.Abs, absOp);
  ft.registerBuiltin(Op.Neg, negOp);
  ft.registerBuiltin(Op.Sign, signOp);
  ft.registerBuiltin(Op.Exp, expOp);
  ft.registerBuiltin(Op.Ln, lnOp);
  ft.registerBuiltin(Op.Log, logOp);
  ft.registerBuiltin(Op.Sqrt, sqrtOp);
  ft.registerBuiltin(Op.Pow, powOp);
  ft.registerBuiltin(Op.Avg, avgOp);
  ft.registerBuiltin(Op.Prod, prodOp);
  ft.registerBuiltin(Op.If, simpleIfOp);
  ft.registerBuiltin(Op.IfFalseBranch, ifCurlyBranchFalseOp);
  ft.registerBuiltin(Op.OpenList, openListOp);
  ft.registerBuiltin(Op.CloseList, closeListOp);
}
