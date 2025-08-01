import { executeProgram } from '../../lang/interpreter';
import { initializeInterpreter, vm } from '../../core/globalState';
import { Tag, fromTaggedValue } from '../../core/tagged';

describe('compileCodeBlock function', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('Basic Block Creation', () => {
    it('should create a code reference for empty blocks', () => {
      executeProgram('{ }');

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);

      const { tag } = fromTaggedValue(stack[0]);
      expect(tag).toBe(Tag.CODE);
    });

    it('should create a code reference for simple blocks', () => {
      executeProgram('{ 42 }');

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);

      const { tag } = fromTaggedValue(stack[0]);
      expect(tag).toBe(Tag.CODE);
    });

    it('should create multiple independent code references', () => {
      executeProgram('{ 1 } { 2 } { 3 }');

      const stack = vm.getStackData();
      expect(stack.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        const { tag } = fromTaggedValue(stack[i]);
        expect(tag).toBe(Tag.CODE);
      }
    });
  });

  describe('Block Execution', () => {
    it('should execute simple blocks with eval', () => {
      executeProgram('{ 10 20 add } eval');

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(30);
    });

    it('should execute empty blocks without error', () => {
      executeProgram('{ } eval');

      const stack = vm.getStackData();
      expect(stack.length).toBe(0);
    });

    it('should preserve stack state during block creation', () => {
      executeProgram('100 200 { 5 }');

      const stack = vm.getStackData();
      expect(stack.length).toBe(3);
      expect(stack[0]).toBe(100);
      expect(stack[1]).toBe(200);

      const { tag } = fromTaggedValue(stack[2]);
      expect(tag).toBe(Tag.CODE);
    });

    it('should execute nested blocks when evaluated', () => {
      executeProgram('{ { 10 20 add } eval } eval');

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(30);
    });
  });

  describe('Integration with Combinators', () => {
    it('should work with do combinator', () => {
      executeProgram('10 do { 5 add }');

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(15);
    });

    it('should work with repeat combinator', () => {
      executeProgram('0 3 repeat { 2 add }');

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(6);
    });
  });
});
