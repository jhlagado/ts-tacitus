import { VM } from '@src/core';
import { toTaggedValue, Tag, isRef } from '@src/core';
import { refOp } from '@ops/lists/query-ops';

describe('refOp coverage', () => {
  let vm: VM;
  beforeEach(() => {
    vm = new VM();
  });

  test('refOp pushes reference for LIST at TOS', () => {
    // Build a simple list (1 2) on the stack: payload then header
    vm.push(1);
    vm.push(2);
    vm.push(toTaggedValue(2, Tag.LIST));
  const spBefore = vm.sp;

    refOp(vm);

  expect(vm.sp).toBe(spBefore + 1);
    const top = vm.peek();
    expect(isRef(top)).toBe(true);
  });

  test('refOp no-op for non-LIST TOS', () => {
    vm.push(42);
    const spBefore = vm.sp;

    refOp(vm);

    // No change to stack
  expect(vm.sp).toBe(spBefore);
    expect(vm.peek()).toBe(42);
  });
});
