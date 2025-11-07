import { VM } from '../../../../core';
import { toTaggedValue, Tag, isRef } from '../../../../core';
import { push, peek } from '../../../../core/vm';
import { refOp } from '../../../../ops/lists/query-ops';

describe('refOp coverage', () => {
  let vm: VM;
  beforeEach(() => {
    vm = new VM();
  });

  test('refOp pushes reference for LIST at TOS', () => {
    // Build a simple list (1 2) on the stack: payload then header
    push(vm, 1);
    push(vm, 2);
    push(vm, toTaggedValue(2, Tag.LIST));
    const spBefore = vm.sp;

    refOp(vm);

    expect(vm.sp).toBe(spBefore + 1);
    const top = peek(vm);
    expect(isRef(top)).toBe(true);
  });

  test('refOp no-op for non-LIST TOS', () => {
    push(vm, 42);
    const spBefore = vm.sp;

    refOp(vm);

    // No change to stack
    expect(vm.sp).toBe(spBefore);
    expect(peek(vm)).toBe(42);
  });
});
