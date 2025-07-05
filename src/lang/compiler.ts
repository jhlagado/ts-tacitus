import { VM } from '../core/vm';
import { CoreTag, toTaggedValue } from '../core/tagged';
import { SEG_CODE } from '../core/memory';
import { Operation } from '../ops/basic/builtins';

export class Compiler {
  // Array to store operation functions
  operations: Operation[] = [];
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
  compileFloat32(value: number): void {
    this.vm.memory.writeFloat32(SEG_CODE, this.CP, value);
    this.CP += 4; // Move to the next 32-bit aligned address
  }

  /**
   * Compiles an address value as a tagged pointer (tagNum) and writes it as a float.
   */
  compileAddress(value: number): void {
    const tagNum = toTaggedValue(value, false, CoreTag.CODE); // PrimitiveTag the address
    this.compileFloat32(tagNum); // Write the tagged pointer as a Float32
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

  // Update patch16 method to directly use memory write methods
  patch16(address: number, value: number): void {
    this.vm.memory.write16(SEG_CODE, address, value);
  }

  /**
   * Compiles an operation function to be executed by the VM.
   * For the simplified Forth-like implementation, we'll store the operation
   * function in an array and compile an index reference to it.
   * 
   * @param operation The operation function to compile
   */
  compileOp(operation: Operation): void {
    // Store the operation in our operations array
    const opIndex = this.operations.length;
    this.operations.push(operation);
    
    // Compile a special marker byte (255) to indicate an operation reference
    this.compile8(255);
    // Compile the index of the operation in our array
    this.compile16(opIndex);
  }
}
