import { VM } from '../core/vm';
import { Tag, toTaggedValue } from '../core/tagged';
import { SEG_CODE } from '../core/memory';

export class Compiler {
  nestingScore: number;
  CP: number;
  BCP: number;
  preserve: boolean;
  private vm: VM;

  /**
   * Creates a new Compiler instance.
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
   * Note: Use this only for raw byte values, not for opcodes.
   */
  compile8(value: number): void {
    this.vm.memory.write8(SEG_CODE, this.CP, value);
    this.CP += 1;
  }

  /**
   * Compiles a 16-bit value to the CODE area.
   * Note: Use this only for raw values, not for opcodes.
   */
  compile16(value: number): void {
    const unsignedValue = value & 0xffff;

    this.vm.memory.write16(SEG_CODE, this.CP, unsignedValue);
    this.CP += 2;
  }

  /**
   * Compiles a 32-bit float to the CODE area.
   */
  compileFloat32(value: number): void {
    this.vm.memory.writeFloat32(SEG_CODE, this.CP, value);
    this.CP += 4;
  }

  /**
   * Compiles an address value as a tagged pointer (tagNum) and writes it as a float.
   */
  compileAddress(value: number): void {
    const tagNum = toTaggedValue(value, Tag.CODE);
    this.compileFloat32(tagNum);
  }

  /**
   * Compiles an opcode according to the unified addressing scheme:
   * - Built-in ops (0-127): Single byte encoding
   * - User-defined words (128-32767): Two-byte little-endian encoding with high bit set
   */
  compileOpcode(opcodeAddress: number): void {
    if (opcodeAddress < 0 || opcodeAddress >= 32768) {
      throw new Error(`Invalid opcode address: ${opcodeAddress}`);
    }

    if (opcodeAddress < 128) {
      this.compile8(opcodeAddress);
      return;
    }

    this.compile8(0x80 | (opcodeAddress & 0x7f));

    this.compile8((opcodeAddress >> 7) & 0xff);
  }

  /**
   * Resets the compile pointer to the buffer pointer.
   */
  reset(): void {
    if (this.preserve) {
      this.BCP = this.CP;
    } else {
      this.CP = this.BCP;
    }
  }

  /**
   * Patches a 16-bit value at the specified memory address
   */
  patch16(address: number, value: number): void {
    this.vm.memory.write16(SEG_CODE, address, value);
  }

  /**
   * Patches an opcode at the specified memory address
   */
  patchOpcode(address: number, opcodeAddress: number): void {
    if (opcodeAddress < 0 || opcodeAddress >= 32768) {
      throw new Error(`Invalid opcode address: ${opcodeAddress}`);
    }

    if (opcodeAddress < 128) {
      this.vm.memory.write8(SEG_CODE, address, opcodeAddress);
      return;
    }

    this.vm.memory.write8(SEG_CODE, address, 0x80 | (opcodeAddress & 0x7f));
    this.vm.memory.write8(SEG_CODE, address + 1, (opcodeAddress >> 7) & 0xff);
  }
}
