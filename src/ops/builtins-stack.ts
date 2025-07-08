import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { Tag, fromTaggedValue } from '../core/tagged';
import { SEG_STACK } from '../core/memory';
const BYTES_PER_ELEMENT = 4;

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);

  if (tag === Tag.LINK) {
    const elemCount = value + 1;
    const byteOffset = elemCount * BYTES_PER_ELEMENT;
    const startByte = vm.SP - byteOffset;

    for (let i = 0; i < elemCount; i++) {
      const val = vm.memory.readFloat32(SEG_STACK, startByte + i * BYTES_PER_ELEMENT);
      vm.push(val);
    }
  } else {
    vm.push(topValue);
  }
};

export const dropOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT) {
    throw new Error(
      `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const topValue = vm.pop();
  const { tag, value } = fromTaggedValue(topValue);

  if (tag === Tag.LINK) {
    const targetSP = vm.SP - value * BYTES_PER_ELEMENT;
    vm.SP = targetSP;
  }
};

export const swapOp: Verb = (vm: VM) => {
  const top = vm.pop();
  const second = vm.pop();

  vm.push(top);
  vm.push(second);
};

export const rotOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: 'rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }
  const c = vm.pop();
  const b = vm.pop();
  const a = vm.pop();
  vm.push(b);
  vm.push(c);
  vm.push(a);
};

export const negRotOp: Verb = (vm: VM) => {
  if (vm.SP < BYTES_PER_ELEMENT * 3) {
    throw new Error(
      `Stack underflow: '-rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }
  const c = vm.pop();
  const b = vm.pop();
  const a = vm.pop();
  vm.push(c);
  vm.push(a);
  vm.push(b);
};
