/**
 * @file src/ops/builtins.ts
 * Central dispatcher for built-in operations. Maps opcodes to implementation functions.
 */
import { VM, Verb, toTaggedValue, fromTaggedValue, getTag, Tag, getVarRef, createDataRef, getByteAddressFromRef, isRef, SEG_DATA, RSTACK_BASE, CELL_SIZE, RSTACK_BASE_CELLS } from '@src/core';

import {
  literalNumberOp,
  skipDefOp,
  callOp,
  abortOp,
  exitOp,
  evalOp,
  literalStringOp,
  pushSymbolRefOp,
  endDefinitionOp,
  endIfOp,
  endDoOp,
  endWhenOp,
  endOfOp,
  endCaseOp,
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
import { openListOp, closeListOp } from './lists';
import {
  lengthOp,
  sizeOp,
  slotOp,
  elemOp,
  fetchOp,
  storeOp,
  findOp,
  loadOp,
  walkOp,
} from './lists';
import { makeListOp, packOp, unpackOp } from './lists';
import { refOp } from './lists';
import { headOp as _headOp, tailOp, reverseOp, concatOp } from './lists';
import {
  exitConstructorOp,
  exitDispatchOp,
  dispatchOp,
  endCapsuleOp,
} from './capsules/capsule-ops';

import { Op } from './opcodes';
import { InvalidOpcodeError } from '@src/core';

import { ifFalseBranchOp } from './control';
import { selectOp } from './access';
import { isList, rpushList } from './local-vars-transfer';
import { gpushOp, gpopOp, gpeekOp, gmarkOp, gsweepOp } from './heap';

// Temp register and related opcodes have been removed.

const nopOp: Verb = () => {};

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
    vm.rpush(vm.IP);
    // Save BP as relative cells
    vm.rpush(vm.bp - RSTACK_BASE_CELLS);
    vm.bp = vm.rsp;
    vm.IP = opcode;
    return;
  }

  const OPCODE_TO_VERB: Partial<Record<Op, Verb>> = {
    [Op.LiteralNumber]: literalNumberOp,
    [Op.Branch]: skipDefOp,
    [Op.Call]: callOp,
    [Op.Abort]: abortOp,
    [Op.Exit]: exitOp,
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
    [Op.IfFalseBranch]: ifFalseBranchOp,
    [Op.Select]: selectOp,
    [Op.MakeList]: makeListOp,
    [Op.LiteralAddress]: literalAddressOp,
    [Op.LiteralCode]: literalCodeOp,
    [Op.Nop]: nopOp,
    [Op.OpenList]: openListOp,
    [Op.CloseList]: closeListOp,
    [Op.Length]: lengthOp,
    [Op.Size]: sizeOp,
    [Op.Slot]: slotOp,
    [Op.Elem]: elemOp,
    [Op.Walk]: walkOp,
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
    [Op.GMark]: gmarkOp,
    [Op.GSweep]: gsweepOp,
    [Op.GPush]: gpushOp,
    [Op.GPop]: gpopOp,
    [Op.GPeek]: gpeekOp,
    [Op.EndDefinition]: endDefinitionOp,
    [Op.EndIf]: endIfOp,
    [Op.EndDo]: endDoOp,
    [Op.EndWhen]: endWhenOp,
    [Op.EndOf]: endOfOp,
    [Op.EndCase]: endCaseOp,
    [Op.EndCapsule]: endCapsuleOp,
    [Op.ExitConstructor]: exitConstructorOp,
    [Op.ExitDispatch]: exitDispatchOp,
    [Op.Dispatch]: dispatchOp,
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
  vm.rsp += slotCount;
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
  // Compute slot address using BP (cells) and convert to bytes at the boundary
  // Use CELL_SIZE instead of magic 4 for address computation
  const slotAddr = (vm.bp - RSTACK_BASE_CELLS + slotNumber) * CELL_SIZE;

  if (isList(value)) {
    const headerAddr = rpushList(vm);
    const headerCellIndex = headerAddr / CELL_SIZE;
    const absHeaderCellIndex = RSTACK_BASE / CELL_SIZE + headerCellIndex;
    const localRef = createDataRef(absHeaderCellIndex);

    vm.memory.writeFloat32(SEG_DATA, RSTACK_BASE + slotAddr, localRef);
  } else {
    const simpleValue = vm.pop();
    vm.memory.writeFloat32(SEG_DATA, RSTACK_BASE + slotAddr, simpleValue);
  }
}

export function varRefOp(vm: VM): void {
  const slotNumber = vm.nextInt16();
  vm.push(getVarRef(vm, slotNumber));
}

/**
 * Debug opcode to dump current stack frame state
 */
// (no longer using STACK_BASE_CELLS in debug dump)

export function dumpFrameOp(vm: VM): void {
  console.log('\n=== STACK FRAME DUMP ===');
  // Cell-based representation only (Plan 26 Phase 3 cleanup)
  console.log(
    'RSP(cells):',
    vm.rdepth(),
    'SP(cells):',
    vm.depth(),
    'BP(cells):',
    vm.bp - RSTACK_BASE_CELLS,
    'GP(cells):',
    vm.gp,
  );

  if (vm.bp > RSTACK_BASE_CELLS) {
    const localCount = vm.symbolTable.getLocalCount();
    console.log('Local variable count:', localCount);

    for (let i = 0; i < localCount; i++) {
      const slotAddr = (vm.bp - RSTACK_BASE_CELLS + i) * CELL_SIZE;
      const slotValue = vm.memory.readFloat32(SEG_DATA, RSTACK_BASE + slotAddr);
      const tag = getTag(slotValue);
      const { value } = fromTaggedValue(slotValue);
      console.log(`  Slot ${i} - tag: ${Tag[tag]}, value: ${value}`);

      if (isRef(slotValue)) {
        const absAddrBytes = getByteAddressFromRef(slotValue);
        const targetValue = vm.memory.readFloat32(SEG_DATA, absAddrBytes);
        const targetTag = getTag(targetValue);
        const { value: targetVal } = fromTaggedValue(targetValue);
        console.log(
          `    -> Points to absolute addr ${absAddrBytes / CELL_SIZE} (cells), tag: ${Tag[targetTag]}, value: ${targetVal}`,
        );
      }
    }
  } else {
    console.log('No active stack frame');
  }
  console.log('========================\n');
}
