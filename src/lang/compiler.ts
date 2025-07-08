import { VM } from '../core/vm';
import { Tag, toTaggedValue } from '../core/tagged';
import { SEG_CODE } from '../core/memory';

export class Compiler {
  nestingScore: number;
  CP: number; // Compile pointer (points to CODE area, 16-bit address)
  BCP: number; // Buffer Compile Pointer (points to start of CODE area, 16-bit address)
  preserve: boolean;
  private vm: VM;

  /**
   * Creates a new Compiler instance.
   * @param vm The VM instance to use for memory access and other operations.
   */
  constructor(vm: VM) {
    this.nestingScore = 0;
    this.CP = 0; // Start compiling at CODE
    this.BCP = 0; // Buffer Compile Pointer starts at CODE
    this.preserve = false;
    this.vm = vm;
  }

  /**
   * Compiles an 8-bit value to the CODE area.
   * Note: Use this only for raw byte values, not for opcodes.
   */
  compile8(value: number): void {
    this.vm.memory.write8(SEG_CODE, this.CP, value);
    this.CP += 1; // Move to the next byte
  }

  /**
   * Compiles a 16-bit value to the CODE area.
   * Note: Use this only for raw values, not for opcodes.
   */
  compile16(value: number): void {
    // Convert the signed value to its 16-bit two's complement representation
    const unsignedValue = value & 0xffff; // Mask to 16 bits

    // Write the 16-bit value to memory
    this.vm.memory.write16(SEG_CODE, this.CP, unsignedValue);
    this.CP += 2; // Move to the next 16-bit aligned address
  }

  /**
   * Compiles a 32-bit float to the CODE area.
   */
  compileFloat32(value: number): void {
    this.vm.memory.writeFloat32(SEG_CODE, this.CP, value);
    this.CP += 4; // Move to the next 32-bit aligned address
  }

  /**
   * Compiles an address value as a tagged pointer (tagNum) and writes it as a float.
   */
  compileAddress(value: number): void {
    const tagNum = toTaggedValue(value, Tag.CODE); // Tag the address
    this.compileFloat32(tagNum); // Write the tagged pointer as a Float32
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
    
    // For built-in opcodes (0-127), use single byte
    if (opcodeAddress < 128) {
      this.compile8(opcodeAddress);
      return;
    }
    
    // For user-defined words (128-32767), use two bytes (little-endian)
    // First byte: High bit set + lower 7 bits
    this.compile8(0x80 | (opcodeAddress & 0x7F));
    
    // Second byte: Higher 8 bits 
    this.compile8((opcodeAddress >> 7) & 0xFF);
  }

  /**
   * Resets the compile pointer to the buffer pointer.
   */
  reset(): void {
    if (this.preserve) {
      this.BCP = this.CP; // Preserve the compiled code
    } else {
      this.CP = this.BCP; // Reuse the memory
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
    
    // For built-in opcodes (0-127), use single byte
    if (opcodeAddress < 128) {
      this.vm.memory.write8(SEG_CODE, address, opcodeAddress);
      return;
    }
    
    // For user-defined words (128-32767), use two bytes (little-endian)
    this.vm.memory.write8(SEG_CODE, address, 0x80 | (opcodeAddress & 0x7F));
    this.vm.memory.write8(SEG_CODE, address + 1, (opcodeAddress >> 7) & 0xFF);
  }
}
