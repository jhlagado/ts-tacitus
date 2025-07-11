import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { rangeRoll } from './ops-utils';

describe('rangeRoll', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should handle empty ranges', () => {
    // Setup
    vm.push(1);
    vm.push(2);
    const initialStack = [...vm.getStackData()];

    // Execute
    rangeRoll(vm, 0, 0, 1);

    // Verify
    expect(vm.getStackData()).toEqual(initialStack);
  });

  test('should handle zero shift amount', () => {
    // Setup
    vm.push(1);
    vm.push(2);
    vm.push(3);
    const initialStack = [...vm.getStackData()];

    // Execute
    rangeRoll(vm, 0, 3, 0);

    // Verify
    expect(vm.getStackData()).toEqual(initialStack);
  });

  test('should roll values right by one position', () => {
    // Setup - stack: [1, 2, 3, 4]
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(4);

    // Execute - Roll right by 1 position
    rangeRoll(vm, 0, 4, 1);

    // Verify - Should be [4, 1, 2, 3]
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(1);
    expect(vm.pop()).toBe(4);
  });

  test('should roll values left by one position', () => {
    // Setup - stack: [1, 2, 3, 4]
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(4);

    // Execute - Roll left by 1 position (same as right by 3 positions)
    rangeRoll(vm, 0, 4, -1);

    // Verify - Should be [2, 3, 4, 1]
    expect(vm.pop()).toBe(1);
    expect(vm.pop()).toBe(4);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
  });

  test('should handle shift amount larger than range size', () => {
    // Setup - stack: [1, 2, 3]
    vm.push(1);
    vm.push(2);
    vm.push(3);

    // Execute - Roll right by 5 positions (equivalent to rolling right by 2 positions)
    rangeRoll(vm, 0, 3, 5);

    // Verify - Should be [2, 3, 1]
    expect(vm.pop()).toBe(1);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
  });

  test('should handle negative shift amount larger than range size', () => {
    // Setup - stack: [1, 2, 3]
    vm.push(1);
    vm.push(2);
    vm.push(3);

    // Execute - Roll left by 4 positions (equivalent to rolling left by 1 position)
    rangeRoll(vm, 0, 3, -4);

    // Verify - Should be [2, 3, 1]
    expect(vm.pop()).toBe(1);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
  });
});
