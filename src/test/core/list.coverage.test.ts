import { initializeInterpreter, vm } from '../../core/global-state';
import { reverseSpan, getListElemAddrAbs, getListBoundsAbs, createDataRefAbs } from '../../core';
import { Tag, toTaggedValue, CELL_SIZE, SEG_DATA, STACK_BASE, GLOBAL_BASE } from '../../core';

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

  test('getListElemAddrAbs returns -1 for negative index', () => {
    const header = toTaggedValue(1, Tag.LIST);
    const headerAbsAddr = STACK_BASE + 100;
    expect(getListElemAddrAbs(vm, header, headerAbsAddr, -1)).toBe(-1);
  });

  test('getListElemAddrAbs computes correct addresses for flat list', () => {
    // Layout: e1, e2, e3, header (cells 5..8)
    const cellHeader = 8;
    const headerAddr = cellHeader * 4;
    const header = toTaggedValue(3, Tag.LIST);
    const e1 = toTaggedValue(11, Tag.NUMBER);
    const e2 = toTaggedValue(22, Tag.NUMBER);
    const e3 = toTaggedValue(33, Tag.NUMBER);

    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + (cellHeader - 3) * 4, e1);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + (cellHeader - 2) * 4, e2);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + (cellHeader - 1) * 4, e3);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + headerAddr, header);

    // Logical index 0 refers to nearest element (just below header)
    const headerAbsAddr = STACK_BASE + headerAddr;
    expect(getListElemAddrAbs(vm, header, headerAbsAddr, 0)).toBe(STACK_BASE + headerAddr - 4);
    expect(getListElemAddrAbs(vm, header, headerAbsAddr, 1)).toBe(STACK_BASE + headerAddr - 8);
    expect(getListElemAddrAbs(vm, header, headerAbsAddr, 2)).toBe(STACK_BASE + headerAddr - 12);
  });

  test('getListElemAddrAbs throws for non-list header', () => {
    expect(() => getListElemAddrAbs(vm, 42, STACK_BASE, 0)).toThrow(
      'Invalid LIST header provided to getListElemAddrAbs',
    );
  });

  test('getListBoundsAbs returns null for ref pointing to non-list', () => {
    const cellIndex = 10;
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE, 123.456);
    const absCellIndex = GLOBAL_BASE / CELL_SIZE + cellIndex;
    const ref = createDataRefAbs(absCellIndex);
    expect(getListBoundsAbs(vm, ref)).toBeNull();
  });

  test('getListBoundsAbs follows ref-to-ref indirection', () => {
    const baseIndex = 30;
    const headerIndex = baseIndex + 1;
    const header = toTaggedValue(1, Tag.LIST);
    vm.memory.writeFloat32(
      SEG_DATA,
      GLOBAL_BASE + baseIndex * CELL_SIZE,
      toTaggedValue(5, Tag.NUMBER),
    );
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + headerIndex * CELL_SIZE, header);

    const innerRefIndex = headerIndex + 1;
    const innerRef = createDataRefAbs(GLOBAL_BASE / CELL_SIZE + headerIndex);
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + innerRefIndex * CELL_SIZE, innerRef);

    const outerRef = createDataRefAbs(GLOBAL_BASE / CELL_SIZE + innerRefIndex);
    const bounds = getListBoundsAbs(vm, outerRef);
    expect(bounds).not.toBeNull();
    expect(bounds?.header).toBe(header);
    expect(bounds?.absBaseAddrBytes).toBe(GLOBAL_BASE + baseIndex * CELL_SIZE);
  });

  test('getListElemAddrAbs traverses GLOBAL list via unified read', () => {
    const baseIndex = 50;
    const slotCount = 2;
    const headerIndex = baseIndex + slotCount;
    const header = toTaggedValue(slotCount, Tag.LIST);
    // Write payload and header into GLOBAL window
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + (baseIndex + 0) * CELL_SIZE, 111);
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + (baseIndex + 1) * CELL_SIZE, 222);
    vm.memory.writeFloat32(SEG_DATA, GLOBAL_BASE + headerIndex * CELL_SIZE, header);

    const headerAbsAddr = GLOBAL_BASE + headerIndex * CELL_SIZE;
    // Element 0 is just below header (absolute)
    const addr0 = getListElemAddrAbs(vm, header, headerAbsAddr, 0);
    expect(addr0).toBe(headerAbsAddr - CELL_SIZE);
  });
});
