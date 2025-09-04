import { initializeInterpreter, vm } from '../../core/globalState';
import { reverseSpan, getListElementAddress } from '../../core/list';
import { SEG_STACK } from '../../core/constants';
import { Tag, toTaggedValue } from '../../core/tagged';

describe('core/list additional coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('reverseSpan early return for spanSize <= 1', () => {
    // Should not throw on empty stack with spanSize 0 or 1
    expect(() => reverseSpan(vm, 0)).not.toThrow();
    expect(() => reverseSpan(vm, 1)).not.toThrow();
  });

  test('reverseSpan reverses last N values in place', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);
    reverseSpan(vm, 3);
    expect(vm.getStackData()).toEqual([3, 2, 1]);
  });

  test('getListElementAddress returns -1 for negative index', () => {
    const header = toTaggedValue(1, Tag.LIST);
    const addr = 100;
    expect(getListElementAddress(vm, header, addr, -1, SEG_STACK)).toBe(-1);
  });

  test('getListElementAddress computes correct addresses for flat list', () => {
    // Layout: e1, e2, e3, header (cells 5..8)
    const cellHeader = 8;
    const headerAddr = cellHeader * 4;
    const header = toTaggedValue(3, Tag.LIST);
    const e1 = toTaggedValue(11, Tag.NUMBER);
    const e2 = toTaggedValue(22, Tag.NUMBER);
    const e3 = toTaggedValue(33, Tag.NUMBER);

    vm.memory.writeFloat32(SEG_STACK, (cellHeader - 3) * 4, e1);
    vm.memory.writeFloat32(SEG_STACK, (cellHeader - 2) * 4, e2);
    vm.memory.writeFloat32(SEG_STACK, (cellHeader - 1) * 4, e3);
    vm.memory.writeFloat32(SEG_STACK, headerAddr, header);

    // Logical index 0 refers to nearest element (just below header)
    expect(getListElementAddress(vm, header, headerAddr, 0, SEG_STACK)).toBe(headerAddr - 4);
    expect(getListElementAddress(vm, header, headerAddr, 1, SEG_STACK)).toBe(headerAddr - 8);
    expect(getListElementAddress(vm, header, headerAddr, 2, SEG_STACK)).toBe(headerAddr - 12);
  });
});
