import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { toTaggedValue, Tag } from '../core/tagged';

export const mNegateOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'm-' (neg) requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mNegateOp", a);
  vm.push(-a);
};

export const mReciprocalOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'm%' (recip) requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mReciprocalOp", a);
  vm.push(1 / a);
};

export const mFloorOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'm_' (floor) requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mFloorOp", a);
  vm.push(Math.floor(a));
};

export const mNotOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'm~' (not) requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mNotOp", a);
  vm.push(a === 0 ? 1 : 0);
};

export const mSignumOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'm*' (sign) requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mSignumOp", a);
  vm.push(a > 0 ? 1 : a < 0 ? -1 : 0);
};

export const mEnlistOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'm,' (enlist) requires 1 operand`);
  const a = vm.pop();
  if (vm.debug) console.log("mEnlistOp", a);

  // Create a single-element tuple
  // First push the tuple tag with size 1
  vm.push(toTaggedValue(1, Tag.TUPLE));
  // Then push the single element
  vm.push(a);
};
