// src/string-buffer.ts
import { Memory } from "./memory";
import { STRINGS, STRINGS_SIZE } from "./memory";

export class StringBuffer {
  SBP: number; // Next available memory pointer

  constructor(private memory: Memory) {
    this.SBP = STRINGS;
  }

  add(str: string): number {
    if (str.length > 255) {
      throw new Error("String too long (max 255 characters)");
    }

    const requiredSpace = 1 + str.length; // 1 byte for length + characters
    if (this.SBP + requiredSpace > STRINGS + STRINGS_SIZE) {
      throw new Error("String buffer overflow");
    }

    const startAddress = this.SBP;

    // Write Pascal-style string
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

  find(target: string): number {
    let currentAddress = STRINGS;

    while (currentAddress < this.SBP) {
      const length = this.memory.read8(currentAddress++);

      // Check if we have valid string data
      if (currentAddress + length > this.SBP) {
        break;
      }

      if (length !== target.length) {
        currentAddress += length;
        continue;
      }

      let match = true;
      for (let i = 0; i < length; i++) {
        const charCode = this.memory.read8(currentAddress++);
        if (charCode !== target.charCodeAt(i)) {
          match = false;
          break;
        }
      }

      if (match) {
        return currentAddress;
      }
    }

    return -1; 
  }

  get(address: number): string {
    let currentAddress = address;
    const length = this.memory.read8(currentAddress++);
    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.memory.read8(currentAddress++));
    }
    return str;
  }

  get remainingSpace(): number {
    return STRINGS + STRINGS_SIZE - this.SBP;
  }
}
