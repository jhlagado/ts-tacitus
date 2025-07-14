/**
 * @file src/core/vm.ts
 * This file implements the core Virtual Machine (VM) for the Tacit language.
 * The VM is responsible for executing bytecode instructions, managing the stacks,
 * and handling the instruction pointer and base pointer for function calls.
 * 
 * The VM uses a segmented memory model with separate segments for:
 * - Data stack: Used for operands and results of operations
 * - Return stack: Used for function call return addresses and local variables
 * - Code segment: Contains compiled bytecode instructions
 * - String segment: Contains string literals
 */

import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { Memory, STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK, SEG_CODE } from './memory';
import { fromTaggedValue, toTaggedValue, Tag } from './tagged';
import { Digest } from '../strings/digest';
import { registerBuiltins } from '../ops/builtins-register';
import { StackUnderflowError, StackOverflowError, ReturnStackUnderflowError, ReturnStackOverflowError } from './errors';
// Imports removed as we no longer use function table

/** Number of bytes per memory element (32-bit float) */
const BYTES_PER_ELEMENT = 4;

/**
 * The Virtual Machine (VM) class that executes Tacit bytecode.
 * 
 * The VM maintains several pointers and state variables:
 * - IP (Instruction Pointer): Points to the current instruction in the code segment
 * - SP (Stack Pointer): Points to the top of the data stack
 * - RP (Return Stack Pointer): Points to the top of the return stack
 * - BP (Base Pointer): Points to the base of the current function's stack frame
 */
export class VM {
  /** The memory instance used by this VM */
  memory: Memory;
  
  /** Stack Pointer - points to the next free position on the data stack */
  SP: number;
  
  /** Return Stack Pointer - points to the next free position on the return stack */
  RP: number;
  
  /** Base Pointer - points to the base of the current function's stack frame */
  BP: number;
  
  /** Instruction Pointer - points to the current instruction in the code segment */
  IP: number;
  
  /** Flag indicating whether the VM is currently running */
  running: boolean;
  
  /** The compiler instance used by this VM */
  compiler!: Compiler;
  
  /** The string digest used for string interning */
  digest: Digest;
  
  /** Flag indicating whether debug mode is enabled */
  debug: boolean;
  
  /** The symbol table mapping names to opcodes and implementations */
  symbolTable: SymbolTable;
  
  /** Current nesting depth when processing lists */
  listDepth: number;
  /**
   * Creates a new VM instance and initializes all pointers and state variables.
   * Also creates a new symbol table and registers all built-in operations.
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
    // functionTable initialization removed - using symbolTable directly
    this.symbolTable = new SymbolTable(this.digest);
    registerBuiltins(this, this.symbolTable);
  }

  /**
   * Initializes the compiler.
   * This method must be called after VM construction to complete initialization.
   * 
   * @param compiler - The compiler instance to use for compiling Tacit code
   */
  initializeCompiler(compiler: Compiler): void {
    this.compiler = compiler;
    // initFunctionTable call removed as we're using the symbol table directly
  }

  /**
   * Evaluates a code pointer from the stack.
   * Saves the current IP on the return stack and jumps to the address popped from the stack.
   * This is used for function calls and code block execution.
   */
  eval() {
    this.rpush(toTaggedValue(this.IP, Tag.CODE));
    const { value: pointer } = fromTaggedValue(this.pop());
    this.IP = pointer;
  }

  /**
   * Pushes a 32-bit float onto the data stack.
   * 
   * @param value - The 32-bit float value to push onto the stack
   * @throws {Error} If pushing would cause a stack overflow
   */
  push(value: number): void {
    if (this.SP + BYTES_PER_ELEMENT > STACK_SIZE) {
      throw new Error(
        `Stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(this.getStackData())})`
      );
    }

    this.memory.writeFloat32(SEG_STACK, this.SP, value);
    this.SP += BYTES_PER_ELEMENT;
  }

  /**
   * Pops a 32-bit float from the data stack.
   * 
   * @returns The 32-bit float value popped from the stack
   * @throws {Error} If popping would cause a stack underflow
   */
  pop(): number {
    if (this.SP <= 0) {
      throw new Error(
        `Stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`
      );
    }

    this.SP -= BYTES_PER_ELEMENT;
    return this.memory.readFloat32(SEG_STACK, this.SP);
  }

  /**
   * Peeks at the top value on the data stack without removing it.
   * 
   * @returns The 32-bit float value at the top of the stack
   * @throws {Error} If the stack is empty
   */
  peek(): number {
    if (this.SP <= 0) {
      throw new Error(`Stack underflow: Cannot peek value (stack: ${JSON.stringify(this.getStackData())})`);
    }

    return this.memory.readFloat32(SEG_STACK, this.SP - BYTES_PER_ELEMENT);
  }

  /**
   * Pops multiple 32-bit values from the stack and returns them in an array.
   * The values are returned in the order they were on the stack (bottom first).
   * 
   * @param size - The number of values to pop from the stack
   * @returns An array of 32-bit float values popped from the stack
   * @throws {Error} If popping would cause a stack underflow
   */
  popArray(size: number): number[] {
    if (this.SP < size * BYTES_PER_ELEMENT) {
      throw new Error(
        `Stack underflow: Cannot pop ${size} values (stack: ${JSON.stringify(this.getStackData())})`
      );
    }

    const result: number[] = [];
    for (let i = 0; i < size; i++) {
      result.unshift(this.pop());
    }

    return result;
  }

  /**
   * Pushes a 32-bit float onto the return stack.
   * The return stack is used for function call return addresses and local variables.
   * 
   * @param value - The 32-bit float value to push onto the return stack
   * @throws {Error} If pushing would cause a return stack overflow
   */
  rpush(value: number): void {
    if (this.RP + BYTES_PER_ELEMENT > RSTACK_SIZE) {
      throw new Error(
        `Return stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(this.getStackData())})`
      );
    }

    this.memory.writeFloat32(SEG_RSTACK, this.RP, value);
    this.RP += BYTES_PER_ELEMENT;
  }

  /**
   * Pops a 32-bit float from the return stack.
   * 
   * @returns The 32-bit float value popped from the return stack
   * @throws {Error} If popping would cause a return stack underflow
   */
  rpop(): number {
    if (this.RP <= 0) {
      throw new Error(
        `Return stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`
      );
    }

    this.RP -= BYTES_PER_ELEMENT;
    return this.memory.readFloat32(SEG_RSTACK, this.RP);
  }

  /**
   * Resets the instruction pointer to the beginning of the code segment.
   * This is typically used to restart execution from the beginning.
   */
  reset() {
    this.IP = 0;
  }

  /**
   * Reads the next byte from the code segment and advances the instruction pointer.
   * 
   * @returns The 8-bit value at the current instruction pointer
   */
  next8(): number {
    const value = this.memory.read8(SEG_CODE, this.IP);
    this.IP += 1;
    return value;
  }

  /**
   * Reads the next opcode from the code segment and advances the instruction pointer.
   * Decodes opcodes according to the unified addressing scheme:
   * - Built-in opcodes (0-127): Single byte with high bit clear
   * - User-defined words (128-32767): Two bytes with high bit set on first byte
   * 
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
   * Reads the next 16-bit value from the code segment and advances the instruction pointer.
   * The value is sign-extended to handle negative numbers correctly.
   * 
   * @returns The 16-bit signed value at the current instruction pointer
   */
  next16(): number {
    const unsignedValue = this.memory.read16(SEG_CODE, this.IP);
    const signedValue = (unsignedValue << 16) >> 16;
    this.IP += 2;
    return signedValue;
  }

  /**
   * Reads the next 32-bit float from the code segment and advances the instruction pointer.
   * 
   * @returns The 32-bit float value at the current instruction pointer
   */
  nextFloat32(): number {
    const value = this.memory.readFloat32(SEG_CODE, this.IP);
    this.IP += BYTES_PER_ELEMENT;
    return value;
  }

  /**
   * Reads the next address (tagged as CODE) from the code segment and advances the instruction pointer.
   * Decodes the tagged value to extract the code pointer.
   * 
   * @returns The decoded code pointer value
   */
  nextAddress(): number {
    const tagNum = this.nextFloat32();
    const { value: pointer } = fromTaggedValue(tagNum);
    return pointer;
  }

  /**
   * Reads the next 16-bit value from the code segment and advances the instruction pointer.
   * Unlike next16(), this method reads the bytes directly and assembles them into a 16-bit value.
   * 
   * @returns The 16-bit value at the current instruction pointer
   */
  read16(): number {
    const lowByte = this.memory.read8(SEG_CODE, this.IP);
    const highByte = this.memory.read8(SEG_CODE, this.IP + 1);
    this.IP += 2;
    return (highByte << 8) | lowByte;
  }

  /**
   * Returns the current data stack contents as an array of 32-bit values.
   * This is primarily used for debugging and error reporting.
   * 
   * @returns An array containing all values currently on the data stack
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = 0; i < this.SP; i += BYTES_PER_ELEMENT) {
      stackData.push(this.memory.readFloat32(SEG_STACK, i));
    }

    return stackData;
  }
  
  /**
   * Ensures that the stack has at least the specified number of elements.
   * This is a helper method used by operations that require a minimum stack depth.
   * 
   * @param {number} size - The minimum number of elements required
   * @param {string} operation - The name of the operation for error reporting
   * @throws {Error} If the stack doesn't have enough elements
   */
  ensureStackSize(size: number, operation: string): void {
    if (this.SP < size * BYTES_PER_ELEMENT) {
      throw new Error(
        `Stack underflow: '${operation}' requires ${size} operand${size !== 1 ? 's' : ''} (stack: ${JSON.stringify(this.getStackData())})`
      );
    }
  }

  /**
   * Returns the current compiled bytecode as an array of 8-bit values.
   * This is primarily used for debugging and testing the compiler.
   * 
   * @returns An array containing all bytes in the compiled code segment
   */
  getCompileData(): number[] {
    const compileData: number[] = [];
    for (let i = 0; i < this.compiler.CP; i++) {
      compileData.push(this.memory.read8(SEG_CODE, i));
    }

    return compileData;
  }
}
