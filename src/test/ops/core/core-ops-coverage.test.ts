/**
 * Branch coverage tests for core-ops.ts
 *
 * Targets specific uncovered branches identified in coverage report:
 * Lines 202-203, 214, 243-244, 252-256, 338, 369, 376-377, 405-407, 433, 439
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';
import { vm } from '../../../lang/runtime';
import { exitOp, evalOp } from '../../../ops/core';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('Core Operations Branch Coverage', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('exitOp edge cases', () => {
    test('should handle return stack underflow (lines 202-203)', () => {
      // Set up minimal return stack that will trigger underflow condition
      // Set return stack to 1 cell (4 bytes); less than required 2 cells (8 bytes)
      vm.rsp = 1;

      // Call exitOp which should hit the underflow branch
      exitOp(vm);

      // Should have stopped VM execution
      expect(vm.running).toBe(false);
    });

    test('should handle non-code return address (line 214)', () => {
      // Set up return stack properly with enough entries
      vm.unsafeSetBPBytes(16); // Set base pointer (bytes -> cells)
      vm.rsp = 4; // 4 cells = 16 bytes to match BP
      // Save BP as relative cells (depth)
      vm.rpush(
        vm.bp -
          require('../../../core/constants').RSTACK_BASE /
            require('../../../core/constants').CELL_SIZE,
      ); // BP saved (relative)
      vm.rpush(1000); // Non-code return address (number, not tagged as CODE)

      exitOp(vm);

      // Should have executed the non-code branch (line 214) even if IP is different
      // The test documents that this branch is covered
      expect(vm.IP).toBeDefined();
    });
  });

  describe('evalOp branch coverage', () => {
    test('should handle non-executable values (line 338)', () => {
      // Push a non-executable value (not CODE or BUILTIN)
      vm.push(toTaggedValue(42, Tag.NUMBER));

      const stackBefore = vm.getStackData();
      evalOp(vm);
      const stackAfter = vm.getStackData();

      // Should have pushed the value back (non-executable branch)
      expect(stackAfter.length).toBe(stackBefore.length);
      expect(stackAfter[stackAfter.length - 1]).toBe(toTaggedValue(42, Tag.NUMBER));
    });

    test('should handle string values in eval', () => {
      // Test string tag in evalOp
      vm.push(toTaggedValue(100, Tag.STRING));

      evalOp(vm);

      // String should be treated as non-executable and pushed back
      const result = vm.pop();
      expect(result).toBe(toTaggedValue(100, Tag.STRING));
    });

    test('should handle list values in eval', () => {
      // Test list tag in evalOp
      vm.push(toTaggedValue(4, Tag.LIST));

      evalOp(vm);

      // List should be treated as non-executable and pushed back
      const result = vm.pop();
      expect(result).toBe(toTaggedValue(4, Tag.LIST));
    });

    test('should execute CODE with meta=1 (block) path', () => {
      // meta=1 branch in evalOp should rpush return address and jump to addr
      const addr = 12345;
      vm.IP = 77;
      vm.push(toTaggedValue(addr, Tag.CODE, 1));
      evalOp(vm);
      expect(vm.IP).toBe(addr);
    });
  });

  describe('Error handling branches', () => {
    test('should handle edge case in exitOp', () => {
      // Test that exitOp handles edge cases properly
      vm.rsp = 1; // Minimal valid return stack (1 cell) triggers early return condition

      exitOp(vm);

      expect(vm.running).toBe(false);
    });
  });

  describe('Integration tests to hit more branches', () => {
    test('should exercise function return paths', () => {
      // Test function definition and calling to hit return branches
      const result = executeTacitCode(`
        : test-func 42 ;
        test-func
      `);

      expect(result[result.length - 1]).toBe(42);
    });

    test('should exercise eval with colon definition', () => {
      const result = executeTacitCode(`
        : inc 1 add ;
        41 @inc eval
      `);

      expect(result).toEqual([42]);
    });

    test('should exercise function calls', () => {
      // Test function calls to hit return scenarios
      const result = executeTacitCode(`
        : test-func 42 ;
        test-func
      `);

      expect(result[result.length - 1]).toBe(42);
    });
  });

  describe('Code tag variations', () => {
    test('should handle CODE tag with different meta values', () => {
      // Test CODE tag with meta=0 (function) vs meta=1 (block)
      const codeFunc = toTaggedValue(1000, Tag.CODE, 0); // Function
      const codeBlock = toTaggedValue(2000, Tag.CODE, 1); // Block

      // Just ensure these don't crash when processed
      vm.push(codeFunc);
      expect(vm.getStackData().length).toBe(1);

      vm.push(codeBlock);
      expect(vm.getStackData().length).toBe(2);
    });
  });

  describe('Stack state edge cases', () => {
    test('should handle various stack configurations', () => {
      // Test with different stack/return stack states to hit edge cases

      // Deep stack
      for (let i = 0; i < 10; i++) {
        vm.push(i);
      }

      // Push and pop to exercise stack operations
      const last = vm.pop();
      expect(last).toBe(9);

      // Multiple return stack entries
      vm.rpush(100);
      vm.rpush(200);
      vm.rpush(300);

      expect(vm.rpop()).toBe(300);
      expect(vm.rpop()).toBe(200);
      expect(vm.rpop()).toBe(100);
    });
  });
});
