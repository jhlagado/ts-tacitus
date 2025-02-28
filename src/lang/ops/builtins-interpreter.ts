import { VM } from "../../core/vm";
import { Verb } from "../../core/types";
import { toTaggedValue, Tag, fromTaggedValue } from "../../core/tagged-value";
import { formatValue } from "../../core/utils";

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
  vm.push(toTaggedValue(Tag.CODE, vm.IP));
  vm.IP += offset;
};

export const callOp: Verb = (vm: VM) => {
  const address = vm.next16();
  if (vm.debug) console.log("callOp", address);
  vm.rpush(toTaggedValue(Tag.CODE, vm.IP));
  vm.IP = address;
};

export const abortOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("abortOp");
  vm.running = false;
};

export const exitOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("exitOp");
  vm.IP = fromTaggedValue(Tag.CODE, vm.rpop()).value;
};

export const evalOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("evalOp");
  vm.rpush(toTaggedValue(Tag.CODE, vm.IP));
  const { value: pointer } = fromTaggedValue(Tag.CODE, vm.pop());
  vm.IP = pointer;
};

export const groupLeftOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("groupLeftOp");
  vm.rpush(vm.SP);
};

export const groupRightOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("groupRightOp");
  const sp0 = vm.rpop();
  const sp1 = vm.SP;
  const d = (sp1 - sp0) / 4;
  vm.push(d);
};

export const printOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("printOp");
  const d = vm.pop();
  console.log(formatValue(vm, d));
};
