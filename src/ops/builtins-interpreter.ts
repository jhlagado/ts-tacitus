import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { toTaggedValue, CoreTag, fromTaggedValue, isCode } from '../core/tagged';
import { formatValue } from '../core/utils';
import { vectorCreate } from '../heap/vector';
import { dictCreate } from '../heap/dict';

export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.nextFloat32();
  if (vm.debug) console.log('literalNumberOp', num);
  vm.push(num);
};

export const literalStringOp: Verb = (vm: VM) => {
  const address = vm.next16();
  if (vm.debug) console.log('literalStringOp', address);
  // Create tagged value for string address
  const taggedString = toTaggedValue(address, false, CoreTag.STRING);
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
  vm.push(toTaggedValue(vm.IP, false, CoreTag.CODE));
  vm.IP += offset;
};

export const callOp: Verb = (vm: VM) => {
  const callAddress = vm.next16(); // Get call address
  if (vm.debug) console.log('callOp', callAddress);

  // Save return address on return stack as a tagged value
  vm.rpush(toTaggedValue(vm.IP, false, CoreTag.CODE));

  // Save current BP on return stack (no need to tag BP)
  vm.rpush(vm.BP);

  // Update BP to point to current frame
  vm.BP = vm.RP;

  // Jump to function
  vm.IP = callAddress;
};

export const abortOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('abortOp');
  vm.running = false;
};

export const exitOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('exitOp');

  // Pop all locals to properly handle reference counting
  while (vm.RP > vm.BP) {
    vm.rpop(); // This will decrement ref counts as needed
  }

  // Now RP equals BP, pop the saved BP (not tagged)
  vm.BP = vm.rpop();

  // Return to caller, converting from tagged value
  vm.IP = fromTaggedValue(vm.rpop()).value;
};

export const evalOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('evalOp');

  // Pop the value to be evaluated
  const value = vm.pop();

  // Check if it's a code block
  if (isCode(value)) {
    // If it's code, execute it by:
    // 1. Pushing the current IP onto the return stack
    vm.rpush(toTaggedValue(vm.IP, false, CoreTag.CODE));

    // 2. Save current BP on return stack (just like callOp does)
    vm.rpush(vm.BP);

    // 3. Update BP to point to current frame
    vm.BP = vm.RP;

    // 4. Setting IP to the code block's address
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

export const vecLeftOp = (vm: VM) => {
  if (vm.debug) console.log('vecLeftOp');
  // Push the current stack pointer as marker
  vm.rpush(vm.SP);
};

export const vecRightOp = (vm: VM) => {
  if (vm.debug) console.log('vecRightOp');
  const marker = vm.rpop(); // what vecLeftOp saved
  const count = (vm.SP - marker) / 4; // Assume each stack item is 4 bytes.
  const array = vm.popArray(count, true);
  // Added logging for debugging NaN issues in vector construction
  for (let i = 0; i < array.length; i++) {
    const { tag, isHeap } = fromTaggedValue(array[i]);
    console.log(`vecRightOp debug: Element ${i}: tag=${tag}, isHeap=${isHeap}, value=${array[i]}`);
  }
  const tagVal = vectorCreate(vm.heap, array);
  vm.push(tagVal);
};

export const dictLeftOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('dictLeftOp');
  // Push the current stack pointer as marker
  vm.rpush(vm.SP);
};

export const dictRightOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('dictRightOp');
  const marker = vm.rpop(); // what dictLeftOp saved
  const count = (vm.SP - marker) / 4; // Assume each stack item is 4 bytes.

  if (count % 2 !== 0) {
    throw new Error(
      `Dictionary literal requires an even number of items (key-value pairs), got ${count}`
    );
  }

  const taggedArray = vm.popArray(count);
  const entries: (string | number)[] = [];
  for (let i = 0; i < taggedArray.length; i += 2) {
    const taggedKey = taggedArray[i];
    const taggedValue = taggedArray[i + 1];

    // Extract the key as a string
    const { tag: keyTag, isHeap: keyHeap, value: keyPtr } = fromTaggedValue(taggedKey);
    if (keyTag !== CoreTag.STRING || keyHeap) {
      // Ensure it's a non-heap string tag
      // Note: dictCreate also performs checks, but checking early is good.
      // We might need to adjust this check depending on what key types are truly allowed.
      throw new Error(`Dictionary key at index ${i} must be a string literal.`);
    }
    const keyString = vm.digest.get(keyPtr);
    console.log('keyString', keyString, taggedValue);
    entries.push(keyString);
    entries.push(taggedValue);
  }

  const tagVal = dictCreate(vm.digest, vm.heap, entries); // Pass the processed entries
  vm.push(tagVal);
};

export const printOp: Verb = (vm: VM) => {
  if (vm.debug) console.log('printOp');
  const d = vm.pop();
  console.log(formatValue(vm, d));
};
