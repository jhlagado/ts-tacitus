import { VM } from '../../../../core';
import { toTaggedValue, Tag, NIL } from '../../../../core';
import { keysOp, valuesOp } from '../../../../ops/lists/query-ops';

describe('keysOp/valuesOp branch coverage', () => {
  let vm: VM;
  beforeEach(() => {
    vm = new VM();
  });

  test('keysOp on empty list returns empty list header', () => {
    vm.push(toTaggedValue(0, Tag.LIST));
    keysOp(vm);
    // After keysOp: should push original header then empty list header
    const top = vm.pop();
    expect(top).toBe(toTaggedValue(0, Tag.LIST));
  });

  test('valuesOp on empty list returns empty list header', () => {
    vm.push(toTaggedValue(0, Tag.LIST));
    valuesOp(vm);
    const top = vm.pop();
    expect(top).toBe(toTaggedValue(0, Tag.LIST));
  });

  test('keysOp on odd slotCount returns NIL', () => {
    // Build a 3-slot list payload on stack: a b c LIST:3
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(toTaggedValue(3, Tag.LIST));
    keysOp(vm);
    expect(vm.peek()).toBe(NIL);
  });

  test('valuesOp on odd slotCount returns NIL', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(toTaggedValue(3, Tag.LIST));
    valuesOp(vm);
    expect(vm.peek()).toBe(NIL);
  });
});
