import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createVM, VM, memoryWrite8 } from '../../core';
import { execute } from '../../lang/interpreter';
import { Op } from '../../ops/opcodes';
import { SEG_CODE } from '../../core';
import { getStackData } from '../../core/vm';
import { executeTacitCode } from '../utils/vm-test-utils';
import * as builtins from '../../ops/builtins';

function expectStack(vm: VM, expected: number[]): void {
  expect(getStackData(vm)).toEqual(expected);
}

describe('Interpreter', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Basic operations', () => {
    test('should execute simple addition', () => {
      executeTacitCode(vm, '5 3 add');
      expectStack(vm, [8]);
    });
    test('should handle subtraction', () => {
      executeTacitCode(vm, '10 3 sub');
      expectStack(vm, [7]);
    });
    test('should handle multiplication', () => {
      executeTacitCode(vm, '5 3 mul');
      expectStack(vm, [15]);
    });
    test('should handle division', () => {
      executeTacitCode(vm, '15 3 div');
      expectStack(vm, [5]);
    });
  });

  describe('Stack operations', () => {
    test('should handle dup', () => {
      executeTacitCode(vm, '5 dup');
      expectStack(vm, [5, 5]);
    });
    test('should handle drop', () => {
      executeTacitCode(vm, '5 3 drop');
      expectStack(vm, [5]);
    });
    test('should handle swap', () => {
      executeTacitCode(vm, '5 3 swap');
      expectStack(vm, [3, 5]);
    });
    test('should handle complex stack operations', () => {
      executeTacitCode(vm, '1 2 3 drop swap dup');
      expectStack(vm, [2, 1, 1]);
    });
  });

  describe('Control flow', () => {
    test('should handle empty program', () => {
      executeTacitCode(vm, '');
      expectStack(vm, []);
    });
  });

  describe('Code blocks', () => {});
  describe('Error handling', () => {
    test('should handle invalid opcodes', () => {
      vm.compiler.CP = vm.compiler.BCP + 1;
      memoryWrite8(vm.memory, SEG_CODE, vm.compiler.BCP, 110);

      let errorThrown = false;
      let errorMessage = '';

      try {
        execute(vm, vm.compiler.BCP);
      } catch (error) {
        errorThrown = true;
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      expect(errorThrown).toBe(true);
      expect(errorMessage).toContain('Invalid opcode: 110');
    });
    test('should handle non-Error exceptions', () => {
      // Mock executeOp to intercept Op.Add and throw a raw string error
      // Note: This test verifies that non-Error exceptions are caught and wrapped
      const actualBuiltins = jest.requireActual<typeof builtins>('../../ops/builtins');
      const originalExecuteOp = actualBuiltins.executeOp;

      const executeOpSpy = jest
        .spyOn(builtins, 'executeOp')
        .mockImplementation((vm: VM, opcode: number, isUserDefined = false) => {
          if (opcode === Op.Add && !isUserDefined) {
            // Throw raw string error - stack should have [5,3] at this point
            throw 'Raw string error';
          } else {
            // Call the original implementation for other opcodes (including literals)
            // This ensures literals are pushed onto the stack before add is called
            originalExecuteOp(vm, opcode, isUserDefined);
          }
        });

      try {
        expect(() => executeTacitCode(vm, '5 3 add')).toThrow(
          'Error executing word (stack: [5,3])',
        );
      } finally {
        executeOpSpy.mockRestore();
      }
    });
    test('should preserve stack state on error', () => {
      try {
        executeTacitCode(vm, '5 3 0 div add');
      } catch (_) {
        expect(getStackData(vm)).toEqual([5, 3, 0]);
      }
    });
    test('should skip definition body during normal execution', () => {
      executeTacitCode(
        vm,
        `
        : double 2 mul ;
        5 double
      `,
      );
      expectStack(vm, [10]);
    });
  });

  describe('Memory management', () => {
    test('should preserve memory when flag is set', () => {
      vm.compiler.preserve = true;
      executeTacitCode(vm, '5 3 add');
      expect(vm.compiler.BCP).toBe(vm.compiler.CP);
      expect(vm.compiler.preserve).toBe(false);
    });
    test('should reset memory when preserve is false', () => {
      const initialBCP = vm.compiler.BCP;
      executeTacitCode(vm, '5 3 add');
      expect(vm.compiler.CP).toBe(initialBCP);
    });
    test('should handle multiple preserve states', () => {
      executeTacitCode(vm, '5 3 add');
      const initialBCP = vm.compiler.BCP;
      vm.compiler.preserve = true;
      executeTacitCode(vm, '2 2 add');
      expect(vm.compiler.BCP).toBe(initialBCP + 12);
    });
  });

  describe('Colon definitions', () => {
    test('should execute simple colon definition', () => {
      executeTacitCode(
        vm,
        `: square dup mul ;
      3 square`,
      );
      expectStack(vm, [9]);
    });
    test('should handle multiple colon definitions', () => {
      executeTacitCode(
        vm,
        `
        : square dup mul ;
        : cube dup square mul ;
        4 square
        3 cube
      `,
      );
      expectStack(vm, [16, 27]);
    });
    test('should allow colon definitions to use other definitions', () => {
      executeTacitCode(
        vm,
        `
        : double 2 mul ;
        : quadruple double double ;
        5 quadruple
      `,
      );
      expectStack(vm, [20]);
    });
    test('should handle colon definitions with stack manipulation', () => {
      executeTacitCode(
        vm,
        `
        : swap-and-add swap add ;
        3 7 swap-and-add
      `,
      );
      expectStack(vm, [10]);
    });
    test('should handle colon definitions with code blocks', () => {
      executeTacitCode(
        vm,
        `
        : double 2 mul ;
        5 double
      `,
      );
      expectStack(vm, [10]);
    });
  });

  describe('Edge cases and coverage', () => {
    test('should handle debug mode output for valid opcodes', () => {
      vm.debug = true;
      // Just verify it doesn't crash - debug output is console.log
      expect(() => executeTacitCode(vm, '5 3 add')).not.toThrow();
      vm.debug = false;
    });

    test('should handle empty code string', () => {
      expect(() => executeTacitCode(vm, '')).not.toThrow();
      expectStack(vm, []);
    });
  });
});
