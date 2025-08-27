/**
 * Debug length operation to see what's happening
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { executeTacitCode } from '../../utils/vm-test-utils';

describe('Debug Length Operation', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('should check direct empty list length result', () => {
    const result = executeTacitCode('() length');
    
    console.log('Direct () length result:', result);
    console.log('Result length:', result.length);
    console.log('Stack data:', vm.getStackData());
    
    // What should it be?
    expect(result.length).toBe(1); // Should have one result
    expect(result[0]).toBe(0); // Should be 0 for empty list
  });

  test('should check what empty list alone produces', () => {
    const result = executeTacitCode('()');
    
    console.log('Direct () result:', result);
    console.log('Result length:', result.length);
    console.log('Stack data:', vm.getStackData());
  });
});