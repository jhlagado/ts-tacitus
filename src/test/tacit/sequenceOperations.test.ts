 
import { vectorGet } from '../../heap/vector';
import { vm } from '../../core/globalState';
import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Sequence Operations', () => {
  test('simple sequence to vector', () => {
    // Create a sequence and convert it to a vector
    const result = runTacitTest('1 5 1 range to-vector');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack

    // Validate the vector contents
    const vectorPtr = result[0];
    const vectorContents = [];
    for (let i = 0; i < 5; i++) {
      vectorContents.push(vectorGet(vm.heap, vectorPtr, i));
    }
    expect(vectorContents).toEqual([1, 2, 3, 4, 5]);
  });

  xtest('map sequence to vector', () => {
    // Create a sequence and convert it to a vector
    const result = runTacitTest('1 5 1 range (  ) map to-vector');
    expect(result.length).toBe(1); // Ensure a single vector is on the stack

    // Validate the vector contents
    const vectorPtr = result[0];
    const vectorContents = [];
    for (let i = 0; i < 5; i++) {
      vectorContents.push(vectorGet(vm.heap, vectorPtr, i));
    }
    console.log(vectorContents);
    expect(vectorContents).toEqual([1, 2, 3, 4, 5]);
  });
});
