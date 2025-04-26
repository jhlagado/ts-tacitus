import { Memory, SEG_STRING, STRING_SIZE } from '../core/memory';

const MAX_STRING_LENGTH = 255;
const STRING_HEADER_SIZE = 1; // Now represents the suffix size
const NOT_FOUND = -1;

export class Digest {
  SBP: number; // Points to the NEXT available byte

  constructor(private memory: Memory) {
    this.SBP = 0;
  }

  /**
   * Adds a string to the digest. Stores characters first, then the length byte.
   * @param str The string to add.
   * @returns The address of the length byte suffix.
   */
  add(str: string): number {
    if (str.length > MAX_STRING_LENGTH) {
      throw new Error(`String too long (max ${MAX_STRING_LENGTH} characters)`);
    }

    const requiredSpace = str.length + STRING_HEADER_SIZE;
    if (this.SBP + requiredSpace > STRING_SIZE) {
      throw new Error('String digest overflow');
    }

    // Write characters first
    for (let i = 0; i < str.length; i++) {
      this.memory.write8(SEG_STRING, this.SBP++, str.charCodeAt(i));
    }
    // Write length suffix AFTER characters
    this.memory.write8(SEG_STRING, this.SBP++, str.length);

    const lengthByteAddress = this.SBP - 1; // Address of the length byte we just wrote
    return lengthByteAddress;
  }

  /**
   * Resets the String Base Pointer (SBP) to the given address, effectively
   * forgetting strings added after that point.
   * @param address The address to reset SBP to. Defaults to 0.
   */
  reset(address: number = 0): void {
    // Address now means the potential end of the digest data (next SBP)
    if (address < 0 || address > STRING_SIZE) {
      throw new Error('Invalid reset address');
    }
    // Check if address points to a valid length byte or start?
    // Simplest: just allow resetting SBP. Caller beware.
    this.SBP = address;
  }

  /**
   * Gets the length of the string whose length byte is at the given address.
   * @param address The address of the string's length byte suffix.
   * @returns The length of the string.
   */
  length(address: number): number {
    // 'address' points to the length byte
    if (address < 0 || address >= STRING_SIZE) {
      throw new Error('Address is outside memory bounds (length byte)');
    }
    return this.memory.read8(SEG_STRING, address);
  }

  /**
   * Retrieves the string whose length byte is at the given address.
   * @param address The address of the string's length byte suffix.
   * @returns The retrieved string.
   */
  get(address: number): string {
    // 'address' points to the length byte
    if (address < 0 || address >= STRING_SIZE) {
      throw new Error('Address is outside memory bounds (get length byte)');
    }

    const length = this.memory.read8(SEG_STRING, address);
    const stringStartAddress = address - length; // Calculate start of string bytes

    if (stringStartAddress < 0) {
      throw new Error('Invalid string format or address (start < 0)');
    }
    // Minimal check: ensure string doesn't wrap around buffer start
    // A more robust check would be difficult without knowing the previous SBP.

    let str = '';
    for (let i = 0; i < length; i++) {
      // Read bytes starting from stringStartAddress
      str += String.fromCharCode(this.memory.read8(SEG_STRING, stringStartAddress + i));
    }
    return str;
  }

  get remainingSpace(): number {
    return STRING_SIZE - this.SBP;
  }

  /**
   * Finds a string in the digest by searching backwards from the end.
   * @param str The string to find.
   * @returns The address of the string's length byte suffix if found, otherwise NOT_FOUND (-1).
   */
  find(str: string): number {
    let currentPtr = this.SBP; // Start scan from the current end of the digest
    while (currentPtr > 0) {
      if (currentPtr - 1 < 0) break; // Boundary check

      const length = this.memory.read8(SEG_STRING, currentPtr - 1); // Read potential length byte

      // Check if length byte is valid relative to current pointer
      if (currentPtr - 1 - length < 0) {
        // This suggests digest corruption or reaching the beginning incorrectly
        throw new Error(
          `Digest corruption detected during find at ptr ${currentPtr}. Length ${length} invalid.`
        );
        // Or simply break/continue? Let's throw for now.
      }

      const stringStartAddress = currentPtr - 1 - length;

      // Compare efficiently
      let match = true;
      if (str.length !== length) {
        match = false;
      } else {
        for (let i = 0; i < length; i++) {
          if (str.charCodeAt(i) !== this.memory.read8(SEG_STRING, stringStartAddress + i)) {
            match = false;
            break;
          }
        }
      }

      if (match) {
        return currentPtr - 1; // Return address of the length byte
      }

      // Move pointer to the beginning of this entry (which is the end of the previous entry)
      currentPtr = stringStartAddress;
    }

    return NOT_FOUND; // Not found
  }

  /**
   * Interns a string: finds it if it exists, otherwise adds it.
   * @param str The string to intern.
   * @returns The address of the string's length byte suffix.
   */
  intern(str: string): number {
    const address = this.find(str);
    if (address !== NOT_FOUND) {
      return address;
    }

    return this.add(str);
  }
}
