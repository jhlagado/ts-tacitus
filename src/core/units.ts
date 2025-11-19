/**
 * Unit-safe helpers for cells vs bytes, and basic cell-oriented memory ops.
 *
 * Phase 0: Introduces branded types and helpers without changing VM behavior.
 * These functions operate on the existing Memory API and maintain memmove semantics.
 */

import type { Memory } from './memory';

// Basic cell-level memory accessors built on current Memory API
export function loadCell(mem: Memory, segment: number, at: number): number {
  return mem.readFloat32(segment, at << 2);
}

export function storeCell(mem: Memory, segment: number, at: number, value: number): void {
  mem.writeFloat32(segment, at << 2, value);
}

// Memmove semantics for cells within a single segment
export function copyCells(
  mem: Memory,
  segment: number,
  dst: number,
  src: number,
  len: number,
): void {
  if (len <= 0 || dst === src) {
    return;
  }

  // Compute absolute cell indices in the unified buffer and use copyWithin
  const baseByte = mem.resolveAddress(segment, 0);
  const baseCell = baseByte >> 2;
  const absDst = baseCell + dst;
  const absSrc = baseCell + src;
  mem.u32.copyWithin(absDst, absSrc, absSrc + len);
}

export function fillCells(
  mem: Memory,
  segment: number,
  dst: number,
  len: number,
  value: number,
): void {
  for (let i = 0; i < len; i++) {
    mem.writeFloat32(segment, (dst + i) << 2, value);
  }
}
