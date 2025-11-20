import { beforeEach, describe, expect, test } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { gpushOp, gpopOp, gpeekOp, forgetOp } from '../../../ops/heap';
import {
  GLOBAL_SIZE,
  GLOBAL_BASE,
  STACK_BASE,
} from '../../../core/constants';
import { createRef } from '../../../core/refs';
import { Tagged, Tag } from '../../../core/tagged';
import { push, getStackData } from '../../../core/vm';
import { memoryReadCell } from '../../../core';

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
    expect(vm.sp - STACK_BASE).toBe(0);
    const cellIndex = baseGp;
    expect(memoryReadCell(vm.memory, GLOBAL_BASE + cellIndex)).toBe(42);
  });

  test('gpush copies list payload and leaves no result', () => {
    push(vm, 2);
    push(vm, 1);
    push(vm, Tagged(2, Tag.LIST));
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 3);
    expect(vm.sp - STACK_BASE).toBe(0);
    const cellIndex = baseGp + 2; // header at baseGp+2 after pushing 2 values
    const header = memoryReadCell(vm.memory, GLOBAL_BASE + cellIndex);
    expect(header).toBe(Tagged(2, Tag.LIST));
    expect(memoryReadCell(vm.memory, GLOBAL_BASE + cellIndex - 1)).toBe(1);
    expect(memoryReadCell(vm.memory, GLOBAL_BASE + cellIndex - 2)).toBe(2);
  });

  test('gpeek materialises list contents without altering heap', () => {
    push(vm, 2);
    push(vm, 1);
    push(vm, Tagged(2, Tag.LIST));
    gpushOp(vm);
    gpeekOp(vm);
    expect(vm.sp - STACK_BASE).toBe(3);
    const values = getStackData(vm);
    expect(values).toEqual([2, 1, Tagged(2, Tag.LIST)]);
    expect(vm.gp).toBe(baseGp + 3);
  });

  test('gpop rewinds heap to previous state', () => {
    push(vm, 10);
    gpushOp(vm);
    push(vm, 20);
    gpushOp(vm);
    gpopOp(vm);
    expect(vm.gp).toBe(baseGp + 1);
    expect(vm.sp - STACK_BASE).toBe(0);
  });

  test('gpop rewinds list payload spans', () => {
    push(vm, 2);
    push(vm, 1);
    push(vm, Tagged(2, Tag.LIST));
    gpushOp(vm);

    expect(vm.gp).toBe(baseGp + 3);

    gpopOp(vm);

    expect(vm.gp).toBe(baseGp);
    expect(vm.sp - STACK_BASE).toBe(0);
  });

  test('gpush resolves REF of simple and copies the value', () => {
    push(vm, 7);
    gpushOp(vm);
    // Create a ref to the first heap cell on the stack and push it
    const nestedRef = createRef(GLOBAL_BASE + baseGp);
    push(vm, nestedRef);
    gpushOp(vm);
    expect(vm.gp).toBe(baseGp + 2);
    // The second heap cell stores the resolved simple value
    expect(memoryReadCell(vm.memory, GLOBAL_BASE + baseGp + 1)).toBe(7);
  });

  test('gpush copies list referenced by REF handle', () => {
    // First, push a list to heap to create a REF to its header
    push(vm, 2);
    push(vm, 1);
    push(vm, Tagged(2, Tag.LIST));
    gpushOp(vm);
    const listHeaderCell = baseGp + 2; // header at gp-1 after push
    const listRef = createRef(GLOBAL_BASE + listHeaderCell);

    // Now push that REF and copy via gpushOp
    push(vm, listRef);
    gpushOp(vm);

    // Expect a duplicate list appended to heap (span size = 3)
    expect(vm.gp).toBe(baseGp + 6);
    expect(memoryReadCell(vm.memory, GLOBAL_BASE + baseGp + 5)).toBe(Tagged(2, Tag.LIST));
  });

  test('gpeek rejects empty heap', () => {
    // Set GP to 0 to simulate empty heap
    vm.gp = 0;
    expect(() => gpeekOp(vm)).toThrow(/empty heap/);
  });

  test('gpop throws on empty heap', () => {
    vm.gp = 0;
    expect(() => gpopOp(vm)).toThrow(/empty heap/);
  });

  test('forgetOp rejects non-REF and out-of-range marks', () => {
    push(vm, 123); // not a REF
    expect(() => forgetOp(vm)).toThrow(/expects REF/);

    // Push a valid ref but make it out of range
    const badRef = createRef(GLOBAL_BASE + vm.gp + 5);
    push(vm, badRef);
    expect(() => forgetOp(vm)).toThrow(/out of range|beyond current heap top/);
  });

  // gpop no longer accepts input; reference validation tests removed

  test('gpush reports exhaustion when heap is full', () => {
    const capacity = GLOBAL_SIZE;
    vm.gp = capacity;
    push(vm, 123);
    expect(() => gpushOp(vm)).toThrow(/Global heap exhausted/);
  });
});
