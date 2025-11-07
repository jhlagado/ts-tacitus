import { VM } from '../../../../core';
import { toTaggedValue, Tag } from '../../../../core';
import { push, pop } from '../../../../core/vm';
import { findOp, fetchOp } from '../../../../ops/lists/query-ops';
import { stringCreate } from '../../../../strings';

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
    push(vm, 2);
    push(vm, b);
    push(vm, 99);
    push(vm, def);
    push(vm, 1);
    push(vm, a);
    push(vm, toTaggedValue(6, Tag.LIST));

    // Push missing key and perform find (find expects ( key target -- ref ))
    const missing = stringCreate(vm.digest, 'nope');
    push(vm, missing);
    // At this point, TOS is key and below is the LIST header; call find directly
    findOp(vm);

    // Result is a reference; fetch once to load the simple value (default is numeric)
    fetchOp(vm);
    const value = pop(vm);
    expect(value).toBe(99);
  });
});
