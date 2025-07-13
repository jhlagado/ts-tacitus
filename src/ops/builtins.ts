/**
 * @file src/ops/builtins.ts
 * This file defines the built-in operations (functions) available in the Tacit language.
 * It maps symbolic names to their corresponding opcodes and provides an execution function
 * to handle these operations during program execution.
 * Architectural Observations: This file acts as a central registry for all built-in functions,
 * linking the symbolic representation used in Tacit code with the underlying execution logic.
 */
import { VM } from '../core/vm';

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
import { printOp } from './builtins-print';

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
import { BYTES_PER_ELEMENT } from '../core/constants';
import { fromTaggedValue, Tag } from '../core/tagged';
import { formatAtomicValue } from '../core/format-utils';
import { openListOp, closeListOp } from './builtins-list';


import { Op } from './opcodes';

import { ifCurlyBranchFalseOp } from './builtins-conditional';

/**
 * Executes a specific operation based on the given opcode.
 * @param {VM} vm The virtual machine instance.
 * @param {Op} opcode The opcode representing the operation to execute.
 * @throws {Error} If the opcode is invalid.
 */
export function executeOp(vm: VM, opcode: Op) {
  switch (opcode) {
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
    case Op.Print:
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
      break;
    case Op.LiteralString:
      literalStringOp(vm);
      break;
    case Op.Add:
      addOp(vm);
      break;
    case Op.Minus:
      subtractOp(vm);
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
    case Op.LessOrEqual:
      lessOrEqualOp(vm);
      break;
    case Op.GreaterThan:
      greaterThanOp(vm);
      break;
    case Op.GreaterOrEqual:
      greaterOrEqualOp(vm);
      break;
    case Op.Match:
      equalOp(vm);
      break;
    case Op.Mod:
      modOp(vm);
      break;
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
    case Op.RevRot:
      revrotOp(vm);
      break;
    case Op.Over:
      overOp(vm);
      break;
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
    case Op.If:
      simpleIfOp(vm);
      break;
    case Op.IfFalseBranch:
      ifCurlyBranchFalseOp(vm);
      break;
    case Op.LiteralAddress:
      literalAddressOp(vm);
      break;
    case Op.OpenList:
      openListOp(vm);
      break;
    case Op.CloseList:
      closeListOp(vm);
      break;
    default:
      // If opcode is in the user-defined range, we need to find the implementation in the symbol table
      if (opcode >= 128 && opcode < 32768) {
        const implementation = vm.symbolTable.findImplementationByOpcode(opcode);
        if (implementation) {
          implementation(vm);
          return;
        }
      }
      
      throw new Error(`Invalid opcode: ${opcode} (stack: ${JSON.stringify(vm.getStackData())})`);
  }
}

export function literalAddressOp(vm: VM): void {
  const address = vm.read16();
  vm.push(address);
}
