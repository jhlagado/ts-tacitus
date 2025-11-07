import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core';
import { STACK_BASE, CELL_SIZE } from '../../core/constants';
import { cellsRoll, cellsReverse } from '../../ops/stack';
import { push, pop } from '../../core/vm';

describe('rangeRoll', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should handle empty range', () => {
    push(vm, 1);
    const start = vm.sp - STACK_BASE / CELL_SIZE;

    cellsRoll(vm, start, 0, 1);

    expect(pop(vm)).toBe(1);
  });

  test('should handle zero shift', () => {
    push(vm, 1);
    push(vm, 2);
    const start = vm.sp - STACK_BASE / CELL_SIZE - 1;

    cellsRoll(vm, start, 2, 0);

    expect(pop(vm)).toBe(2);
    expect(pop(vm)).toBe(1);
  });

  test('should roll simple values right', () => {
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);
    push(vm, 4);

    cellsRoll(vm, 0, 4, 1);
    expect(pop(vm)).toBe(3);
    expect(pop(vm)).toBe(2);
    expect(pop(vm)).toBe(1);
    expect(pop(vm)).toBe(4);
  });

  test('should roll simple values left', () => {
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);
    push(vm, 4);

    cellsRoll(vm, 0, 4, -1);
    expect(pop(vm)).toBe(1);
    expect(pop(vm)).toBe(4);
    expect(pop(vm)).toBe(3);
    expect(pop(vm)).toBe(2);
  });

  test('should handle shift amounts larger than range size', () => {
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);

    cellsRoll(vm, 0, 3, 3);
    expect(pop(vm)).toBe(3);
    expect(pop(vm)).toBe(2);
    expect(pop(vm)).toBe(1);
  });
});

describe('reverseRange', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should reverse a range of elements', () => {
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);
    push(vm, 4);

    const start = 1;
    cellsReverse(vm, start, 2);

    expect(pop(vm)).toBe(4);
    expect(pop(vm)).toBe(2);
    expect(pop(vm)).toBe(3);
    expect(pop(vm)).toBe(1);
  });

  test('should handle empty range', () => {
    push(vm, 42);
    const start = 0;

    cellsReverse(vm, start, 0);

    expect(pop(vm)).toBe(42);
  });

  test('should handle single element range', () => {
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);

    const start = 1;
    cellsReverse(vm, start, 1);

    expect(pop(vm)).toBe(3);
    expect(pop(vm)).toBe(2);
    expect(pop(vm)).toBe(1);
  });
});
