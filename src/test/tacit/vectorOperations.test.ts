import { runTacitTest } from '../tacitTestUtils';
import { vectorToArray } from '../../heap/vector';
import { vm } from '../../core/globalState';

describe('Tacit Vector Operations', () => {
  test('vector content assertions', () => {
    // Test a vector with specific values
    let result = runTacitTest('[ 1 2 3 4 5]');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack
    const vectorPtr = result[0];
    const vectorContents = vectorToArray(vm.heap, vectorPtr);
    expect(vectorContents).toBeCloseToArray([1, 2, 3, 4, 5]);

    // Test a vector with specific values
    result = runTacitTest('[ 42 43 44 ]');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack
    const specificVectorPtr = result[0];
    const specificVectorContents = vectorToArray(vm.heap, specificVectorPtr);
    expect(specificVectorContents).toBeCloseToArray([42, 43, 44]);
  });
});
