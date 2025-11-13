/**
 * @file src/ops/buffers/buffer-ops.ts
 * Ring buffer operations for the Tacit VM.
 *
 * Buffers are LIST-backed ring buffers with fixed capacity. They use LIST headers
 * for allocation only, then treat memory as raw blocks with array semantics
 * (address-increasing order).
 */

import {
  type VM,
  getTaggedInfo,
  Tag,
  getListLength,
  getListBounds,
  isList,
  NIL,
} from '@src/core';
import { push, pop, peek, ensureStackSize } from '../../core/vm';
import { Tagged } from '@src/core';

/**
 * Resolves a buffer input (LIST header or REF) and extracts buffer metadata.
 * @param vm VM instance
 * @param value Input value (LIST header or REF)
 * @returns Buffer metadata or null if invalid
 */
function resolveBuffer(
  vm: VM,
  value: number,
): { header: number; headerCell: number; capacity: number } | null {
  const bounds = getListBounds(vm, value);
  if (!bounds) {
    return null;
  }

  const { header, headerCell } = bounds;
  if (!isList(header)) {
    return null;
  }

  // Extract capacity: header stores N+2 payload slots (readPtr + writePtr + N data slots)
  const totalPayloadSlots = getListLength(header);
  const capacity = totalPayloadSlots - 2;

  // Validate capacity (must be >= 1)
  if (capacity < 1) {
    return null;
  }

  return { header, headerCell, capacity };
}

/**
 * Gets buffer pointers (readPtr and writePtr) from memory.
 * @param vm VM instance
 * @param headerCell Absolute cell address of LIST header
 * @returns [readPtr, writePtr] as logical indices (0..N-1)
 */
function getBufferPointers(vm: VM, headerCell: number): [number, number] {
  const readPtr = vm.memory.readCell(headerCell - 1);
  const writePtr = vm.memory.readCell(headerCell - 2);
  return [readPtr, writePtr];
}

/**
 * Calculates the data base address (lowest address for data[0]).
 * @param headerCell Absolute cell address of LIST header
 * @param capacity Buffer capacity N
 * @returns Absolute cell address of data[0]
 */
function getDataBase(headerCell: number, capacity: number): number {
  return headerCell - (capacity + 2);
}

/**
 * buffer: Allocates a ring buffer with capacity N.
 * Stack: ( N -- buffer )
 */
export function bufferOp(vm: VM): void {
  ensureStackSize(vm, 1, 'buffer');

  const capacity = pop(vm);
  const { value: n, tag } = getTaggedInfo(capacity);

  if (tag !== Tag.NUMBER || n < 1) {
    throw new Error(`buffer: capacity must be >= 1, got ${n}`);
  }

  // Allocate LIST with N+2 payload slots (readPtr + writePtr + N data slots)
  const payloadSlots = n + 2;

  // Allocate space for payload (we'll write pointers and leave data uninitialized)
  // Push NIL values for payload slots (will be overwritten)
  for (let i = 0; i < payloadSlots; i++) {
    push(vm, NIL);
  }

  // Initialize readPtr = 0 at headerCell - 1
  const headerCell = vm.sp - 1;
  vm.memory.writeCell(headerCell - 1, 0); // readPtr
  vm.memory.writeCell(headerCell - 2, 0); // writePtr

  // Push LIST header
  const header = Tagged(payloadSlots, Tag.LIST);
  push(vm, header);
}

/**
 * buf-size: Returns the current number of elements in the buffer.
 * Stack: ( buffer/ref -- n )
 */
export function bufSizeOp(vm: VM): void {
  ensureStackSize(vm, 1, 'buf-size');

  const value = pop(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('buf-size: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Size = (writePtr - readPtr + N) % N
  const size = (writePtr - readPtr + capacity) % capacity;
  push(vm, Tagged(size, Tag.NUMBER));
}

/**
 * is-empty: Returns 1 if buffer is empty, 0 otherwise.
 * Stack: ( buffer/ref -- 0|1 )
 */
export function isEmptyOp(vm: VM): void {
  ensureStackSize(vm, 1, 'is-empty');

  const value = pop(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('is-empty: Expected buffer (LIST or REF)');
  }

  const { headerCell } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Empty when readPtr == writePtr
  const isEmpty = readPtr === writePtr ? 1 : 0;
  push(vm, Tagged(isEmpty, Tag.NUMBER));
}

/**
 * is-full: Returns 1 if buffer is full, 0 otherwise.
 * Stack: ( buffer/ref -- 0|1 )
 */
export function isFullOp(vm: VM): void {
  ensureStackSize(vm, 1, 'is-full');

  const value = pop(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('is-full: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Full when (writePtr + 1) % N == readPtr
  const nextWritePtr = (writePtr + 1) % capacity;
  const isFull = nextWritePtr === readPtr ? 1 : 0;
  push(vm, Tagged(isFull, Tag.NUMBER));
}

/**
 * write: Writes a value to the buffer (stack semantics using write pointer).
 * Stack: ( x buffer/ref -- )
 * Alias: push
 */
export function writeOp(vm: VM): void {
  ensureStackSize(vm, 2, 'write');

  const value = pop(vm); // buffer/ref (closer to op)
  const x = pop(vm); // value (from earlier operations)
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('write: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Check if full: (writePtr + 1) % N == readPtr
  const nextWritePtr = (writePtr + 1) % capacity;
  if (nextWritePtr === readPtr) {
    throw new Error('Buffer overflow');
  }

  // Calculate data base address
  const dataBase = getDataBase(headerCell, capacity);

  // Write x to data[writePtr]
  vm.memory.writeCell(dataBase + writePtr, x);

  // Update writePtr: (writePtr + 1) % N
  const newWritePtr = nextWritePtr;
  vm.memory.writeCell(headerCell - 2, newWritePtr);
}

/**
 * unwrite: Unwrites a value from the buffer (stack semantics using write pointer).
 * Stack: ( buffer/ref -- v )
 * Alias: pop
 */
export function unwriteOp(vm: VM): void {
  ensureStackSize(vm, 1, 'unwrite');

  const value = pop(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('unwrite: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Check if empty: writePtr == readPtr
  if (writePtr === readPtr) {
    throw new Error('Buffer underflow');
  }

  // Calculate data base address
  const dataBase = getDataBase(headerCell, capacity);

  // Decrement writePtr: (writePtr - 1 + N) % N
  const newWritePtr = (writePtr - 1 + capacity) % capacity;

  // Read from data[newWritePtr]
  const result = vm.memory.readCell(dataBase + newWritePtr);

  // Update writePtr
  vm.memory.writeCell(headerCell - 2, newWritePtr);

  // Return value
  push(vm, result);
}

/**
 * read: Reads a value from the buffer (queue semantics using read pointer).
 * Stack: ( buffer/ref -- v )
 * Alias: shift
 */
export function readOp(vm: VM): void {
  ensureStackSize(vm, 1, 'read');

  const value = pop(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('read: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Check if empty: readPtr == writePtr
  if (readPtr === writePtr) {
    throw new Error('Buffer underflow');
  }

  // Calculate data base address
  const dataBase = getDataBase(headerCell, capacity);

  // Read from data[readPtr]
  const result = vm.memory.readCell(dataBase + readPtr);

  // Update readPtr: (readPtr + 1) % N
  const newReadPtr = (readPtr + 1) % capacity;
  vm.memory.writeCell(headerCell - 1, newReadPtr);

  // Return value
  push(vm, result);
}

/**
 * unread: Pushes a value back into the buffer (queue semantics using read pointer).
 * Stack: ( x buffer/ref -- )
 * Alias: unshift
 */
export function unreadOp(vm: VM): void {
  ensureStackSize(vm, 2, 'unread');

  const value = pop(vm); // buffer/ref (closer to op)
  const x = pop(vm); // value (from earlier operations)
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('unread: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Check if full: (readPtr - 1 + N) % N == writePtr
  const prevReadPtr = (readPtr - 1 + capacity) % capacity;
  if (prevReadPtr === writePtr) {
    throw new Error('Buffer full, cannot unread');
  }

  // Calculate data base address
  const dataBase = getDataBase(headerCell, capacity);

  // Decrement readPtr: (readPtr - 1 + N) % N
  const newReadPtr = prevReadPtr;

  // Write x to data[newReadPtr]
  vm.memory.writeCell(dataBase + newReadPtr, x);

  // Update readPtr
  vm.memory.writeCell(headerCell - 1, newReadPtr);
}

