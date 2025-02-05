import { VM } from "../vm";
import { Verb } from "../types";
import { toTagNum, Tag, fromTagNum } from "../tagnum";

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
  vm.push(toTagNum(Tag.CODE, vm.IP));
  vm.IP += offset;
};

export const callOp: Verb = (vm: VM) => {
  const address = vm.next16();
  if (vm.debug) console.log("callOp", address);
  vm.rpush(toTagNum(Tag.CODE, vm.IP));
  vm.IP = address;
};

export const abortOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("abortOp");
  vm.running = false;
};

export const exitOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("exitOp");
  vm.IP = fromTagNum(Tag.CODE, vm.rpop()).value;
};

export const evalOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("evalOp");
  vm.rpush(toTagNum(Tag.CODE, vm.IP));
  const { value: pointer } = fromTagNum(Tag.CODE, vm.pop());
  vm.IP = pointer;
};
