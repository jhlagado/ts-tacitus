import { execute, executeProgram } from '../../lang/interpreter';
import { vm, initializeInterpreter } from '../../core/globalState';
import * as math from '../../ops/builtins-math';
import { SEG_CODE } from '../../core/constants';

function expectStack(expected: number[]): void {
  expect(vm.getStackData()).toEqual(expected);
}

describe('Interpreter', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Basic operations', () => {
    test('should execute simple addition', () => {
      executeProgram('5 3 add');
      expectStack([8]);
    });
    test('should handle subtraction', () => {
      executeProgram('10 3 sub');
      expectStack([7]);
    });
    test('should handle multiplication', () => {
      executeProgram('5 3 mul');
      expectStack([15]);
    });
    test('should handle division', () => {
      executeProgram('15 3 div');
      expectStack([5]);
    });
  });

  describe('Stack operations', () => {
    test('should handle dup', () => {
      executeProgram('5 dup');
      expectStack([5, 5]);
    });
    test('should handle drop', () => {
      executeProgram('5 3 drop');
      expectStack([5]);
    });
    test('should handle swap', () => {
      executeProgram('5 3 swap');
      expectStack([3, 5]);
    });
    test('should handle complex stack operations', () => {
      executeProgram('1 2 3 drop swap dup');
      expectStack([2, 1, 1]);
    });
  });

  describe('Control flow', () => {
    test('should handle empty program', () => {
      executeProgram('');
      expectStack([]);
    });
  });

  describe('Code blocks', () => {});
  describe('Error handling', () => {
    test('should handle invalid opcodes', () => {
      vm.memory.write8(SEG_CODE, vm.compiler.BCP, 255);
      expect(() => execute(vm.compiler.BCP)).toThrow('Invalid opcode');
    });
    test('should handle non-Error exceptions', () => {
      jest.spyOn(math, 'addOp').mockImplementation(() => {
        throw 'Raw string error';
      });
      expect(() => executeProgram('5 3 add')).toThrow('Error executing word (stack: [5,3])');
      jest.restoreAllMocks();
    });
    test('should preserve stack state on error', () => {
      try {
        executeProgram('5 3 0 div add');
      } catch (_) {
        expect(vm.getStackData()).toEqual([5, 3, 0]);
      }
    });
    test('should skip definition body during normal execution', () => {
      executeProgram(`
        : double 2 mul ;
        5 double
      `);
      expectStack([10]);
    });
  });

  describe('Memory management', () => {
    test('should preserve memory when flag is set', () => {
      vm.compiler.preserve = true;
      executeProgram('5 3 add');
      expect(vm.compiler.BCP).toBe(vm.compiler.CP);
      expect(vm.compiler.preserve).toBe(false);
    });
    test('should reset memory when preserve is false', () => {
      const initialBCP = vm.compiler.BCP;
      executeProgram('5 3 add');
      expect(vm.compiler.CP).toBe(initialBCP);
    });
    test('should handle multiple preserve states', () => {
      executeProgram('5 3 add');
      const initialBCP = vm.compiler.BCP;
      vm.compiler.preserve = true;
      executeProgram('2 2 add');
      expect(vm.compiler.BCP).toBe(initialBCP + 12);
    });
  });

  describe('Colon definitions', () => {
    test('should execute simple colon definition', () => {
      executeProgram(`: square dup mul ;
      3 square`);
      expectStack([9]);
    });
    test('should handle multiple colon definitions', () => {
      executeProgram(`
        : square dup mul ;
        : cube dup square mul ;
        4 square
        3 cube
      `);
      expectStack([16, 27]);
    });
    test('should allow colon definitions to use other definitions', () => {
      executeProgram(`
        : double 2 mul ;
        : quadruple double double ;
        5 quadruple
      `);
      expectStack([20]);
    });
    test('should handle colon definitions with stack manipulation', () => {
      executeProgram(`
        : swap-and-add swap add ;
        3 7 swap-and-add
      `);
      expectStack([10]);
    });
    test('should handle colon definitions with code blocks', () => {
      executeProgram(`
        : double 2 mul ;
        5 double
      `);
      expectStack([10]);
    });
  });
});
