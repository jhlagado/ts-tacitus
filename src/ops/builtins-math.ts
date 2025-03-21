import { VM } from "../core/vm";
import { Verb } from "../core/types";
import {} from "../core/memory";

export const plusOp: Verb = (vm: VM) => {
  if (vm.SP < 2) {
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
  if (vm.SP < 2) {
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
  if (vm.SP < 2) {
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
  if (vm.SP < 2) {
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

export const powerOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '^' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("powerOp", a, b);
  vm.push(a ** b);
};

export const modOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '!' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("modOp", a, b);
  vm.push(a % b);
};

export const minOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '&' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("minOp", a, b);
  vm.push(Math.min(a, b));
};

export const maxOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '|' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("maxOp", a, b);
  vm.push(Math.max(a, b));
};

export const equalOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '=' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("equalOp", a, b);
  vm.push(a === b ? 1 : 0);
};

export const lessThanOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '<' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("lessThanOp", a, b);
  vm.push(a < b ? 1 : 0);
};

export const greaterThanOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '>' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("greaterThanOp", a, b);
  vm.push(a > b ? 1 : 0);
};

export const matchOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '~' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("matchOp", a, b);
  // TODO: Implement deep equality check for complex types
  vm.push(a === b ? 1 : 0);
};
