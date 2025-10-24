/**
 * @file src/core/memory.ts
 * Segmented memory model for the Tacit VM.
 */

import {
  MEMORY_SIZE,
  SEG_GLOBAL,
  SEG_CODE,
  SEG_STRING,
  SEG_DATA,
  RSTACK_TOP,
  GLOBAL_BASE,
  GLOBAL_SIZE,
  STRING_SIZE,
  CODE_SIZE,
  DATA_BASE,
  DATA_TOP,
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
  }

  private resolveAddressWithWidth(segment: number, offset: number, width: number): number {
    let base = 0;
    let size = 0;

    switch (segment) {
      case SEG_DATA:
        base = DATA_BASE;
        size = DATA_TOP - DATA_BASE;
        break;
      case SEG_GLOBAL:
        base = GLOBAL_BASE;
        size = GLOBAL_SIZE;
        break;
      case SEG_STRING:
        base = RSTACK_TOP;
        size = STRING_SIZE;
        break;
      case SEG_CODE:
        base = RSTACK_TOP + STRING_SIZE;
        size = CODE_SIZE;
        break;
      default:
        throw new RangeError(`Invalid segment ID: ${segment}`);
    }

    if (offset < 0 || offset + width > size) {
      throw new RangeError(`Offset ${offset} is outside segment ${segment} bounds`);
    }

    return base + offset;
  }

  /**
   * Resolves segmented address to linear address.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @returns The linear address
   * @throws {RangeError} If segment ID is invalid
   */
  resolveAddress(segment: number, offset: number): number {
    return this.resolveAddressWithWidth(segment, offset, 1);
  }

  /**
   * Writes an 8-bit value to memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @param value The 8-bit value
   * @throws {RangeError} If address is out of bounds
   */
  write8(segment: number, offset: number, value: number): void {
    const address = this.resolveAddressWithWidth(segment, offset, 1);
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
    const address = this.resolveAddressWithWidth(segment, offset, 1);
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
    const address = this.resolveAddressWithWidth(segment, offset, 2);
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
    const address = this.resolveAddressWithWidth(segment, offset, 2);
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
    const address = this.resolveAddressWithWidth(segment, offset, 4);
    this.dataView.setFloat32(address, value, true);
  }
  /**
   * Reads a 32-bit float from memory.
   * @param segment The segment ID
   * @param offset The offset within segment
   * @returns The float value
   * @throws {RangeError} If address is out of bounds
   */
  readFloat32(segment: number, offset: number): number {
    const address = this.resolveAddressWithWidth(segment, offset, 4);
    return this.dataView.getFloat32(address, true);
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
