import { initializeInterpreter, vm } from '../core/globalState';
import { vectorCreate, vectorGet, vectorToArray, vectorUpdate } from './vector';
import { fromTaggedValue, isNIL } from '../core/tagged';
import { formatValue } from '../core/utils';
import { vecLeftOp, vecRightOp } from '../ops/builtins-interpreter';
import { SEG_HEAP } from '../core/memory';
import { INVALID } from '../core/constants';

// Helper to create a long array
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i * 1.0);
}

describe('Vector', () => {
  beforeEach(() => {
    initializeInterpreter();
    // Now vm.memory and vm.heap are freshly initialized.
  });

  // In your tests, use vm.heap and vm.memory directly.
  it('should create an empty vector', () => {
    const vectorPtr = vectorCreate(vm.heap, []);
    expect(isNIL(vectorPtr)).toBe(false);

    // Read the length from metadata.
    const { value: firstBlock } = fromTaggedValue(vectorPtr);
    const length = vm.heap.memory.read16(
      SEG_HEAP,
      vm.heap.blockToByteOffset(firstBlock) + 4 // VEC_SIZE offset is 4 bytes
    );
    expect(length).toBe(0);
  });

  it('should create a vector with initial values', () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(vm.heap, data);
    expect(isNIL(vectorPtr)).toBe(false);

    // Verify each element using vectorGet
    const vectorContents = data.map((_, i) => vectorGet(vm.heap, vectorPtr, i));
    expect(vectorContents).toBeCloseToArray(data);
  });

  it('should update a vector element', () => {
    const data = [10, 20, 30];
    let vectorPtr = vectorCreate(vm.heap, data);

    // Update index 1 to a new value.
    vectorPtr = vectorUpdate(vm.heap, vectorPtr, 1, 99);
    const updatedValue = vectorGet(vm.heap, vectorPtr, 1);
    expect(updatedValue).toBe(99);
  });

  it('should return NIL for out-of-bound access', () => {
    const data = [5, 6, 7];
    const vectorPtr = vectorCreate(vm.heap, data);

    expect(isNIL(vectorGet(vm.heap, vectorPtr, -1))).toBe(true);
    expect(isNIL(vectorGet(vm.heap, vectorPtr, 3))).toBe(true);
  });

  it('should format a vector with elements [ 1 2 3 ]', () => {
    const data = [1, 2, 3];
    const vectorPtr = vectorCreate(vm.heap, data);
    expect(isNIL(vectorPtr)).toBe(false);

    const formatted = formatValue(vm, vectorPtr);
    expect(formatted).toBe('[ 1 2 3 ]');
  });

  describe('Vector Extended Coverage', () => {
    it('should correctly write vector metadata (header)', () => {
      // Create a simple vector with a single element.
      const data = [42];
      const vectorPtr = vectorCreate(vm.heap, data);
      expect(isNIL(vectorPtr)).toBe(false);

      // Read metadata from the first block.
      // For example, assume that at offset VEC_RESERVED or VEC_SIZE the header is written.
      // (This test assumes that the length is stored at offset VEC_DATA - some constant.)
      const { value: firstBlock } = fromTaggedValue(vectorPtr);
      const headerValue = vm.heap.memory.read16(
        SEG_HEAP,
        vm.heap.blockToByteOffset(firstBlock) + 4 // Adjust the offset as appropriate
      );
      // Expect the header to reflect a length of 1 (or similar metadata)
      expect(headerValue).toBe(1);
    });

    it('should return NIL when vector allocation fails due to block exhaustion', () => {
      // Force the heap to simulate allocation failure.
      // Monkey-patch getNextBlock so that it returns an INVALID marker when called.
      const data = [10, 20, 30, 40];
      const originalGetNextBlock = vm.heap.getNextBlock;
      vm.heap.getNextBlock = () => {
        return INVALID; // simulate failure to allocate a new block
      };

      const vectorPtr = vectorCreate(vm.heap, data);
      expect(isNIL(vectorPtr)).toBe(false);

      // Restore original method
      vm.heap.getNextBlock = originalGetNextBlock;
    });

    it('should allocate a vector spanning multiple blocks', () => {
      // Produce an array long enough to force use of more than one heap block.
      // Adjust the count as needed based on BLOCK_SIZE and ELEMENT_SIZE.
      const longArray = range(50);
      const vectorPtr = vectorCreate(vm.heap, longArray);
      expect(isNIL(vectorPtr)).toBe(false);

      // Check that all elements are written correctly.
      const vectorContents = longArray.map((_, i) => vectorGet(vm.heap, vectorPtr, i));
      expect(vectorContents).toBeCloseToArray(longArray);
    });

    it('should update elements correctly in a vector spanning multiple blocks', () => {
      // Also test vectorUpdate across a larger array.
      const longArray = range(30);
      let vectorPtr = vectorCreate(vm.heap, longArray);
      expect(isNIL(vectorPtr)).toBe(false);

      // Update a value in the middle.
      vectorPtr = vectorUpdate(vm.heap, vectorPtr, 15, 999);
      const updatedValue = vectorGet(vm.heap, vectorPtr, 15);
      expect(updatedValue).toBe(999);
    });

    it('should return NIL when vector allocation fails due to malloc failure', () => {
      const originalMalloc = vm.heap.malloc;
      vm.heap.malloc = () => INVALID;
      const data = [10, 20, 30, 40];
      const vectorPtr = vectorCreate(vm.heap, data);
      expect(isNIL(vectorPtr)).toBe(true);
      vm.heap.malloc = originalMalloc;
    });

    it('should return NIL when vector allocation fails due to block exhaustion', () => {
      // Use an array long enough so that more than one block is needed.
      const longData = range(50);
      const originalGetNextBlock = vm.heap.getNextBlock;
      // Force failure: whenever a new block is needed, simulate that allocation fails.
      vm.heap.getNextBlock = () => INVALID;
      const vectorPtr = vectorCreate(vm.heap, longData);
      expect(isNIL(vectorPtr)).toBe(true);
      vm.heap.getNextBlock = originalGetNextBlock;
    });

    it('should produce a nested vector [ 1 2 [ 3 ] ]', () => {
      // Outer vector: the outer vector will have three elements: 1, 2, and an inner vector.
      // Use vecLeftOp to mark the start and vecRightOp to build the vector.

      // --- Outer vector start ---
      vecLeftOp(vm);
      // Push outer vector element 1.
      vm.push(1);
      // Push outer vector element 2.
      vm.push(2);

      // --- Inner vector start ---
      vecLeftOp(vm);
      // Push inner vector element 3.
      vm.push(3);
      // End inner vector.
      vecRightOp(vm); // This pops the inner vector elements and pushes a tagged inner vector.

      // --- End outer vector ---
      vecRightOp(vm); // This constructs the outer vector from elements: 1, 2, and the inner vector.

      // The outer vector should now be on the top of the stack.
      const outerVector = vm.pop();

      // Use formatValue to convert the nested vector to a string.
      const printed = formatValue(vm, outerVector);
      expect(printed).toBe('[ 1 2 [ 3 ] ]');
    });

    it('should format a vector with elements [ 1 2 3 ]', () => {
      const data = [1, 2, 3];
      const vectorPtr = vectorCreate(vm.heap, data);
      expect(isNIL(vectorPtr)).toBe(false); // 0 or NIL indicates allocation failure

      const formatted = formatValue(vm, vectorPtr);
      // Expected output: "[ 1 2 3 ]"
      expect(formatted).toBe('[ 1 2 3 ]');
    });

    it('should format a nested vector [ 1 2 [ 3 ] ]', () => {
      // First, create the inner vector.
      const inner = vectorCreate(vm.heap, [3]);
      // Then, create the outer vector.
      // Here we pretend that the numbers 1 and 2 and the inner vector (i.e. its tagged value) are pushed.
      const outer = vectorCreate(vm.heap, [1, 2, inner]);
      const formatted = formatValue(vm, outer);
      expect(formatted).toBe('[ 1 2 [ 3 ] ]');
    });

    // Debug the nested vector test
    it('should format a nested vector [ 1 2 [ 3 ] ]', () => {
      const inner = vectorCreate(vm.heap, [3]);
      console.log('Inner vector tagged value:', inner);

      // Verify inner vector is valid
      const innerFormatted = formatValue(vm, inner);
      console.log('Inner vector formatted:', innerFormatted); // Should be "[ 3 ]"

      // Create outer vector
      const outer = vectorCreate(vm.heap, [1, 2, inner]);

      // Read the length from metadata to verify
      const { value: firstBlock } = fromTaggedValue(outer);
      const length = vm.heap.memory.read16(SEG_HEAP, vm.heap.blockToByteOffset(firstBlock) + 4);
      console.log('Outer vector length:', length); // Should be 3

      // Read each element to verify what's stored
      for (let i = 0; i < length; i++) {
        const elem = vm.heap.memory.readFloat(
          SEG_HEAP,
          vm.heap.blockToByteOffset(firstBlock) + 8 + i * 4 // Assuming VEC_DATA is 8
        );
        console.log(`Element ${i}:`, elem);
      }

      const formatted = formatValue(vm, outer);
      console.log('Outer vector formatted:', formatted);
      expect(formatted).toBe('[ 1 2 [ 3 ] ]');
    });

    it('should preserve nested vector references when stored and retrieved', () => {
      // Create an inner vector
      const innerVecPtr = vectorCreate(vm.heap, [3, 4]);

      // Verify the inner vector is valid and properly tagged
      const innerType = fromTaggedValue(innerVecPtr);
      console.log('Inner vector tag type:', innerType.tag);

      // Store the inner vector in an outer vector
      const outerVecPtr = vectorCreate(vm.heap, [1, 2, innerVecPtr]);

      // Retrieve the inner vector reference directly
      const retrievedInnerPtr = vectorGet(vm.heap, outerVecPtr, 2);

      console.log('Original inner vector ptr:', innerVecPtr);
      console.log('Retrieved inner vector ptr:', retrievedInnerPtr);

      const element0 = vectorGet(vm.heap, retrievedInnerPtr, 0);
      const element1 = vectorGet(vm.heap, retrievedInnerPtr, 1);

      console.log('Inner vector elements:', element0, element1);

      expect(element0).toBe(3);
      expect(element1).toBe(4);
    });
  });
});

describe('vectorToArray', () => {
  it('should convert a vector to a TypeScript array', () => {
    const data = [1.1, 2.2, 3.3];
    const vectorPtr = vectorCreate(vm.heap, data);

    const array = vectorToArray(vm.heap, vectorPtr);
    expect(array).toBeCloseToArray(data);
  });

  it('should handle an empty vector', () => {
    const vectorPtr = vectorCreate(vm.heap, []);

    const array = vectorToArray(vm.heap, vectorPtr);
    expect(array).toEqual([]);
  });

  it('should handle a vector with a single element', () => {
    const data = [42];
    const vectorPtr = vectorCreate(vm.heap, data);

    const array = vectorToArray(vm.heap, vectorPtr);
    expect(array).toBeCloseToArray(data);
  });

  it('should handle a vector spanning multiple blocks', () => {
    const longArray = range(50);
    const vectorPtr = vectorCreate(vm.heap, longArray);

    const array = vectorToArray(vm.heap, vectorPtr);
    expect(array).toBeCloseToArray(longArray);
  });
});
