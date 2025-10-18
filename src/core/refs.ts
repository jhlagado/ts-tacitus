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
  const window = DATA_SEGMENT_WINDOWS.find((entry) => entry.segment === segment);
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

function classifyAbsoluteCellIndex(
  absoluteCellIndex: number,
): { segment: number; segmentCellIndex: number } {
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

export function createDataRef(segment: number, cellIndex: number): number {
  const absoluteCellIndex = toAbsoluteCellIndex(segment, cellIndex);
  return toTaggedValue(absoluteCellIndex, Tag.DATA_REF);
}

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
 * Checks if a value is a reference (legacy STACK/RSTACK/GLOBAL or unified DATA_REF).
 */
export function isRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return (
    tag === Tag.STACK_REF ||
    tag === Tag.RSTACK_REF ||
    tag === Tag.GLOBAL_REF ||
    tag === Tag.DATA_REF
  );
}

/**
 * Checks if a value is a STACK_REF.
 */
export function isStackRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STACK_REF;
}

/**
 * Checks if a value is a RSTACK_REF.
 */
export function isLocalRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.RSTACK_REF;
}

/**
 * Checks if a value is a GLOBAL_REF.
 */
export function isGlobalRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.GLOBAL_REF;
}

/**
 * Creates a STACK_REF tagged value.
 */
export function createStackRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex > 65535) {
    throw new Error('Stack cell index must be 0-65535');
  }
  return toTaggedValue(cellIndex, Tag.STACK_REF);
}

/**
 * Creates a reference to a local variable slot.
 * Takes a slot number (0, 1, 2, etc.) and returns a RSTACK_REF tagged value
 * that points to the absolute address of that slot in the current stack frame.
 */
export function getVarRef(vm: VM, slotNumber: number): number {
  if (slotNumber < 0) {
    throw new Error('Slot number must be non-negative');
  }

  // Use BP (cells) for unit-safe math; payload expects absolute cell index
  const absoluteCellIndex = vm.BP + slotNumber;
  const maxCells = RSTACK_SIZE / CELL_SIZE;
  if (absoluteCellIndex < 0 || absoluteCellIndex >= maxCells) {
    throw new RangeError('Local reference outside return stack bounds');
  }
  return toTaggedValue(absoluteCellIndex, Tag.RSTACK_REF);
}

/**
 * Creates a GLOBAL_REF tagged value.
 */
export function createGlobalRef(key: number): number {
  return toTaggedValue(key, Tag.GLOBAL_REF);
}

/**
 * Creates a reference value for a given segment and cell index.
 * SEG_STACK -> STACK_REF, SEG_RSTACK -> RSTACK_REF, other (e.g., GLOBAL) -> GLOBAL_REF.
 */
export function createSegmentRef(segment: number, cellIndex: number): number {
  switch (segment) {
    case SEG_STACK:
      return toTaggedValue(cellIndex, Tag.STACK_REF);
    case SEG_RSTACK:
      return toTaggedValue(cellIndex, Tag.RSTACK_REF);
    case SEG_GLOBAL:
      return toTaggedValue(cellIndex, Tag.GLOBAL_REF);
    default:
      return createDataRef(segment, cellIndex);
  }
}

/**
 * Result of reference resolution containing memory address and segment.
 */
export interface ResolvedReference {
  address: number;
  segment: number;
}

/**
 * Polymorphic reference resolver that handles all reference types.
 * Returns the byte address and memory segment for any reference type.
 */
export function resolveReference(vm: VM, ref: number): ResolvedReference {
  const tag = getTag(ref);

  switch (tag) {
    case Tag.STACK_REF: {
      const { value } = fromTaggedValue(ref);
      const offset = value * CELL_SIZE;
      if (offset < 0 || offset + CELL_SIZE > STACK_SIZE) {
        throw new RangeError(`Offset ${offset} is outside segment ${SEG_STACK} bounds`);
      }
      return { address: offset, segment: SEG_STACK };
    }

    case Tag.RSTACK_REF: {
      const { value } = fromTaggedValue(ref);
      const offset = value * CELL_SIZE;
      if (offset < 0 || offset + CELL_SIZE > RSTACK_SIZE) {
        throw new RangeError(`Offset ${offset} is outside segment ${SEG_RSTACK} bounds`);
      }
      return { address: offset, segment: SEG_RSTACK };
    }

    case Tag.GLOBAL_REF: {
      const { value } = fromTaggedValue(ref);
      const offset = value * CELL_SIZE;
      if (offset < 0 || offset + CELL_SIZE > GLOBAL_SIZE) {
        throw new RangeError(`Offset ${offset} is outside segment ${SEG_GLOBAL} bounds`);
      }
      return { address: offset, segment: SEG_GLOBAL };
    }

    case Tag.DATA_REF: {
      const { segment, cellIndex } = decodeDataRef(ref);
      return { address: cellIndex * CELL_SIZE, segment };
    }

    default:
      throw new Error(`Invalid reference type: ${tag}`);
  }
}

/**
 * Reads a value from memory using a polymorphic reference.
 */
export function readReference(vm: VM, ref: number): number {
  const { address, segment } = resolveReference(vm, ref);
  return vm.memory.readFloat32(segment, address);
}

/**
 * Writes a value to memory using a polymorphic reference.
 */
export function writeReference(vm: VM, ref: number, value: number): void {
  const { address, segment } = resolveReference(vm, ref);
  vm.memory.writeFloat32(segment, address, value);
}
