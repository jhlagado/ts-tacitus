/**
 * @file src/core/refs.ts
 * Reference utilities for polymorphic memory addressing.
 */

import { VM } from './vm';
import { fromTaggedValue, toTaggedValue, getTag, Tag } from './tagged';
import {
  SEG_STACK,
  SEG_RSTACK,
  SEG_GLOBAL,
  SEG_DATA,
  STACK_BASE,
  STACK_SIZE,
  RSTACK_BASE,
  RSTACK_SIZE,
  GLOBAL_BASE,
  GLOBAL_SIZE,
  TOTAL_DATA_BYTES,
  CELL_SIZE,
} from './constants';

const TOTAL_DATA_CELLS = TOTAL_DATA_BYTES / CELL_SIZE;

interface SegmentWindow {
  segment: number;
  baseBytes: number;
  topBytes: number;
}

const DATA_SEGMENT_WINDOWS: SegmentWindow[] = [
  { segment: SEG_GLOBAL, baseBytes: GLOBAL_BASE, topBytes: GLOBAL_BASE + GLOBAL_SIZE },
  { segment: SEG_STACK, baseBytes: STACK_BASE, topBytes: STACK_BASE + STACK_SIZE },
  { segment: SEG_RSTACK, baseBytes: RSTACK_BASE, topBytes: RSTACK_BASE + RSTACK_SIZE },
];

function getSegmentWindow(segment: number): SegmentWindow {
  const window = DATA_SEGMENT_WINDOWS.find(entry => entry.segment === segment);
  if (!window) {
    throw new Error(`Unsupported DATA_REF segment: ${segment}`);
  }
  return window;
}

function toAbsoluteCellIndex(segment: number, segmentCellIndex: number): number {
  const { baseBytes, topBytes } = getSegmentWindow(segment);
  const segmentCellCount = (topBytes - baseBytes) / CELL_SIZE;
  if (segmentCellIndex < 0 || segmentCellIndex >= segmentCellCount) {
    throw new RangeError(
      `DATA_REF cell index ${segmentCellIndex} exceeds segment capacity ${segmentCellCount}`,
    );
  }
  return baseBytes / CELL_SIZE + segmentCellIndex;
}

function classifyAbsoluteCellIndex(absoluteCellIndex: number): {
  segment: number;
  segmentCellIndex: number;
} {
  if (absoluteCellIndex < 0 || absoluteCellIndex >= TOTAL_DATA_CELLS) {
    throw new RangeError(`DATA_REF absolute cell index ${absoluteCellIndex} is out of bounds`);
  }

  const byteOffset = absoluteCellIndex * CELL_SIZE;
  const window = DATA_SEGMENT_WINDOWS.find(
    ({ baseBytes, topBytes }) => byteOffset >= baseBytes && byteOffset < topBytes,
  );

  if (!window) {
    throw new RangeError(`DATA_REF byte offset ${byteOffset} does not map to a data segment`);
  }

  const segmentCellIndex = (byteOffset - window.baseBytes) / CELL_SIZE;
  return { segment: window.segment, segmentCellIndex };
}

export interface DataRefComponents {
  segment: number;
  cellIndex: number;
  absoluteCellIndex: number;
}

/**
 * @deprecated Phase C: Prefer createDataRefAbs(absoluteCellIndex).
 * Accepts legacy (segment, cellIndex) and emits an absolute DATA_REF. Kept for tests/compat
 * until the final flip removes segment-derived APIs from runtime paths.
 */
export function createDataRef(segment: number, cellIndex: number): number {
  const absoluteCellIndex = toAbsoluteCellIndex(segment, cellIndex);
  return toTaggedValue(absoluteCellIndex, Tag.DATA_REF);
}

/**
 * @deprecated Phase C: Prefer decodeDataRefAbs(ref).
 * @internal Test-only compatibility: retained for tests until final removal.
 * Returns legacy classification alongside absolute index.
 */
export function decodeDataRef(ref: number): DataRefComponents {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.DATA_REF) {
    throw new Error('decodeDataRef called with non-DATA_REF value');
  }

  const { segment, segmentCellIndex } = classifyAbsoluteCellIndex(value);
  return {
    segment,
    cellIndex: segmentCellIndex,
    absoluteCellIndex: value,
  };
}

/**
 * Phase A: Absolute-only helpers for unified data addressing.
 * These do not classify into legacy windows and should be used by new code paths.
 */
export function createDataRefAbs(absoluteCellIndex: number): number {
  if (absoluteCellIndex < 0 || absoluteCellIndex >= TOTAL_DATA_CELLS) {
    throw new RangeError(`DATA_REF absolute cell index ${absoluteCellIndex} is out of bounds`);
  }
  return toTaggedValue(absoluteCellIndex, Tag.DATA_REF);
}

export function decodeDataRefAbs(ref: number): { absoluteCellIndex: number } {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.DATA_REF) {
    throw new Error('decodeDataRefAbs called with non-DATA_REF value');
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

export function readRefValueAbs(vm: VM, ref: number): number {
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
  if (absByte >= GLOBAL_BASE && absByte < STACK_BASE) return SEG_GLOBAL;
  if (absByte >= STACK_BASE && absByte < RSTACK_BASE) return SEG_STACK;
  return SEG_RSTACK;
}

/**
 * @deprecated Phase C: Prefer createDataRefAbs(absoluteCellIndex). Alias for createDataRef.
 */
export function createSegmentRef(segment: number, cellIndex: number): number {
  return createDataRef(segment, cellIndex);
}

export function getVarRef(vm: VM, slotNumber: number): number {
  if (slotNumber < 0) {
    throw new Error('Slot number must be non-negative');
  }

  const segmentCellIndex = vm.BP + slotNumber;
  const maxCells = RSTACK_SIZE / CELL_SIZE;
  if (segmentCellIndex < 0 || segmentCellIndex >= maxCells) {
    throw new RangeError('Local reference outside return stack bounds');
  }
  // Phase C: return absolute DATA_REF for local variable slot
  const absCellIndex = RSTACK_BASE / CELL_SIZE + segmentCellIndex;
  return createDataRefAbs(absCellIndex);
}

export function createGlobalRef(cellIndex: number): number {
  // Phase C: return absolute DATA_REF for global cell index
  if (cellIndex < 0 || cellIndex >= GLOBAL_SIZE / CELL_SIZE) {
    throw new RangeError('Global reference outside global segment bounds');
  }
  const absCellIndex = GLOBAL_BASE / CELL_SIZE + cellIndex;
  return createDataRefAbs(absCellIndex);
}

/**
 * Result of reference resolution containing memory address and segment.
 */
export interface ResolvedReference {
  address: number;
  segment: number;
}

/**
 * @deprecated Phase C: Prefer getAbsoluteByteAddressFromRef(ref) with unified SEG_DATA I/O.
 * @internal Test-only compatibility: retained for tests until final removal.
 * Polymorphic resolver that returns legacy (segment, address) from an absolute DATA_REF.
 */
export function resolveReference(vm: VM, ref: number): ResolvedReference {
  if (!isRef(ref)) {
    throw new Error(`Invalid reference type: ${getTag(ref)}`);
  }
  // Phase C: resolve via absolute byte address and classify to legacy window
  const absByte = getAbsoluteByteAddressFromRef(ref);
  if (absByte >= GLOBAL_BASE && absByte < STACK_BASE) {
    return { address: absByte - GLOBAL_BASE, segment: SEG_GLOBAL };
  }
  if (absByte >= STACK_BASE && absByte < RSTACK_BASE) {
    return { address: absByte - STACK_BASE, segment: SEG_STACK };
  }
  return { address: absByte - RSTACK_BASE, segment: SEG_RSTACK };
}

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
