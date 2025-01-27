// src/string-buffer.ts
import { Memory } from "./memory";
import { STRINGS, STRINGS_SIZE } from "./memory";

export class StringBuffer {
  SBP: number; 

  constructor(private memory: Memory) {
    this.SBP = STRINGS;
  }

  add(str: string): number {
    if (str.length > 255) {
      throw new Error("String too long (max 255 characters)");
    }

    const requiredSpace = 1 + str.length; 
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
}
