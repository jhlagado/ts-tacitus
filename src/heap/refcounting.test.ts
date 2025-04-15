import { vm } from '../core/globalState';
import { initializeInterpreter } from '../core/globalState';
import { vectorCreate } from './vector';
import { decRef, incRef, getRefCount } from './heapUtils';
import { fromTaggedValue } from '../core/tagged';

describe('Reference Counting', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('should track reference count changes correctly', () => {
    // Create a vector with initial data
    const vector = vectorCreate(vm.heap, []);

    // Initial ref count is 1 (objects are created with count=1)
    expect(getRefCount(vm.heap, vector)).toBe(1);

    // Manually increment reference
    incRef(vm.heap, vector);
    expect(getRefCount(vm.heap, vector)).toBe(2);

    // Increment again
    incRef(vm.heap, vector);
    expect(getRefCount(vm.heap, vector)).toBe(3);

    // Release references
    decRef(vm.heap, vector);
    expect(getRefCount(vm.heap, vector)).toBe(2);

    decRef(vm.heap, vector);
    expect(getRefCount(vm.heap, vector)).toBe(1);

    // One more decRef should free the memory
    // Save the block address to check if it's been freed
    const blockAddr = fromTaggedValue(vector).value;

    decRef(vm.heap, vector);

    // After freeing, getRefCount likely returns 0 instead of throwing
    expect(getRefCount(vm.heap, vector)).toBe(0);
  });

  it('should handle nested vectors correctly', () => {
    // Create vectors with initial data
    const innerVector = vectorCreate(vm.heap, [42]);
    const outerVector = vectorCreate(vm.heap, [1, 2, innerVector]);

    // Initial ref counts are 1 (creation reference)
    expect(getRefCount(vm.heap, innerVector)).toBe(1);
    expect(getRefCount(vm.heap, outerVector)).toBe(1);

    // Check if storing in another vector automatically incremented the ref count
    const innerRefCountBefore = getRefCount(vm.heap, innerVector);
    console.log(`Reference count of inner vector before: ${innerRefCountBefore}`);

    // Try manually incrementing to see if it works
    incRef(vm.heap, innerVector);
    const afterManualInc = getRefCount(vm.heap, innerVector);
    console.log(`Reference count after manual increment: ${afterManualInc}`);

    // Release outer vector
    decRef(vm.heap, outerVector);
    console.log(
      `Reference count after releasing outer vector: ${getRefCount(vm.heap, innerVector)}`
    );

    // Release inner vector's creation reference
    decRef(vm.heap, innerVector);

    // After freeing, getRefCount returns 0
    expect(getRefCount(vm.heap, innerVector)).toBe(0);
  });
});
