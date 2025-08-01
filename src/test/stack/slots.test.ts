import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { slotsRoll, slotsReverse } from '../../stack/slots';

describe('rangeRoll', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should handle empty range', () => {
    vm.push(1);
    const start = vm.SP / 4;

    slotsRoll(vm, start, 0, 1);

    expect(vm.pop()).toBe(1);
  });

  test('should handle zero shift', () => {
    vm.push(1);
    vm.push(2);
    const start = vm.SP / 4 - 1;

    slotsRoll(vm, start, 2, 0);

    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(1);
  });

  test('should roll simple values right', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(4);

    slotsRoll(vm, 0, 4, 1);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(1);
    expect(vm.pop()).toBe(4);
  });

  test('should roll simple values left', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(4);

    slotsRoll(vm, 0, 4, -1);
    expect(vm.pop()).toBe(1);
    expect(vm.pop()).toBe(4);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
  });

  test('should handle shift amounts larger than range size', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);

    slotsRoll(vm, 0, 3, 3);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(1);
  });
});

describe('reverseRange', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should reverse a range of elements', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(4);

    const start = 1;
    slotsReverse(vm, start, 2);

    expect(vm.pop()).toBe(4);
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(1);
  });

  test('should handle empty range', () => {
    vm.push(42);
    const start = 0;

    slotsReverse(vm, start, 0);

    expect(vm.pop()).toBe(42);
  });

  test('should handle single element range', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);

    const start = 1;
    slotsReverse(vm, start, 1);

    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(1);
  });
});
