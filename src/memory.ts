export class Memory {
  private memory: Uint8Array;
  private dataView: DataView;

  constructor(size: number) {
    if (size <= 0 || size % 4 !== 0) {
      throw new Error("Memory size must be positive and aligned to 4 bytes.");
    }
    this.memory = new Uint8Array(size);
    this.dataView = new DataView(this.memory.buffer);
  }

  private validateAddress(address: number): void {
    if (address < 0 || address >= this.memory.length) {
      throw new Error(`Address ${address} is out of bounds.`);
    }
  }

  private ensureAlignment(address: number, alignment: number): void {
    if (address % alignment !== 0) {
      throw new Error(
        `Address ${address} must be aligned to ${alignment} bytes.`
      );
    }
  }

  // Generalized 8-bit read/write (with signed flag)
  read8(address: number, signed: boolean = false): number {
    this.validateAddress(address);
    const value = this.memory[address];
    return signed && value > 127 ? value - 256 : value;
  }

  write8(address: number, value: number): void {
    this.validateAddress(address);
    this.memory[address] = value & 0xff;
  }

  // Generalized 16-bit read/write (with signed flag)
  read16(address: number, signed: boolean = false): number {
    this.validateAddress(address);
    this.ensureAlignment(address, 2);
    const value = this.dataView.getUint16(address, true);
    return signed && value > 32767 ? value - 65536 : value;
  }

  write16(address: number, value: number): void {
    this.validateAddress(address);
    this.ensureAlignment(address, 2);
    this.dataView.setUint16(address, value & 0xffff, true);
  }

  // Generalized 32-bit read/write (with signed flag)
  read32(address: number, signed: boolean = false): number {
    this.validateAddress(address);
    this.ensureAlignment(address, 4);
    const value = this.dataView.getUint32(address, true);
    return signed && value > 2147483647 ? value - 4294967296 : value;
  }

  write32(address: number, value: number): void {
    this.validateAddress(address);
    this.ensureAlignment(address, 4);
    this.dataView.setUint32(address, value >>> 0, true);
  }

  // Float32 read/write
  readFloat32(address: number): number {
    this.validateAddress(address);
    this.ensureAlignment(address, 4);
    return this.dataView.getFloat32(address, true);
  }

  writeFloat32(address: number, value: number): void {
    this.validateAddress(address);
    this.ensureAlignment(address, 4);
    this.dataView.setFloat32(address, value, true);
  }

  // Utility: Dump memory for debugging
  dumpMemory(): void {
    console.log(
      Array.from(this.memory)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" ")
    );
  }
}
