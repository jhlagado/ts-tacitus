/**
 * Tests for compiler function context and Reserve back-patching
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, memoryRead16, memoryRead8, VM } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';
import { Op } from '../../ops/opcodes';
import { SEG_CODE } from '../../core';
import { markWithLocalReset, forget, define } from '../../core/dictionary';
import { Tagged, Tag } from '../../core';
import {
  compilerEnterFunction,
  compilerEmitReserveIfNeeded,
  compilerExitFunction,
} from '../../lang/compiler';

describe('Compiler Function Context', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Function context tracking', () => {
    test('should track function compilation state', () => {
      expect(vm.compile.isInFunction).toBe(false);

      compilerEnterFunction(vm.compile);
      expect(vm.compile.isInFunction).toBe(true);
      expect(vm.compile.reservePatchAddr).toBe(-1); // No Reserve emitted yet

      compilerExitFunction(vm, vm.compile);
      expect(vm.compile.isInFunction).toBe(false);
      expect(vm.compile.reservePatchAddr).toBe(-1);
    });

    test('should emit Reserve opcode only when needed', () => {
      const initialCP = vm.compile.CP;

      compilerEnterFunction(vm.compile);

      // Should not have emitted anything yet
      expect(vm.compile.CP).toBe(initialCP);

      compilerEmitReserveIfNeeded(vm, vm.compile);

      // Now should have emitted Reserve opcode (1 byte) + placeholder slot count (2 bytes)
      expect(vm.compile.CP).toBe(initialCP + 3);

      // Check that Reserve opcode was written
      const reserveOpcode = memoryRead8(vm.memory, SEG_CODE, initialCP);
      expect(reserveOpcode).toBe(Op.Reserve);
    });

    test('should patch slot count on exitFunction', () => {
      // Simulate function with 2 local variables
      const checkpoint = markWithLocalReset(vm);
      const slotX = vm.compile.localCount++;
      define(vm, 'x', Tagged(slotX, Tag.LOCAL));
      const slotY = vm.compile.localCount++;
      define(vm, 'y', Tagged(slotY, Tag.LOCAL));
      expect(vm.compile.localCount).toBe(2);

      compilerEnterFunction(vm.compile);
      compilerEmitReserveIfNeeded(vm, vm.compile); // Emit the Reserve opcode
      const patchAddr = vm.compile.reservePatchAddr;

      // Initial placeholder should be 0
      expect(memoryRead16(vm.memory, SEG_CODE, patchAddr)).toBe(0);

      compilerExitFunction(vm, vm.compile);

      // Should be patched with actual local count (2)
      expect(memoryRead16(vm.memory, SEG_CODE, patchAddr)).toBe(2);

      forget(vm, checkpoint);
    });
  });

  describe('Integration with function parsing', () => {
    test('should automatically emit Reserve for functions with variables', () => {
      // This test verifies that the parser integration works
      const result = executeTacitCode(
        vm,
        `
        : test-fn
          # ( — 52 )
          42 var x    # Initialize x with 42
          10 var y    # Initialize y with 10
          x y add     # ( x y — x+y )
        ;
        test-fn       # Call the function
      `,
      );

      // Function should execute without error and return reasonable result
      expect(typeof result[0]).toBe('number');
      expect(result[0]).toBe(52); // 42 + 10
    });

    test('should handle functions without variables', () => {
      // Functions without variables should still work
      const result = executeTacitCode(
        vm,
        `
        : double
          # ( n — n*2 )
          2 mul
        ;
        5 double      # ( 5 — 10 )
      `,
      );

      expect(result[0]).toBe(10);
    });

    test('should handle nested function calls with variables', () => {
      // Just test that nested functions with variables compile and run without errors
      // The exact computation doesn't matter for this test
      expect(() => {
        const result = executeTacitCode(
          vm,
          `
          : helper 10 var temp temp ;
          : caller 5 var value value helper add ;
          caller
        `,
        );
        // Should produce some numeric result
        expect(typeof result[0]).toBe('number');
      }).not.toThrow();
    });

    test('should handle multiple functions with different variable counts', () => {
      expect(() => {
        executeTacitCode(
          vm,
          `
          : fn1 1 var a ;
          : fn2 1 var x 2 var y ;
          : fn3 ;
          fn1 fn2 fn3
        `,
        );
      }).not.toThrow();
    });
  });

  describe('Error conditions', () => {
    test('should handle exitFunction without enterFunction', () => {
      // Should not crash
      expect(() => {
        compilerExitFunction(vm, vm.compile);
      }).not.toThrow();
    });

    test('should handle multiple enterFunction calls', () => {
      compilerEnterFunction(vm.compile);
      expect(vm.compile.reservePatchAddr).toBe(-1); // No Reserve emitted yet

      compilerEmitReserveIfNeeded(vm, vm.compile);

      // Second call should reset state
      compilerEnterFunction(vm.compile);
      expect(vm.compile.reservePatchAddr).toBe(-1); // Reset to no Reserve
      expect(vm.compile.isInFunction).toBe(true);
    });
  });
});
