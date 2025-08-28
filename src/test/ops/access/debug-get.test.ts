/**
 * Debug test to understand getOp behavior
 */
import { describe, test } from '@jest/globals';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Debug getOp behavior', () => {
  test('should understand what get actually does', () => {
    resetVM();
    
    console.log('Testing: ( 1 100 2 200 ) get { 1 }');
    const result = executeTacitCode('( 1 100 2 200 ) get { 1 }');
    
    console.log('Result stack:', result);
    console.log('Length:', result.length);
    console.log('Last value:', result[result.length - 1]);
    console.log('Is last NIL:', result[result.length - 1] === null);
    
    // Let's see what types we get
    result.forEach((val, idx) => {
      console.log(`  [${idx}]:`, val, typeof val, isNaN(val) ? '(NaN)' : '');
    });
  });

  test('should test empty path', () => {
    resetVM();
    
    console.log('Testing: ( 1 100 ) get { }');
    const result = executeTacitCode('( 1 100 ) get { }');
    
    console.log('Empty path result:', result);
  });
});