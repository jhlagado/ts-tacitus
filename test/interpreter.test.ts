import { VM } from '../src/core/vm';
import { Interpreter } from '../src/lang/interpreter';

describe('Interpreter', () => {
  let vm: VM;
  let interpreter: Interpreter;

  beforeEach(() => {
    vm = new VM();
    interpreter = new Interpreter(vm);
  });

  describe('do loop', () => {
    it('should execute a block of code n times', () => {
      // Push initial value and loop count
      vm.push(0); // initial value
      vm.push(3); // loop count
      
      // Execute the do loop that adds 1 each iteration
      interpreter.eval('do { 1 + }');
      
      // After 3 iterations of adding 1, the final value should be 3
      expect(vm.pop()).toBe(3);
    });

    it('should handle nested loops', () => {
      // Push initial value and loop counts (outer first, then inner)
      vm.push(0); // initial value
      vm.push(2); // inner loop count
      vm.push(3); // outer loop count
      
      // Execute nested do loops that add 1 each iteration
      interpreter.eval('do { do { 1 + } }');
      
      // After 3 outer loops * 2 inner loops of adding 1, the final value should be 6
      expect(vm.pop()).toBe(6);
    });

    it('should handle zero iterations', () => {
      // Push initial value and 0 as the loop count
      vm.push(0); // initial value
      vm.push(0); // loop count
      
      // This should not execute the block
      interpreter.eval('do { 1 + }');
      
      // Initial value should remain on the stack
      expect(vm.pop()).toBe(0);
    });
  });
});
