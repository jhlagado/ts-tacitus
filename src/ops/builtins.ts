/**
 * @file src/ops/builtins.ts
 * Central dispatcher for built-in operations. Maps opcodes to implementation functions.
 */
import {
  VM,
  Verb,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  Tag,
  getVarRef,
  SEG_RSTACK,
  CELL_SIZE,
} from '@src/core';

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
} from './core';
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
  recipOp,
  floorOp,
  notOp,
} from './math';
import { enlistOp, keysOp, valuesOp } from './lists';
import { dupOp, dropOp, swapOp, rotOp, revrotOp, overOp, nipOp, tuckOp } from './stack';
import { printOp, rawPrintOp } from './print';
import { simpleIfOp } from './control';
import { openListOp, closeListOp } from './lists';
import { lengthOp, sizeOp, slotOp, elemOp, fetchOp, storeOp, findOp, loadOp } from './lists';
import { makeListOp, packOp, unpackOp } from './lists';
import { refOp } from './lists';
import { headOp as _headOp, tailOp, reverseOp, concatOp } from './lists';

import { Op } from './opcodes';
import { InvalidOpcodeError } from '@src/core';

import { ifCurlyBranchFalseOp } from './control';
import { doOp } from './combinators/do';
import { repeatOp } from './combinators/repeat';
import { selectOp } from './access';
import { isList, rpushList } from './local-vars-transfer';

// Temp register and related opcodes have been removed.

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
    if (vm.frameBpInCells) {
      vm.rpush(vm.BPCells);
      vm.BPCells = vm.RSP;
    } else {
  // Save caller BP in cells (now vm.BP is cells); legacy byte view accessible via BPBytes
  vm.rpush(vm.BP);
  // BP is byte-based; set it from the cell-based RSP (convert to bytes)
  vm.BP = vm.RSP; // set BP in cells
    }
    vm.IP = opcode;
    return;
  }

  const OPCODE_TO_VERB: Partial<Record<Op, Verb>> = {
    [Op.LiteralNumber]: literalNumberOp,
    [Op.Branch]: skipDefOp,
    [Op.BranchCall]: skipBlockOp,
    [Op.Call]: callOp,
    [Op.Abort]: abortOp,
    [Op.Exit]: exitOp,
    [Op.ExitCode]: exitCodeOp,
    [Op.Eval]: evalOp,
    [Op.RawPrint]: rawPrintOp,
    [Op.Print]: printOp,
    [Op.LiteralString]: literalStringOp,
    [Op.Add]: addOp,
    [Op.Minus]: subtractOp,
    [Op.Multiply]: multiplyOp,
    [Op.Divide]: divideOp,
    [Op.Min]: minOp,
    [Op.Max]: maxOp,
    [Op.Equal]: equalOp,
    [Op.LessThan]: lessThanOp,
    [Op.LessOrEqual]: lessOrEqualOp,
    [Op.GreaterThan]: greaterThanOp,
    [Op.GreaterOrEqual]: greaterOrEqualOp,
    [Op.Mod]: modOp,
    [Op.Recip]: recipOp,
    [Op.Floor]: floorOp,
    [Op.Not]: notOp,
    [Op.Enlist]: enlistOp,
    [Op.Dup]: dupOp,
    [Op.Drop]: dropOp,
    [Op.Swap]: swapOp,
    [Op.Rot]: rotOp,
    [Op.RevRot]: revrotOp,
    [Op.Over]: overOp,
    [Op.Nip]: nipOp,
    [Op.Tuck]: tuckOp,
    [Op.Abs]: absOp,
    [Op.Neg]: negOp,
    [Op.Sign]: signOp,
    [Op.Exp]: expOp,
    [Op.Ln]: lnOp,
    [Op.Log]: logOp,
    [Op.Sqrt]: sqrtOp,
    [Op.Pow]: powOp,
    [Op.If]: simpleIfOp,
    [Op.IfFalseBranch]: ifCurlyBranchFalseOp,
    [Op.Do]: doOp,
    [Op.Repeat]: repeatOp,
    [Op.Select]: selectOp,
    [Op.MakeList]: makeListOp,
    [Op.LiteralAddress]: literalAddressOp,
    [Op.LiteralCode]: literalCodeOp,
    [Op.OpenList]: openListOp,
    [Op.CloseList]: closeListOp,
    [Op.Length]: lengthOp,
    [Op.Size]: sizeOp,
    [Op.Slot]: slotOp,
    [Op.Elem]: elemOp,
    [Op.Fetch]: fetchOp,
    [Op.Store]: storeOp,
    [Op.Head]: _headOp,
    [Op.Pack]: packOp,
    [Op.Unpack]: unpackOp,
    [Op.Reverse]: reverseOp,
    [Op.Concat]: concatOp,
    [Op.Tail]: tailOp,
    [Op.DropHead]: tailOp,
    [Op.PushSymbolRef]: pushSymbolRefOp,
    [Op.Find]: findOp,
    [Op.Keys]: keysOp,
    [Op.Values]: valuesOp,
    [Op.Reserve]: reserveOp,
    [Op.InitVar]: initVarOp,
    [Op.VarRef]: varRefOp,
    [Op.DumpStackFrame]: dumpFrameOp,
    [Op.Ref]: refOp,
    [Op.Load]: loadOp,
  };

  const impl = OPCODE_TO_VERB[opcode];
  if (!impl) {
    throw new InvalidOpcodeError(opcode, vm.getStackData());
  }
  impl(vm);
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
  // Reserve local slots: advance RSP in CELLS. RP (bytes) remains a compatible view
  // via the `RP` accessor so external callers/tests that read `vm.RP` will see the
  // equivalent byte offset (RSP * CELL_SIZE).
  vm.RSP += slotCount;
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
  // Compute slot address using BPCells and convert to bytes at the boundary
  // Use CELL_SIZE instead of magic 4 for address computation
  const slotAddr = (vm.BPCells + slotNumber) * CELL_SIZE;

  if (isList(value)) {
    const headerAddr = rpushList(vm);
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
export function dumpFrameOp(vm: VM): void {
  console.log('\n=== STACK FRAME DUMP ===');
  // Prefer cell-based representation; include legacy byte values parenthetically for transition (Plan 26 Step 1.4)
  console.log(
    'BP(cells):', vm.BPCells,
  'BP(bytes):', vm.BPBytes,
    'RSP(cells):', vm.RSP,
    'RSP(bytes):', vm.RSP * CELL_SIZE,
    'SP(cells):', vm.SPCells,
    'SP(bytes):', vm.SP
  );

  if (vm.BP > 0) {
    const localCount = vm.symbolTable.getLocalCount();
    console.log('Local variable count:', localCount);

    for (let i = 0; i < localCount; i++) {
  const slotAddr = (vm.BPCells + i) * CELL_SIZE;
      const slotValue = vm.memory.readFloat32(SEG_RSTACK, slotAddr);
      const tag = getTag(slotValue);
      const { value } = fromTaggedValue(slotValue);
      console.log(`  Slot ${i} - tag: ${Tag[tag]}, value: ${value}`);

      if (tag === Tag.RSTACK_REF) {
  const targetAddr = value * CELL_SIZE;
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
