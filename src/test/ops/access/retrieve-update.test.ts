import { describe, test, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../../core/globalState';
import { executeProgram } from '../../../lang/interpreter';

describe('retrieve/update ops (path-based)', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('retrieve from direct nested list', () => {
    // ((1 2)(3 4)) (0 0) retrieve => 1
    executeProgram('((1 2)(3 4)) (0 0) retrieve');
    const stack = vm.getStackData();
    expect(stack[stack.length - 1]).toBe(1);
  });

  test('retrieve from local variable value', () => {
    // x (0 1) retrieve => second element of first nested
    executeProgram(': f ((1 2)(3 4)) var x x (0 1) retrieve ; f');
    const stack = vm.getStackData();
    expect(stack[stack.length - 1]).toBe(2);
  });

  test('update simple element within local via &x', () => {
    // 100 &x (0 1) update => update second elem of first nested to 100
    executeProgram(': f ((1 2)(3 4)) var x 100 &x (0 1) update &x (0 1) retrieve ; f');
    const stack = vm.getStackData();
    expect(stack[stack.length - 1]).toBe(100);
  });

  test('update compound element within local via &y', () => {
    // Ensure compatibility: inner element is LIST:3 initially
    // y = (( (9 9 9) 8 )) ; path (0 0) addresses first element of first nested, which is LIST:3
    const program = `
      : f
        ( ( (9 9 9) 8 ) ) var y
        (1 2 3) &y (0 0) update
        &y (0 0) retrieve head
      ;
      f
    `;
    executeProgram(program);
    const stack = vm.getStackData();
    // Current in-place mutation order writes nearest-to-header with last copied element.
    // With stack order [3,2,1,header], head after update is 1.
    expect(stack[stack.length - 1]).toBe(1);
  });
});
