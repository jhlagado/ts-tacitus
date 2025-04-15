import { fromTaggedValue, HeapTag, isNIL } from '../core/tagged';
import { Heap } from './heap'; // Removed toTaggedValue if not used elsewhere
// REMOVED: Vector constant imports (VEC_SIZE, VEC_DATA) - cleanup logic moved out

/**
 * Reference Counting System
 * -------------------------
 * Tacitus uses manual reference counting for memory management. This approach
 * provides predictable cleanup and explicit control over object lifetimes.
 *
 * Key principles:
 *
 * 1. All heap-allocated objects start with a reference count of 1 when created
 * 2. When storing an object inside another (e.g., in vectors, dictionaries, or sequences),
 *    you MUST manually call incRef() to increment its reference count
 * 3. When removing or replacing an object, call decRef() to release the reference
 * 4. When an object's reference count reaches 0, it is immediately freed
 * 5. For objects containing other objects, the cleanup handler must call decRef()
 *    on all contained objects when the parent is freed
 *
 * Example usage:
 *
 * // Storing an object in a vector
 * function storeInVector(heap, vector, index, value) {
 *   // Decrement ref count of existing value (if it's a heap object)
 *   const oldValue = vectorGet(heap, vector, index);
 *   if (isHeapAllocated(oldValue)) {
 *     decRef(heap, oldValue);
 *   }
 *
 *   // Increment ref count of new value (if it's a heap object)
 *   if (isHeapAllocated(value)) {
 *     incRef(heap, value);
 *   }
 *
 *   // Store the value
 *   vectorSet(heap, vector, index, value);
 * }
 *
 * Note: Unlike some systems, Tacitus does NOT automatically manage references
 * for nested objects. Reference management must be explicit.
 */

// --- Cleanup Handler Registry ---

/** Type definition for a function that handles cleanup for a specific HeapTag. */
export type CleanupHandler = (heap: Heap, address: number) => void;

/** Registry to store cleanup functions keyed by HeapTag. */
const cleanupRegistry = new Map<HeapTag, CleanupHandler>();

/**
 * Registers a cleanup handler function for a specific HeapTag.
 * This should be called during initialization (e.g., in VM setup)
 * to provide type-specific cleanup logic.
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

/**
 * Increments the reference count of a heap object.
 * Must be called when storing an object reference.
 * No effect on non-heap values.
 */
export function incRef(heap: Heap, tvalue: number): void {
  const { value, heap: isHeap } = fromTaggedValue(tvalue);
  if (isHeap) {
    heap.incrementRef(value);
  }
}

/**
 * Decrements the reference count of a heap object.
 * When count reaches 0, the object is freed.
 * No effect on non-heap values.
 */
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
        // Call the registered handler (e.g., for sequences, vectors, dicts)
        handler(heap, address);
      } else {
        // No handler registered for this tag. This indicates an initialization error
        // if the tag represents an object type that requires cleanup (like vector, dict, seq).
        // Simple blocks might not need handlers.
        console.warn(
          `decRef: No cleanup handler registered for HeapTag ${tag} at address ${address}. Block will be freed without internal cleanup. Potential memory leak if internal references exist.`
        );
      }
    } catch (error) {
      // Catch errors during cleanup logic to prevent them from stopping the final free
      console.error(
        `Error during type-specific cleanup for tag ${tag} at address ${address}:`,
        error
      );
    }

    // --- Final Step ---
    // Now that internal cleanup is done (via handler), tell the heap
    // to decrement the count from 1 to 0 and free the block(s).
    heap.decrementRef(address);
  }
}

/**
 * Returns the current reference count of an object.
 * Returns 0 for non-heap values or freed objects.
 */
export function getRefCount(heap: Heap, tvalue: number): number {
  const { value, heap: isHeap } = fromTaggedValue(tvalue);
  if (isHeap) {
    return heap.getRefCount(value);
  }
  return 0; // Non-heap values have no ref count
}
