/**
 * @file src/strings/digest.ts
 *
 * This file implements the string digest system for the Tacit VM.
 *
 * The string digest is responsible for storing and managing string data in the VM's memory.
 * It provides functionality for adding, retrieving, and finding strings in the string segment
 * of memory. The digest uses a simple storage format where each string is prefixed with a
 * length byte, followed by the character data.
 *
 * String storage format:
 * - 1 byte: String length (0-255)
 * - N bytes: Character data (each character is 1 byte)
 */

import { Memory } from '../core/memory';
import { SEG_STRING, STRING_SIZE } from '../core/constants';

/**
 * Maximum length of a string that can be stored in the digest (255 characters)
 * This is limited by the 1-byte header used to store the string length
 */
const MAX_STRING_LENGTH = 255;

/**
 * Size of the string header in bytes (1 byte for length)
 */
const STRING_HEADER_SIZE = 1;

/**
 * Value returned when a string is not found in the digest
 */
const NOT_FOUND = -1;

/**
 * The Digest class manages string storage in the VM's string segment.
 *
 * It provides methods for adding, retrieving, and finding strings in memory.
 * Strings are stored with a 1-byte length prefix followed by the character data.
 * The digest maintains a string base pointer (SBP) that points to the next
 * available position in the string segment.
 */
export class Digest {
  /**
   * String Base Pointer - points to the next available position in the string segment
   */
  SBP: number;

  /**
   * Creates a new Digest instance
   *
   * @param {Memory} memory - The VM memory instance to use for string storage
   */
  constructor(private memory: Memory) {
    this.SBP = 0;
  }

  /**
   * Adds a string to the digest
   *
   * This method adds a new string to the digest and returns its address.
   * The string is stored with a 1-byte length prefix followed by the character data.
   * Each character is stored as a single byte (ASCII/Latin-1 encoding).
   *
   * @param {string} str - The string to add to the digest
   * @returns {number} The address of the string in the string segment
   * @throws {Error} If the string is too long or if there's not enough space in the digest
   */
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

  /**
   * Gets the length of a string at the specified address
   *
   * This method reads the length byte of a string stored at the given address.
   *
   * @param {number} address - The address of the string in the string segment
   * @returns {number} The length of the string
   * @throws {Error} If the address is outside the string segment bounds
   */
  length(address: number): number {
    if (address < 0 || address >= 0 + STRING_SIZE) {
      throw new Error('Address is outside memory bounds');
    }

    return this.memory.read8(SEG_STRING, address);
  }

  /**
   * Retrieves a string from the digest at the specified address
   *
   * This method reads a string from memory at the given address.
   * It first reads the length byte, then reads the specified number of character bytes.
   *
   * @param {number} address - The address of the string in the string segment
   * @returns {string} The string stored at the specified address
   * @throws {Error} If the address or string data is outside the string segment bounds
   */
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

  /**
   * Gets the remaining space in the string segment
   *
   * @returns {number} The number of bytes available in the string segment
   */
  get remainingSpace(): number {
    return 0 + STRING_SIZE - this.SBP;
  }

  /**
   * Searches for a string in the digest
   *
   * This method scans through all strings in the digest to find a match for the provided string.
   * It returns the address of the first matching string, or NOT_FOUND if no match is found.
   *
   * @param {string} str - The string to search for
   * @returns {number} The address of the matching string, or NOT_FOUND (-1) if not found
   * @throws {Error} If any string data is outside the string segment bounds
   */
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
          this.memory.read8(SEG_STRING, pointer + STRING_HEADER_SIZE + i),
        );
      }

      if (existingStr === str) {
        return pointer;
      }

      pointer += STRING_HEADER_SIZE + length;
    }

    return NOT_FOUND;
  }

  /**
   * Interns a string in the digest
   *
   * This method first checks if the string already exists in the digest.
   * If it does, it returns the address of the existing string.
   * If not, it adds the string to the digest and returns the new address.
   *
   * This is useful for string deduplication and symbol interning.
   *
   * @param {string} str - The string to intern
   * @returns {number} The address of the string in the digest
   */
  intern(str: string): number {
    const address = this.find(str);
    if (address !== NOT_FOUND) {
      return address;
    }

    return this.add(str);
  }
}
