import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { toTaggedValue, Tag, fromTaggedValue, isCode } from '../core/tagged';
import { formatValue } from '../core/utils';

export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.nextFloat32();
  if (vm.debug) console.log('literalNumberOp', num);
  vm.push(num);
};

export const literalStringOp: Verb = (vm: VM) => {
  const address = vm.next16();
  if (vm.debug) console.log('literalStringOp', address);
  // Create tagged value for string address
  const taggedString = toTaggedValue(address, Tag.STRING);
  vm.push(taggedString);
};

export const skipDefOp: Verb = (vm: VM) => {
  const offset = vm.next16();
  if (vm.debug) console.log('branchOp', offset);
  vm.IP += offset;
};

export const skipBlockOp: Verb = (vm: VM) => {
  const offset = vm.next16();
  if (vm.debug) console.log('branchCallOp', offset);
  vm.push(toTaggedValue(vm.IP, Tag.CODE));
  vm.IP += offset;
};

export const callOp: Verb = (vm: VM) => {
  const callAddress = vm.next16(); // Get call address
  if (vm.debug) console.log('callOp', callAddress);

  // Save return address on return stack as a tagged value
  vm.rpush(toTaggedValue(vm.IP, Tag.CODE));

  // Jump to function
  vm.IP = callAddress;
};

export const abortOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('abortOp');
  vm.running = false;
};

export const exitOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('exitOp');

  try {
    // Return to caller, expecting a tagged return address
    if (vm.RP > 0) {
      const returnAddr = vm.rpop();
      
      // Check if the value appears to be a tagged pointer
      if (isCode(returnAddr)) {
        const { value: returnIP } = fromTaggedValue(returnAddr);
        vm.IP = returnIP;
      } else {
        // If it's not tagged as code, just use the value directly
        // This provides backwards compatibility with tests that might
        // push raw addresses onto the return stack
        vm.IP = Math.floor(returnAddr);
      }
    } else {
      // We're at the bottom of the call stack
      vm.running = false;
    }
  } catch (e) {
    // If any error occurs during exitOp, we need to stop the VM
    // to avoid an infinite loop
    vm.running = false;
    throw e;
  }
};

export const evalOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('evalOp');

  // Pop the value to be evaluated
  const value = vm.pop();

  // Check if it's a code block
  if (isCode(value)) {
    // If it's code, execute it by:
    // 1. Pushing the current IP onto the return stack
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));

    // 2. Setting IP to the code block's address
    const { value: pointer } = fromTaggedValue(value);
    vm.IP = pointer;
  } else {
    // If it's a regular value, just push it back onto the stack
    vm.push(value);
  }
};

export const groupLeftOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('groupLeftOp');
  vm.rpush(vm.SP);
};

export const groupRightOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('groupRightOp');
  const sp0 = vm.rpop();
  const sp1 = vm.SP;
  const d = (sp1 - sp0) / 4;
  vm.push(d);
};

export const printOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('printOp');
  const d = vm.pop();
  console.log(formatValue(vm, d));
};
