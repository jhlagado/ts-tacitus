import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { Tag, getTag } from '../../../core/tagged';

describe('Global Variable Access', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should read simple global value', () => {
    executeTacitCode(vm, '42 global x');
    const stack = executeTacitCode(vm, 'x');
    expect(stack[stack.length - 1]).toBe(42);
  });

  test('should read compound global value', () => {
    executeTacitCode(vm, '(1 2 3) global myList');
    const stack = executeTacitCode(vm, 'myList');
    // Should materialize the list
    const header = stack[stack.length - 1];
    expect(getTag(header)).toBe(Tag.LIST);
  });

  test('should get address-of global with &', () => {
    executeTacitCode(vm, '42 global x');
    const stack = executeTacitCode(vm, '&x');
    // For simple values, Fetch returns the value (not a REF to the cell)
    // For compounds, Fetch returns the REF stored in the cell
    expect(stack[stack.length - 1]).toBe(42);
  });

  test('should get address-of compound global with &', () => {
    executeTacitCode(vm, '(1 2 3) global myList');
    const stack = executeTacitCode(vm, '&myList');
    // For compounds, the cell contains a REF, so Fetch returns that REF
    const ref = stack[stack.length - 1];
    expect(getTag(ref)).toBe(Tag.REF);
  });

  test('should access global inside function', () => {
    executeTacitCode(vm, '100 global counter');
    const code = `
      : increment
        counter 1 add -> counter
      ;
      increment
      counter
    `;
    const stack = executeTacitCode(vm, code);
    expect(stack[stack.length - 1]).toBe(101);
  });

  test('should allow shadowing - global overrides builtin', () => {
    executeTacitCode(vm, '999 global add');
    const stack = executeTacitCode(vm, 'add');
    expect(stack[stack.length - 1]).toBe(999);
  });

  test('should allow redefinition', () => {
    executeTacitCode(vm, '10 global x');
    executeTacitCode(vm, '20 global x');
    const stack = executeTacitCode(vm, 'x');
    expect(stack[stack.length - 1]).toBe(20);
  });
});
