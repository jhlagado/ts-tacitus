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
  STACK_BASE,
} from '@src/core';
import { push, pop, peek, ensureStackSize } from '../../core/vm';
import { Tagged } from '@src/core';
import { dropOp } from '../stack';

/**
 * Resolves a buffer input (LIST header or REF) and extracts buffer metadata.
 * Works exactly like other list operations - uses getListBounds polymorphically.
 * @param vm VM instance
 * @param value Input value (LIST header or REF)
 * @returns Buffer metadata or null if invalid
 */
function resolveBuffer(
  vm: VM,
  value: number,
): { header: number; headerCell: number; capacity: number } | null {
  // Use getListBounds exactly like other list operations (lengthOp, walkOp, etc.)
  const bounds = getListBounds(vm, value);
  if (!bounds || !isList(bounds.header)) {
    return null;
  }

  const { header, headerCell } = bounds;
  const totalPayloadSlots = getListLength(header);
  const capacity = totalPayloadSlots - 2;

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
 * Calculates the span (number of stack cells) occupied by a single element.
 * Simple values occupy one cell; LIST headers occupy payload slots + header.
 */
function getElementSpan(value: number): number {
  const { tag, value: payloadSlots } = getTaggedInfo(value);
  if (tag === Tag.LIST) {
    return payloadSlots + 1;
  }
  return 1;
}

/**
 * Extracts the value directly beneath the buffer element on the stack.
 * Returns metadata required to remove both elements after the operation.
 */
function getValueBelowBuffer(
  vm: VM,
  bufferSpan: number,
  opName: string,
): { value: number; valueSpan: number; valueStart: number } {
  const bufferHeaderIndex = vm.sp - 1;
  const valueHeaderIndex = bufferHeaderIndex - bufferSpan;

  if (valueHeaderIndex < STACK_BASE) {
    throw new Error(`${opName}: expected value before buffer`);
  }

  const value = vm.memory.readCell(valueHeaderIndex);
  const valueSpan = getElementSpan(value);
  const valueStart = valueHeaderIndex - (valueSpan - 1);

  if (valueStart < STACK_BASE) {
    throw new Error(`${opName}: malformed value for ${opName}`);
  }

  return { value, valueSpan, valueStart };
}

/**
 * Normalizes an absolute pointer index into the buffer's data window.
 */
function normalizeIndex(index: number, capacity: number): number {
  if (capacity === 0) {
    return 0;
  }
  const mod = index % capacity;
  return mod < 0 ? mod + capacity : mod;
}

/**
 * Removes the consumed value while preserving the buffer on the stack when it was passed directly.
 */
function cleanupAfterValue(
  vm: VM,
  isDirectList: boolean,
  bufferSpan: number,
  valueSpan: number,
  valueStart: number,
): void {
  if (valueSpan <= 0) {
    return;
  }

  if (!isDirectList) {
    vm.sp = valueStart;
    return;
  }

  const bufferStart = vm.sp - bufferSpan;
  for (let i = 0; i < bufferSpan; i++) {
    const sourceIndex = bufferStart + i;
    const destIndex = valueStart + i;
    const cell = vm.memory.readCell(sourceIndex);
    vm.memory.writeCell(destIndex, cell);
  }
  vm.sp -= valueSpan;
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
    throw new Error('capacity must be >= 1');
  }

  // Allocate LIST with N+2 payload slots (readPtr + writePtr + N data slots)
  const payloadSlots = n + 2;

  // Allocate space for payload (we'll write pointers and leave data uninitialized)
  // Push NIL values for payload slots (will be overwritten)
  for (let i = 0; i < payloadSlots; i++) {
    push(vm, NIL);
  }

  // Push LIST header first (header is at TOS)
  const header = Tagged(payloadSlots, Tag.LIST);
  push(vm, header);

  // Now calculate headerCell (TOS after pushing header)
  const headerCell = vm.sp - 1;

  // Initialize readPtr = 0 at headerCell - 1 (store as raw number, logical index)
  vm.memory.writeCell(headerCell - 1, 0); // readPtr
  vm.memory.writeCell(headerCell - 2, 0); // writePtr
}

/**
 * buf-size: Returns the current number of elements in the buffer.
 * Stack: ( buffer/ref -- n )
 */
export function bufSizeOp(vm: VM): void {
  ensureStackSize(vm, 1, 'buf-size');

  const value = peek(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('buf-size: Expected buffer (LIST or REF)');
  }

  const { headerCell } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Consume input using dropOp (works for both LIST headers and REFs, like other list ops)
  dropOp(vm);

  const size = writePtr - readPtr;
  push(vm, Tagged(size, Tag.NUMBER));
}

/**
 * is-empty: Returns 1 if buffer is empty, 0 otherwise.
 * Stack: ( buffer/ref -- 0|1 )
 */
export function isEmptyOp(vm: VM): void {
  ensureStackSize(vm, 1, 'is-empty');

  const value = peek(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('is-empty: Expected buffer (LIST or REF)');
  }

  const { headerCell } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Consume input using dropOp (works for both LIST headers and REFs, like other list ops)
  dropOp(vm);

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

  const value = peek(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('is-full: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  // Consume input using dropOp (works for both LIST headers and REFs, like other list ops)
  dropOp(vm);

  const isFull = writePtr - readPtr === capacity ? 1 : 0;
  push(vm, Tagged(isFull, Tag.NUMBER));
}

/**
 * write: Writes a value to the buffer (stack semantics using write pointer).
 * Stack: ( x buffer/ref -- )
 * Alias: push
 */
export function writeOp(vm: VM): void {
  ensureStackSize(vm, 2, 'write');

  const bufferValue = peek(vm);
  const bufferSpan = getElementSpan(bufferValue);
  const isDirectList = getTaggedInfo(bufferValue).tag === Tag.LIST;

  const { value: x, valueSpan, valueStart } = getValueBelowBuffer(vm, bufferSpan, 'write');
  const cleanup = (): void => {
    cleanupAfterValue(vm, isDirectList, bufferSpan, valueSpan, valueStart);
  };

  if (valueSpan !== 1) {
    cleanup();
    throw new Error('write: value must be single cell');
  }

  const bufferInfo = resolveBuffer(vm, bufferValue);

  if (!bufferInfo) {
    cleanup();
    throw new Error('write: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);
  const currentSize = writePtr - readPtr;

  if (currentSize === capacity) {
    cleanup();
    throw new Error('Buffer overflow');
  }

  const dataBase = getDataBase(headerCell, capacity);
  const slotIndex = normalizeIndex(writePtr, capacity);
  vm.memory.writeCell(dataBase + slotIndex, x);
  vm.memory.writeCell(headerCell - 2, writePtr + 1);

  cleanup();
}

/**
 * unwrite: Unwrites a value from the buffer (stack semantics using write pointer).
 * Stack: ( buffer/ref -- v )
 * Alias: pop
 */
export function unwriteOp(vm: VM): void {
  ensureStackSize(vm, 1, 'unwrite');

  const value = peek(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('unwrite: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  if (writePtr === readPtr) {
    dropOp(vm);
    throw new Error('Buffer underflow');
  }

  const dataBase = getDataBase(headerCell, capacity);
  const newWritePtr = writePtr - 1;
  const slotIndex = normalizeIndex(newWritePtr, capacity);
  const result = vm.memory.readCell(dataBase + slotIndex);

  vm.memory.writeCell(headerCell - 2, newWritePtr);
  dropOp(vm);
  push(vm, result);
}

/**
 * read: Reads a value from the buffer (queue semantics using read pointer).
 * Stack: ( buffer/ref -- v )
 * Alias: shift
 */
export function readOp(vm: VM): void {
  ensureStackSize(vm, 1, 'read');

  const value = peek(vm);
  const bufferInfo = resolveBuffer(vm, value);

  if (!bufferInfo) {
    throw new Error('read: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);

  if (readPtr === writePtr) {
    dropOp(vm);
    throw new Error('Buffer underflow');
  }

  const dataBase = getDataBase(headerCell, capacity);
  const slotIndex = normalizeIndex(readPtr, capacity);
  const result = vm.memory.readCell(dataBase + slotIndex);

  vm.memory.writeCell(headerCell - 1, readPtr + 1);
  dropOp(vm);
  push(vm, result);
}

/**
 * unread: Pushes a value back into the buffer (queue semantics using read pointer).
 * Stack: ( x buffer/ref -- )
 * Alias: unshift
 */
export function unreadOp(vm: VM): void {
  ensureStackSize(vm, 2, 'unread');

  const bufferValue = peek(vm);
  const bufferSpan = getElementSpan(bufferValue);
  const isDirectList = getTaggedInfo(bufferValue).tag === Tag.LIST;

  const { value: x, valueSpan, valueStart } = getValueBelowBuffer(vm, bufferSpan, 'unread');
  const cleanup = (): void => {
    cleanupAfterValue(vm, isDirectList, bufferSpan, valueSpan, valueStart);
  };

  if (valueSpan !== 1) {
    cleanup();
    throw new Error('unread: value must be single cell');
  }

  const bufferInfo = resolveBuffer(vm, bufferValue);

  if (!bufferInfo) {
    cleanup();
    throw new Error('unread: Expected buffer (LIST or REF)');
  }

  const { headerCell, capacity } = bufferInfo;
  const [readPtr, writePtr] = getBufferPointers(vm, headerCell);
  const currentSize = writePtr - readPtr;

  if (currentSize === capacity) {
    cleanup();
    throw new Error('Buffer full, cannot unread');
  }

  const dataBase = getDataBase(headerCell, capacity);
  const newReadPtr = readPtr - 1;
  const slotIndex = normalizeIndex(newReadPtr, capacity);
  vm.memory.writeCell(dataBase + slotIndex, x);
  vm.memory.writeCell(headerCell - 1, newReadPtr);

  cleanup();
}
