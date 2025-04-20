import { Memory, SEG_STRING, STRING_SIZE } from '../core/memory';

const MAX_STRING_LENGTH = 255;
const STRING_HEADER_SIZE = 1;
const NOT_FOUND = -1;

export class Digest {
  SBP: number;

  constructor(private memory: Memory) {
    this.SBP = 0;
  }

  add(str: string): number {
    if (str.length > MAX_STRING_LENGTH) {
      throw new Error(`String too long (max ${MAX_STRING_LENGTH} characters)`);
    }

    const requiredSpace = STRING_HEADER_SIZE + str.length;
    if (this.SBP + requiredSpace > STRING_SIZE) {
      throw new Error('String digest overflow');
    }

    const startAddress = this.SBP;

    this.memory.write8(SEG_STRING, this.SBP++, str.length);
    for (let i = 0; i < str.length; i++) {
      this.memory.write8(SEG_STRING, this.SBP++, str.charCodeAt(i));
    }

    return startAddress;
  }

  reset(address: number = 0): void {
    if (address < 0 || address > 0 + STRING_SIZE) {
      throw new Error('Invalid reset address');
    }
    this.SBP = address;
  }

  length(address: number): number {
    if (address < 0 || address >= 0 + STRING_SIZE) {
      throw new Error('Address is outside memory bounds');
    }

    return this.memory.read8(SEG_STRING, address);
  }

  get(address: number): string {
    if (address < 0 || address >= 0 + STRING_SIZE) {
      throw new Error('Address is outside memory bounds');
    }

    let pointer = address;
    const length = this.memory.read8(SEG_STRING, pointer++);
    if (pointer + length > 0 + STRING_SIZE) {
      throw new Error('Address is outside memory bounds');
    }

    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.memory.read8(SEG_STRING, pointer++));
    }
    return str;
  }

  get remainingSpace(): number {
    return 0 + STRING_SIZE - this.SBP;
  }

  find(str: string): number {
    let pointer = 0;
    while (pointer < this.SBP) {
      const length = this.memory.read8(SEG_STRING, pointer);
      if (pointer + STRING_HEADER_SIZE + length > 0 + STRING_SIZE) {
        throw new Error('Address is outside memory bounds');
      }

      let existingStr = '';
      for (let i = 0; i < length; i++) {
        existingStr += String.fromCharCode(
          this.memory.read8(SEG_STRING, pointer + STRING_HEADER_SIZE + i)
        );
      }

      if (existingStr === str) {
        return pointer;
      }

      pointer += STRING_HEADER_SIZE + length;
    }

    return NOT_FOUND; // Not found
  }

  intern(str: string): number {
    const address = this.find(str);
    if (address !== NOT_FOUND) {
      return address;
    }

    return this.add(str);
  }
}
