/**
 * Tests for InitVar opcode implementation
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { initVarOp } from '../../../ops/builtins';
import { SEG_DATA, CELL_SIZE, RSTACK_BASE } from '../../../core/constants';
import { push, getStackData } from '../../../core/vm';

describe('InitVar Opcode', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  test('should store value in correct slot', () => {
    // Set up BP to simulate being inside a function
    // BP in tests previously used relative cells; vm.bp is absolute
    vm.bp = RSTACK_BASE + 6;

    // Push test value onto stack
    push(vm, 42);

    // Write slot number to bytecode
    vm.compiler.compile16(5); // slot 5

    // Execute initVarOp
    initVarOp(vm);

    // Verify value was stored in correct slot
    const storedValue = vm.memory.readCell(vm.bp + 5);
    expect(storedValue).toBe(42);

    // Verify stack is empty
    expect(getStackData(vm)).toEqual([]);
  });

  test('should handle slot 0', () => {
    vm.bp = RSTACK_BASE + 8;
    push(vm, 123);

    vm.compiler.compile16(0); // slot 0
    initVarOp(vm);

    const storedValue = vm.memory.readCell(vm.bp);
    expect(storedValue).toBe(123);
  });

  test('should handle negative values', () => {
    vm.bp = RSTACK_BASE + 10;
    push(vm, -99.5);

    vm.compiler.compile16(3); // slot 3
    initVarOp(vm);

    const storedValue = vm.memory.readCell(vm.bp + 3);
    expect(storedValue).toBe(-99.5);
  });

  test('should handle large slot numbers', () => {
    vm.bp = RSTACK_BASE + 12;
    push(vm, 777);

    vm.compiler.compile16(20); // large slot number within bounds
    initVarOp(vm);

    const storedValue = vm.memory.readCell(vm.bp + 20);
    expect(storedValue).toBe(777);
  });

  test('should handle floating point values', () => {
    vm.bp = RSTACK_BASE + 14;
    push(vm, 3.14159);

    vm.compiler.compile16(7); // slot 7
    initVarOp(vm);

    const storedValue = vm.memory.readCell(vm.bp + 7);
    expect(storedValue).toBeCloseTo(3.14159);
  });

  test('should throw on stack underflow', () => {
    vm.bp = RSTACK_BASE + 6;
    // Don't push anything to stack

    vm.compiler.compile16(1); // slot 1

    expect(() => initVarOp(vm)).toThrow('Stack underflow');
  });

  test('should handle multiple sequential initializations', () => {
    vm.bp = RSTACK_BASE + 16;

    // Initialize slot 0 with value 10
    push(vm, 10);
    vm.compiler.compile16(0);
    initVarOp(vm);

    // Initialize slot 1 with value 20
    push(vm, 20);
    vm.compiler.compile16(1);
    initVarOp(vm);

    // Initialize slot 2 with value 30
    push(vm, 30);
    vm.compiler.compile16(2);
    initVarOp(vm);

    // Verify all values stored correctly
    expect(vm.memory.readCell(vm.bp + 0)).toBe(10);
    expect(vm.memory.readCell(vm.bp + 1)).toBe(20);
    expect(vm.memory.readCell(vm.bp + 2)).toBe(30);

    // Stack should be empty
    expect(getStackData(vm)).toEqual([]);
  });

  test('should overwrite existing slot values', () => {
    vm.bp = RSTACK_BASE + 18;

    // Initialize slot 5 with first value
    push(vm, 100);
    vm.compiler.compile16(5);
    initVarOp(vm);

    // Overwrite slot 5 with new value
    push(vm, 200);
    vm.compiler.compile16(5);
    initVarOp(vm);

    // Should have new value
    const storedValue = vm.memory.readCell(vm.bp + 5);
    expect(storedValue).toBe(200);
  });
});
