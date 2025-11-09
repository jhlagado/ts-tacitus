import { beforeEach, describe, expect, test } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { gpushOp, gpopOp, gpeekOp, gmarkOp, gsweepOp } from '../../../ops/heap';
import { CELL_SIZE, GLOBAL_SIZE_CELLS, GLOBAL_BASE_BYTES, GLOBAL_BASE_CELLS, SEG_DATA, STACK_BASE_CELLS } from '../../../core/constants';
import { createRef } from '../../../core/refs';
import { toTaggedValue, Tag } from '../../../core/tagged';
import { push, pop, getStackData } from '../../../core/vm';

describe('Global heap primitives', () => {
  let vm: VM;
  let baseGp = 0;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
    baseGp = vm.gp;
  });

  test('gpush copies simple value to heap and leaves no result', () => {
    push(vm, 42);
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 1);
    expect(vm.sp - STACK_BASE_CELLS).toBe(0);
    const cellIndex = baseGp;
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE)).toBe(42);
  });

  test('gpush copies list payload and leaves no result', () => {
    push(vm, 2);
    push(vm, 1);
    push(vm, toTaggedValue(2, Tag.LIST));
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 3);
    expect(vm.sp - STACK_BASE_CELLS).toBe(0);
    const cellIndex = baseGp + 2; // header at baseGp+2 after pushing 2 values
    const header = vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + cellIndex * CELL_SIZE);
    expect(header).toBe(toTaggedValue(2, Tag.LIST));
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + (cellIndex - 1) * CELL_SIZE)).toBe(1);
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + (cellIndex - 2) * CELL_SIZE)).toBe(2);
  });

  test('gpeek materialises list contents without altering heap', () => {
    push(vm, 2);
    push(vm, 1);
    push(vm, toTaggedValue(2, Tag.LIST));
    gpushOp(vm);
    gpeekOp(vm);
    expect(vm.sp - STACK_BASE_CELLS).toBe(3);
    const values = getStackData(vm);
    expect(values).toEqual([2, 1, toTaggedValue(2, Tag.LIST)]);
    expect(vm.gp).toBe(baseGp + 3);
  });

  test('gpop rewinds heap to previous state', () => {
    push(vm, 10);
    gpushOp(vm);
    push(vm, 20);
    gpushOp(vm);
    gpopOp(vm);
    expect(vm.gp).toBe(baseGp + 1);
    expect(vm.sp - STACK_BASE_CELLS).toBe(0);
  });

  test('gpop rewinds list payload spans', () => {
    push(vm, 2);
    push(vm, 1);
    push(vm, toTaggedValue(2, Tag.LIST));
    gpushOp(vm);

    expect(vm.gp).toBe(baseGp + 3);

    gpopOp(vm);

    expect(vm.gp).toBe(baseGp);
    expect(vm.sp - STACK_BASE_CELLS).toBe(0);
  });

  test('gmark + gsweep restore GP to saved mark', () => {
    push(vm, 11);
    gpushOp(vm);
    gmarkOp(vm);
    const mark = pop(vm);

    push(vm, 22);
    gpushOp(vm);
    expect(vm.gp).toBeGreaterThan(mark);

    push(vm, mark);
    gsweepOp(vm);

    expect(vm.gp).toBe(mark);
  });

  test('gpush resolves REF of simple and copies the value', () => {
    push(vm, 7);
    gpushOp(vm);
    // Create a ref to the first heap cell on the stack and push it
    const nestedRef = createRef(GLOBAL_BASE_CELLS + baseGp);
    push(vm, nestedRef);
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 2);
    // The second heap cell stores the resolved simple value
    expect(vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE_BYTES + (baseGp + 1) * CELL_SIZE)).toBe(7);
  });

  test('gpeek rejects empty heap', () => {
    // Sweep to absolute 0 to simulate empty heap
    push(vm, 0);
    gsweepOp(vm);
    expect(() => gpeekOp(vm)).toThrow(/empty heap/);
  });

  test('gpop throws on empty heap', () => {
    push(vm, 0);
    gsweepOp(vm);
    expect(() => gpopOp(vm)).toThrow(/empty heap/);
  });

  // gpop no longer accepts input; reference validation tests removed

  test('gsweep rejects non-integer marks', () => {
    push(vm, 0.5);
    expect(() => gsweepOp(vm)).toThrow(/integer heap mark/);
  });

  test('gsweep rejects out-of-range marks', () => {
    push(vm, -1);
    expect(() => gsweepOp(vm)).toThrow(/mark out of range/);
  });

  test('gsweep rejects marks above current heap top', () => {
    push(vm, vm.gp + 1);
    expect(() => gsweepOp(vm)).toThrow(/mark out of range/);
  });

  test('gpush reports exhaustion when heap is full', () => {
    const capacity = GLOBAL_SIZE_CELLS;
    vm.gp = capacity;
    push(vm, 123);
    expect(() => gpushOp(vm)).toThrow(/Global heap exhausted/);
  });
});
