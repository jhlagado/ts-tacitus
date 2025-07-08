import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { toTaggedValue, Tag, fromTaggedValue, isCode } from '../core/tagged';

import { formatValue } from '../core/utils';

const BYTES_PER_ELEMENT = 4;

export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.nextFloat32();

  vm.push(num);
};

export const literalStringOp: Verb = (vm: VM) => {
  const address = vm.next16();

  const taggedString = toTaggedValue(address, Tag.STRING);

  vm.push(taggedString);
};

export const skipDefOp: Verb = (vm: VM) => {
  const offset = vm.next16();

  vm.IP += offset;
};

export const skipBlockOp: Verb = (vm: VM) => {
  const offset = vm.next16();

  vm.push(toTaggedValue(vm.IP, Tag.CODE));
  vm.IP += offset;
};

export const callOp: Verb = (vm: VM) => {
  const callAddress = vm.next16();

  vm.rpush(toTaggedValue(vm.IP, Tag.CODE));

  vm.rpush(vm.BP);
  vm.BP = vm.RP;
  vm.IP = callAddress;
};

export const abortOp: Verb = (vm: VM) => {
  vm.running = false;
};

export const exitOp: Verb = (vm: VM) => {
  try {
    vm.RP = vm.BP;

    if (vm.RP > 0) {
      vm.BP = vm.rpop();
    }

    if (vm.RP > 0) {
      const returnAddr = vm.rpop();

      if (isCode(returnAddr)) {
        const { value: returnIP } = fromTaggedValue(returnAddr);

        vm.IP = returnIP;
      } else {
        vm.IP = Math.floor(returnAddr);
      }
    } else {
      vm.running = false;
    }
  } catch (e) {
    vm.running = false;
    throw e;
  }
};

export const evalOp: Verb = (vm: VM) => {
  const value = vm.pop();

  if (isCode(value)) {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));

    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    const { value: pointer } = fromTaggedValue(value);

    vm.IP = pointer;
  } else {
    vm.push(value);
  }
};

export const groupLeftOp: Verb = (vm: VM) => {
  vm.rpush(vm.SP);
};

export const groupRightOp: Verb = (vm: VM) => {
  const sp0 = vm.rpop();

  const sp1 = vm.SP;

  const d = (sp1 - sp0) / BYTES_PER_ELEMENT;

  vm.push(d);
};

export const printOp: Verb = (vm: VM) => {
  const d = vm.pop();

  console.log(formatValue(vm, d));
};
