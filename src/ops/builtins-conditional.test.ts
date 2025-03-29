import { ifOp } from './builtins-conditional';
import { initializeInterpreter, vm } from '../core/globalState';
import { toTaggedValue, CoreTag } from '../core/tagged';
import { parse } from '../core/parser';
import { Tokenizer } from '../core/tokenizer';

describe('Conditional Operations', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('If Operation', () => {
    it('should select the then-branch when condition is truthy', () => {
      // Create code blocks
      parse(new Tokenizer('( 99 )')); // Parse else-branch
      const elseCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      parse(new Tokenizer('( 42 )')); // Parse then-branch
      const thenCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      // Setup: Push else-branch, then-branch, and true condition
      vm.push(elseCode); // else-branch code
      vm.push(thenCode); // then-branch code
      vm.push(1); // condition (true)

      // Execute the if operation
      ifOp(vm);

      // Verify it selected the then-branch
      expect(vm.getStackData().length).toBe(1);
      expect(vm.getStackData()[0]).toBe(thenCode);
    });

    it('should select the else-branch when condition is falsy', () => {
      // Create code blocks
      parse(new Tokenizer('( 99 )')); // Parse else-branch
      const elseCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      parse(new Tokenizer('( 42 )')); // Parse then-branch
      const thenCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      // Setup: Push else-branch, then-branch, and false condition
      vm.push(elseCode); // else-branch code
      vm.push(thenCode); // then-branch code
      vm.push(0); // condition (false)

      // Execute the if operation
      ifOp(vm);

      // Verify it selected the else-branch
      expect(vm.getStackData().length).toBe(1);
      expect(vm.getStackData()[0]).toBe(elseCode);
    });

    it('should throw on insufficient stack items', () => {
      // Only two items on the stack
      parse(new Tokenizer('( 42 )')); // Parse then-branch
      const thenCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      vm.push(thenCode);
      vm.push(1);

      expect(() => ifOp(vm)).toThrow(/Stack underflow/);
    });

    it('should throw when condition is not a number', () => {
      // Create code blocks
      parse(new Tokenizer('( 99 )')); // Parse else-branch
      const elseCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      parse(new Tokenizer('( 42 )')); // Parse then-branch
      const thenCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      // Setup with invalid condition type
      vm.push(elseCode);
      vm.push(thenCode);
      vm.push(toTaggedValue(123, false, CoreTag.STRING)); // String is not a valid condition

      expect(() => ifOp(vm)).toThrow(/condition must be a number/);
    });

    it('should throw when then-branch is not code', () => {
      // Create code block for else
      parse(new Tokenizer('( 99 )')); // Parse else-branch
      const elseCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      // Setup with invalid then-branch type
      vm.push(elseCode);
      vm.push(42); // Number is not a valid code block
      vm.push(1);

      expect(() => ifOp(vm)).toThrow(/then-branch must be code/);
    });

    it('should throw when else-branch is not code', () => {
      // Create code block for then
      parse(new Tokenizer('( 42 )')); // Parse then-branch
      const thenCode = toTaggedValue(vm.compiler.BP, false, CoreTag.CODE);

      // Setup with invalid else-branch type
      vm.push(99); // Number is not a valid code block
      vm.push(thenCode);
      vm.push(1);

      expect(() => ifOp(vm)).toThrow(/else-branch must be code/);
    });
  });
});
