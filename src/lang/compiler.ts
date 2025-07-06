import { VM } from '../core/vm';
import { CoreTag, toTaggedValue } from '../core/tagged';
import { SEG_CODE } from '../core/memory';
import { Operation } from '../ops/basic/builtins';
import { encodeFunctionIndex } from './opcode';

export class Compiler {
  // Operation lookup table for built-ins and user-defined functions
  private operations: Map<number, Operation> = new Map();
  // Next available function index for user-defined operations
  private nextFunctionIndex = 0;
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
      this.operations.clear(); // Clear operations when resetting
      this.nextFunctionIndex = 0; // Reset function index counter
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
  /**
   * Compiles an operation function to be executed by the VM.
   * For built-ins, registers them in the symbol table and compiles their opcode.
   * For user-defined functions, compiles a function call with the appropriate index.
   * 
   * @param operation The operation function to compile
   * @param name Optional name for built-in operations
   * @returns The opcode for built-ins or function index for user-defined functions
   */
  compileOp(operation: Operation, name?: string): number | undefined {
    if (name) {
      // This is a built-in operation
      const opcode = this.vm.symbolTable.define(name, operation, { isBuiltin: true });
      if (opcode !== undefined) {
        this.compile8(opcode);
        return opcode;
      }
      return undefined;
    } else {
      // This is a user-defined function call
      const funcIndex = this.nextFunctionIndex++;
      this.operations.set(funcIndex, operation);
      
      // Encode the function index as two bytes
      const [low, high] = encodeFunctionIndex(funcIndex);
      this.compile8(low);
      this.compile8(high);
      
      return funcIndex;
    }
  }
  
  /**
   * Compiles a built-in operation (0-127)
   */
  private compileBuiltin(opcode: number): void {
    if (opcode >= 128) { // 7-bit opcode range
      throw new Error(`Opcode ${opcode} exceeds maximum value (127) for built-ins`);
    }
    this.compile8(opcode);
  }
  
  /**
   * Compiles a call to a user-defined function by its index
   */
  compileCallByIndex(index: number): void {
    const [low, high] = encodeFunctionIndex(index);
    this.compile8(low);
    this.compile8(high);
  }
}
