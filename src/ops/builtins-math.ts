import { VM } from '../core/vm';
import { Verb } from '../core/types';
import {} from '../core/memory';
export const addOp: Verb = (vm: VM) => {
  if (vm.SP < 2) {
    throw new Error(
      `Stack underflow: 'add' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a + b);
};
export const subtractOp: Verb = (vm: VM) => {
  if (vm.SP < 2) {
    throw new Error(
      `Stack underflow: '-' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a - b);
};
export const multiplyOp: Verb = (vm: VM) => {
  if (vm.SP < 2) {
    throw new Error(
      `Stack underflow: '*' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a * b);
};
export const divideOp: Verb = (vm: VM) => {
  if (vm.SP < 2) {
    throw new Error(
      `Stack underflow: '/' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a / b);
};
export const powerOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '^' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a ** b);
};
export const modOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '!' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a % b);
};
export const minOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '&' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.min(a, b));
};
export const maxOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: '|' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.max(a, b));
};
export const equalOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: 'eq' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a === b ? 1 : 0);
};
export const lessThanOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: 'lt' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a < b ? 1 : 0);
};
export const lessOrEqualOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: 'le' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a <= b ? 1 : 0);
};
export const greaterThanOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: 'gt' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a > b ? 1 : 0);
};
export const greaterOrEqualOp: Verb = (vm: VM) => {
  if (vm.SP < 2) throw new Error(`Stack underflow: 'ge' requires 2 operands`);
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a >= b ? 1 : 0);
};
