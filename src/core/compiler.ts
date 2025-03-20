import { VM } from "./vm";
import { CoreTag, toTaggedValue } from "./tagged-value";
import { SEG_CODE } from "./memory";

export class Compiler {
  nestingScore: number;
  CP: number; // Compile pointer (points to CODE area, 16-bit address)
  BP: number; // Buffer pointer (points to start of CODE area, 16-bit address)
  preserve: boolean;

  constructor(private vm: VM) {
    this.nestingScore = 0;
    this.CP = 0; // Start compiling at CODE
    this.BP = 0; // Buffer starts at CODE
    this.preserve = false;
  }

  /**
   * Compiles an 8-bit value to the CODE area.
   */
  compile8(value: number): void {
    this.vm.memory.write8(SEG_CODE, this.CP, value);
    this.CP += 1; // Move to the next byte
  }

  /**
   * Compiles a 16-bit value to the CODE area.
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
  compileFloat(value: number): void {
    this.vm.memory.writeFloat(SEG_CODE, this.CP, value);
    this.CP += 4; // Move to the next 32-bit aligned address
  }

  /**
   * Compiles an address value as a tagged pointer (tagNum) and writes it as a float.
   */
  compileAddress(value: number): void {
    const tagNum = toTaggedValue(value, false, CoreTag.CODE); // PrimitiveTag the address
    this.compileFloat(tagNum); // Write the tagged pointer as a Float32
  }

  /**
   * Resets the compile pointer to the buffer pointer.
   */
  reset(): void {
    if (this.preserve) {
      this.BP = this.CP; // Preserve the compiled code
    } else {
      this.CP = this.BP; // Reuse the memory
    }
  }
}
