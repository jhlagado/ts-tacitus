/**
 * @file Compiler for the Tacit virtual machine
 *
 * This module implements the bytecode compiler for the Tacit language. The compiler
 * translates parsed Tacit code into bytecode that can be executed by the VM's interpreter.
 * It handles the generation of opcodes, literals, and control flow instructions, and provides
 * facilities for patching jump addresses during compilation of branching constructs.
 *
 * The compiler works with the VM's memory model, writing bytecode directly to the CODE segment.
 * It supports both single-byte opcodes for built-in operations and two-byte encodings for
 * user-defined words, following a unified addressing scheme.
 */

import { VM } from '../core/vm';
import { Tag, toTaggedValue } from '../core/tagged';
import { SEG_CODE, MIN_USER_OPCODE } from '../core/constants';
import { InvalidOpcodeAddressError } from '../core/errors';

/**
 * Compiler for the Tacit virtual machine
 *
 * The Compiler class is responsible for generating bytecode from parsed Tacit code.
 * It maintains a compile pointer (CP) that tracks the current position in the code segment
 * where bytecode is being written, and provides methods for compiling various types of
 * values (8-bit, 16-bit, 32-bit float) and opcodes.
 *
 * The compiler also supports patching previously written bytecode, which is essential for
 * implementing control flow constructs like conditionals and loops where jump addresses
 * may not be known at the time of initial compilation.
 */
export class Compiler {
  /**
   * Tracks the nesting level of control structures
   */
  nestingScore: number;

  /**
   * Compile Pointer - current position in the code segment where bytecode is being written
   */
  CP: number;

  /**
   * Buffer Compile Pointer - saved position for reset operations
   */
  BCP: number;

  /**
   * Flag indicating whether the compiler state should be preserved during reset
   */
  preserve: boolean;

  /**
   * Reference to the VM instance for memory access
   */
  private vm: VM;
  /**
   * Creates a new Compiler instance.
   *
   * Initializes the compiler with default values for compile pointers and nesting score.
   * The compiler requires a VM instance to access memory for bytecode writing.
   *
   * @param vm The VM instance to use for memory access and other operations.
   */
  constructor(vm: VM) {
    this.nestingScore = 0;
    this.CP = 0;
    this.BCP = 0;
    this.preserve = false;
    this.vm = vm;
  }

  /**
   * Compiles an 8-bit value to the CODE area.
   *
   * Writes a single byte to the code segment at the current compile pointer position
   * and advances the compile pointer by 1 byte.
   *
   * @param value The 8-bit value to compile (0-255)
   * @note Use this only for raw byte values, not for opcodes (use compileOpcode instead).
   */
  compile8(value: number): void {
    this.vm.memory.write8(SEG_CODE, this.CP, value);
    this.CP += 1;
  }

  /**
   * Compiles a 16-bit value to the CODE area.
   *
   * Writes a 16-bit value to the code segment at the current compile pointer position
   * in little-endian format and advances the compile pointer by 2 bytes.
   * Used for jump offsets, addresses, and other 16-bit values.
   *
   * @param value The 16-bit value to compile (0-65535)
   * @note Use this only for raw values, not for opcodes (use compileOpcode instead).
   */
  compile16(value: number): void {
    const unsignedValue = value & 0xffff;
    this.vm.memory.write16(SEG_CODE, this.CP, unsignedValue);
    this.CP += 2;
  }

  /**
   * Compiles a 32-bit float to the CODE area.
   *
   * Writes a 32-bit floating point value to the code segment at the current compile pointer
   * position and advances the compile pointer by 4 bytes.
   * Used primarily for numeric literals in the Tacit language.
   *
   * @param value The floating point value to compile
   */
  compileFloat32(value: number): void {
    this.vm.memory.writeFloat32(SEG_CODE, this.CP, value);
    this.CP += 4;
  }

  /**
   * Compiles an address value as a tagged pointer (tagNum) and writes it as a float.
   *
   * Tags the provided address with the CODE tag using NaN-boxing and writes it
   * to the code segment as a 32-bit float. This is used for func addresses that
   * need to be treated as tagged values within the VM.
   *
   * @param value The address value to compile and tag
   */
  compileAddress(value: number): void {
    const tagNum = toTaggedValue(value, Tag.CODE);
    this.compileFloat32(tagNum);
  }

  /**
   * Compiles an opcode according to the unified addressing scheme.
   *
   * The Tacit VM uses a unified addressing scheme for opcodes:
   * - Built-in ops (0-127): Single byte encoding
   * - User-defined words (128+): Two-byte little-endian encoding with high bit set
   *
   * This method handles the encoding logic and writes the appropriate bytes to the code segment.
   *
   * @param opcodeAddress The opcode address to compile (0-32767)
   * @throws {Error} If the opcode address is out of range
   *
   * @example
   *
   * compiler.compileOpcode(5);
   *
   *
   * compiler.compileOpcode(500);
   */
  compileOpcode(opcodeAddress: number): void {
    if (opcodeAddress < 0 || opcodeAddress >= 32768) {
      throw new InvalidOpcodeAddressError(opcodeAddress);
    }

    if (opcodeAddress < MIN_USER_OPCODE) {
      this.compile8(opcodeAddress);
      return;
    }

    this.compile8(0x80 | (opcodeAddress & 0x7f));
    this.compile8((opcodeAddress >> 7) & 0xff);
  }

  /**
   * Compiles a user-defined word call using 15-bit addressing.
   * Forces the MSB encoding regardless of the address value.
   *
   * @param address The bytecode address of the user-defined word
   */
  compileUserWordCall(address: number): void {
    if (address < 0 || address >= 32768) {
      throw new InvalidOpcodeAddressError(address);
    }

    // Always use 15-bit encoding for user-defined words
    this.compile8(0x80 | (address & 0x7f));
    this.compile8((address >> 7) & 0xff);
  }

  /**
   * Resets the compile pointer to the buffer pointer.
   *
   * This method is used to reset the compilation state, either by:
   * - Saving the current compile pointer to the buffer pointer (when preserve is true)
   * - Restoring the compile pointer from the buffer pointer (when preserve is false)
   *
   * The preserve flag is used to control whether the current compilation state should
   * be preserved (e.g., when defining a word) or discarded (e.g., when starting a new compilation).
   */
  reset(): void {
    if (this.preserve) {
      this.BCP = this.CP;
    } else {
      this.CP = this.BCP;
    }
  }

  /**
   * Patches a 16-bit value at the specified memory address.
   *
   * This method is used to modify previously compiled bytecode, typically to update
   * jump offsets in control flow constructs once the destination address is known.
   *
   * @param address The address in the code segment to patch
   * @param value The 16-bit value to write at the address
   */
  patch16(address: number, value: number): void {
    this.vm.memory.write16(SEG_CODE, address, value);
  }

  /**
   * Patches an opcode at the specified memory address.
   *
   * Similar to patch16, but specifically handles the encoding of opcodes according
   * to the unified addressing scheme. This is used to modify previously compiled
   * opcodes in the bytecode.
   *
   * @param address The address in the code segment to patch
   * @param opcodeAddress The opcode address to write at the specified address
   * @throws {Error} If the opcode address is out of range
   */
  patchOpcode(address: number, opcodeAddress: number): void {
    if (opcodeAddress < 0 || opcodeAddress >= 32768) {
      throw new InvalidOpcodeAddressError(opcodeAddress);
    }

    if (opcodeAddress < MIN_USER_OPCODE) {
      this.vm.memory.write8(SEG_CODE, address, opcodeAddress);
      return;
    }

    this.vm.memory.write8(SEG_CODE, address, 0x80 | (opcodeAddress & 0x7f));
    this.vm.memory.write8(SEG_CODE, address + 1, (opcodeAddress >> 7) & 0xff);
  }
}
