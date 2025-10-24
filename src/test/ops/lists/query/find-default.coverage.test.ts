import { VM } from '@src/core';
import { toTaggedValue, Tag } from '@src/core';
import { findOp, fetchOp } from '@ops/lists/query-ops';
import { stringCreate } from '@src/strings';

/**
 * Coverage for findOp default branch: when key not present but 'default' key exists.
 */
describe('findOp default branch coverage', () => {
  let vm: VM;
  beforeEach(() => {
    vm = new VM();
  });

  test('find returns default value reference when key not found', () => {
    // Build a maplist: ('a' 1 'default' 99 'b' 2)
    const a = stringCreate(vm.digest, 'a');
    const def = stringCreate(vm.digest, 'default');
    const b = stringCreate(vm.digest, 'b');
    // Push payload in value-then-key order so keys appear directly under header
    vm.push(2);
    vm.push(b);
    vm.push(99);
    vm.push(def);
    vm.push(1);
    vm.push(a);
    vm.push(toTaggedValue(6, Tag.LIST));

    // Push missing key and perform find (find expects ( key target -- ref ))
    const missing = stringCreate(vm.digest, 'nope');
    vm.push(missing);
    // At this point, TOS is key and below is the LIST header; call find directly
    findOp(vm);

    // Result is a reference; fetch once to load the simple value (default is numeric)
    fetchOp(vm);
    const value = vm.pop();
    expect(value).toBe(99);
  });
});
