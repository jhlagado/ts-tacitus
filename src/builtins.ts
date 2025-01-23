import { VM } from "./vm";
import { Verb } from "./types";
import { STACK } from "./memory";

export enum Op {
  LiteralNumber, //0
  BranchCall, //1
  Abort, //2
  Exit, //3
  Eval, //4
  Plus, //5
  Minus, //6
  Multiply, //7
  Divide, //8
  Dup, //9
  Drop, //10
  Swap, //11
}

export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.nextFloat(); // Read the 32-bit number
  if (vm.debug) console.log("literalNumberOp", num);
  vm.push(num); // Push the number onto the stack
};

/**
 * Branch call to a relative address in memory.
 * The offset is relative to the address after the branch instruction.
 * Puts return address on the data stack
 */
export const branchCallOp: Verb = (vm: VM) => {
  const offset = vm.next16(); // Read the relative offset
  if (vm.debug) console.log("branchCallOp", offset);
  vm.push(vm.IP); // Push the current IP
  vm.IP += offset;
};

export const abortOp: Verb = (vm: VM) => {
  vm.running = false;
};
export const exitOp: Verb = (vm: VM) => {
  vm.IP = vm.rpop();
};

export const evalOp: Verb = (vm: VM) => {
  vm.rpush(vm.IP);
  vm.IP = vm.pop();
};

export const plusOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 2) {
    throw new Error(
      `Stack underflow: '+' requires 2 operands (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error(
      `Expected numbers on the stack for '+' operation (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  vm.push(a + b);
};

export const minusOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 2) {
    throw new Error(
      `Stack underflow: '-' requires 2 operands (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error(
      `Expected numbers on the stack for '-' operation (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  vm.push(a - b);
};

export const multiplyOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 2) {
    throw new Error(
      `Stack underflow: '*' requires 2 operands (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error(
      `Expected numbers on the stack for '*' operation (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  vm.push(a * b);
};

export const divideOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 2) {
    throw new Error(
      `Stack underflow: '/' requires 2 operands (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error(
      `Expected numbers on the stack for '/' operation (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  if (b === 0) {
    throw new Error(
      `Division by zero (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  vm.push(a / b);
};

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  const a = vm.pop();
  vm.push(a);
  vm.push(a);
};

export const dropOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1) {
    throw new Error(
      `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  vm.pop();
};

export const swapOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 2) {
    throw new Error(
      `Stack underflow: 'swap' requires 2 operands (stack: ${JSON.stringify(
        vm.getStackData()
      )})`
    );
  }
  const a = vm.pop();
  const b = vm.pop();
  vm.push(a);
  vm.push(b);
};

export const builtins: Record<string, Verb> = {
  literalNumber: literalNumberOp,
  branch: branchCallOp,
  abort: abortOp,
  exit: exitOp,
  eval: evalOp,
  "+": plusOp,
  "-": minusOp,
  "*": multiplyOp,
  "/": divideOp,
  dup: dupOp,
  drop: dropOp,
  swap: swapOp,
};

export const opcodes: Record<string, number> = Object.keys(builtins).reduce(
  (acc, key, index) => {
    acc[key] = index;
    return acc;
  },
  {} as Record<string, number>
);

export const verbs: Verb[] = Object.values(builtins);
