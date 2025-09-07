/**
 * @file src/core/vm.ts
 * Core Virtual Machine implementation for Tacit bytecode execution.
 */

import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { Memory } from './memory';
import { STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK, SEG_CODE } from './constants';
import { fromTaggedValue, NIL } from './tagged';
import { Digest } from '../strings/digest';
import { registerBuiltins } from '../ops/builtins-register';
import {
  StackUnderflowError,
  StackOverflowError,
  ReturnStackUnderflowError,
  ReturnStackOverflowError,
} from './errors';

const CELL_SIZE = 4;

/**
 * Virtual Machine for executing Tacit bytecode.
 */
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

  listDepth: number;
  

  /**
   * Creates a new VM instance with initialized memory and built-in operations.
   */
  constructor() {
    this.memory = new Memory();
    this.IP = 0;
    this.running = true;
    this.SP = 0;
    this.RP = 0;
    this.BP = 0;
    this.digest = new Digest(this.memory);
    this.debug = false;
    this.listDepth = 0;
    this.listDepth = 0;

    this.symbolTable = new SymbolTable(this.digest);
    registerBuiltins(this, this.symbolTable);
  }

  /**
   * Initializes the compiler for the VM.
   * @param compiler The compiler instance
   */
  initializeCompiler(compiler: Compiler): void {
    this.compiler = compiler;
  }

  /**
   * Pushes a value onto the data stack.
   * @param value The value to push
   * @throws {StackOverflowError} If stack overflow occurs
   */
  push(value: number): void {
    if (this.SP + CELL_SIZE > STACK_SIZE) {
      throw new StackOverflowError('push', this.getStackData());
    }

    this.memory.writeFloat32(SEG_STACK, this.SP, value);
    this.SP += CELL_SIZE;
  }

  /**
   * Pops a value from the data stack.
   * @returns The popped value
   * @throws {StackUnderflowError} If stack underflow occurs
   */
  pop(): number {
    if (this.SP <= 0) {
      throw new StackUnderflowError('pop', 1, this.getStackData());
    }

    this.SP -= CELL_SIZE;
    return this.memory.readFloat32(SEG_STACK, this.SP);
  }

  /**
   * Peeks at the top stack value.
   * @returns The top value
   * @throws {StackUnderflowError} If stack is empty
   */
  peek(): number {
    if (this.SP <= 0) {
      throw new StackUnderflowError('peek', 1, this.getStackData());
    }

    return this.memory.readFloat32(SEG_STACK, this.SP - CELL_SIZE);
  }

  /**
   * Peeks at a value at a specific slot offset from the top of the stack.
   * @param slotOffset Number of slots from the top (0 = top, 1 = second from top, etc.)
   * @returns The value at the specified offset
   * @throws {StackUnderflowError} If the stack doesn't have enough values
   */
  peekAt(slotOffset: number): number {
    const requiredCells = slotOffset + 1;
    if (this.SP < requiredCells * CELL_SIZE) {
      throw new StackUnderflowError('peekAt', requiredCells, this.getStackData());
    }

    return this.memory.readFloat32(SEG_STACK, this.SP - (slotOffset + 1) * CELL_SIZE);
  }

  /**
   * Pops multiple values from the stack.
   * @param size Number of values to pop
   * @returns Array of values in stack order
   * @throws {StackUnderflowError} If stack underflow occurs
   */
  popArray(size: number): number[] {
    if (this.SP < size * CELL_SIZE) {
      throw new StackUnderflowError('popArray', size, this.getStackData());
    }

    const result: number[] = [];
    for (let i = 0; i < size; i++) {
      result.unshift(this.pop());
    }

    return result;
  }

  /**
   * Pushes a value onto the return stack.
   * @param value The value to push
   * @throws {ReturnStackOverflowError} If return stack overflow occurs
   */
  rpush(value: number): void {
    if (this.RP + CELL_SIZE > RSTACK_SIZE) {
      throw new ReturnStackOverflowError('rpush', this.getStackData());
    }

    this.memory.writeFloat32(SEG_RSTACK, this.RP, value);
    this.RP += CELL_SIZE;
  }

  /**
   * Pops a value from the return stack.
   * @returns The popped value
   * @throws {ReturnStackUnderflowError} If return stack underflow occurs
   */
  rpop(): number {
    if (this.RP <= 0) {
      throw new ReturnStackUnderflowError('rpop', this.getStackData());
    }

    this.RP -= CELL_SIZE;
    return this.memory.readFloat32(SEG_RSTACK, this.RP);
  }

  /**
   * Resets the instruction pointer to the beginning.
   */
  reset() {
    this.IP = 0;
  }

  /**
   * Reads the next byte from code and advances IP.
   * @returns The byte value
   */
  next8(): number {
    const value = this.memory.read8(SEG_CODE, this.IP);
    this.IP += 1;
    return value;
  }

  /**
   * Reads the next opcode from code and advances IP.
   * @returns The decoded opcode or user-defined word address
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
   * Reads the next 16-bit signed integer from code and advances IP.
   * @returns The signed integer value
   */
  nextInt16(): number {
    const unsignedValue = this.memory.read16(SEG_CODE, this.IP);
    const signedValue = (unsignedValue << 16) >> 16;
    this.IP += 2;
    return signedValue;
  }

  /**
   * Reads the next float from code and advances IP.
   * @returns The float value
   */
  nextFloat32(): number {
    const value = this.memory.readFloat32(SEG_CODE, this.IP);
    this.IP += CELL_SIZE;
    return value;
  }

  /**
   * Reads the next address from code and advances IP.
   * @returns The decoded code pointer
   */
  nextAddress(): number {
    const tagNum = this.nextFloat32();
    const { value: pointer } = fromTaggedValue(tagNum);
    return pointer;
  }

  /**
   * Reads the next 16-bit unsigned integer from code and advances IP.
   * @returns The unsigned integer value
   */
  nextUint16(): number {
    const value = this.memory.read16(SEG_CODE, this.IP);
    this.IP += 2;
    return value;
  }

  /**
   * Gets the current data stack contents.
   * @returns Array of stack values
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = 0; i < this.SP; i += CELL_SIZE) {
      stackData.push(this.memory.readFloat32(SEG_STACK, i));
    }

    return stackData;
  }

  /**
   * Ensures stack has minimum number of elements.
   * @param size Required stack depth
   * @param operation Operation name for error reporting
   * @throws {StackUnderflowError} If insufficient stack elements
   */
  ensureStackSize(size: number, operation: string): void {
    if (this.SP < size * CELL_SIZE) {
      throw new StackUnderflowError(operation, size, this.getStackData());
    }
  }

  /**
   * Gets the current compiled bytecode.
   * @returns Array of code bytes
   */
  getCompileData(): number[] {
    const compileData: number[] = [];
    for (let i = 0; i < this.compiler.CP; i++) {
      compileData.push(this.memory.read8(SEG_CODE, i));
    }

    return compileData;
  }

  /**
   * Resolves a symbol name to a tagged value.
   * @param name The symbol name to resolve
   * @returns Tagged value for the symbol, or undefined if not found
   */
  resolveSymbol(name: string): number | undefined {
    return this.symbolTable.findTaggedValue(name);
  }

  /**
   * Pushes a symbol reference onto the stack.
   * @param name The symbol name to resolve and push
   * @throws Error if the symbol is not found
   */
  pushSymbolRef(name: string): void {
    const taggedValue = this.resolveSymbol(name);
    if (taggedValue === undefined) {
      throw new Error(`Symbol not found: ${name}`);
    }
    this.push(taggedValue);
  }

}
