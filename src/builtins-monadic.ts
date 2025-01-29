import { VM } from "./vm";
import { Verb } from "./types";
import { STACK } from "./memory";

export const mNegateOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1)
    throw new Error(`Stack underflow: 'm-' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mNegateOp", a);
  vm.push(-a);
};

export const mReciprocalOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1)
    throw new Error(`Stack underflow: 'm%' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mReciprocalOp", a);
  vm.push(1 / a);
};

export const mFloorOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1)
    throw new Error(`Stack underflow: 'm_' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mFloorOp", a);
  vm.push(Math.floor(a));
};

export const mNotOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1)
    throw new Error(`Stack underflow: 'm~' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mNotOp", a);
  vm.push(a === 0 ? 1 : 0);
};

export const mSignumOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1)
    throw new Error(`Stack underflow: 'm*' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mSignumOp", a);
  vm.push(a > 0 ? 1 : a < 0 ? -1 : 0);
};

export const mEnlistOp: Verb = (vm: VM) => {
  if (vm.SP < STACK + 1)
    throw new Error(`Stack underflow: 'm,' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mEnlistOp", a);
  // TODO: Implement proper list support
  // vm.push([a]); // Placeholder for list implementation
};
