
import { Memory } from './src/core/memory';
import { Digest } from './src/strings/digest';
import { STACK_BASE, RSTACK_BASE, SEG_CODE } from './src/core/constants';
import { Tagged, Tag } from './src/core/tagged';
import { Op } from './src/ops/opcodes';
import { registerBuiltins } from './src/ops/builtins-register';
import { executeOp } from './src/ops/builtins';
import { createCompilerState } from './src/lang/compiler';

const memory = new Memory();
const digest = new Digest(memory);
const vm = {
  memory,
  IP: 0,
  running: true,
  sp: STACK_BASE,
  rsp: RSTACK_BASE,
  bp: RSTACK_BASE,
  gp: 0,
  digest,
  debug: false,
  listDepth: 0,
  localCount: 0,
  head: 0,
  currentDefinition: null,
  currentTokenizer: null,
  compiler: createCompilerState(),
};
registerBuiltins(vm);

// Test Op.Branch
console.log('Testing Op.Branch...');
vm.IP = 0;
// Opcode is passed to executeOp, arguments are in memory at IP (SEG_CODE)
// We want to simulate "Branch +5"
// 5 as Int16 is 0x0005. Little endian.
memory.write16(SEG_CODE, 0, 5);

executeOp(vm, Op.Branch);
// nextInt16 advances IP by 2 -> IP=2
// vm.IP += 5 -> IP=7
console.log(`Op.Branch: IP is ${vm.IP} (Expected 7)`);

// Test Op.IfFalseBranch
console.log('Testing Op.IfFalseBranch...');
vm.IP = 0;
memory.write16(SEG_CODE, 0, 10);
// Push 0 (false)
vm.memory.writeCell(vm.sp, 0);
vm.sp++; // Push increments SP

// Need to pop, so SP should be pointing to next empty slot.
// pop() does sp -= 1 then read.
// So if we pushed, sp is at STACK_BASE + 1.
// executeOp will pop.

executeOp(vm, Op.IfFalseBranch);
// nextInt16 advances IP by 2 -> IP=2
// Condition is 0 (false)
// vm.IP += 10 -> IP=12
console.log(`Op.IfFalseBranch: IP is ${vm.IP} (Expected 12)`);
