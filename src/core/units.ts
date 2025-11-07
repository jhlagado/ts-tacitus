/**
 * Unit-safe helpers for cells vs bytes, and basic cell-oriented memory ops.
 *
 * Phase 0: Introduces branded types and helpers without changing VM behavior.
 * These functions operate on the existing Memory API and maintain memmove semantics.
 */

import { CELL_SIZE } from './constants';
import type { Memory } from './memory';

// Branded numeric types to avoid mixing units inadvertently
type Brand<T, B extends string> = T & { readonly __brand: B };

export type CellIndex = Brand<number, 'CellIndex'>; // index within a segment, in cells
export type CellCount = Brand<number, 'CellCount'>; // length measured in cells
export type ByteIndex = Brand<number, 'ByteIndex'>; // index within a segment, in bytes

// Constructors (lightweight; runtime is just number)
export function cells(n: number): CellCount {
  if (!Number.isInteger(n) || n < 0) {
throw new Error(`cells(): invalid count ${n}`);
}
  return n as CellCount;
}

export function cellIndex(n: number): CellIndex {
  if (!Number.isInteger(n) || n < 0) {
throw new Error(`cellIndex(): invalid index ${n}`);
}
  return n as CellIndex;
}

export function bytes(n: number): ByteIndex {
  if (!Number.isInteger(n) || n < 0) {
throw new Error(`bytes(): invalid index ${n}`);
}
  return n as ByteIndex;
}

// Conversions
export function asBytes(n: CellIndex | CellCount): ByteIndex {
  // Shift left by 2; safe for 32-bit arithmetic within our sizes.
  return ((n as unknown as number) << 2) as ByteIndex;
}

export function asCells(n: ByteIndex): CellCount {
  const v = n as unknown as number;
  if ((v & (CELL_SIZE - 1)) !== 0) {
    throw new Error(`asCells(): byte index ${v} not cell-aligned`);
  }
  return (v >> 2) as CellCount;
}

// Basic cell-level memory accessors built on current Memory API
export function loadCell(mem: Memory, segment: number, at: CellIndex): number {
  return mem.readFloat32(segment, asBytes(at) as unknown as number);
}

export function storeCell(mem: Memory, segment: number, at: CellIndex, value: number): void {
  mem.writeFloat32(segment, asBytes(at) as unknown as number, value);
}

// Memmove semantics for cells within a single segment
export function copyCells(
  mem: Memory,
  segment: number,
  dst: CellIndex,
  src: CellIndex,
  len: CellCount,
): void {
  const dstNum = dst as unknown as number;
  const srcNum = src as unknown as number;
  const count = len as unknown as number;
  if (count <= 0 || dstNum === srcNum) {
return;
}

  // Compute absolute cell indices in the unified buffer and use copyWithin
  const baseByte = mem.resolveAddress(segment, 0);
  const baseCell = baseByte >> 2;
  const absDst = baseCell + dstNum;
  const absSrc = baseCell + srcNum;
  mem.u32.copyWithin(absDst, absSrc, absSrc + count);
}

export function fillCells(
  mem: Memory,
  segment: number,
  dst: CellIndex,
  len: CellCount,
  value: number,
): void {
  const dstNum = dst as unknown as number;
  const count = len as unknown as number;
  for (let i = 0; i < count; i++) {
    mem.writeFloat32(segment, (dstNum + i) << 2, value);
  }
}
