export const MEMORY_SIZE = 65536;

const SEGMENT_TABLE: number[] = new Array(8).fill(0);

export const SEG_STACK = 0;

export const SEG_RSTACK = 1;

export const SEG_CODE = 4;

export const SEG_STRING = 5;

export const STACK_SIZE = 0x0100;

export const RSTACK_SIZE = 0x0100;

export const STRING_SIZE = 0x0800;

export const CODE_SIZE = 0x2000;

function initializeSegments() {
  SEGMENT_TABLE[SEG_STACK] = 0x0000;
  SEGMENT_TABLE[SEG_RSTACK] = SEGMENT_TABLE[SEG_STACK] + STACK_SIZE;
  SEGMENT_TABLE[SEG_STRING] = SEGMENT_TABLE[SEG_RSTACK] + RSTACK_SIZE;
  SEGMENT_TABLE[SEG_CODE] = SEGMENT_TABLE[SEG_STRING] + STRING_SIZE;
}

export class Memory {
  buffer: Uint8Array;
  dataView: DataView;
  constructor() {
    this.buffer = new Uint8Array(MEMORY_SIZE);
    this.dataView = new DataView(this.buffer.buffer);
    initializeSegments();
  }
  resolveAddress(segment: number, offset: number): number {
    if (segment < 0 || segment >= SEGMENT_TABLE.length) {
      throw new RangeError(`Invalid segment ID: ${segment}`);
    }
    const baseAddress = SEGMENT_TABLE[segment];
    return baseAddress + offset;
  }
  write8(segment: number, offset: number, value: number): void {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    this.buffer[address] = value & 0xff;
  }
  read8(segment: number, offset: number): number {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    return this.buffer[address];
  }
  write16(segment: number, offset: number, value: number): void {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    this.dataView.setUint16(address, value & 0xffff, true);
  }
  read16(segment: number, offset: number): number {
    const address = this.resolveAddress(segment, offset);
    if (address < 0 || address + 1 >= MEMORY_SIZE) {
      throw new RangeError(`Address ${address} is outside memory bounds`);
    }
    return this.dataView.getUint16(address, true);
  }
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

  dump(start: number, end: number = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }
    return Array.from(this.buffer.slice(start, end + 1))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ');
  }
  dumpChars(start: number, end: number = 32): string {
    if (start < 0 || end >= MEMORY_SIZE || start > end) {
      throw new RangeError(`Invalid memory range [${start}, ${end}]`);
    }
    return Array.from(this.buffer.slice(start, end + 1))
      .map(byte => String.fromCharCode(byte))
      .join(' ');
  }
}
