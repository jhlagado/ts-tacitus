/**
 * selectOp tests - Path-based address access
 * Tests the select operation that returns addresses/refs instead of values
 */
import { executeTacitCode } from '../../utils/vm-test-utils';
import { NIL, Tag, getTag } from '../../../core/tagged';
import { createTargetRef, traverseMultiPath } from '../../../ops/select-ops';
import { isRef } from '../../../core/refs';
import { initializeInterpreter, vm } from '../../../core/globalState';

describe('selectOp - Path-based address access', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('should return NIL for empty path', () => {
    const result = executeTacitCode('( 1 2 3 ) ( ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  test('should return NIL for non-list target', () => {
    const result = executeTacitCode('42 ( 1 ) select');
    expect(result[result.length - 1]).toBe(NIL);
  });

  describe('createTargetRef function', () => {
    test('should create stack ref for list target', () => {
      // Set up stack: target path
      executeTacitCode('( 10 20 30 ) ( 1 )');

      const success = createTargetRef(vm);
      expect(success).toBe(true);

      // Should have: target path target-ref
      const targetRef = vm.peek();
      expect(isRef(targetRef)).toBe(true);
      expect(getTag(targetRef)).toBe(Tag.STACK_REF);
    });

    test('should return false for simple target', () => {
      // Set up stack: target path
      executeTacitCode('42 ( 1 )');

      const success = createTargetRef(vm);
      expect(success).toBe(false);
    });
  });

  describe('traverseMultiPath function', () => {
    test('should traverse single element path', () => {
      // Set up: target path target-ref
      executeTacitCode('( 10 20 30 ) ( 1 )');
      createTargetRef(vm);

      traverseMultiPath(vm);

      // Should have: target final-ref
      expect(vm.SP / 4).toBe(2); // Two items on stack
      const finalRef = vm.peek();
      expect(isRef(finalRef)).toBe(true);
    });
  });

  // Integration tests - skipped for now
  test.skip('should handle simple numeric path', () => {
    expect(() => {
      executeTacitCode('( "a" 10 "b" 20 "c" 30 ) "a" select drop drop');
    }).not.toThrow();
  });

  test.skip('should handle simple path as list', () => {
    const result = executeTacitCode('( 1 2 3 ) ( 1 ) select');
    expect(result[result.length - 1]).toBe(2);
  });

  test.skip('should handle simple numeric path', () => {
    expect(() => {
      executeTacitCode('( 10 20 30 ) 1 select drop drop');
    }).not.toThrow();
  });

  test.skip('should handle two-element numeric path', () => {
    const elem0 = executeTacitCode('( ( 1 2 3 ) ( 4 5 6 ) ) 0 elem fetch');
    console.log('elem 0 result:', elem0.slice(-3));

    const elem1 = executeTacitCode('( ( 1 2 3 ) ( 4 5 6 ) ) 1 elem fetch');
    console.log('elem 1 result:', elem1.slice(-3));

    const result = executeTacitCode('( ( 1 2 3 ) ( 4 5 6 ) ) ( 1 0 ) select fetch');
    expect(result[result.length - 1]).toBe(4);
  });

  test.skip('should handle mixed path with number then string', () => {
    const result = executeTacitCode('( ( "name" "John" "age" 25 ) ( "name" "Jane" "age" 30 ) ) ( 0 "name" ) select fetch');
    expect(result[result.length - 1]).toBe("John");
  });
});
