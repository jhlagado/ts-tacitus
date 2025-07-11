import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { rangeRoll, reverseRange } from './rotate';

describe('rangeRoll', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should handle empty range', () => {
    // Push some values
    vm.push(1);
    const start = vm.SP / 4; // Convert to slot index
    
    // Roll 0 elements (should do nothing)
    rangeRoll(vm, start, 0, 1);
    
    expect(vm.pop()).toBe(1);
  });

  test('should handle zero shift', () => {
    // Push some values
    vm.push(1);
    vm.push(2);
    const start = vm.SP / 4 - 1; // Start at first element
    
    // Roll with 0 shift (should do nothing)
    rangeRoll(vm, start, 2, 0);
    
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(1);
  });

  test('should roll simple values right', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(4);

    // Roll all elements right by 1 position (1 slot)
    // [1, 2, 3, 4] -> [4, 1, 2, 3]
    rangeRoll(vm, 0, 4, 1);
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

    // Roll all elements left by 1 position
    // [1, 2, 3, 4] -> [2, 3, 4, 1]
    rangeRoll(vm, 0, 4, -1);
    expect(vm.pop()).toBe(1);
    expect(vm.pop()).toBe(4);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
  });

  test('should handle shift amounts larger than range size', () => {
    vm.push(1);
    vm.push(2);
    vm.push(3);

    // Roll by amount equal to range size (3 slots)
    // [1, 2, 3] -> [1, 2, 3] (no change)
    rangeRoll(vm, 0, 3, 3);
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
    // Push values 1, 2, 3, 4
    vm.push(1);
    vm.push(2);
    vm.push(3);
    vm.push(4);
    
    // Reverse the middle two elements [2, 3] -> [3, 2]
    // Start at index 1 (0-based) for the second element
    const start = 1;
    reverseRange(vm, start * 4, 2);
    
    // After reversing, the stack should be [1, 3, 2, 4] from bottom to top
    expect(vm.pop()).toBe(4);
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(1);
  });

  test('should handle empty range', () => {
    // Push a value
    vm.push(42);
    const start = 0; // First and only element
    
    // Reverse 0 elements (should do nothing)
    reverseRange(vm, start * 4, 0);
    
    expect(vm.pop()).toBe(42);
  });

  test('should handle single element range', () => {
    // Push values 1, 2, 3
    vm.push(1);
    vm.push(2);
    vm.push(3);
    
    // Reverse just the middle element (should do nothing)
    const start = 1; // Middle element at index 1
    reverseRange(vm, start * 4, 1);
    
    // Stack should be unchanged
    expect(vm.pop()).toBe(3);
    expect(vm.pop()).toBe(2);
    expect(vm.pop()).toBe(1);
  });
});
