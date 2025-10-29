import { beforeEach, describe, expect, test } from '@jest/globals';
import { initializeInterpreter, vm } from '../../../lang/runtime';
import { resetVM } from '../../utils/vm-test-utils';
import { gpushOp, gpopOp, gpeekOp, gmarkOp, gsweepOp } from '../../../ops/heap';
import { CELL_SIZE, GLOBAL_SIZE, GLOBAL_BASE, SEG_DATA, STACK_BASE } from '../../../core/constants';
import { createDataRef } from '../../../core/refs';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('Global heap primitives', () => {
  let baseGp = 0;
  beforeEach(() => {
    resetVM();
    vm.debug = false;
    baseGp = vm.gp;
  });

  test('gpush copies simple value to heap and leaves no result', () => {
    vm.push(42);
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 1);
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(0);
    const cellIndex = baseGp;
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE)).toBe(42);
  });

  test('gpush copies list payload and leaves no result', () => {
    vm.push(2);
    vm.push(1);
    vm.push(toTaggedValue(2, Tag.LIST));
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 3);
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(0);
    const cellIndex = baseGp + 2; // header at baseGp+2 after pushing 2 values
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
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(3);
    const values = vm.getStackData();
    expect(values).toEqual([2, 1, toTaggedValue(2, Tag.LIST)]);
    expect(vm.gp).toBe(baseGp + 3);
  });

  test('gpop rewinds heap to previous state', () => {
    vm.push(10);
    gpushOp(vm);
    vm.push(20);
    gpushOp(vm);
    gpopOp(vm);
    expect(vm.gp).toBe(baseGp + 1);
    expect(vm.sp - STACK_BASE / CELL_SIZE).toBe(0);
  });

  test('gpop rewinds list payload spans', () => {
    vm.push(2);
    vm.push(1);
    vm.push(toTaggedValue(2, Tag.LIST));
    gpushOp(vm);

    expect(vm.gp).toBe(baseGp + 3);

    gpopOp(vm);

    expect(vm.gp).toBe(baseGp);
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

  test('gpush resolves DATA_REF of simple and copies the value', () => {
    vm.push(7);
    gpushOp(vm);
    // Create a ref to the first heap cell on the stack and push it
    const nestedRef = createDataRef(GLOBAL_BASE / CELL_SIZE + baseGp);
    vm.push(nestedRef);
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 2);
    // The second heap cell stores the resolved simple value
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + (baseGp + 1) * CELL_SIZE)).toBe(7);
  });

  test('gpeek rejects empty heap', () => {
    // Sweep to absolute 0 to simulate empty heap
    vm.push(0);
    gsweepOp(vm);
    expect(() => gpeekOp(vm)).toThrow(/empty heap/);
  });

  test('gpop throws on empty heap', () => {
    vm.push(0);
    gsweepOp(vm);
    expect(() => gpopOp(vm)).toThrow(/empty heap/);
  });

  // gpop no longer accepts input; reference validation tests removed

  test('gsweep rejects non-integer marks', () => {
    vm.push(0.5);
    expect(() => gsweepOp(vm)).toThrow(/integer heap mark/);
  });

  test('gsweep rejects out-of-range marks', () => {
    vm.push(-1);
    expect(() => gsweepOp(vm)).toThrow(/mark out of range/);
  });

  test('gsweep rejects marks above current heap top', () => {
    vm.push(vm.gp + 1);
    expect(() => gsweepOp(vm)).toThrow(/mark out of range/);
  });

  test('gpush reports exhaustion when heap is full', () => {
    const capacity = GLOBAL_SIZE / CELL_SIZE;
    vm.gp = capacity;
    vm.push(123);
    expect(() => gpushOp(vm)).toThrow(/Global heap exhausted/);
  });
});
