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
 * Creates a REF tagged value for an absolute cell index.
 * @param absoluteCellIndex - Absolute cell index in unified data arena
 * @returns Tagged REF value
 * @throws {RangeError} If index is out of bounds
 */
export function createRef(absoluteCellIndex: number): number {
  if (absoluteCellIndex < 0 || absoluteCellIndex >= TOTAL_DATA) {
    throw new RangeError(`REF absolute cell index ${absoluteCellIndex} is out of bounds`);
  }
  return toTaggedValue(absoluteCellIndex, Tag.REF);
}

/**
 * Decodes a REF tagged value to extract the absolute cell index.
 * @param ref - REF tagged value
 * @returns Object containing absolute cell index
 * @throws {Error} If value is not a REF
 */
export function decodeRef(ref: number): { absoluteCellIndex: number } {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.REF) {
    throw new Error('decodeRef called with non-REF value');
  }
  return { absoluteCellIndex: value };
}

/**
 * Extracts absolute cell index from a REF.
 * @param ref - REF tagged value
 * @returns Absolute cell index
 * @throws {Error} If value is not a REF or index is out of bounds
 */
export function getAbsoluteCellIndexFromRef(ref: number): number {
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
 * Converts a REF to its absolute byte address.
 * @param ref - REF tagged value
 * @returns Absolute byte address
 */
export function getByteAddressFromRef(ref: number): number {
  return getAbsoluteCellIndexFromRef(ref) * CELL_SIZE;
}

/**
 * Reads a value from memory using a REF.
 * @param vm - VM instance
 * @param ref - REF tagged value
 * @returns Value read from memory
 */
export function readRefValue(vm: VM, ref: number): number {
  const cellIndex = getAbsoluteCellIndexFromRef(ref);
  return vm.memory.readCell(cellIndex);
}

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
export function getRefRegion(ref: number): 'global' | 'stack' | 'rstack' {
  const absByte = getByteAddressFromRef(ref);
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
  const absByte = getByteAddressFromRef(ref);
  return absByte >= GLOBAL_BASE_BYTES && absByte < STACK_BASE_BYTES;
}

/**
 * Checks if a REF points into the data stack area.
 * @param ref - REF tagged value
 * @returns True if ref is in the data stack area
 */
export function isStackRef(ref: number): boolean {
  const absByte = getByteAddressFromRef(ref);
  return absByte >= STACK_BASE_BYTES && absByte < RSTACK_BASE_BYTES;
}

/**
 * Checks if a REF points into the return stack area.
 * @param ref - REF tagged value
 * @returns True if ref is in the return stack area
 */
export function isRStackRef(ref: number): boolean {
  const absByte = getByteAddressFromRef(ref);
  return absByte >= RSTACK_BASE_BYTES;
}

/**
 * Gets the segment number for a REF based on its address range.
 * @param ref - REF tagged value
 * @returns Segment number (0=global, 1=stack, 2=rstack)
 * @deprecated Prefer using getRefRegion() or the boolean functions (isGlobalRef, isStackRef, isRStackRef)
 */
export function getRefSegment(ref: number): number {
  const absByte = getByteAddressFromRef(ref);
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
export function writeReference(vm: VM, ref: number, value: number): void {
  const cellIndex = getAbsoluteCellIndexFromRef(ref);
  vm.memory.writeCell(cellIndex, value);
}
