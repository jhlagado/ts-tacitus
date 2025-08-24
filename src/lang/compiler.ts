/**
 * @file Compiler for the Tacit virtual machine
 * Bytecode compiler for the Tacit language.
 */

import { VM } from '../core/vm';
import { Tag, toTaggedValue } from '../core/tagged';
import { SEG_CODE, MIN_USER_OPCODE } from '../core/constants';
import { InvalidOpcodeAddressError } from '../core/errors';
import { Op } from '../ops/opcodes';

/**
 * Compiler for generating bytecode from parsed Tacit code.
 */
export class Compiler {
  nestingScore: number;

  CP: number;

  BCP: number;

  preserve: boolean;

  // Function compilation context
  isInFunction: boolean;
  reservePatchAddr: number;

  private vm: VM;
  /**
   * Creates a new Compiler instance.
   * @param vm VM instance for memory access
   */
  constructor(vm: VM) {
    this.nestingScore = 0;
    this.CP = 0;
    this.BCP = 0;
    this.preserve = false;
    this.isInFunction = false;
    this.reservePatchAddr = -1;
    this.vm = vm;
  }

  /**
   * Compiles 8-bit value to CODE area.
   * @param value 8-bit value to compile
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
   * to the code segment as a 32-bit float. This is used for code addresses that
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

  /**
   * Begins function compilation context.
   * 
   * This method is called when starting to compile a function.
   * It tracks that we are in a function context but does not emit
   * Reserve opcode until variables are actually declared.
   */
  enterFunction(): void {
    this.isInFunction = true;
    this.reservePatchAddr = -1;
  }

  /**
   * Emits Reserve opcode placeholder on first variable declaration.
   * 
   * This method is called when the first local variable is encountered
   * in a function. It emits the Reserve opcode with a placeholder that
   * will be patched when the function ends.
   */
  emitReserveIfNeeded(): void {
    if (this.isInFunction && this.reservePatchAddr === -1) {
      // Emit Reserve opcode with placeholder slot count
      this.compileOpcode(Op.Reserve);
      this.reservePatchAddr = this.CP;
      this.compile16(0); // Placeholder - will be patched in exitFunction
    }
  }

  /**
   * Ends function compilation context and patches Reserve slot count.
   * 
   * This method is called when finishing compilation of a function.
   * It patches the Reserve opcode's slot count if any variables were declared.
   */
  exitFunction(): void {
    if (this.isInFunction && this.reservePatchAddr !== -1) {
      const localCount = this.vm.symbolTable.getLocalCount();
      this.patch16(this.reservePatchAddr, localCount);
    }
    
    this.isInFunction = false;
    this.reservePatchAddr = -1;
  }
}
