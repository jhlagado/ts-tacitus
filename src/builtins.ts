import { VM } from "./vm";
import { Verb } from "./types";
import { STACK } from "./memory";

export enum Op {
  LiteralNumber, //0
  Branch, //1
  BranchCall, //2
  Call, //3
  Abort, //4
  Exit, //5
  Eval, //6
  Plus, //7
  Minus, //8
  Multiply, //9
  Divide, //10
  Dup, //11
  Drop, //12
  Swap, //13
}

export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.nextFloat();
  if (vm.debug) console.log("literalNumberOp", num);
  vm.push(num);
};

export const skipDefOp: Verb = (vm: VM) => {
  const offset = vm.next16();
  if (vm.debug) console.log("branchOp", offset);
  vm.IP += offset;
};

export const skipBlockOp: Verb = (vm: VM) => {
  const offset = vm.next16(); // Read the relative offset
  if (vm.debug) console.log("branchCallOp", offset);
  vm.pushAddress(vm.IP);
  vm.IP += offset;
};

export const callOp: Verb = (vm: VM) => {
  const address = vm.next16();
  if (vm.debug) console.log("callOp", address);
  vm.rpushAddress(vm.IP);
  vm.IP = address;
};

export const abortOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("abortOp");
  vm.running = false;
};

export const exitOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("exitOp");
  vm.IP = vm.rpopAddress();
};

export const evalOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("evalOp");
  vm.rpushAddress(vm.IP);
  vm.IP = vm.popAddress();
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
  if (vm.debug) console.log("plusOp", a, b);
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
  if (vm.debug) console.log("minusOp", a, b);
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
  if (vm.debug) console.log("multiplyOp", a, b);
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
  if (vm.debug) console.log("divideOp", a, b);
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
  if (vm.debug) console.log("dupOp", a);
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
  const a = vm.pop();
  if (vm.debug) console.log("dropOp", a);
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
  if (vm.debug) console.log("swapOp", a, b);
  vm.push(a);
  vm.push(b);
};
