import { vm, initializeInterpreter } from '../core/globalState';
import { executeProgram } from '../lang/interpreter';
describe('Conditional Operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });
  describe('IF { ... }', () => {
    it('should execute then-branch when condition is true', () => {
      executeProgram('1 IF { 2 3 add }');
      expect(vm.getStackData()).toEqual([5]);
    });
    it('should not execute then-branch when condition is false', () => {
      executeProgram('0 IF { 2 3 add }');
      expect(vm.getStackData()).toEqual([]);
    });
    it('should handle nested IF statements', () => {
      executeProgram('1 IF { 2 0 IF { 3 } }');
      expect(vm.getStackData()).toEqual([2]);
    });
  });
  describe('IF { ... } ELSE { ... }', () => {
    it('should execute then-branch when condition is true', () => {
      executeProgram('1 IF { 10 } ELSE { 20 }');
      expect(vm.getStackData()).toEqual([10]);
    });
    it('should execute else-branch when condition is false', () => {
      executeProgram('0 IF { 10 } ELSE { 20 }');
      expect(vm.getStackData()).toEqual([20]);
    });
    it('should handle complex expressions in branches', () => {
      executeProgram('5 3 gt IF { 2 3 mul } ELSE { 2 3 add }');
      expect(vm.getStackData()).toEqual([6]);
    });
  });
  describe('Edge Cases', () => {
    it('should handle empty then-branch', () => {
      executeProgram('1 IF { }');
      expect(vm.getStackData()).toEqual([]);
    });
    it('should handle empty else-branch', () => {
      executeProgram('0 IF { 10 } ELSE { }');
      expect(vm.getStackData()).toEqual([]);
    });
    it('should handle multiple statements in branches', () => {
      executeProgram(`
        1 IF {
          2 3 mul
          4 5 mul
          add
        } ELSE {
          6 7 mul
        }
      `);
      expect(vm.getStackData()).toEqual([26]);
    });
  });
});
