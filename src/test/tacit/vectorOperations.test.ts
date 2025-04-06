import { runTacitTest } from '../tacitTestUtils';
import { vectorGet } from '../../heap/vector';
import { vm } from '../../core/globalState';

describe('Tacit Vector Operations', () => {
  test('vector content assertions', () => {
    // Test a vector with specific values
    let result = runTacitTest('[ 1 2 3 4 5]');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack
    const vectorPtr = result[0];
    const vectorContents = [];
    for (let i = 0; i < 5; i++) {
      vectorContents.push(vectorGet(vm.heap, vectorPtr, i));
    }
    expect(vectorContents).toBeCloseToArray([1, 2, 3, 4, 5]);

    // Test a vector with specific values
    result = runTacitTest('[ 42 43 44 ]');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack
    const specificVectorPtr = result[0];
    const specificVectorContents = [];
    for (let i = 0; i < 3; i++) {
      specificVectorContents.push(vectorGet(vm.heap, specificVectorPtr, i));
    }
    expect(specificVectorContents).toBeCloseToArray([42, 43, 44]);
  });
});
