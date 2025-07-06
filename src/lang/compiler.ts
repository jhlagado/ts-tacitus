import { VM } from '../core/vm';
import { CoreTag, toTaggedValue } from '../core/tagged';
import { SEG_CODE } from '../core/memory';
import { Operation } from '../ops/basic/builtins';
import { encodeBuiltin, encodeFunctionIndex, MAX_BUILTINS } from './opcode';

export class Compiler {
  // Array to store operation functions
  operations: Operation[] = [];
  // Counter for built-in operations (0-127)
  private builtinCount = 0;
  // Counter for user-defined operations (0-16383)
  private userOpCount = 0;
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
      this.operations = []; // Clear operations when resetting
      this.builtinCount = 0;
      this.userOpCount = 0;
    }
  }

  // Update patch16 method to directly use memory write methods
  patch16(address: number, value: number): void {
    this.vm.memory.write16(SEG_CODE, address, value);
  }

  /**
   * Compiles an operation function to be executed by the VM.
   * Uses the new opcode encoding scheme:
   * - Built-ins: 0xxxxxxx (7-bit opcode)
   * - User functions: 1xxxxxxx yyyyyyyy (15-bit index)
   * 
   * @param operation The operation function to compile
   * @param isBuiltin Whether this is a built-in operation
   */
  compileOp(operation: Operation, isBuiltin: boolean = false): void {
    // Store the operation in our operations array
    const opIndex = this.operations.length;
    this.operations.push(operation);
    
    // For built-ins, we just need to store the opcode (which is the index)
    // For user functions, we need to store the function table index
    if (isBuiltin) {
      this.compileBuiltin(opIndex);
    } else {
      this.compileCall(opIndex);
    }
  }
  
  /**
   * Compiles a call to a built-in operation
   * @param opcode The built-in opcode (0-127)
   */
  private compileBuiltin(opcode: number): void {
    if (opcode < 0 || opcode >= MAX_BUILTINS) {
      throw new Error(`Built-in opcode ${opcode} out of range (0-${MAX_BUILTINS-1})`);
    }
    // For built-ins, we just write the 7-bit opcode directly
    this.compile8(opcode);
  }
  
  /**
   * Compiles a call to a user-defined function
   * @param index The function table index (0-16383)
   */
  private compileCall(index: number): void {
    // Encode the index as a 15-bit value with the high bit set on the first byte
    const bytes = encodeFunctionIndex(index);
    for (const byte of bytes) {
      this.compile8(byte);
    }
  }
}
