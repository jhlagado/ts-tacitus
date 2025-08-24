/**
 * Tests for InitVar opcode implementation
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { initVarOp } from '../../../ops/builtins';
import { SEG_RSTACK } from '../../../core/constants';

describe('InitVar Opcode', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('should store value in correct slot', () => {
    // Set up BP to simulate being inside a function
    vm.BP = 100;
    
    // Push test value onto stack
    vm.push(42);
    
    // Write slot number to bytecode
    vm.compiler.compile16(5); // slot 5
    
    // Execute initVarOp
    initVarOp(vm);
    
    // Verify value was stored in correct slot
    const expectedAddress = vm.BP + 5 * 4; // slot 5, 4 bytes per slot
    const storedValue = vm.memory.readFloat32(SEG_RSTACK, expectedAddress);
    expect(storedValue).toBe(42);
    
    // Verify stack is empty
    expect(vm.getStackData()).toEqual([]);
  });

  test('should handle slot 0', () => {
    vm.BP = 200;
    vm.push(123);
    
    vm.compiler.compile16(0); // slot 0
    initVarOp(vm);
    
    const storedValue = vm.memory.readFloat32(SEG_RSTACK, vm.BP);
    expect(storedValue).toBe(123);
  });

  test('should handle negative values', () => {
    vm.BP = 300;
    vm.push(-99.5);
    
    vm.compiler.compile16(3); // slot 3
    initVarOp(vm);
    
    const expectedAddress = vm.BP + 3 * 4;
    const storedValue = vm.memory.readFloat32(SEG_RSTACK, expectedAddress);
    expect(storedValue).toBe(-99.5);
  });

  test('should handle large slot numbers', () => {
    vm.BP = 400;
    vm.push(777);
    
    vm.compiler.compile16(1000); // large slot number
    initVarOp(vm);
    
    const expectedAddress = vm.BP + 1000 * 4;
    const storedValue = vm.memory.readFloat32(SEG_RSTACK, expectedAddress);
    expect(storedValue).toBe(777);
  });

  test('should handle floating point values', () => {
    vm.BP = 500;
    vm.push(3.14159);
    
    vm.compiler.compile16(7); // slot 7
    initVarOp(vm);
    
    const expectedAddress = vm.BP + 7 * 4;
    const storedValue = vm.memory.readFloat32(SEG_RSTACK, expectedAddress);
    expect(storedValue).toBeCloseTo(3.14159);
  });

  test('should throw on stack underflow', () => {
    vm.BP = 100;
    // Don't push anything to stack
    
    vm.compiler.compile16(1); // slot 1
    
    expect(() => initVarOp(vm)).toThrow('Stack underflow');
  });

  test('should handle multiple sequential initializations', () => {
    vm.BP = 600;
    
    // Initialize slot 0 with value 10
    vm.push(10);
    vm.compiler.compile16(0);
    initVarOp(vm);
    
    // Initialize slot 1 with value 20  
    vm.push(20);
    vm.compiler.compile16(1);
    initVarOp(vm);
    
    // Initialize slot 2 with value 30
    vm.push(30);
    vm.compiler.compile16(2);
    initVarOp(vm);
    
    // Verify all values stored correctly
    expect(vm.memory.readFloat32(SEG_RSTACK, vm.BP + 0 * 4)).toBe(10);
    expect(vm.memory.readFloat32(SEG_RSTACK, vm.BP + 1 * 4)).toBe(20);
    expect(vm.memory.readFloat32(SEG_RSTACK, vm.BP + 2 * 4)).toBe(30);
    
    // Stack should be empty
    expect(vm.getStackData()).toEqual([]);
  });

  test('should overwrite existing slot values', () => {
    vm.BP = 700;
    
    // Initialize slot 5 with first value
    vm.push(100);
    vm.compiler.compile16(5);
    initVarOp(vm);
    
    // Overwrite slot 5 with new value
    vm.push(200);
    vm.compiler.compile16(5);
    initVarOp(vm);
    
    // Should have new value
    const expectedAddress = vm.BP + 5 * 4;
    const storedValue = vm.memory.readFloat32(SEG_RSTACK, expectedAddress);
    expect(storedValue).toBe(200);
  });
});