/**
 * @file src/core/vm.ts
 * A minimal Forth-like virtual machine implementation for Tacit
 * without heap allocation or complex data structures.
 */

import { 
  Memory, 
  STACK_SIZE, 
  RSTACK_SIZE, 
  SEG_STACK, 
  SEG_RSTACK, 
  SEG_CODE, 
  CODE_SIZE,
  SEGMENT_TABLE 
} from './memory';
import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { Digest } from '../strings/digest';
import { fromTaggedValue, toTaggedValue, CoreTag } from './tagged';
import { defineBuiltins } from '../ops/define-builtins';

/**
 * A simplified Forth-like virtual machine for Tacit
 */
export class VM {
  memory: Memory;
  SP: number; // Stack pointer (points to the next free slot)
  RP: number; // Return stack pointer (points to the next free slot)
  BP: number; // Base Pointer for local variable frames
  IP: number; // Instruction pointer
  running: boolean;
  compiler: Compiler;
  digest: Digest;
  debug: boolean;
  symbolTable: SymbolTable;

  constructor() {
    this.memory = new Memory();
    this.IP = 0; // Start execution at CODE
    this.running = true;
    this.SP = 0; // Stack starts at STACK
    this.RP = 0; // Return stack starts at RSTACK
    this.BP = 0; // Base Pointer starts at 0
    this.compiler = new Compiler(this);
    this.digest = new Digest(this.memory);
    this.debug = false;

    this.symbolTable = new SymbolTable(this.digest);
    // Register all built-in operations
    defineBuiltins(this.symbolTable);
  }

  eval() {
    this.rpush(toTaggedValue(this.IP, false, CoreTag.CODE));
    const { value: pointer } = fromTaggedValue(this.pop());
    this.IP = pointer;
  }

  /**
   * Pushes a 32-bit float onto the stack.
   */
  push(value: number): void {
    if (this.SP + 4 > STACK_SIZE) {
      throw new Error(
        `Stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(this.getStackData())})`
      );
    }
    this.memory.writeFloat32(SEG_STACK, this.SP, value); // Write 32-bit float
    this.SP += 4; // Move stack pointer by 4 bytes
  }

  /**
   * Pops a 32-bit float from the stack.
   */
  pop(): number {
    if (this.SP <= 0) {
      throw new Error(
        `Stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`
      );
    }
    this.SP -= 4; // Move stack pointer back by 4 bytes
    return this.memory.readFloat32(SEG_STACK, this.SP); // Read 32-bit float
  }

  peek(): number {
    const value = this.pop();
    this.push(value); // Push back the value
    return value;
  }

  /**
   * Clears the data stack
   */
  clearStack(): void {
    this.SP = 0;
  }

  /**
   * Pops 'size' 32-bit values from the stack and returns them in an array.
   * The values are returned in the order they were on the stack (bottom first).
   */
  popArray(size: number): number[] {
    const result: number[] = Array(size);
    for (let i = size - 1; i >= 0; i--) {
      result[i] = this.pop();
    }
    return result;
  }

  /**
   * Pushes a 32-bit value onto the return stack.
   */
  rpush(value: number): void {
    if (this.RP + 4 > RSTACK_SIZE) {
      throw new Error(
        `Return stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    
    this.memory.writeFloat32(SEG_RSTACK, this.RP, value); // Write 32-bit value
    this.RP += 4; // Move return stack pointer by 4 bytes
  }

  /**
   * Pops a 32-bit value from the return stack.
   */
  rpop(): number {
    if (this.RP <= 0) {
      throw new Error(
        `Return stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`
      );
    }
    
    this.RP -= 4; // Move return stack pointer back by 4 bytes
    return this.memory.readFloat32(SEG_RSTACK, this.RP); // Read 32-bit value
  }

  reset() {
    this.IP = 0;
  }

  /**
   * Reads the next 8-bit value from memory and increments the instruction pointer.
   */
  next8(): number {
    const value = this.memory.read8(SEG_CODE, this.IP); // Read 8-bit value
    this.IP += 1; // Move instruction pointer by 1 byte
    return value;
  }

  /**
   * Reads the next 16-bit value from memory and increments the instruction pointer.
   */
  next16(): number {
    // Read the 16-bit value from memory
    const unsignedValue = this.memory.read16(SEG_CODE, this.IP);

    // Interpret the 16-bit value as a signed integer
    const signedValue = (unsignedValue << 16) >> 16; // Sign-extend to 32 bits

    this.IP += 2; // Move instruction pointer by 2 bytes
    return signedValue;
  }

  /**
   * Reads the next 32-bit float from memory and increments the instruction pointer.
   */
  nextFloat32(): number {
    const value = this.memory.readFloat32(SEG_CODE, this.IP); // Read 32-bit float
    this.IP += 4; // Move instruction pointer by 4 bytes
    return value;
  }

  /**
   * Reads the next address (tagged as CODE) from memory and increments the instruction pointer.
   */
  nextAddress(): number {
    const tagNum = this.nextFloat32(); // Read the tagged pointer as a float
    const { value: pointer } = fromTaggedValue(tagNum);
    return pointer;
  }

  /**
   * Reads the next 16-bit value from code memory and increments the instruction pointer.
   */
  read16(): number {
    const lowByte = this.memory.read8(SEG_CODE, this.IP);
    const highByte = this.memory.read8(SEG_CODE, this.IP + 1);
    this.IP += 2;
    return (highByte << 8) | lowByte; // Combine bytes, assuming big-endian or adjust as per codebase
  }

  /**
   * Returns the current stack data as an array of 32-bit values.
   * For testing purposes, this converts NaN-boxed values to their raw forms.
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = 0; i < this.SP; i += 4) {
      const value = this.memory.readFloat32(SEG_STACK, i);
      
      // If the value is NaN-boxed, extract the raw value
      if (isNaN(value)) {
        const { value: rawValue } = fromTaggedValue(value);
        stackData.push(rawValue);
      } else {
        // It's a regular float, push as is
        stackData.push(value);
      }
    }
    return stackData;
  }

  getCompileData(): number[] {
    const compileData: number[] = [];
    for (let i = 0; i < this.compiler.CP; i++) {
      compileData.push(this.memory.read8(SEG_CODE, i));
    }
    return compileData;
  }

  /**
   * Executes compiled code starting at the current IP
   * Implements a direct threaded code interpreter
   */
  run(): void {
    this.running = true;
    const maxIterations = 1000; // Prevent infinite loops
    let iterations = 0;
    
    // Calculate code segment bounds
    const codeStart = SEGMENT_TABLE[SEG_CODE];
    const codeEnd = codeStart + CODE_SIZE;
    
    while (this.running && iterations++ < maxIterations) {
      // Check if we've reached the end of code memory
      const currentAddress = codeStart + this.IP;
      if (currentAddress >= codeEnd) {
        this.running = false;
        break;
      }
      
      const opcode = this.next8();
      
      if ((opcode & 0x80) === 0) {
        // Built-in opcode (0-127)
        const operation = this.symbolTable.getBuiltin(opcode);
        if (!operation) {
          throw new Error(`Undefined opcode: ${opcode}`);
        }
        
        try {
          operation(this);
        } catch (error) {
          this.running = false;
          throw error;
        }
      } else {
        // Function call (high bit set)
        const byte2 = this.next8();
        const index = ((byte2 & 0x7F) << 7) | (opcode & 0x7F);
        const targetAddress = this.symbolTable.getUserDefined(index);
        
        if (targetAddress === undefined) {
          throw new Error(`Undefined function index: ${index}`);
        }
        
        // Check for stack overflow before pushing return address
        if (this.RP + 4 > RSTACK_SIZE) {
          this.running = false;
          throw new Error('Return stack overflow');
        }
        
        // Save return address (current IP, which is after the 2-byte call)
        this.rpush(this.IP);
        // Set IP to the function's address
        this.IP = targetAddress;
      }
    }
    
    if (iterations >= maxIterations && this.running) {
      throw new Error('Maximum iterations exceeded');
    }
  }

  /**
   * Returns from a function call
   */
  ret(): void {
    if (this.RP < 4) {
      this.running = false; // Return from top-level
      return;
    }
    this.IP = this.rpop();
  }
}
