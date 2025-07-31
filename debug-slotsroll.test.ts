import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from './src/core/vm';
import { slotsRoll } from './src/stack/slots';

describe('Debug slotsRoll', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('slotsRoll with correct indexing for swap', () => {
    // Set up stack: [10, 20, 30] (bottom to TOS)
    vm.push(10);
    vm.push(20);
    vm.push(30);
    
    console.log('Before slotsRoll:', vm.getStackData());
    
    // Stack layout: [10, 20, 30]
    // Slot indices:  0   1   2
    // To swap TOS and NOS (20 and 30), we need to roll slots 1 and 2
    slotsRoll(vm, 1, 2, 1);
    
    console.log('After slotsRoll(vm, 1, 2, 1):', vm.getStackData());
    
    const stack = vm.getStackData();
    
    // Expected: [10, 30, 20] - bottom unchanged, top two swapped
    expect(stack[0]).toBe(10);  // Bottom unchanged
    expect(stack[1]).toBe(30);  // Original TOS now NOS
    expect(stack[2]).toBe(20);  // Original NOS now TOS
  });
  
  test('trace slotsRoll step by step', () => {
    vm.push(10);
    vm.push(20);
    vm.push(30);
    
    console.log('Initial stack:', vm.getStackData());
    console.log('SP:', vm.SP, 'Stack length:', vm.getStackData().length);
    
    // Manually trace what slotsRoll(vm, 0, 2, 1) should do:
    // rangeSize = 2, shiftSlots = 1
    // normalizedShift = ((1 % 2) + 2) % 2 = 1  
    // splitPoint = 2 - 1 = 1
    // 1. slotsReverse(vm, 0, 1) - reverse slot 0 (single slot, no effect)
    // 2. slotsReverse(vm, 1, 1) - reverse slot 1 (single slot, no effect) 
    // 3. slotsReverse(vm, 0, 2) - reverse slots 0-1 (swap them)
    
    slotsRoll(vm, 0, 2, 1);
    console.log('Final stack:', vm.getStackData());
  });
});
