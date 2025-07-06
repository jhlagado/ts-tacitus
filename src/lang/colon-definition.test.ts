import { VM } from '../core/vm';
import { Interpreter } from './interpreter';

describe('Colon Definitions', () => {
  let vm: VM;
  let interpreter: Interpreter;

  beforeEach(() => {
    vm = new VM();
    interpreter = new Interpreter(vm);
  });

  test('should define and execute a simple word', () => {
    // Define a word that doubles a number
    interpreter.eval(': double 2 * ;');
    
    // Use the defined word
    interpreter.eval('5 double');
    
    // Check the result
    expect(vm.pop()).toBe(10);
  });

  test('should handle nested definitions', () => {
    // Define a word that squares a number
    interpreter.eval(': square dup * ;');
    
    // Define a word that doubles and then squares
    interpreter.eval(': double-square 2 * square ;');
    
    // Use the defined word
    interpreter.eval('3 double-square');
    
    // (3 * 2)² = 36
    expect(vm.pop()).toBe(36);
  });

  test('should handle multiple definitions', () => {
    // Define multiple words
    interpreter.eval(': double 2 * ; : triple 3 * ;');
    
    // Use the defined words
    interpreter.eval('5 double triple');
    
    // 5 * 2 * 3 = 30
    expect(vm.pop()).toBe(30);
  });

  test('should handle empty definitions', () => {
    expect(() => {
      interpreter.eval(': EMPTY ;');
    }).not.toThrow();
    
    // Using an empty word should be a no-op
    const before = vm.SP;
    interpreter.eval('EMPTY');
    expect(vm.SP).toBe(before);
  });

  test('should throw error for invalid word names', () => {
    // Try to define a word with a numeric name
    expect(() => {
      interpreter.eval(': 123 1 + ;');
    }).toThrow('Invalid word name');
  });
});
