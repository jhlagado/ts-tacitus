import { fromTaggedPtr, toTaggedPtr, TAG } from "./tagged-ptr";

export const MEMORY_SIZE = 65536; // Total memory size (16-bit address space)

// Define sections
export const STACK = 0; // Start address of the main stack
export const STACK_SIZE = 0x100; // Stack size in bytes
export const RSTACK = STACK + STACK_SIZE; // Start address of the return stack
export const RSTACK_SIZE = 0x100; // Return stack size
export const STRINGS = RSTACK + RSTACK_SIZE; // Start address of the heap
export const STRINGS_SIZE = 0x400; // Remaining memory for heap
export const HEAP = STRINGS + STRINGS_SIZE; // Start address of the heap
export const HEAP_SIZE = MEMORY_SIZE - HEAP; // Remaining memory for heap

// Other sections (optional)
export const CODE = HEAP; // Start of executable code (if needed)

export class Memory {
  private buffer: Uint8Array;
  private dataView: DataView;

  constructor() {
    this.buffer = new Uint8Array(MEMORY_SIZE);
    this.dataView = new DataView(this.buffer.buffer);
  }

  // 8-bit read/write
  write8(address: number, value: number): void {
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    this.buffer[address] = value & 0xff;
  }

  read8(address: number): number {
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    return this.buffer[address];
  }

  // 16-bit read/write
  write16(address: number, value: number): void {
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    this.dataView.setUint16(address, value & 0xffff, true); // Little-endian
  }

  read16(address: number): number {
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    return this.dataView.getUint16(address, true); // Little-endian
  }

  // Float32 read/write (unaligned)
  writeFloat(address: number, value: number): void {
    if (address < 0 || address + 3 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, true); // Little-endian

    for (let i = 0; i < 4; i++) {
      this.write8(address + i, view.getUint8(i));
    }
  }

  readFloat(address: number): number {
    if (address < 0 || address + 3 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);

    for (let i = 0; i < 4; i++) {
      view.setUint8(i, this.read8(address + i));
    }

    return view.getFloat32(0, true); // Little-endian
  }

  writeAddress(address: number, value: number): void {
    this.writeFloat(address, toTaggedPtr(TAG.ADDRESS, value));
  }

  readAddress(address: number): number {
    const nPtr = this.readFloat(address); // Read the tagged pointer as a float
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.ADDRESS) {
      throw new Error(`Expected an ADDRESS, got tag ${tag}`);
    }
    return pointer;
  }

  writeInteger(address: number, value: number): void {
    this.writeFloat(address, toTaggedPtr(TAG.INTEGER, value));
  }

  readInteger(address: number): number {
    const nPtr = this.readFloat(address); // Read the tagged pointer as a float
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.INTEGER) {
      throw new Error(`Expected an ADDRESS, got tag ${tag}`);
    }
    return pointer;
  }

  // Utility to dump memory for debugging
  dump(start: number, end: number = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }
    return Array.from(this.buffer.slice(start, end + 1))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ");
  }

  dumpChars(start: number, end: number = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }
    return Array.from(this.buffer.slice(start, end + 1))
      .map((byte) => String.fromCharCode(byte))
      .join(" ");
  }
}
