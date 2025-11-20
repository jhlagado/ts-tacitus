/**
 * @file src/core/memory.ts
 * Segmented memory model for the Tacit VM implemented with plain data plus helpers.
 */

import {
  MEMORY_SIZE_BYTES,
  SEG_CODE,
  SEG_DATA,
  SEG_STRING,
  RSTACK_TOP_BYTES,
  STRING_SIZE_BYTES,
  CODE_SIZE_BYTES,
  DATA_BASE_BYTES,
  DATA_TOP_BYTES,
  DATA_TOP,
  CELL_SIZE,
} from './constants';

export type Memory = {
  buffer: Uint8Array;
  u8: Uint8Array;
  u32: Uint32Array;
  dataView: DataView;
  view: DataView;
};

/**
 * Creates a zeroed segmented memory arena.
 */
export function createMemory(): Memory {
  const buffer = new Uint8Array(MEMORY_SIZE_BYTES);
  const dataView = new DataView(buffer.buffer);
  return {
    buffer,
    u8: buffer,
    u32: new Uint32Array(buffer.buffer, 0, Math.floor(MEMORY_SIZE_BYTES / 4)),
    dataView,
    view: dataView,
  };
}

function resolveAddressWithWidth(segment: number, offset: number, width: number): number {
  let base = 0;
  let size = 0;

  switch (segment) {
    case SEG_DATA:
      base = DATA_BASE_BYTES;
      size = DATA_TOP_BYTES - DATA_BASE_BYTES;
      break;
    case SEG_STRING:
      base = RSTACK_TOP_BYTES;
      size = STRING_SIZE_BYTES;
      break;
    case SEG_CODE:
      base = RSTACK_TOP_BYTES + STRING_SIZE_BYTES;
      size = CODE_SIZE_BYTES;
      break;
    default:
      throw new RangeError(`Invalid segment ID: ${segment}`);
  }

  if (offset < 0 || offset + width > size) {
    throw new RangeError(`Offset ${offset} is outside segment ${segment} bounds`);
  }

  return base + offset;
}

export function memoryResolveAddress(_memory: Memory, segment: number, offset: number): number {
  return resolveAddressWithWidth(segment, offset, 1);
}

export function memoryWrite8(memory: Memory, segment: number, offset: number, value: number): void {
  const address = resolveAddressWithWidth(segment, offset, 1);
  memory.buffer[address] = value & 0xff;
}

export function memoryRead8(memory: Memory, segment: number, offset: number): number {
  const address = resolveAddressWithWidth(segment, offset, 1);
  return memory.buffer[address];
}

export function memoryWrite16(memory: Memory, segment: number, offset: number, value: number): void {
  const address = resolveAddressWithWidth(segment, offset, 2);
  memory.dataView.setUint16(address, value & 0xffff, true);
}

export function memoryRead16(memory: Memory, segment: number, offset: number): number {
  const address = resolveAddressWithWidth(segment, offset, 2);
  return memory.dataView.getUint16(address, true);
}

export function memoryWriteFloat32(memory: Memory, segment: number, offset: number, value: number): void {
  const address = resolveAddressWithWidth(segment, offset, 4);
  memory.dataView.setFloat32(address, value, true);
}

export function memoryReadFloat32(memory: Memory, segment: number, offset: number): number {
  const address = resolveAddressWithWidth(segment, offset, 4);
  return memory.dataView.getFloat32(address, true);
}

function ensureCellIndex(cellIndex: number): void {
  if (cellIndex < 0 || cellIndex >= DATA_TOP) {
    throw new RangeError(`Cell index ${cellIndex} is outside data arena bounds [0, ${DATA_TOP})`);
  }
}

export function memoryWriteCell(memory: Memory, cellIndex: number, value: number): void {
  ensureCellIndex(cellIndex);
  const byteAddress = cellIndex * CELL_SIZE;
  memory.dataView.setFloat32(byteAddress, value, true);
}

export function memoryReadCell(memory: Memory, cellIndex: number): number {
  ensureCellIndex(cellIndex);
  const byteAddress = cellIndex * CELL_SIZE;
  return memory.dataView.getFloat32(byteAddress, true);
}

export function memoryDump(memory: Memory, start: number, end = 32): string {
  if (start < 0 || end >= MEMORY_SIZE_BYTES || start > end) {
    throw new RangeError(`Invalid memory range [${start}, ${end}]`);
  }

  const length = end - start + 1;
  const bytes: string[] = [];
  for (let i = 0; i < length; i++) {
    const byte = memory.u8[start + i];
    bytes.push(byte.toString(16).padStart(2, '0'));
  }
  return bytes.join(' ');
}

export function memoryDumpChars(memory: Memory, start: number, end = 32): string {
  if (start < 0 || end >= MEMORY_SIZE_BYTES || start > end) {
    throw new RangeError(`Invalid memory range [${start}, ${end}]`);
  }

  const length = end - start + 1;
  const chars: string[] = [];
  for (let i = 0; i < length; i++) {
    const byte = memory.u8[start + i];
    chars.push(String.fromCharCode(byte));
  }
  return chars.join(' ');
}
