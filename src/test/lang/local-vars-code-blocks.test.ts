/**
 * Test local variables access from inside code blocks
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Local Variables in Code Blocks', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('should access local variables from inside code blocks', () => {
    const result = executeTacitCode(`
      : func-with-block 
          100 var x 
          { x 1 add } eval
      ;
      func-with-block
    `);
    
    // Should return 101 (x=100, then x + 1 inside the code block)
    expect(result).toEqual([101]);
  });

  test('should access multiple local variables from code blocks', () => {
    const result = executeTacitCode(`
      : multi-vars-block
          10 var x
          20 var y
          { x y add } eval
      ;
      multi-vars-block
    `);
    
    // Should return 30 (x=10, y=20, then x + y = 30)
    expect(result).toEqual([30]);
  });

  test('should work with nested code blocks and local variables', () => {
    const result = executeTacitCode(`
      : nested-blocks
          5 var x
          { x 10 add var temp { temp x add } eval } eval
      ;
      nested-blocks
    `);
    
    // x=5, temp=15 (x+10), result = temp + x = 15 + 5 = 20
    expect(result).toEqual([20]);
  });

  test('should preserve local variables across code block boundaries', () => {
    const result = executeTacitCode(`
      : preserve-vars
          42 var answer
          { answer } eval
          answer
      ;
      preserve-vars
    `);
    
    // Should push answer twice: once from inside block, once after
    expect(result).toEqual([42, 42]);
  });
});