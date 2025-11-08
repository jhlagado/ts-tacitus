/**
 * @file src/core/refs.ts
 * Reference utilities for polymorphic memory addressing.
 */

import type { VM } from './vm';
import { fromTaggedValue, toTaggedValue, getTag, Tag } from './tagged';
import {
  SEG_DATA,
  STACK_BASE,
  RSTACK_BASE,
  RSTACK_BASE_CELLS,
  RSTACK_TOP_CELLS,
  GLOBAL_BASE,
  GLOBAL_SIZE,
  TOTAL_DATA_BYTES,
  CELL_SIZE,
} from './constants';

const TOTAL_DATA_CELLS = TOTAL_DATA_BYTES / CELL_SIZE;

/**
 * Creates a DATA_REF tagged value for an absolute cell index.
 * @param absoluteCellIndex - Absolute cell index in unified data arena
 * @returns Tagged DATA_REF value
 * @throws {RangeError} If index is out of bounds
 */
export function createDataRef(absoluteCellIndex: number): number {
  if (absoluteCellIndex < 0 || absoluteCellIndex >= TOTAL_DATA_CELLS) {
    throw new RangeError(`DATA_REF absolute cell index ${absoluteCellIndex} is out of bounds`);
  }
  return toTaggedValue(absoluteCellIndex, Tag.DATA_REF);
}

/**
 * Decodes a DATA_REF tagged value to extract the absolute cell index.
 * @param ref - DATA_REF tagged value
 * @returns Object containing absolute cell index
 * @throws {Error} If value is not a DATA_REF
 */
export function decodeDataRef(ref: number): { absoluteCellIndex: number } {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.DATA_REF) {
    throw new Error('decodeDataRef called with non-DATA_REF value');
  }
  return { absoluteCellIndex: value };
}

/**
 * Extracts absolute cell index from a DATA_REF.
 * @param ref - DATA_REF tagged value
 * @returns Absolute cell index
 * @throws {Error} If value is not a DATA_REF or index is out of bounds
 */
export function getAbsoluteCellIndexFromRef(ref: number): number {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.DATA_REF) {
    throw new Error('Expected DATA_REF');
  }
  if (value < 0 || value >= TOTAL_DATA_CELLS) {
    throw new RangeError('DATA_REF absolute out of bounds');
  }
  return value;
}

/**
 * Converts a DATA_REF to its absolute byte address.
 * @param ref - DATA_REF tagged value
 * @returns Absolute byte address
 */
export function getByteAddressFromRef(ref: number): number {
  return getAbsoluteCellIndexFromRef(ref) * CELL_SIZE;
}

/**
 * Reads a value from memory using a DATA_REF.
 * @param vm - VM instance
 * @param ref - DATA_REF tagged value
 * @returns Value read from memory
 */
export function readRefValue(vm: VM, ref: number): number {
  const byteAddr = getByteAddressFromRef(ref);
  return vm.memory.readFloat32(SEG_DATA, byteAddr);
}

/**
 * Checks if a tagged value is a DATA_REF.
 * @param tval - Tagged value to check
 * @returns True if value is a DATA_REF
 */
export function isRef(tval: number): boolean {
  return getTag(tval) === Tag.DATA_REF;
}

/**
 * Checks if a tagged value is a DATA_REF (alias for isRef).
 * @param tval - Tagged value to check
 * @returns True if value is a DATA_REF
 */
export function isDataRef(tval: number): boolean {
  return isRef(tval);
}

/**
 * Gets the segment number for a DATA_REF based on its address range.
 * @param ref - DATA_REF tagged value
 * @returns Segment number (0=stack, 1=rstack, 2=global)
 */
export function getRefSegment(ref: number): number {
  const absByte = getByteAddressFromRef(ref);
  if (absByte >= GLOBAL_BASE && absByte < STACK_BASE) {
    return 2;
  }
  if (absByte >= STACK_BASE && absByte < RSTACK_BASE) {
    return 0;
  }
  return 1;
}

/**
 * Gets the region name for a DATA_REF based on its address range.
 * @param ref - DATA_REF tagged value
 * @returns Region name ('global', 'stack', or 'rstack')
 */
export function getRefRegion(ref: number): 'global' | 'stack' | 'rstack' {
  const absByte = getByteAddressFromRef(ref);
  if (absByte >= GLOBAL_BASE && absByte < STACK_BASE) {
    return 'global';
  }
  if (absByte >= STACK_BASE && absByte < RSTACK_BASE) {
    return 'stack';
  }
  return 'rstack';
}

/**
 * Creates a DATA_REF to a local variable slot in the current frame.
 * @param vm - VM instance
 * @param slotNumber - Local variable slot number (0-based)
 * @returns DATA_REF tagged value
 * @throws {Error} If slot number is negative
 * @throws {RangeError} If reference is outside return stack bounds
 */
export function getVarRef(vm: VM, slotNumber: number): number {
  if (slotNumber < 0) {
    throw new Error('Slot number must be non-negative');
  }

  const absCellIndex = vm.bp + slotNumber;
  if (absCellIndex < RSTACK_BASE_CELLS || absCellIndex >= RSTACK_TOP_CELLS) {
    throw new RangeError('Local reference outside return stack bounds');
  }
  return createDataRef(absCellIndex);
}

/**
 * Creates a DATA_REF to a global heap cell.
 * @param cellIndex - Global cell index (relative to global base)
 * @returns DATA_REF tagged value
 * @throws {RangeError} If cell index is out of bounds
 */
export function createGlobalRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex >= GLOBAL_SIZE / CELL_SIZE) {
    throw new RangeError('Global reference outside global segment bounds');
  }
  const absCellIndex = GLOBAL_BASE / CELL_SIZE + cellIndex;
  return createDataRef(absCellIndex);
}

/**
 * Reads a value from memory using a DATA_REF.
 * @param vm - VM instance
 * @param ref - DATA_REF tagged value
 * @returns Value read from memory
 */
export function readReference(vm: VM, ref: number): number {
  const address = getByteAddressFromRef(ref);
  return vm.memory.readFloat32(SEG_DATA, address);
}

/**
 * Writes a value to memory using a DATA_REF.
 * @param vm - VM instance
 * @param ref - DATA_REF tagged value
 * @param value - Value to write
 */
export function writeReference(vm: VM, ref: number, value: number): void {
  const address = getByteAddressFromRef(ref);
  vm.memory.writeFloat32(SEG_DATA, address, value);
}
