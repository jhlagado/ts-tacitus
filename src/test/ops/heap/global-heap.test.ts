import { beforeEach, describe, expect, test } from '@jest/globals';
import { initializeInterpreter, vm } from '../../../core/global-state';
import { gpushOp, gpopOp, gpeekOp, gmarkOp, gsweepOp } from '../../../ops/heap';
import { CELL_SIZE, GLOBAL_SIZE, GLOBAL_BASE, SEG_DATA, STACK_BASE } from '../../../core/constants';
import { isRef, decodeDataRef, createDataRef, getRefRegion } from '../../../core/refs';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('Global heap primitives', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('gpush copies simple value to heap and returns DATA_REF', () => {
    vm.push(42);

    gpushOp(vm);

    expect(vm.gp).toBe(1);
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(1);

    const ref = vm.peek();
    expect(isRef(ref)).toBe(true);
  expect(getRefRegion(ref)).toBe('global');
  const { absoluteCellIndex } = decodeDataRef(ref);
    const cellIndex = absoluteCellIndex - GLOBAL_BASE / CELL_SIZE;
    expect(cellIndex).toBe(0);
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE)).toBe(42);
  });

  test('gpush copies list payload and replaces stack value with DATA_REF', () => {
    vm.push(2);
    vm.push(1);
    vm.push(toTaggedValue(2, Tag.LIST));

    gpushOp(vm);

    expect(vm.gp).toBe(3);
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(1);

    const ref = vm.peek();
    expect(isRef(ref)).toBe(true);
  expect(getRefRegion(ref)).toBe('global');
  const { absoluteCellIndex } = decodeDataRef(ref);
    const cellIndex = absoluteCellIndex - GLOBAL_BASE / CELL_SIZE;
    const header = vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE);
    expect(header).toBe(toTaggedValue(2, Tag.LIST));
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + (cellIndex - 1) * CELL_SIZE)).toBe(1);
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + (cellIndex - 2) * CELL_SIZE)).toBe(2);
  });

  test('gpeek materialises list contents without altering heap', () => {
    vm.push(2);
    vm.push(1);
    vm.push(toTaggedValue(2, Tag.LIST));
    gpushOp(vm);

    gpeekOp(vm);

    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(1 + 3);
    const values = vm.getStackData();
    const ref = values[0];
    expect(isRef(ref)).toBe(true);
    expect(values.slice(1)).toEqual([2, 1, toTaggedValue(2, Tag.LIST)]);
    expect(vm.gp).toBe(3);
  });

  test('gpop rewinds heap to previous state', () => {
    vm.push(10);
    gpushOp(vm);
    const firstRef = vm.peek();

    vm.push(firstRef);
    gpushOp(vm);

    gpopOp(vm);

    expect(vm.gp).toBe(1);
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(1);
    expect(vm.peek()).toBe(firstRef);
  });

  test('gpop rewinds list payload spans', () => {
    vm.push(2);
    vm.push(1);
    vm.push(toTaggedValue(2, Tag.LIST));
    gpushOp(vm);

    expect(vm.gp).toBe(3);

    gpopOp(vm);

    expect(vm.gp).toBe(0);
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(0);
  });

  test('gmark + gsweep restore GP to saved mark', () => {
    vm.push(11);
    gpushOp(vm);
    gmarkOp(vm);
    const mark = vm.pop();

    vm.push(22);
    gpushOp(vm);
    expect(vm.gp).toBeGreaterThan(mark);

    vm.push(mark);
    gsweepOp(vm);

    expect(vm.gp).toBe(mark);
  });

  test('gpush follows nested DATA_REF handles', () => {
    vm.push(7);
    gpushOp(vm);
    const originalRef = vm.peek();
    const stackCellAbs = vm.sp - 1;
  const nestedRef = createDataRef(stackCellAbs);
    vm.push(nestedRef);

    gpushOp(vm);

    expect(vm.gp).toBe(2);
    const duplicateRef = vm.peek();
  const { absoluteCellIndex: originalAbs } = decodeDataRef(originalRef);
  const { absoluteCellIndex: duplicateAbs } = decodeDataRef(duplicateRef);
    const originalIndex = originalAbs - GLOBAL_BASE / CELL_SIZE;
    const duplicateIndex = duplicateAbs - GLOBAL_BASE / CELL_SIZE;
    expect(originalIndex).toBe(0);
    expect(duplicateIndex).toBe(1);
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + duplicateIndex * CELL_SIZE)).toBe(7);
  });

  test('gpeek rejects non-reference inputs', () => {
    vm.push(1);
    expect(() => gpeekOp(vm)).toThrow(/DATA_REF/);
  });

  test('gpeek rejects non-global references', () => {
    vm.push(5);
  const stackRef = createDataRef(vm.sp - 1);
    vm.push(stackRef);
    expect(() => gpeekOp(vm)).toThrow(/global heap reference/);
  });

  test('gpop throws on empty heap', () => {
  vm.push(createDataRef(GLOBAL_BASE / CELL_SIZE + 0));
    expect(() => gpopOp(vm)).toThrow(/empty heap/);
  });

  test('gpop rejects non-reference values', () => {
    vm.push(3);
    gpushOp(vm);
    vm.pop();
    vm.push(9);
    expect(() => gpopOp(vm)).toThrow(/DATA_REF/);
  });

  test('gpop requires reference to heap top', () => {
    vm.push(1);
    gpushOp(vm);
    vm.push(2);
    gpushOp(vm);
    const [olderRef] = vm.getStackData();
    vm.pop();
    vm.push(olderRef);
    expect(() => gpopOp(vm)).toThrow(/heap top/);
  });

  test('gpop rejects non-global references', () => {
    vm.push(4);
    gpushOp(vm);
  const stackRef = createDataRef(STACK_BASE / CELL_SIZE + 0);
    vm.pop();
    vm.push(stackRef);
    expect(() => gpopOp(vm)).toThrow(/global heap reference/);
  });

  test('gsweep rejects non-integer marks', () => {
    vm.push(0.5);
    expect(() => gsweepOp(vm)).toThrow(/integer heap mark/);
  });

  test('gsweep rejects out-of-range marks', () => {
    vm.push(-1);
    expect(() => gsweepOp(vm)).toThrow(/mark out of range/);
  });

  test('gsweep rejects marks above current heap top', () => {
    vm.push(1);
    expect(() => gsweepOp(vm)).toThrow(/mark out of range/);
  });

  test('gpush reports exhaustion when heap is full', () => {
    const capacity = GLOBAL_SIZE / CELL_SIZE;
    vm.gp = capacity;
    vm.push(123);
    expect(() => gpushOp(vm)).toThrow(/Global heap exhausted/);
  });
});
