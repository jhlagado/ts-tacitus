/**
 * @file src/ops/builtins.ts
 * Central dispatcher for built-in operations. Maps opcodes to implementation functions.
 */
import { VM } from '../core/vm';
import { toTaggedValue, fromTaggedValue, getTag, Tag } from '../core/tagged';
import { getVarRef } from '../core/refs';
import { SEG_RSTACK } from '../core/constants';

import {
  literalNumberOp,
  skipDefOp,
  skipBlockOp,
  callOp,
  abortOp,
  exitOp,
  exitCodeOp,
  evalOp,
  literalStringOp,
  pushSymbolRefOp,
} from './core-ops';
import {
  addOp,
  subtractOp,
  multiplyOp,
  divideOp,
  modOp,
  minOp,
  maxOp,
  equalOp,
  lessThanOp,
  lessOrEqualOp,
  greaterThanOp,
  greaterOrEqualOp,
  absOp,
  negOp,
  signOp,
  expOp,
  lnOp,
  logOp,
  sqrtOp,
  powOp,
} from './math-ops';
import { recipOp, floorOp, notOp } from './math-ops';
import { enlistOp, findOp, keysOp, valuesOp } from './list-ops';
import { dupOp, dropOp, swapOp, rotOp, revrotOp, overOp, nipOp, tuckOp } from './stack-ops';
import { printOp, rawPrintOp } from './print-ops';
import { simpleIfOp } from './control-ops';
import {
  openListOp,
  closeListOp,
  lengthOp,
  sizeOp,
  slotOp,
  elemOp,
  fetchOp,
  storeOp,
  headOp,
} from './list-ops';
import {
  concatOp,
  tailOp,
  packOp,
  unpackOp,
  reverseOp,
  makeListOp,
  refOp,
  resolveOp,
} from './list-ops';

import { Op } from './opcodes';
import { InvalidOpcodeError } from '../core/errors';

import { ifCurlyBranchFalseOp } from './control-ops';
import { doOp } from './combinators/do';
import { repeatOp } from './combinators/repeat';
import { getOp, setOp, selectOp } from './access-ops';
import { isCompoundData, transferCompoundToReturnStack } from './local-vars-transfer';

/** Stores TOS into vm.tempRegister. */
export function saveTempOp(vm: VM): void {
  vm.ensureStackSize(1, 'saveTemp');
  vm.tempRegister = vm.pop();
}
/** Pushes vm.tempRegister onto the stack. */
export function restoreTempOp(vm: VM): void {
  vm.push(vm.tempRegister);
}

/**
 * Executes a specific operation based on the given opcode.
 *
 * This is the central dispatch function of the VM's execution engine. It takes an opcode
 * and routes execution to the appropriate implementation function. The function handles
 * both built-in operations (opcodes < 128) and user-defined operations (opcodes >= 128).
 *
 * @param {VM} vm - The virtual machine instance containing the current execution state.
 * @param {Op} opcode - The opcode representing the operation to execute.
 * @throws {Error} If the opcode is invalid or no implementation is found for a user-defined opcode.
 */

/**
 * Implements the LiteralCode operation.
 *
 * Reads a 16-bit address from the instruction stream, tags it as Tag.CODE, and pushes it onto the stack.
 * This is used for pushing quotations (code pointers) onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 */
export function literalCodeOp(vm: VM): void {
  const address = vm.nextUint16();
  const tagged = toTaggedValue(address, Tag.CODE, 1);
  vm.push(tagged);
}

export function executeOp(vm: VM, opcode: Op, isUserDefined = false) {
  if (isUserDefined) {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    vm.IP = opcode;
    return;
  }

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
    case Op.ExitCode:
      exitCodeOp(vm);
      break;
    case Op.Eval:
      evalOp(vm);
      break;
    case Op.RawPrint:
      rawPrintOp(vm);
      break;
    case Op.Print:
      printOp(vm);
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

    case Op.Mod:
      modOp(vm);
      break;
    case Op.Recip:
      recipOp(vm);
      break;
    case Op.Floor:
      floorOp(vm);
      break;
    case Op.Not:
      notOp(vm);
      break;
    case Op.Enlist:
      enlistOp(vm);
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
    case Op.Nip:
      nipOp(vm);
      break;
    case Op.Tuck:
      tuckOp(vm);
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

    case Op.If:
      simpleIfOp(vm);
      break;
    case Op.IfFalseBranch:
      ifCurlyBranchFalseOp(vm);
      break;
    case Op.Do:
      doOp(vm);
      break;
    case Op.Repeat:
      repeatOp(vm);
      break;
    case Op.Get:
      getOp(vm);
      break;
    case Op.Set:
      setOp(vm);
      break;
    case Op.Select:
      selectOp(vm);
      break;
    case Op.MakeList:
      makeListOp(vm);
      break;
    case Op.LiteralAddress:
      literalAddressOp(vm);
      break;
    case Op.LiteralCode:
      literalCodeOp(vm);
      break;
    case Op.OpenList:
      openListOp(vm);
      break;
    case Op.CloseList:
      closeListOp(vm);
      break;
    /** List operations. */
    case Op.Length:
      lengthOp(vm);
      break;
    case Op.Size:
      sizeOp(vm);
      break;
    case Op.Slot:
      slotOp(vm);
      break;
    case Op.Elem:
      elemOp(vm);
      break;
    case Op.Fetch:
      fetchOp(vm);
      break;
    case Op.Store:
      storeOp(vm);
      break;
    case Op.Head:
      headOp(vm);
      break;
    case Op.Pack:
      packOp(vm);
      break;
    case Op.Unpack:
      unpackOp(vm);
      break;
    case Op.Reverse:
      reverseOp(vm);
      break;
    case Op.Concat:
      concatOp(vm);
      break;
    case Op.Tail:
      tailOp(vm);
      break;
    case Op.DropHead:
      tailOp(vm);
      break;
    case Op.PushSymbolRef:
      pushSymbolRefOp(vm);
      break;
    case Op.Find:
      findOp(vm);
      break;
    case Op.Keys:
      keysOp(vm);
      break;
    case Op.Values:
      valuesOp(vm);
      break;
    case Op.SaveTemp:
      saveTempOp(vm);
      break;
    case Op.RestoreTemp:
      restoreTempOp(vm);
      break;
    case Op.Reserve:
      reserveOp(vm);
      break;
    case Op.InitVar:
      initVarOp(vm);
      break;
    case Op.VarRef:
      varRefOp(vm);
      break;
    case Op.DumpStackFrame:
      dumpStackFrameOp(vm);
      break;
    case Op.Ref:
      refOp(vm);
      break;
    case Op.Unref:
      resolveOp(vm);
      break;
    default:
      throw new InvalidOpcodeError(opcode, vm.getStackData());
  }
}

/**
 * Implements the LiteralAddress operation.
 *
 * Reads a 16-bit address from the instruction stream and pushes it onto the stack.
 * This operation is used for pushing memory addresses or function pointers onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 */
export function literalAddressOp(vm: VM): void {
  const address = vm.nextUint16();
  vm.push(address);
}

/**
 * Implements the Reserve operation for local variable slot allocation.
 *
 * Reads a 16-bit slot count from the instruction stream and allocates that many
 * 32-bit slots on the return stack for local variables. Each slot is 4 bytes.
 *
 * @param {VM} vm - The virtual machine instance.
 */
export function reserveOp(vm: VM): void {
  const slotCount = vm.nextUint16();
  vm.RP += slotCount * 4;
}

/**
 * Implements the InitVar operation for local variable initialization.
 *
 * Reads a 16-bit slot number from the instruction stream, pops a value from the
 * data stack, and stores it in the specified local variable slot on the return stack.
 *
 * @param {VM} vm - The virtual machine instance.
 */
export function initVarOp(vm: VM): void {
  const slotNumber = vm.nextInt16();
  vm.ensureStackSize(1, 'InitVar');

  const value = vm.peek();
  const slotAddr = vm.BP + slotNumber * 4;

  if (isCompoundData(value)) {
    const headerAddr = transferCompoundToReturnStack(vm);
    const headerCellIndex = headerAddr / 4;
    const localRef = toTaggedValue(headerCellIndex, Tag.RSTACK_REF);

    vm.memory.writeFloat32(SEG_RSTACK, slotAddr, localRef);
  } else {
    const simpleValue = vm.pop();
    vm.memory.writeFloat32(SEG_RSTACK, slotAddr, simpleValue);
  }
}

export function varRefOp(vm: VM): void {
  const slotNumber = vm.nextInt16();
  vm.push(getVarRef(vm, slotNumber));
}

/**
 * Debug opcode to dump current stack frame state
 */
export function dumpStackFrameOp(vm: VM): void {
  console.log('\n=== STACK FRAME DUMP ===');
  console.log('BP:', vm.BP, 'RP:', vm.RP, 'SP:', vm.SP);

  if (vm.BP > 0) {
    const localCount = vm.symbolTable.getLocalCount();
    console.log('Local variable count:', localCount);

    for (let i = 0; i < localCount; i++) {
      const slotAddr = vm.BP + i * 4;
      const slotValue = vm.memory.readFloat32(SEG_RSTACK, slotAddr);
      const tag = getTag(slotValue);
      const { value } = fromTaggedValue(slotValue);
      console.log(`  Slot ${i} - tag: ${Tag[tag]}, value: ${value}`);

      if (tag === Tag.RSTACK_REF) {
        const targetAddr = value * 4;
        const targetValue = vm.memory.readFloat32(SEG_RSTACK, targetAddr);
        const targetTag = getTag(targetValue);
        const { value: targetVal } = fromTaggedValue(targetValue);
        console.log(`    -> Points to tag: ${Tag[targetTag]}, value: ${targetVal}`);
      }
    }
  } else {
    console.log('No active stack frame');
  }
  console.log('========================\n');
}
