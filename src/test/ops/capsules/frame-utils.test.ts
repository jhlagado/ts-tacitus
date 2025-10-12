import { toTaggedValue, Tag } from '@src/core';
import { vm } from '@src/core/global-state';
import { freezeCapsule, readCapsuleLayout } from '@src/ops/capsules/frame-utils';
import { resetVM, pushTestList } from '@test/utils/vm-test-utils';

describe('capsule frame utilities', () => {
  beforeEach(() => {
    resetVM();
  });

  const setupLocals = () => {
    vm.rpush(0); // return address stub
    vm.rpush(0); // previous BP stub
    vm.BP = vm.RSP;
    vm.rpush(10);
    vm.rpush(20);
  };

  test('freezeCapsule handles zero locals', () => {
    vm.rpush(0);
    vm.rpush(0);
    vm.BP = vm.RSP; // no locals reserved

    freezeCapsule(vm, 777);

    expect(vm.getStackData()).toEqual([
      toTaggedValue(777, Tag.CODE),
      toTaggedValue(1, Tag.LIST),
    ]);
  });

  test('freezeCapsule pushes locals oldest to newest followed by code ref and header', () => {
    setupLocals();
    const entryAddr = 1234;
    freezeCapsule(vm, entryAddr);
    const stack = vm.getStackData();
    expect(stack).toEqual([
      10,
      20,
      toTaggedValue(entryAddr, Tag.CODE),
      toTaggedValue(3, Tag.LIST),
    ]);
  });

  test('readCapsuleLayout validates capsule header and returns layout info', () => {
    const codeRef = toTaggedValue(50, Tag.CODE);
    pushTestList(vm, [codeRef, toTaggedValue(1, Tag.NUMBER)]);
    const header = vm.peek();
    const layout = readCapsuleLayout(vm, header);
    expect(layout.slotCount).toBe(2);
    expect(layout.codeRef).toBe(codeRef);
    expect(layout.payloadStartAddr).toBe(0);
  });

  test('readCapsuleLayout rejects non-code slot0', () => {
    pushTestList(vm, [toTaggedValue(1, Tag.NUMBER), toTaggedValue(2, Tag.NUMBER)]);
    const header = vm.peek();
    expect(() => readCapsuleLayout(vm, header)).toThrow('CODE reference');
  });

  test('readCapsuleLayout rejects non-list values', () => {
    expect(() => readCapsuleLayout(vm, 42)).toThrow('capsule header');
  });
});
