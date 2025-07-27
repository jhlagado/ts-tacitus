import { executeProgram } from '../../lang/interpreter';
import { initializeInterpreter, vm } from '../../core/globalState';
import { fromTaggedValue, Tag } from '../../core/tagged';

describe('Standalone Code Blocks', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('should parse and compile a standalone block', () => {
    const code = '{ 1 2 + }';

    // Should execute without errors
    expect(() => executeProgram(code)).not.toThrow();
  });

  it('should execute a standalone block and leave code reference on stack', () => {
    const code = '{ 1 2 + }';

    // Execute the code
    executeProgram(code);

    // Should have one item on stack - the code reference
    const stack = vm.getStackData();
    expect(stack.length).toBe(1);

    // Should be tagged as CODE
    const { tag, value } = fromTaggedValue(stack[0]);
    expect(tag).toBe(Tag.CODE);
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThan(0); // Should be a valid address
  });  it('should create different code references for different blocks', () => {
    const code = '{ 1 2 + } { 3 4 * }';

    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(2);

    // Both should be code references
    const { tag: tag1, value: addr1 } = fromTaggedValue(stack[0]);
    const { tag: tag2, value: addr2 } = fromTaggedValue(stack[1]);

    expect(tag1).toBe(Tag.CODE);
    expect(tag2).toBe(Tag.CODE);

    // Should be different addresses
    expect(addr1).not.toBe(addr2);
  });

  it('should handle empty blocks', () => {
    const code = '{ }';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);

    const { tag } = fromTaggedValue(stack[0]);
    expect(tag).toBe(Tag.CODE);
  });

  it('should handle nested blocks', () => {
    const code = '{ { 1 } { 2 } }';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);

    const { tag } = fromTaggedValue(stack[0]);
    expect(tag).toBe(Tag.CODE);
  });

  it('should actually execute code when called with eval', () => {
    const code = '{ 1 2 add } eval';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(3); // 1 + 2 = 3
  });

  it('should execute code blocks multiple times', () => {
    const code = '{ 5 6 mul } dup eval swap eval swap';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(2);
    expect(stack[0]).toBe(30); // 5 * 6 = 30
    expect(stack[1]).toBe(30); // Same block executed twice
  });

  // CAREFUL ANALYSIS TESTS FOR NaN ISSUE
  it('should handle simple block execution twice - separate blocks', () => {
    const code = '{ 3 } eval { 2 } eval add';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(5); // 3 + 2 = 5
  });

  it('should handle simple block execution twice - correct stack order', () => {
    const code = '{ 3 } { 2 } eval swap eval swap add';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(5); // 3 + 2 = 5
  });

  it('should handle simple block execution twice - dup eval eval', () => {
    const code = '{ 3 } dup eval swap eval add';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(6); // 3 + 3 = 6
  });

  it('should handle empty blocks when executed', () => {
    const code = '42 { } eval';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(42); // Empty block should not affect existing stack
  });

  it('should handle complex nested execution', () => {
    const code = '{ 10 { 3 4 add } eval mul } eval';
    executeProgram(code);

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(70); // 10 * (3 + 4) = 10 * 7 = 70
  });
});
