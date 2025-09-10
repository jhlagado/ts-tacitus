/**
 * @file src/core/memory.ts
 * Segmented memory model for the Tacit VM.
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
 * Segmented memory implementation for the Tacit VM.
 */
export class Memory {
  /** Primary byte view (backing buffer). */
  buffer: Uint8Array;

  /** Alias for byte view for clarity in dual-view usage. */
  u8: Uint8Array;

  /** 32-bit cell view over the same underlying buffer. */
  u32: Uint32Array;

  /** DataView for mixed-size typed access (8/16/32). */
  dataView: DataView;
  /** Alias for DataView when used along with dual views. */
  view: DataView;

  private SEGMENT_TABLE: number[] = new Array(8).fill(0);

  /**
   * Creates a new Memory instance with initialized segments.
   */
  constructor() {
    this.buffer = new Uint8Array(MEMORY_SIZE);
    this.u8 = this.buffer;
    // Ensure u32 view spans the whole buffer; alignment is 4 by design.
    this.u32 = new Uint32Array(this.buffer.buffer, 0, Math.floor(MEMORY_SIZE / 4));
    this.dataView = new DataView(this.buffer.buffer);
    this.view = this.dataView;
    this.initializeSegments();
  }

  /**
   * Initializes segment table with base addresses.
   */
  private initializeSegments() {
    this.SEGMENT_TABLE[SEG_STACK] = 0x0000;
    this.SEGMENT_TABLE[SEG_RSTACK] = this.SEGMENT_TABLE[SEG_STACK] + STACK_SIZE;
    this.SEGMENT_TABLE[SEG_STRING] = this.SEGMENT_TABLE[SEG_RSTACK] + RSTACK_SIZE;
    this.SEGMENT_TABLE[SEG_CODE] = this.SEGMENT_TABLE[SEG_STRING] + STRING_SIZE;
  }

  /**
   * Resolves segmented address to linear address.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @returns The linear address
   * @throws {RangeError} If segment ID is invalid
   */
  resolveAddress(segment: number, offset: number): number {
    if (segment < 0 || segment >= this.SEGMENT_TABLE.length) {
      throw new RangeError(`Invalid segment ID: ${segment}`);
    }

    const baseAddress = this.SEGMENT_TABLE[segment];
    return baseAddress + offset;
  }

  /**
   * Writes an 8-bit value to memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @param value The 8-bit value
   * @throws {RangeError} If address is out of bounds
   */
  write8(segment: number, offset: number, value: number): void {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    this.buffer[address] = value & 0xff;
  }

  /**
   * Reads an 8-bit value from memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @returns The 8-bit value
   * @throws {RangeError} If address is out of bounds
   */
  read8(segment: number, offset: number): number {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    return this.buffer[address];
  }

  /**
   * Writes a 16-bit value to memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @param value The 16-bit value
   * @throws {RangeError} If address is out of bounds
   */
  write16(segment: number, offset: number, value: number): void {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    this.dataView.setUint16(address, value & 0xffff, true);
  }

  /**
   * Reads a 16-bit value from memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @returns The 16-bit value
   * @throws {RangeError} If address is out of bounds
   */
  read16(segment: number, offset: number): number {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }

    return this.dataView.getUint16(address, true);
  }

  /**
   * Writes a 32-bit float to memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @param value The float value
   * @throws {RangeError} If address is out of bounds
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
   * Reads a 32-bit float from memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @returns The float value
   * @throws {RangeError} If address is out of bounds
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
   * Dumps memory range as hexadecimal values.
   * @param start Starting address
   * @param end Ending address (defaults to 32)
   * @returns Hex string representation
   * @throws {RangeError} If range is invalid
   */
  dump(start: number, end = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }

    const length = end - start + 1;
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      const byte = this.u8[start + i];
      result[i] = byte.toString(16).padStart(2, '0');
    }
    return result.join(' ');
  }

  /**
   * Dumps memory range as ASCII characters.
   * @param start Starting address
   * @param end Ending address (defaults to 32)
   * @returns ASCII string representation
   * @throws {RangeError} If range is invalid
   */
  dumpChars(start: number, end = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }

    const length = end - start + 1;
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      const byte = this.u8[start + i];
      result[i] = String.fromCharCode(byte);
    }
    return result.join(' ');
  }
}
