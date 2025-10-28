/**
 * @file src/core/refs.ts
 * Reference utilities for polymorphic memory addressing.
 */

import { VM } from './vm';
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

// Removed legacy window classification helpers; absolute addressing is authoritative

// Removed legacy createDataRef/decodeDataRef in favor of absolute-only APIs

/**
 * Phase A: Absolute-only helpers for unified data addressing.
 * These do not classify into legacy windows and should be used by new code paths.
 */
export function createDataRef(absoluteCellIndex: number): number {
  if (absoluteCellIndex < 0 || absoluteCellIndex >= TOTAL_DATA_CELLS) {
    throw new RangeError(`DATA_REF absolute cell index ${absoluteCellIndex} is out of bounds`);
  }
  return toTaggedValue(absoluteCellIndex, Tag.DATA_REF);
}

export function decodeDataRef(ref: number): { absoluteCellIndex: number } {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.DATA_REF) {
    throw new Error('decodeDataRef called with non-DATA_REF value');
  }
  return { absoluteCellIndex: value };
}

/**
 * Phase C helpers: absolute addressing utilities that do not rely on window classification.
 */
export function getAbsoluteCellIndexFromRef(ref: number): number {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.DATA_REF) throw new Error('Expected DATA_REF');
  if (value < 0 || value >= TOTAL_DATA_CELLS)
    throw new RangeError('DATA_REF absolute out of bounds');
  return value;
}

export function getAbsoluteByteAddressFromRef(ref: number): number {
  return getAbsoluteCellIndexFromRef(ref) * CELL_SIZE;
}

// Preferred alias: unified address space, no need to say "absolute"
export function getByteAddressFromRef(ref: number): number {
  return getAbsoluteByteAddressFromRef(ref);
}

export function readRefValue(vm: VM, ref: number): number {
  const byteAddr = getAbsoluteByteAddressFromRef(ref);
  return vm.memory.readFloat32(SEG_DATA, byteAddr);
}

export function isRef(tval: number): boolean {
  return getTag(tval) === Tag.DATA_REF;
}

export function isDataRef(tval: number): boolean {
  return isRef(tval);
}

export function getRefSegment(ref: number): number {
  // Phase C: classify by absolute byte address against unified data windows
  const absByte = getAbsoluteByteAddressFromRef(ref);
  if (absByte >= GLOBAL_BASE && absByte < STACK_BASE) return 2;
  if (absByte >= STACK_BASE && absByte < RSTACK_BASE) return 0;
  return 1;
}

/**
 * Region classifier for DATA_REFs that returns string labels instead of numeric ids.
 * Use for guards/validation; not for addressing.
 */
export function getRefRegion(ref: number): 'global' | 'stack' | 'rstack' {
  const absByte = getAbsoluteByteAddressFromRef(ref);
  if (absByte >= GLOBAL_BASE && absByte < STACK_BASE) return 'global';
  if (absByte >= STACK_BASE && absByte < RSTACK_BASE) return 'stack';
  return 'rstack';
}

export function getVarRef(vm: VM, slotNumber: number): number {
  if (slotNumber < 0) {
    throw new Error('Slot number must be non-negative');
  }

  // Compute absolute cell index directly from absolute bp
  const absCellIndex = vm.bp + slotNumber;
  // Bounds check against return stack window
  if (absCellIndex < RSTACK_BASE_CELLS || absCellIndex >= RSTACK_TOP_CELLS) {
    throw new RangeError('Local reference outside return stack bounds');
  }
  return createDataRef(absCellIndex);
}

export function createGlobalRef(cellIndex: number): number {
  // Phase C: return absolute DATA_REF for global cell index
  if (cellIndex < 0 || cellIndex >= GLOBAL_SIZE / CELL_SIZE) {
    throw new RangeError('Global reference outside global segment bounds');
  }
  const absCellIndex = GLOBAL_BASE / CELL_SIZE + cellIndex;
  return createDataRef(absCellIndex);
}

/**
 * Result of reference resolution containing memory address and segment.
 */
// Removed legacy resolveReference; use getAbsoluteByteAddressFromRef instead

/**
 * Reads a value from memory using a polymorphic reference.
 */
export function readReference(vm: VM, ref: number): number {
  // Phase C: absolute-only dereference via unified SEG_DATA
  const address = getAbsoluteByteAddressFromRef(ref);
  return vm.memory.readFloat32(SEG_DATA, address);
}

/**
 * Writes a value to memory using a polymorphic reference.
 */
export function writeReference(vm: VM, ref: number, value: number): void {
  // Phase C: absolute-only dereference via unified SEG_DATA
  const address = getAbsoluteByteAddressFromRef(ref);
  vm.memory.writeFloat32(SEG_DATA, address, value);
}
