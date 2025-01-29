import { Memory } from "./memory";
import { STRINGS, STRINGS_SIZE } from "./memory";

const MAX_STRING_LENGTH = 255;
const STRING_HEADER_SIZE = 1;
const NOT_FOUND = -1;

export class StringBuffer {
  SBP: number;

  constructor(private memory: Memory) {
    this.SBP = STRINGS;
  }

  add(str: string): number {
    if (str.length > MAX_STRING_LENGTH) {
      throw new Error(`String too long (max ${MAX_STRING_LENGTH} characters)`);
    }

    const requiredSpace = STRING_HEADER_SIZE + str.length;
    if (this.SBP + requiredSpace > STRINGS + STRINGS_SIZE) {
      throw new Error("String buffer overflow");
    }

    const startAddress = this.SBP;

    this.memory.write8(this.SBP++, str.length);
    for (let i = 0; i < str.length; i++) {
      this.memory.write8(this.SBP++, str.charCodeAt(i));
    }

    return startAddress;
  }

  reset(address: number = STRINGS): void {
    if (address < STRINGS || address > STRINGS + STRINGS_SIZE) {
      throw new Error("Invalid reset address");
    }
    this.SBP = address;
  }

  get(address: number): string {
    if (address < STRINGS || address >= STRINGS + STRINGS_SIZE) {
      throw new Error("Address is outside memory bounds");
    }

    let pointer = address;
    const length = this.memory.read8(pointer++);
    if (pointer + length > STRINGS + STRINGS_SIZE) {
      throw new Error("Address is outside memory bounds");
    }

    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.memory.read8(pointer++));
    }
    return str;
  }

  get remainingSpace(): number {
    return STRINGS + STRINGS_SIZE - this.SBP;
  }

  find(str: string): number {
    let pointer = STRINGS;
    while (pointer < this.SBP) {
      const length = this.memory.read8(pointer);
      if (pointer + STRING_HEADER_SIZE + length > STRINGS + STRINGS_SIZE) {
        throw new Error("Address is outside memory bounds");
      }

      let existingStr = "";
      for (let i = 0; i < length; i++) {
        existingStr += String.fromCharCode(this.memory.read8(pointer + STRING_HEADER_SIZE + i));
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