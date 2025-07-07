import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { Memory, STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK, SEG_CODE } from './memory';
import { fromTaggedValue, toTaggedValue, Tag } from './tagged';
import { Digest } from '../strings/digest';
import { defineBuiltins } from '../ops/define-builtins';
import { FunctionTable } from './function-table';
import { initFunctionTable } from '../ops/init-function-table';

export class VM {
  memory: Memory;
  SP: number; // Stack pointer (points to the next free slot)
  RP: number; // Return stack pointer (points to the next free slot)
  BP: number; // Base Pointer for local variable frames
  IP: number; // Instruction pointer
  running: boolean;
  compiler!: Compiler; // Will be set in initializeCompilerAndFunctionTable
  digest: Digest;
  debug: boolean;
  symbolTable: SymbolTable;
  functionTable: FunctionTable; // Function table for unified opcode addressing
  tupleDepth: number; // Tracks nesting level of tuples

  constructor() {
    this.memory = new Memory();
    this.IP = 0; // Start execution at CODE
    this.running = true;
    this.SP = 0; // Stack starts at STACK
    this.RP = 0; // Return stack starts at RSTACK
    this.BP = 0; // Base Pointer starts at 0
    
    this.digest = new Digest(this.memory);
    this.debug = false;
    this.tupleDepth = 0; // Initialize tuple depth to 0
    
    // Initialize function table and register built-in functions
    this.functionTable = new FunctionTable();
    
    // Set up symbol table
    this.symbolTable = new SymbolTable(this.digest); // Creates a new SymbolTable
    defineBuiltins(this.symbolTable); // Populates the new table with built-ins
    
    // Defer function table initialization and compiler assignment to avoid circular dependencies
    // These will be set after construction in the initialization function
  }
  
  /**
   * Sets the compiler instance and initializes the function table.
   * This method must be called after VM construction to complete initialization.
   */
  initializeCompilerAndFunctionTable(compiler: Compiler): void {
    this.compiler = compiler;
    initFunctionTable(this);
  }

  eval() {
    this.rpush(toTaggedValue(this.IP, Tag.CODE));
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
   * Pops 'size' 32-bit values from the stack and returns them in an array.
   * The values are returned in the order they were on the stack (bottom first).
   */
  popArray(size: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < size; i++) {
      result.unshift(this.pop());
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
   * Read the next byte from memory and advance the instruction pointer
   */
  next8(): number {
    const value = this.memory.read8(SEG_CODE, this.IP);
    this.IP += 1;
    return value;
  }

  /**
   * Read the next opcode from memory (either 1-byte or 2-byte) and advance the instruction pointer
   * Decodes opcodes according to the unified addressing scheme:
   * - Built-in opcodes (0-127): Single byte with high bit clear
   * - User-defined words (128-32767): Two bytes with high bit set on first byte
   * @returns The decoded opcode/function index
   */
  nextOpcode(): number {
    const firstByte = this.memory.read8(SEG_CODE, this.IP);
    this.IP += 1; // Move instruction pointer by 1 byte
    
    // If high bit is set, this is a 2-byte opcode
    if ((firstByte & 0x80) !== 0) {
      const secondByte = this.memory.read8(SEG_CODE, this.IP);
      this.IP += 1; // Move instruction pointer by 1 more byte
      
      // Decode the address (little-endian)
      const lowBits = firstByte & 0x7F;
      const highBits = secondByte << 7;
      return highBits | lowBits;
    }
    
    // Otherwise, it's a 1-byte opcode
    return firstByte;
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
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = 0; i < this.SP; i += 4) {
      stackData.push(this.memory.readFloat32(SEG_STACK, i));
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
}
