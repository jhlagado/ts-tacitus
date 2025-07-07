/**
 * @file function-table.ts
 * Implements a function table system for the Tacit VM
 * 
 * This provides a unified addressing scheme for opcodes:
 * - Built-in opcodes: 0-127 (7-bit, single byte)
 * - User-defined words: 128-32767 (15-bit, two bytes)
 * 
 * Byte encoding (little-endian):
 * - For built-in ops (0-127): Single byte [opcode]
 * - For user-defined words (128-32767):
 *   First byte: 10000000 | (address & 0x7F)  // High bit set + 7 least significant bits
 *   Second byte: (address >> 7) & 0xFF       // Next 8 bits
 */

import { VM } from './vm';

export type OpcodeFunction = (vm: VM) => void;

export class FunctionTable {
  // The function table - index maps to executable function
  private table: OpcodeFunction[] = [];
  
  constructor() {
    // Pre-allocate initial slots for built-in ops
    this.table = new Array(128).fill(null);
  }
  
  /**
   * Register a built-in operation at a specific index (0-127)
   */
  registerBuiltin(index: number, fn: OpcodeFunction): void {
    if (index < 0 || index > 127) {
      throw new Error(`Built-in operations must have indices between 0-127, got ${index}`);
    }
    this.table[index] = fn;
  }
  
  /**
   * Registers a function implementation with a specific opcode index
   * @param opcode The opcode index to register the function with
   * @param func The function implementation
   */
  registerBuiltinOpcode(opcode: number, func: OpcodeFunction): void {
    if (opcode < 0 || opcode >= 128) {
      throw new Error(`Opcode ${opcode} is outside the valid built-in range (0-127)`);
    }
    this.table[opcode] = func;
  }
  
  /**
   * Registers a user-defined word function and assigns it a function index
   * @param func The function implementation
   * @returns The assigned function index (128-32767)
   */
  registerWord(func: OpcodeFunction): number {
    // Find the next available index in the user-defined range (128-32767)
    let index = 128;
    while (this.table[index] !== undefined && index < 32768) {
      index++;
    }
    
    if (index >= 32768) {
      throw new Error('Function table overflow: no more space for user-defined words');
    }
    
    this.table[index] = func;
    return index;
  }
  

  
  /**
   * Execute the function at the given index
   */
  execute(vm: VM, index: number): void {
    const fn = this.table[index];
    if (!fn) {
      throw new Error(`No function registered at index ${index}`);
    }
    
    fn(vm);
  }
  
  /**
   * Encode an address as either one or two bytes (little-endian)
   */
  encodeAddress(address: number): Uint8Array {
    if (address < 0 || address >= 32768) {
      throw new Error(`Invalid function address: ${address}`);
    }
    
    if (address < 128) {
      // Built-in op - single byte
      return new Uint8Array([address]);
    } else {
      // User-defined word - two bytes (little-endian)
      return new Uint8Array([
        0x80 | (address & 0x7F),        // High bit set + 7 least significant bits
        (address >> 7) & 0xFF            // Next 8 bits
      ]);
    }
  }
  
  /**
   * Decode one or two bytes back into an address (little-endian)
   * Returns [address, bytesConsumed]
   */
  decodeAddress(bytes: Uint8Array, offset: number = 0): [number, number] {
    const firstByte = bytes[offset];
    
    if ((firstByte & 0x80) === 0) {
      // Built-in op - single byte
      return [firstByte, 1]; // [address, bytesConsumed]
    } else {
      // User-defined word - two bytes (little-endian)
      const lowBits = firstByte & 0x7F;
      const highBits = bytes[offset + 1] << 7;
      return [highBits | lowBits, 2]; // [address, bytesConsumed]
    }
  }
}
