/**
 * @file src/core/refs.ts
 * Reference utilities for polymorphic memory addressing.
 */

import type { VM } from './vm';
import { fromTaggedValue, toTaggedValue, getTag, Tag } from './tagged';
import {
  SEG_DATA,
  STACK_BASE_BYTES,
  RSTACK_BASE_BYTES,
  RSTACK_BASE,
  RSTACK_TOP,
  GLOBAL_BASE_BYTES,
  GLOBAL_BASE,
  GLOBAL_SIZE_BYTES,
  GLOBAL_SIZE,
  TOTAL_DATA_BYTES,
  TOTAL_DATA,
  CELL_SIZE,
} from './constants';

/**
 * Creates a REF tagged value from a cell index.
 * @param cellIndex - Cell index in unified data arena
 * @returns Tagged REF value
 * @throws {RangeError} If index is out of bounds
 */
export function createRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex >= TOTAL_DATA) {
    throw new RangeError(`REF cell index ${cellIndex} is out of bounds`);
  }
  return toTaggedValue(cellIndex, Tag.REF);
}

/**
 * Decodes a REF tagged value to extract the cell index.
 * @param ref - REF tagged value
 * @returns Object containing cell index
 * @throws {Error} If value is not a REF
 */
export function decodeRef(ref: number): { cellIndex: number } {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.REF) {
    throw new Error('decodeRef called with non-REF value');
  }
  return { cellIndex: value };
}

/**
 * Extracts cell index from a REF.
 * @param ref - REF tagged value
 * @returns Cell index
 * @throws {Error} If value is not a REF or index is out of bounds
 */
export function getCellFromRef(ref: number): number {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.REF) {
    throw new Error('Expected REF');
  }
  if (value < 0 || value >= TOTAL_DATA) {
    throw new RangeError('REF absolute out of bounds');
  }
  return value;
}

/**
 * Converts a REF to its byte address.
 * @param ref - REF tagged value
 * @returns Byte address
 */
export function refToByte(ref: number): number {
  return getCellFromRef(ref) * CELL_SIZE;
}

/**
 * Reads a value from memory using a REF.
 * @param vm - VM instance
 * @param ref - REF tagged value
 * @returns Value read from memory
 */
export function readRef(vm: VM, ref: number): number {
  const cell = getCellFromRef(ref);
  return vm.memory.readCell(cell);
}

/**
 * @deprecated Use readRef instead
 */
export const readRefValue = readRef;

/**
 * Checks if a tagged value is a REF.
 * @param tval - Tagged value to check
 * @returns True if value is a REF
 */
export function isRef(tval: number): boolean {
  return getTag(tval) === Tag.REF;
}

/**
 * Gets the area name for a REF based on its address range.
 * The data segment consists of three contiguous areas:
 * - Global: lowest area, starting at 0, limited to 64K cells
 * - Stack: data stack area
 * - RStack: return stack area
 *
 * @param ref - REF tagged value
 * @returns Area name ('global', 'stack', or 'rstack')
 */
export function getRefArea(ref: number): 'global' | 'stack' | 'rstack' {
  const absByte = refToByte(ref);
  if (absByte >= GLOBAL_BASE_BYTES && absByte < STACK_BASE_BYTES) {
    return 'global';
  }
  if (absByte >= STACK_BASE_BYTES && absByte < RSTACK_BASE_BYTES) {
    return 'stack';
  }
  return 'rstack';
}

/**
 * Checks if a REF points into the global area.
 * @param ref - REF tagged value
 * @returns True if ref is in the global area
 */
export function isGlobalRef(ref: number): boolean {
  const absByte = refToByte(ref);
  return absByte >= GLOBAL_BASE_BYTES && absByte < STACK_BASE_BYTES;
}

/**
 * Checks if a REF points into the data stack area.
 * @param ref - REF tagged value
 * @returns True if ref is in the data stack area
 */
export function isStackRef(ref: number): boolean {
  const absByte = refToByte(ref);
  return absByte >= STACK_BASE_BYTES && absByte < RSTACK_BASE_BYTES;
}

/**
 * Checks if a REF points into the return stack area.
 * @param ref - REF tagged value
 * @returns True if ref is in the return stack area
 */
export function isRStackRef(ref: number): boolean {
  const absByte = refToByte(ref);
  return absByte >= RSTACK_BASE_BYTES;
}

/**
 * Gets the segment number for a REF based on its address range.
 * @param ref - REF tagged value
 * @returns Segment number (0=global, 1=stack, 2=rstack)
 * @deprecated Prefer using getRefArea() or the boolean functions (isGlobalRef, isStackRef, isRStackRef)
 */
export function getRefSegment(ref: number): number {
  const absByte = refToByte(ref);
  if (absByte >= GLOBAL_BASE_BYTES && absByte < STACK_BASE_BYTES) {
    return 0; // global
  }
  if (absByte >= STACK_BASE_BYTES && absByte < RSTACK_BASE_BYTES) {
    return 1; // stack
  }
  return 2; // rstack
}

/**
 * Creates a REF to a local variable slot in the current frame.
 * @param vm - VM instance
 * @param slotNumber - Local variable slot number (0-based)
 * @returns REF tagged value
 * @throws {Error} If slot number is negative
 * @throws {RangeError} If reference is outside return stack bounds
 */
export function getVarRef(vm: VM, slotNumber: number): number {
  if (slotNumber < 0) {
    throw new Error('Slot number must be non-negative');
  }

  const absCellIndex = vm.bp + slotNumber;
  if (absCellIndex < RSTACK_BASE || absCellIndex >= RSTACK_TOP) {
    throw new RangeError('Local reference outside return stack bounds');
  }
  return createRef(absCellIndex);
}

/**
 * Creates a REF to a global heap cell.
 * @param cellIndex - Global cell index (relative to global base)
 * @returns REF tagged value
 * @throws {RangeError} If cell index is out of bounds
 */
export function createGlobalRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex >= GLOBAL_SIZE) {
    throw new RangeError('Global reference outside global segment bounds');
  }
  const absCellIndex = GLOBAL_BASE + cellIndex;
  return createRef(absCellIndex);
}

/**
 * Writes a value to memory using a REF.
 * @param vm - VM instance
 * @param ref - REF tagged value
 * @param value - Value to write
 */
export function writeRef(vm: VM, ref: number, value: number): void {
  const cell = getCellFromRef(ref);
  vm.memory.writeCell(cell, value);
}

/**
 * @deprecated Use writeRef instead
 */
export const writeReference = writeRef;
