import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { toTaggedValue, Tag } from '../core/tagged';

export const mNegateOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'neg' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mNegateOp", a);
  vm.push(-a);
};

export const mReciprocalOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'recip' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mReciprocalOp", a);
  vm.push(1 / a);
};

export const mFloorOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'floor' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mFloorOp", a);
  vm.push(Math.floor(a));
};

export const mNotOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'not' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mNotOp", a);
  vm.push(a === 0 ? 1 : 0);
};

export const mSignumOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'sign' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mSignumOp", a);
  if (a > 0) vm.push(1);
  else if (a < 0) vm.push(-1);
  else vm.push(0);
};

export const mEnlistOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'enlist' requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mEnlistOp", a);

  // Create a single-element tuple
  // First push the tuple tag with size 1
  vm.push(toTaggedValue(1, Tag.TUPLE));
  // Then push the single element
  vm.push(a);
};
