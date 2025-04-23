import { vectorToArray } from '../../heap/vector';
import { vm } from '../../core/globalState';
import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Sequence Operations', () => {
  test('simple sequence to vector', () => {
    const result = runTacitTest('1 5 1 range to-vector');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack
    const vectorPtr = result[0];
    const vectorContents = vectorToArray(vm.heap, vectorPtr);
    expect(vectorContents).toEqual([1, 2, 3, 4, 5]);
  });

  test('map sequence to vector', () => {
    const result = runTacitTest('1 5 1 range (2 *) map to-vector');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack
    const vectorPtr = result[0];
    const vectorContents = vectorToArray(vm.heap, vectorPtr);
    expect(vectorContents).toEqual([2, 4, 6, 8, 10]);
  });
});
