/**
 * @file src/ops/builtins.ts
 * Central dispatcher for built-in operations. Maps opcodes to implementation functions.
 */
import {
  type VM,
  type Verb,
  toTaggedValue,
  fromTaggedValue,
  getTag,
  Tag,
  getVarRef,
  createRef,
  getCellFromRef,
  isRef,
  CELL_SIZE,
  RSTACK_BASE,
  InvalidOpcodeError,
  GLOBAL_BASE,
  GLOBAL_TOP,
  createGlobalRef,
  gpushList,
} from '@src/core';
import {
  nextUint16,
  nextInt16,
  rdepth,
  depth,
  push,
  pop,
  peek,
  rpush,
  ensureStackSize,
  getStackData,
} from '../core/vm';

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
  endWithOp,
  endMatchOp,
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
import { dupOp, dropOp, swapOp, rotOp, revrotOp, overOp, nipOp, tuckOp } from './stack';
import { printOp, rawPrintOp } from './print';
import {
  enlistOp,
  keysOp,
  valuesOp,
  openListOp,
  closeListOp,
  lengthOp,
  sizeOp,
  slotOp,
  elemOp,
  fetchOp,
  storeOp,
  findOp,
  loadOp,
  walkOp,
  makeListOp,
  packOp,
  unpackOp,
  refOp,
  headOp as _headOp,
  tailOp,
  reverseOp,
  concatOp,
} from './lists';
import {
  exitConstructorOp,
  exitDispatchOp,
  dispatchOp,
  endCapsuleOp,
} from './capsules/capsule-ops';

import { Op } from './opcodes';

import { ifFalseBranchOp } from './control';
import { selectOp } from './access';
import { isList, rpushList } from './local-vars-transfer';
import { gpushOp, gpopOp, gpeekOp } from './heap';
import {
  defineOp,
  lookupOp,
  markOp,
  forgetOp,
  dictFirstOnOp,
  dictFirstOffOp,
  dumpDictOp,
} from '@src/core/dictionary';

// Temp register and related opcodes have been removed.

const nopOp: Verb = () => {
  // No operation - intentionally empty
};

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
  const address = nextUint16(vm);
  const tagged = toTaggedValue(address, Tag.CODE, 1);
  push(vm, tagged);
}

export function executeOp(vm: VM, opcode: Op, isUserDefined = false): void {
  if (isUserDefined) {
    rpush(vm, vm.IP);
    // Save BP as relative cells
    rpush(vm, vm.bp - RSTACK_BASE);
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
    [Op.GlobalRef]: globalRefOp,
    [Op.InitGlobal]: initGlobalOp,
    [Op.DumpStackFrame]: dumpFrameOp,
    [Op.Ref]: refOp,
    [Op.Load]: loadOp,
    [Op.GPush]: gpushOp,
    [Op.GPop]: gpopOp,
    [Op.GPeek]: gpeekOp,
    [Op.Define]: defineOp,
    [Op.Lookup]: lookupOp,
    [Op.Mark]: markOp,
    [Op.Forget]: forgetOp,
    [Op.DictFirstOn]: dictFirstOnOp,
    [Op.DictFirstOff]: dictFirstOffOp,
    [Op.DumpDict]: dumpDictOp,
    [Op.EndDefinition]: endDefinitionOp,
    [Op.EndIf]: endIfOp,
    [Op.EndWith]: endWithOp,
    [Op.EndMatch]: endMatchOp,
    [Op.EndOf]: endOfOp,
    [Op.EndCase]: endCaseOp,
    [Op.EndCapsule]: endCapsuleOp,
    [Op.ExitConstructor]: exitConstructorOp,
    [Op.ExitDispatch]: exitDispatchOp,
    [Op.Dispatch]: dispatchOp,
  };

  const impl = OPCODE_TO_VERB[opcode];
  if (!impl) {
    throw new InvalidOpcodeError(opcode, getStackData(vm));
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
  const address = nextUint16(vm);
  push(vm, address);
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
  const slotCount = nextUint16(vm);
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
  const slotNumber = nextInt16(vm);
  ensureStackSize(vm, 1, 'InitVar');

  const value = peek(vm);
  const slotCellIndex = vm.bp + slotNumber;

  if (isList(value)) {
    const headerCell = rpushList(vm);
    const absHeaderCellIndex = RSTACK_BASE + headerCell;
    const localRef = createRef(absHeaderCellIndex);

    vm.memory.writeCell(slotCellIndex, localRef);
  } else {
    const simpleValue = pop(vm);
    vm.memory.writeCell(slotCellIndex, simpleValue);
  }
}

export function varRefOp(vm: VM): void {
  const slotNumber = nextInt16(vm);
  push(vm, getVarRef(vm, slotNumber));
}

/**
 * GlobalRef opcode: Pushes a REF to a global variable cell.
 * Stack: ( -- ref )
 * Reads 16-bit unsigned offset from bytecode.
 * Computes absolute cell index: GLOBAL_BASE + offset
 * Validates boundary: cellIndex >= GLOBAL_BASE && cellIndex < GLOBAL_TOP
 */
export function globalRefOp(vm: VM): void {
  const offset = nextUint16(vm);
  const cell = GLOBAL_BASE + offset;

  // Runtime boundary validation
  if (cell < GLOBAL_BASE || cell >= GLOBAL_TOP) {
    throw new Error(
      `GlobalRef: offset ${offset} results in cell index ${cell} outside global area [${GLOBAL_BASE}, ${GLOBAL_TOP})`,
    );
  }

  push(vm, createGlobalRef(offset));
}

/**
 * InitGlobal opcode: Initializes a global variable slot with value from stack.
 * Similar to InitVar for locals, but for globals.
 * Stack: ( value -- )
 * Reads 16-bit unsigned offset from bytecode.
 * Directly writes value to global cell (no Store opcode, no compatibility checks).
 */
export function initGlobalOp(vm: VM): void {
  const offset = nextUint16(vm);
  ensureStackSize(vm, 1, 'InitGlobal');

  const value = peek(vm);
  const cell = GLOBAL_BASE + offset;

  // Runtime boundary validation
  if (cell < GLOBAL_BASE || cell >= GLOBAL_TOP) {
    throw new Error(
      `InitGlobal: offset ${offset} results in cell index ${cell} outside global area [${GLOBAL_BASE}, ${GLOBAL_TOP})`,
    );
  }

  if (isList(value)) {
    // For compounds, copy to global heap and store REF
    // This matches InitVar's behavior for compounds
    const heapRef = gpushList(vm);
    vm.memory.writeCell(cell, heapRef);
  } else {
    const simpleValue = pop(vm);
    vm.memory.writeCell(cell, simpleValue);
  }
}

/**
 * Debug opcode to dump current stack frame state
 */
// (no longer using STACK_BASE in debug dump)

export function dumpFrameOp(vm: VM): void {
  // eslint-disable-next-line no-console
  console.log('\n=== STACK FRAME DUMP ===');
  // Cell-based representation only (Plan 26 Phase 3 cleanup)
  // eslint-disable-next-line no-console
  console.log(
    'RSP(cells):',
    rdepth(vm),
    'SP(cells):',
    depth(vm),
    'BP(cells):',
    vm.bp - RSTACK_BASE,
    'GP(cells):',
    vm.gp,
  );

  if (vm.bp > RSTACK_BASE) {
    const { localCount } = vm;
    // eslint-disable-next-line no-console
    console.log('Local variable count:', localCount);

    for (let i = 0; i < localCount; i++) {
      const slotValue = vm.memory.readCell(vm.bp + i);
      const tag = getTag(slotValue);
      const { value } = fromTaggedValue(slotValue);
      // eslint-disable-next-line no-console
      console.log(`  Slot ${i} - tag: ${Tag[tag]}, value: ${value}`);

      if (isRef(slotValue)) {
        const absCellIndex = getCellFromRef(slotValue);
        const targetValue = vm.memory.readCell(absCellIndex);
        const targetTag = getTag(targetValue);
        const { value: targetVal } = fromTaggedValue(targetValue);
        // eslint-disable-next-line no-console
        console.log(
          `    -> Points to absolute addr ${absCellIndex} (cells), tag: ${Tag[targetTag]}, value: ${targetVal}`,
        );
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('No active stack frame');
  }
  // eslint-disable-next-line no-console
  console.log('========================\n');
}
