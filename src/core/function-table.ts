/**
 * @file src/core/function-table.ts
 * 
 * This file implements a function table system for the Tacit VM, providing a unified
 * addressing scheme for both built-in operations and user-defined words. The function
 * table maps numeric indices to function implementations, allowing the VM to dispatch
 * operations efficiently during execution.
 * 
 * The addressing scheme divides the available address space into two ranges:
 * - Built-in opcodes: 0-127 (7-bit, single byte encoding)
 * - User-defined words: 128-32767 (15-bit, two-byte encoding)
 * 
 * This design allows for efficient bytecode representation while supporting a large
 * number of user-defined words. The encoding is little-endian:
 * 
 * - For built-in ops (0-127): Single byte [opcode]
 * - For user-defined words (128-32767):
 *   First byte: 10000000 | (address & 0x7F) - High bit set, low 7 bits of address
 *   Second byte: (address >> 7) & 0xFF - High 8 bits of address
 * 
 * The function table works in conjunction with the VM's symbol table, which maps
 * word names to function indices in this table.
 */
import { VM } from './vm';

/**
 * Function signature for VM operations
 * 
 * All operations in the Tacit VM follow this signature, taking a VM instance
 * as their only parameter and returning void. Operations interact with the VM
 * by manipulating its stacks, memory, and other state variables.
 */
export type OpcodeFunction = (vm: VM) => void;
/**
 * Function table for the Tacit VM
 * 
 * The FunctionTable class manages a registry of operation implementations,
 * providing methods to register both built-in operations and user-defined words.
 * It also handles the encoding and decoding of function addresses according to
 * the unified addressing scheme.
 * 
 * The table stores function implementations indexed by their numeric address,
 * allowing the VM to efficiently look up and execute operations during bytecode
 * interpretation.
 */
export class FunctionTable {
  /**
   * The internal array storing function implementations indexed by their address
   */
  private table: OpcodeFunction[] = [];
  constructor() {
    this.table = new Array(128).fill(null);
  }

  /**
   * Register a built-in operation at a specific index (0-127)
   * 
   * This method is used to register core VM operations at fixed indices
   * in the lower range of the address space (0-127), which can be encoded
   * as a single byte in the bytecode.
   * 
   * @param index - The index at which to register the operation (0-127)
   * @param fn - The function implementation to register
   * @throws {Error} If the index is outside the valid range for built-in operations
   */
  registerBuiltin(index: number, fn: OpcodeFunction): void {
    if (index < 0 || index > 127) {
      throw new Error(`Built-in operations must have indices between 0-127, got ${index}`);
    }

    this.table[index] = fn;
  }

  /**
   * Registers a function implementation with a specific opcode index
   * 
   * This is an alternative method for registering built-in operations,
   * with a more descriptive parameter name (opcode instead of index).
   * 
   * @param opcode - The opcode index to register the function with (0-127)
   * @param func - The function implementation
   * @throws {Error} If the opcode is outside the valid range for built-in operations
   */
  registerBuiltinOpcode(opcode: number, func: OpcodeFunction): void {
    if (opcode < 0 || opcode >= 128) {
      throw new Error(`Opcode ${opcode} is outside the valid built-in range (0-127)`);
    }

    this.table[opcode] = func;
  }

  /**
   * Registers a user-defined word function and assigns it a function index
   * 
   * This method is used when defining new words in the Tacit language.
   * It automatically assigns the next available index in the user-defined
   * word range (128-32767) to the provided function implementation.
   * 
   * @param func - The function implementation for the user-defined word
   * @returns The assigned function index (128-32767)
   * @throws {Error} If the function table is full (no more indices available)
   */
  registerWord(func: OpcodeFunction): number {
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
   * 
   * This method is called by the VM's interpreter to execute an operation
   * at a specific index in the function table. It looks up the function
   * implementation and calls it with the VM instance.
   * 
   * @param vm - The VM instance to pass to the function
   * @param index - The index of the function to execute
   * @throws {Error} If no function is registered at the specified index
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
   * 
   * This method implements the unified addressing scheme encoding:
   * - Built-in ops (0-127): Single byte [opcode]
   * - User-defined words (128-32767): Two bytes with high bit set on first byte
   * 
   * @param address - The function address to encode (0-32767)
   * @returns A Uint8Array containing the encoded bytes (1 or 2 bytes)
   * @throws {Error} If the address is outside the valid range (0-32767)
   */
  encodeAddress(address: number): Uint8Array {
    if (address < 0 || address >= 32768) {
      throw new Error(`Invalid function address: ${address}`);
    }

    if (address < 128) {
      return new Uint8Array([address]);
    } else {
      return new Uint8Array([0x80 | (address & 0x7f), (address >> 7) & 0xff]);
    }
  }

  /**
   * Decode one or two bytes back into an address (little-endian)
   * 
   * This method implements the unified addressing scheme decoding:
   * - If the high bit of the first byte is clear, it's a single-byte built-in opcode
   * - If the high bit is set, it's a two-byte user-defined word address
   * 
   * @param bytes - The byte array containing the encoded address
   * @param offset - The offset in the byte array to start decoding from (default: 0)
   * @returns A tuple containing [decodedAddress, bytesConsumed]
   */
  decodeAddress(bytes: Uint8Array, offset: number = 0): [number, number] {
    const firstByte = bytes[offset];
    if ((firstByte & 0x80) === 0) {
      return [firstByte, 1];
    } else {
      const lowBits = firstByte & 0x7f;
      const highBits = bytes[offset + 1] << 7;
      return [highBits | lowBits, 2];
    }
  }
}
