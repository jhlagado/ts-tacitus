import { fromTaggedValue, HeapTag, isNIL } from '../core/tagged';
import { Heap, BLOCK_SIZE } from './heap';
import { SEG_HEAP } from '../core/memory';
import { INVALID } from '../core/constants';
// Import constants directly from vector.ts
import { VEC_SIZE, VEC_DATA } from './vector';

// Define CELL_SIZE based on 32-bit float tagged values
const CELL_SIZE = 4;

// --- Cleanup Handler Registry ---

/** Type definition for a function that handles cleanup for a specific HeapTag. */
export type CleanupHandler = (heap: Heap, address: number) => void;

/** Registry to store cleanup functions keyed by HeapTag. */
const cleanupRegistry = new Map<HeapTag, CleanupHandler>();

/**
 * Registers a cleanup handler function for a specific HeapTag.
 * This should be called during initialization (e.g., in VM setup)
 * to provide type-specific cleanup logic (like for sequences).
 * @param tag The HeapTag to register the handler for.
 * @param handler The function to call when an object with this tag is about to be freed.
 */
export function registerCleanupHandler(tag: HeapTag, handler: CleanupHandler): void {
  if (cleanupRegistry.has(tag)) {
    console.warn(`Overwriting existing cleanup handler for HeapTag ${tag}`);
  }
  cleanupRegistry.set(tag, handler);
}

// --- Reference Counting Functions ---

export function incRef(heap: Heap, tvalue: number): void {
  // No change needed here
  const { value, heap: isHeap } = fromTaggedValue(tvalue);
  if (isHeap) {
    heap.incrementRef(value);
  }
}

// --- Default Internal Cleanup Helpers (Can be overridden by registered handlers) ---
// These are kept for basic types if no external handler is registered,
// but ideally, handlers for VECTOR and DICT would also be registered externally.

function _cleanupVector(heap: Heap, address: number): void {
  try {
    const length = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(address) + VEC_SIZE);
    let currentBlock = address;
    let offsetInBlock = VEC_DATA;

    for (let i = 0; i < length; i++) {
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        currentBlock = heap.getNextBlock(currentBlock);
        if (currentBlock === INVALID) {
          console.error(
            `_cleanupVector: Invalid block encountered at index ${i} for vector ${address}`
          );
          return;
        }
        offsetInBlock = VEC_DATA; // Assuming data starts at VEC_DATA in subsequent blocks
      }
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        console.error(
          `_cleanupVector: Calculated offset ${offsetInBlock} still exceeds block size for vector ${address}, index ${i}`
        );
        return;
      }

      // Read the element (tagged 32-bit float) using the existing readFloat method
      const element = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(currentBlock) + offsetInBlock
      );
      decRef(heap, element); // Recursive call
      offsetInBlock += CELL_SIZE;
    }
  } catch (error) {
    console.error(`Error during vector cleanup at address ${address}:`, error);
  }
}

function _cleanupDict(heap: Heap, address: number): void {
  try {
    // Dicts use vectors, so cleanup is the same: iterate all key/value cells
    const totalElements = heap.memory.read16(SEG_HEAP, heap.blockToByteOffset(address) + VEC_SIZE);
    let currentBlock = address;
    let offsetInBlock = VEC_DATA;

    for (let i = 0; i < totalElements; i++) {
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        currentBlock = heap.getNextBlock(currentBlock);
        if (currentBlock === INVALID) {
          console.error(
            `_cleanupDict: Invalid block encountered at index ${i} for dict ${address}`
          );
          return;
        }
        offsetInBlock = VEC_DATA; // Assuming data starts at VEC_DATA in subsequent blocks
      }
      if (offsetInBlock + CELL_SIZE > BLOCK_SIZE) {
        console.error(
          `_cleanupDict: Calculated offset ${offsetInBlock} still exceeds block size for dict ${address}, index ${i}`
        );
        return;
      }

      // Read the element (tagged 32-bit float key or value) using the existing readFloat method
      const element = heap.memory.readFloat(
        SEG_HEAP,
        heap.blockToByteOffset(currentBlock) + offsetInBlock
      );
      decRef(heap, element); // Recursive call
      offsetInBlock += CELL_SIZE;
    }
  } catch (error) {
    console.error(`Error during dictionary cleanup at address ${address}:`, error);
  }
}

// --- The main decRef function ---

export function decRef(heap: Heap, tvalue: number): void {
  // Avoid processing NIL
  if (isNIL(tvalue)) return;

  // Decode the value
  const { value: address, heap: isHeap, tag } = fromTaggedValue(tvalue);

  // Only process heap objects
  if (!isHeap) return;

  // Check the reference count BEFORE decrementing
  const currentCount = heap.getRefCount(address);

  // Basic sanity check
  if (currentCount <= 0) {
    console.warn(`decRef called on object with count <= 0 at address ${address}, tag ${tag}`);
    return;
  }

  if (currentCount > 1) {
    // Not the last reference, just decrement the count in the heap
    heap.decrementRef(address);
  } else {
    // --- This IS the last reference (count === 1) ---
    // Perform type-specific cleanup BEFORE freeing the block(s).

    try {
      // Look for a registered handler for this object's tag
      const handler = cleanupRegistry.get(tag as HeapTag);

      if (handler) {
        // Call the registered handler (e.g., for sequences)
        handler(heap, address);
      } else {
        // --- Fallback for common types if no handler registered ---
        // Ideally, handlers for VECTOR and DICT should also be registered externally.
        if (tag === HeapTag.VECTOR) {
          // console.warn( // Removed warning as fallback might be intended
          //   `Using internal fallback cleanup for VECTOR tag ${tag}. Consider registering a handler.`
          // );
          _cleanupVector(heap, address);
        } else if (tag === HeapTag.DICT) {
          // console.warn( // Removed warning as fallback might be intended
          //   `Using internal fallback cleanup for DICT tag ${tag}. Consider registering a handler.`
          // );
          _cleanupDict(heap, address);
        } else {
          // No handler registered and no internal fallback for this tag
          // console.warn( // Keep this warning as it indicates a potential leak if cleanup is needed
          //   `decRef: No cleanup handler registered or fallback available for HeapTag ${tag} at address ${address}. Block will be freed without internal cleanup.`
          // );
        }
      }
    } catch (error) {
      // Catch errors during cleanup logic to prevent them from stopping the final free
      console.error(
        `Error during type-specific cleanup for tag ${tag} at address ${address}:`,
        error
      );
    }

    // --- Final Step ---
    // Now that internal cleanup is done (via handler or fallback), tell the heap
    // to decrement the count from 1 to 0 and free the block(s).
    heap.decrementRef(address);
  }
}
