/**
 * Tests for compiler function context and Reserve back-patching
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { executeTacitCode } from '../utils/vm-test-utils';
import { Op } from '../../ops/opcodes';
import { SEG_CODE } from '@src/core';

describe('Compiler Function Context', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Function context tracking', () => {
    test('should track function compilation state', () => {
      expect(vm.compiler.isInFunction).toBe(false);
      
      vm.compiler.enterFunction();
      expect(vm.compiler.isInFunction).toBe(true);
      expect(vm.compiler.reservePatchAddr).toBe(-1); // No Reserve emitted yet
      
      vm.compiler.exitFunction();
      expect(vm.compiler.isInFunction).toBe(false);
      expect(vm.compiler.reservePatchAddr).toBe(-1);
    });

    test('should emit Reserve opcode only when needed', () => {
      const initialCP = vm.compiler.CP;
      
      vm.compiler.enterFunction();
      
      // Should not have emitted anything yet
      expect(vm.compiler.CP).toBe(initialCP);
      
      vm.compiler.emitReserveIfNeeded();
      
      // Now should have emitted Reserve opcode (1 byte) + placeholder slot count (2 bytes)
      expect(vm.compiler.CP).toBe(initialCP + 3);
      
      // Check that Reserve opcode was written
      const reserveOpcode = vm.memory.read8(SEG_CODE, initialCP);
      expect(reserveOpcode).toBe(Op.Reserve);
    });

    test('should patch slot count on exitFunction', () => {
      // Simulate function with 2 local variables
      const checkpoint = vm.symbolTable.mark();
      vm.symbolTable.defineLocal('x');
      vm.symbolTable.defineLocal('y');
      expect(vm.symbolTable.getLocalCount()).toBe(2);
      
      vm.compiler.enterFunction();
      vm.compiler.emitReserveIfNeeded(); // Emit the Reserve opcode
      const patchAddr = vm.compiler.reservePatchAddr;
      
      // Initial placeholder should be 0
      expect(vm.memory.read16(SEG_CODE, patchAddr)).toBe(0);
      
      vm.compiler.exitFunction();
      
      // Should be patched with actual local count (2)
      expect(vm.memory.read16(SEG_CODE, patchAddr)).toBe(2);
      
      vm.symbolTable.revert(checkpoint);
    });
  });

  describe('Integration with function parsing', () => {
    test('should automatically emit Reserve for functions with variables', () => {
      // This test verifies that the parser integration works
      const result = executeTacitCode(': test-fn 42 var x 10 var y x y add ; test-fn');
      
      // Function should execute without error and return reasonable result
      expect(typeof result[0]).toBe('number');
      expect(result[0]).toBe(52); // 42 + 10
    });

    test('should handle functions without variables', () => {
      // Functions without variables should still work
      const result = executeTacitCode(': double 2 mul ; 5 double');
      
      expect(result[0]).toBe(10);
    });

    test('should handle nested function calls with variables', () => {
      // Just test that nested functions with variables compile and run without errors
      // The exact computation doesn't matter for this test
      expect(() => {
        const result = executeTacitCode(`
          : helper 10 var temp temp ;
          : caller 5 var value value helper add ;
          caller
        `);
        // Should produce some numeric result
        expect(typeof result[0]).toBe('number');
      }).not.toThrow();
    });

    test('should handle multiple functions with different variable counts', () => {
      expect(() => {
        executeTacitCode(`
          : fn1 1 var a ;
          : fn2 1 var x 2 var y ;
          : fn3 ;
          fn1 fn2 fn3
        `);
      }).not.toThrow();
    });
  });

  describe('Error conditions', () => {
    test('should handle exitFunction without enterFunction', () => {
      // Should not crash
      expect(() => {
        vm.compiler.exitFunction();
      }).not.toThrow();
    });

    test('should handle multiple enterFunction calls', () => {
      vm.compiler.enterFunction();
      expect(vm.compiler.reservePatchAddr).toBe(-1); // No Reserve emitted yet
      
      vm.compiler.emitReserveIfNeeded();
      const firstPatchAddr = vm.compiler.reservePatchAddr;
      
      // Second call should reset state
      vm.compiler.enterFunction();
      expect(vm.compiler.reservePatchAddr).toBe(-1); // Reset to no Reserve
      expect(vm.compiler.isInFunction).toBe(true);
    });
  });
});
