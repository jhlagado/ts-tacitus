import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { Memory, STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK, SEG_CODE } from './memory';
import { fromTaggedValue, toTaggedValue, Tag } from './tagged';
import { Digest } from '../strings/digest';
import { defineBuiltins } from '../ops/define-builtins';
import { FunctionTable } from './function-table';

import { initFunctionTable } from '../ops/init-function-table';

const BYTES_PER_ELEMENT = 4;

export class VM {
  memory: Memory;
  SP: number;
  RP: number;
  BP: number;
  IP: number;
  running: boolean;
  compiler!: Compiler;
  digest: Digest;
  debug: boolean;
  symbolTable: SymbolTable;
  functionTable: FunctionTable;
  tupleDepth: number;

  constructor() {
    this.memory = new Memory();
    this.IP = 0;
    this.running = true;
    this.SP = 0;
    this.RP = 0;
    this.BP = 0;

    this.digest = new Digest(this.memory);
    this.debug = false;
    this.tupleDepth = 0;

    this.functionTable = new FunctionTable();
    this.symbolTable = new SymbolTable(this.digest);
    defineBuiltins(this.symbolTable);
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
    if (this.SP + BYTES_PER_ELEMENT > STACK_SIZE) {
      throw new Error(
        `Stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(this.getStackData())})`,
      );
    }

    this.memory.writeFloat32(SEG_STACK, this.SP, value);
    this.SP += BYTES_PER_ELEMENT;
  }

  /**
   * Pops a 32-bit float from the stack.
   */
  pop(): number {
    if (this.SP <= 0) {
      throw new Error(
        `Stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`,
      );
    }

    this.SP -= BYTES_PER_ELEMENT;
    return this.memory.readFloat32(SEG_STACK, this.SP);
  }

  peek(): number {
    const value = this.pop();

    this.push(value);
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
    if (this.RP + BYTES_PER_ELEMENT > RSTACK_SIZE) {
      throw new Error(
        `Return stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(
          this.getStackData(),
        )})`,
      );
    }

    this.memory.writeFloat32(SEG_RSTACK, this.RP, value);
    this.RP += BYTES_PER_ELEMENT;
  }

  /**
   * Pops a 32-bit value from the return stack.
   */
  rpop(): number {
    if (this.RP <= 0) {
      throw new Error(
        `Return stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`,
      );
    }

    this.RP -= BYTES_PER_ELEMENT;
    return this.memory.readFloat32(SEG_RSTACK, this.RP);
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

    this.IP += 1;

    if ((firstByte & 0x80) !== 0) {
      const secondByte = this.memory.read8(SEG_CODE, this.IP);

      this.IP += 1;

      const lowBits = firstByte & 0x7f;

      const highBits = secondByte << 7;

      return highBits | lowBits;
    }

    return firstByte;
  }

  /**
   * Reads the next 16-bit value from memory and increments the instruction pointer.
   */
  next16(): number {
    const unsignedValue = this.memory.read16(SEG_CODE, this.IP);

    const signedValue = (unsignedValue << 16) >> 16;

    this.IP += 2;
    return signedValue;
  }

  /**
   * Reads the next 32-bit float from memory and increments the instruction pointer.
   */
  nextFloat32(): number {
    const value = this.memory.readFloat32(SEG_CODE, this.IP);

    this.IP += BYTES_PER_ELEMENT;
    return value;
  }

  /**
   * Reads the next address (tagged as CODE) from memory and increments the instruction pointer.
   */
  nextAddress(): number {
    const tagNum = this.nextFloat32();

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
    return (highByte << 8) | lowByte;
  }

  /**
   * Returns the current stack data as an array of 32-bit values.
   */
  getStackData(): number[] {
    const stackData: number[] = [];

    for (let i = 0; i < this.SP; i += BYTES_PER_ELEMENT) {
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
