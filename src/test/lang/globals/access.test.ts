import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { executeTacitCode } from '../../utils/vm-test-utils';
import { Tag, getTaggedInfo } from '../../../core/tagged';

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
    const { tag: headerTag } = getTaggedInfo(header);
    expect(headerTag).toBe(Tag.LIST);
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
    const { tag: refTag } = getTaggedInfo(ref);
    expect(refTag).toBe(Tag.REF);
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

  test('should access global inside function', () => {
    executeTacitCode(vm, '42 global globalVar');
    const code = `
      : useGlobal
        globalVar
      ;
      useGlobal
    `;
    const stack = executeTacitCode(vm, code);
    expect(stack[stack.length - 1]).toBe(42);
  });

  test('should allow local variable to shadow global variable', () => {
    executeTacitCode(vm, '100 global x');
    const code = `
      : shadow
        200 var x
        x
      ;
      shadow
    `;
    const stack = executeTacitCode(vm, code);
    // Local x (200) should shadow global x (100)
    expect(stack[stack.length - 1]).toBe(200);
  });

  test('should access global when local is not defined', () => {
    executeTacitCode(vm, '42 global x');
    const code = `
      : useGlobal
        x
      ;
      useGlobal
    `;
    const stack = executeTacitCode(vm, code);
    // Should access global x since no local x exists
    expect(stack[stack.length - 1]).toBe(42);
  });

  test('should access global after local goes out of scope', () => {
    executeTacitCode(vm, '100 global x');
    const code = `
      : withLocal
        200 var x
        x
      ;
      withLocal
      x
    `;
    const stack = executeTacitCode(vm, code);
    // First call returns local (200), second access returns global (100)
    expect(stack[stack.length - 2]).toBe(200);
    expect(stack[stack.length - 1]).toBe(100);
  });
});
