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
  CELL_SIZE,
} from './constants';

const DATA_REF_SEGMENT_SHIFT = 14;
const DATA_REF_SEGMENT_MASK = 0x3 << DATA_REF_SEGMENT_SHIFT;
const DATA_REF_INDEX_MASK = (1 << DATA_REF_SEGMENT_SHIFT) - 1;

const DATA_REF_SEGMENT_TABLE = [SEG_STACK, SEG_RSTACK, SEG_GLOBAL];

const DATA_REF_SEGMENT_LIMITS: Record<number, number> = {
  [SEG_STACK]: STACK_SIZE / CELL_SIZE,
  [SEG_RSTACK]: RSTACK_SIZE / CELL_SIZE,
  [SEG_GLOBAL]: GLOBAL_SIZE / CELL_SIZE,
};

function encodeDataRefSegment(segment: number): number {
  const index = DATA_REF_SEGMENT_TABLE.indexOf(segment);
  if (index === -1) {
    throw new Error(`Unsupported DATA_REF segment: ${segment}`);
  }
  return index;
}

function decodeDataRefSegment(code: number): number {
  const segment = DATA_REF_SEGMENT_TABLE[code];
  if (segment === undefined) {
    throw new Error(`Invalid DATA_REF segment code: ${code}`);
  }
  return segment;
}

export interface DataRefComponents {
  segment: number;
  cellIndex: number;
}

export function createDataRef(segment: number, cellIndex: number): number {
  const segmentCode = encodeDataRefSegment(segment);
  if (cellIndex < 0 || cellIndex > DATA_REF_INDEX_MASK) {
    throw new Error(`DATA_REF cell index out of range: ${cellIndex}`);
  }

  const limit = DATA_REF_SEGMENT_LIMITS[segment];
  if (limit === undefined) {
    throw new Error(`DATA_REF limit missing for segment: ${segment}`);
  }
  if (cellIndex >= limit) {
    throw new Error(`DATA_REF cell index ${cellIndex} exceeds segment capacity ${limit}`);
  }

  const payload = (segmentCode << DATA_REF_SEGMENT_SHIFT) | (cellIndex & DATA_REF_INDEX_MASK);
  return toTaggedValue(payload, Tag.DATA_REF);
}

export function decodeDataRef(ref: number): DataRefComponents {
  const { value, tag } = fromTaggedValue(ref);
  if (tag !== Tag.DATA_REF) {
    throw new Error('decodeDataRef called with non-DATA_REF value');
  }

  const segmentCode = (value & DATA_REF_SEGMENT_MASK) >>> DATA_REF_SEGMENT_SHIFT;
  const cellIndex = value & DATA_REF_INDEX_MASK;
  const segment = decodeDataRefSegment(segmentCode);
  return { segment, cellIndex };
}

/**
 * Checks if a value is a reference (STACK_REF, RSTACK_REF, or GLOBAL_REF).
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
      const limit = DATA_REF_SEGMENT_LIMITS[segment];
      if (limit === undefined) {
        throw new Error(`DATA_REF limit missing for segment: ${segment}`);
      }
      if (cellIndex < 0 || cellIndex >= limit) {
        throw new RangeError(`DATA_REF cell index ${cellIndex} outside segment limit ${limit}`);
      }
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
