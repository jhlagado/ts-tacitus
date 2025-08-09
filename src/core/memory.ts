/**
 * @file src/core/memory.ts
 * This file implements the segmented memory model for the Tacit VM.
 * The memory is divided into segments for different purposes (stack, return stack, code, strings).
 * Each segment has a fixed size and base address within the 64KB memory space.
 */

import {
  MEMORY_SIZE,
  SEG_STACK,
  SEG_RSTACK,
  SEG_CODE,
  SEG_STRING,
  STACK_SIZE,
  RSTACK_SIZE,
  STRING_SIZE,
} from './constants';

/**
 * Memory class that implements the segmented memory model for the Tacit VM.
 * Provides methods for reading and writing different data types to memory segments.
 */
export class Memory {
  /**
   * The underlying raw memory buffer, represented as a `Uint8Array`.
   * All memory operations ultimately interact with this buffer.
   */
  buffer: Uint8Array;

  /**
   * A `DataView` instance providing methods to read and write multiple number types
   * (like `Float32Array`, `Uint16Array`) to the `buffer` at any byte offset.
   * This allows for structured access to the raw memory.
   */
  dataView: DataView;

  /**
   * An internal table mapping segment IDs (e.g., `SEG_STACK`, `SEG_CODE`) to their
   * respective base addresses within the linear memory `buffer`.
   * @internal
   */
  private SEGMENT_TABLE: number[] = new Array(8).fill(0);

  /**
   * Creates a new `Memory` instance.
   * Initializes a 64KB `Uint8Array` buffer and a `DataView` for structured access.
   * It then calls `initializeSegments()` to set up the base addresses for all
   * defined memory segments.
   */
  constructor() {
    this.buffer = new Uint8Array(MEMORY_SIZE);
    this.dataView = new DataView(this.buffer.buffer);
    this.initializeSegments();
  }

  /**
   * Initializes the segment table with base addresses for each segment.
   * Segments are laid out sequentially in memory:
   * 1. Stack segment (SEG_STACK)
   * 2. Return stack segment (SEG_RSTACK)
   * 3. String segment (SEG_STRING)
   * 4. Code segment (SEG_CODE)
   */
  private initializeSegments() {
    this.SEGMENT_TABLE[SEG_STACK] = 0x0000;
    this.SEGMENT_TABLE[SEG_RSTACK] = this.SEGMENT_TABLE[SEG_STACK] + STACK_SIZE;
    this.SEGMENT_TABLE[SEG_STRING] = this.SEGMENT_TABLE[SEG_RSTACK] + RSTACK_SIZE;
    this.SEGMENT_TABLE[SEG_CODE] = this.SEGMENT_TABLE[SEG_STRING] + STRING_SIZE;
  }

  /**
   * Resolves a segmented address (segment:offset) to a linear address in the memory buffer.
   *
   * @param segment The segment ID (e.g., `SEG_STACK`, `SEG_CODE`).
   * @param offset The offset within the specified segment.
   * @returns The resolved linear address within the `Memory` buffer.
   * @throws {RangeError} If the provided `segment` ID is invalid.
   */
  resolveAddress(segment: number, offset: number): number {
    if (segment < 0 || segment >= this.SEGMENT_TABLE.length) {
      throw new RangeError(`Invalid segment ID: ${segment}`);
    }

    const baseAddress = this.SEGMENT_TABLE[segment];
    return baseAddress + offset;
  }

  /**
   * Writes an 8-bit value to memory at the specified segment and offset.
   *
   * @param segment The segment ID (e.g., `SEG_STACK`, `SEG_CODE`).
   * @param offset The offset within the specified segment.
   * @param value The 8-bit value to write (will be masked to `0xFF`).
   * @throws {RangeError} If the resulting linear address is outside the memory bounds.
   */
  write8(segment: number, offset: number, value: number): void {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    this.buffer[address] = value & 0xff;
  }

  /**
   * Reads an 8-bit value from memory at the specified segment and offset.
   *
   * @param segment The segment ID (e.g., `SEG_STACK`, `SEG_CODE`).
   * @param offset The offset within the specified segment.
   * @returns The 8-bit value at the specified address.
   * @throws {RangeError} If the resulting linear address is outside the memory bounds.
   */
  read8(segment: number, offset: number): number {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    return this.buffer[address];
  }

  /**
   * Writes a 16-bit value to memory at the specified segment and offset.
   * Uses little-endian byte order.
   *
   * @param segment The segment ID (e.g., `SEG_STACK`, `SEG_CODE`).
   * @param offset The offset within the specified segment.
   * @param value The 16-bit value to write (will be masked to `0xFFFF`).
   * @throws {RangeError} If the resulting linear address range is outside the memory bounds.
   */
  write16(segment: number, offset: number, value: number): void {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    this.dataView.setUint16(address, value & 0xffff, true);
  }

  /**
   * Reads a 16-bit value from memory at the specified segment and offset.
   * Uses little-endian byte order.
   *
   * @param segment The segment ID (e.g., `SEG_STACK`, `SEG_CODE`).
   * @param offset The offset within the specified segment.
   * @returns The 16-bit value at the specified address.
   * @throws {RangeError} If the resulting linear address range is outside the memory bounds.
   */
  read16(segment: number, offset: number): number {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    return this.dataView.getUint16(address, true);
  }

  /**
   * Writes a 32-bit floating-point value to memory at the specified segment and offset.
   * Uses little-endian byte order.
   *
   * @param segment The segment ID (e.g., `SEG_STACK`, `SEG_CODE`).
   * @param offset The offset within the specified segment.
   * @param value The 32-bit floating-point value to write.
   * @throws {RangeError} If the resulting linear address range is outside the memory bounds.
   */
  writeFloat32(segment: number, offset: number, value: number): void {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 3 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, true);
    for (let i = 0; i < 4; i++) {
      this.write8(segment, offset + i, view.getUint8(i));
    }
  }
  /**
   * Reads a 32-bit floating-point value from memory at the specified segment and offset.
   * Uses little-endian byte order.
   *
   * @param segment The segment ID (e.g., `SEG_STACK`, `SEG_CODE`).
   * @param offset The offset within the specified segment.
   * @returns The 32-bit floating-point value at the specified address.
   * @throws {RangeError} If the resulting linear address range is outside the memory bounds.
   */
  readFloat32(segment: number, offset: number): number {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 3 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    for (let i = 0; i < 4; i++) {
      view.setUint8(i, this.read8(segment, offset + i));
    }

    return view.getFloat32(0, true);
  }

  /**
   * Dumps a range of memory as hexadecimal values for debugging.
   *
   * @param start The starting linear address in the memory buffer.
   * @param end The ending linear address in the memory buffer (inclusive, defaults to 32 bytes from `start`).
   * @returns A string representation of the memory contents as hexadecimal values.
   * @throws {RangeError} If the specified address range is invalid or out of bounds.
   */
  dump(start: number, end = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }

    return Array.from(this.buffer.slice(start, end + 1))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ');
  }

  /**
   * Dumps a range of memory as ASCII characters for debugging.
   *
   * @param start The starting linear address in the memory buffer.
   * @param end The ending linear address in the memory buffer (inclusive, defaults to 32 bytes from `start`).
   * @returns A string representation of the memory contents as ASCII characters.
   * @throws {RangeError} If the specified address range is invalid or out of bounds.
   */
  dumpChars(start: number, end = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }

    return Array.from(this.buffer.slice(start, end + 1))
      .map(byte => String.fromCharCode(byte))
      .join(' ');
  }
}
