import { Interpreter } from './interpreter';
import { vm, initializeInterpreter } from '../core/globalState';

describe('Interpreter', () => {
  let interpreter: Interpreter;

  beforeEach(() => {
    initializeInterpreter();
    // Clear the stack before each test
    while (vm.SP > 0) {
      vm.pop();
    }
    vm.debug = false;
    interpreter = new Interpreter(vm);
  });

  describe('Basic operations', () => {
    it('should execute simple addition', () => {
      interpreter.eval('2 3 +');
      const value = vm.pop();
      expect(value).toBe(5);
    });

    it('should execute simple subtraction', () => {
      interpreter.eval('5 3 -');
      const value = vm.pop();
      expect(value).toBe(2);
    });

    it('should execute simple multiplication', () => {
      interpreter.eval('2 3 *');
      const value = vm.pop();
      expect(value).toBe(6);
    });

    it('should execute simple division', () => {
      interpreter.eval('6 2 /');
      const value = vm.pop();
      expect(value).toBe(3);
    });

    it('should handle multiple operations', () => {
      interpreter.eval('2 3 + 4 *');
      const value = vm.pop();
      expect(value).toBe(20);
    });

    it('should handle dup', () => {
      interpreter.eval('5 dup');

      // Check stack values in reverse order (top to bottom)
      let value = vm.pop();
      expect(value).toBe(5);

      value = vm.pop();
      expect(value).toBe(5);
    });

    it('should handle drop', () => {
      // Test individually
      interpreter.eval('5');
      let value = vm.pop();
      expect(value).toBe(5);

      // Now test drop
      interpreter.eval('5');
      interpreter.eval('3');
      interpreter.eval('drop');

      value = vm.pop();
      expect(value).toBe(5);
    });

    it('should handle swap', () => {
      interpreter.eval('5');
      interpreter.eval('3');
      interpreter.eval('swap');

      // Pop values in reverse order to verify the stack order
      let value = vm.pop();
      expect(value).toBe(5);

      value = vm.pop();
      expect(value).toBe(3);
    });
  });

  describe('Advanced stack manipulation', () => {
    it('should handle over', () => {
      interpreter.eval('5');
      interpreter.eval('3');
      interpreter.eval('over');

      // Check stack values in reverse order (top to bottom)
      let value = vm.pop();
      expect(value).toBe(5);

      value = vm.pop();
      expect(value).toBe(3);

      value = vm.pop();
      expect(value).toBe(5);
    });

    it('should handle rot', () => {
      interpreter.eval('1');
      interpreter.eval('2');
      interpreter.eval('3');
      interpreter.eval('rot');

      // Check stack values in reverse order (top to bottom)
      let value = vm.pop();
      expect(value).toBe(1);

      value = vm.pop();
      expect(value).toBe(3);

      value = vm.pop();
      expect(value).toBe(2);
    });

    it('should handle multiple operations in sequence', () => {
      interpreter.eval('5 dup 3 + swap 2 *');

      // Check stack values in reverse order (top to bottom)
      let value = vm.pop();
      expect(value).toBe(10);

      value = vm.pop();
      expect(value).toBe(8);
    });
  });

  describe('Type handling', () => {
    it('should handle integers', () => {
      interpreter.eval('42');
      const value = vm.pop();
      expect(value).toBeCloseTo(42); // Raw float32 value
      expect(typeof value).toBe('number');
    });

    it('should handle floating point numbers', () => {
      interpreter.eval('3.14159');
      const value = vm.pop();
      expect(value).toBeCloseTo(3.14159);
    });

    it('should handle negative numbers', () => {
      interpreter.eval('-42');
      const value = vm.pop();
      expect(value).toBeCloseTo(-42);
    });
  });

  describe('Error handling', () => {
    it('should throw an error for unknown tokens', () => {
      expect(() => {
        interpreter.eval('nonexistent');
      }).toThrow('Unknown token: nonexistent');
    });

    it('should handle stack underflow gracefully', () => {
      expect(() => {
        interpreter.eval('drop');
      }).toThrow();
    });
  });

  describe('Symbol definition', () => {
    it('should allow defining and using custom symbols', () => {
      // Define a custom symbol that doubles a number
      interpreter.symbolTable.define('double', vm => {
        const value = vm.pop();
        // All numbers are raw float32 values now
        vm.push(value * 2);
      });

      // Use the custom symbol
      interpreter.eval('5 double');

      // Check the result
      const value = vm.pop();
      expect(value).toBe(10);
    });
  });
});
