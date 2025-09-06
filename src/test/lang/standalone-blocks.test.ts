import { executeProgram } from '../../lang/interpreter';
import { initializeInterpreter, vm } from '../../core/globalState';

describe('Standalone Code Blocks', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('should parse and compile a standalone block', () => {
    const code = '{ 1 2 add }';

    expect(() => executeProgram(code)).not.toThrow();
  });

  it('should actually execute code when called with eval', () => {
    const code = '{ 1 2 add } eval';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(3);
  });

  it('should execute code blocks multiple times', () => {
    const code = '{ 5 6 mul } dup eval swap eval swap';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(2);
    expect(stack[0]).toBe(30);
    expect(stack[1]).toBe(30);
  });

  it('should handle simple block execution twice - separate blocks', () => {
    const code = '{ 3 } eval { 2 } eval add';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(5);
  });

  it('should handle simple block execution twice - correct stack order', () => {
    const code = '{ 3 } { 2 } eval swap eval swap add';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(5);
  });

  it('should handle simple block execution twice - dup eval eval', () => {
    const code = '{ 3 } dup eval swap eval add';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(6);
  });

  it('should handle empty blocks when executed', () => {
    const code = '42 { } eval';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(42);
  });

  it('should handle complex nested execution', () => {
    const code = '{ 10 { 3 4 add } eval mul } eval';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(70);
  });
});
