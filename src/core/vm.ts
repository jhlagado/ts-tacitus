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
import { Memory } from './memory';
import { STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK, SEG_CODE, MIN_USER_OPCODE, MAX_BUILTIN_OPCODE } from './constants';
import { fromTaggedValue, toTaggedValue, Tag } from './tagged';
import { Digest } from '../strings/digest';
import { registerBuiltins } from '../ops/builtins-register';
import { createBuiltinRef, createCodeRef } from './code-ref';
import {
  StackUnderflowError,
  StackOverflowError,
  ReturnStackUnderflowError,
  ReturnStackOverflowError,
} from './errors';

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
   * Creates a new `VM` (Virtual Machine) instance.
   * Initializes the VM's memory, instruction pointer (IP), stack pointer (SP),
   * return stack pointer (RP), and base pointer (BP). It also sets up the
   * string digest for interning, and the symbol table for managing built-in
   * operations and user-defined symbols. All built-in operations are registered
   * upon instantiation.
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

    this.symbolTable = new SymbolTable(this.digest);
    registerBuiltins(this, this.symbolTable);
  }

  /**
   * Initializes the compiler for the VM.
   * This method must be called after the VM has been constructed to complete its initialization.
   *
   * @param compiler The compiler instance to be used by this VM for compiling Tacit code.
   */
  initializeCompiler(compiler: Compiler): void {
    this.compiler = compiler;
  }

  /**
   * Evaluates a code pointer (address) popped from the data stack.
   * The current instruction pointer (`IP`) is pushed onto the return stack
   * to allow for return to the calling context. The `IP` is then updated
   * to the address popped from the data stack, effectively transferring
   * control to the new code location.
   * This mechanism is used for function calls and executing code blocks.
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
   * @throws {StackOverflowError} If pushing would cause a stack overflow.
   */
  push(value: number): void {
    if (this.SP + BYTES_PER_ELEMENT > STACK_SIZE) {
      throw new StackOverflowError('push', this.getStackData());
    }

    this.memory.writeFloat32(SEG_STACK, this.SP, value);
    this.SP += BYTES_PER_ELEMENT;
  }

  /**
   * Pops a 32-bit float from the data stack.
   *
   * @returns The 32-bit float value popped from the stack.
   * @throws {StackUnderflowError} If popping would cause a stack underflow.
   */
  pop(): number {
    if (this.SP <= 0) {
      throw new StackUnderflowError('pop', 1, this.getStackData());
    }

    this.SP -= BYTES_PER_ELEMENT;
    return this.memory.readFloat32(SEG_STACK, this.SP);
  }

  /**
   * Peeks at the top value on the data stack without removing it.
   *
   * @returns The 32-bit float value at the top of the stack.
   * @throws {StackUnderflowError} If the stack is empty.
   */
  peek(): number {
    if (this.SP <= 0) {
      throw new StackUnderflowError('peek', 1, this.getStackData());
    }

    return this.memory.readFloat32(SEG_STACK, this.SP - BYTES_PER_ELEMENT);
  }

  /**
   * Pops multiple 32-bit values from the stack and returns them in an array.
   * The values are returned in the order they were on the stack (bottom first).
   *
   * @param size - The number of values to pop from the stack.
   * @returns An array of 32-bit float values popped from the stack.
   * @throws {StackUnderflowError} If popping would cause a stack underflow.
   */
  popArray(size: number): number[] {
    if (this.SP < size * BYTES_PER_ELEMENT) {
      throw new StackUnderflowError('popArray', size, this.getStackData());
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
   * @param value - The 32-bit float value to push onto the return stack.
   * @throws {ReturnStackOverflowError} If pushing would cause a return stack overflow.
   */
  rpush(value: number): void {
    if (this.RP + BYTES_PER_ELEMENT > RSTACK_SIZE) {
      throw new ReturnStackOverflowError('rpush', this.getStackData());
    }

    this.memory.writeFloat32(SEG_RSTACK, this.RP, value);
    this.RP += BYTES_PER_ELEMENT;
  }

  /**
   * Pops a 32-bit float from the return stack.
   *
   * @returns The 32-bit float value popped from the return stack.
   * @throws {ReturnStackUnderflowError} If popping would cause a return stack underflow.
   */
  rpop(): number {
    if (this.RP <= 0) {
      throw new ReturnStackUnderflowError('rpop', this.getStackData());
    }

    this.RP -= BYTES_PER_ELEMENT;
    return this.memory.readFloat32(SEG_RSTACK, this.RP);
  }

  /**
   * Resets the instruction pointer (`IP`) to the beginning of the code segment (address 0).
   * This is typically used to restart execution from the beginning of a compiled program.
   */
  reset() {
    this.IP = 0;
  }

  /**
   * Reads the next 8-bit value (byte) from the code segment at the current
   * instruction pointer (`IP`) and advances the `IP` by 1 byte.
   *
   * @returns The 8-bit value read from the code segment.
   */
  next8(): number {
    const value = this.memory.read8(SEG_CODE, this.IP);
    this.IP += 1;
    return value;
  }

  /**
   * Reads the next opcode from the code segment at the current instruction pointer (`IP`)
   * and advances the `IP`.
   * Decodes opcodes according to the unified addressing scheme:
   * - Built-in opcodes (0-MAX_BUILTIN_OPCODE): Represented by a single byte with the most significant bit (MSB) clear.
   * - User-defined words (MIN_USER_OPCODE+): Represented by two bytes. The first byte has its MSB set,
   *   and the remaining 7 bits combine with the second byte to form the 15-bit address.
   *
   * @returns The decoded opcode or the address of a user-defined word.
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
   * Reads the next 16-bit signed integer from the code segment at the current
   * instruction pointer (`IP`) and advances the `IP` by 2 bytes.
   * The value is sign-extended to correctly represent negative numbers.
   *
   * @returns The 16-bit signed integer read from the code segment.
   */
  next16(): number {
    const unsignedValue = this.memory.read16(SEG_CODE, this.IP);
    const signedValue = (unsignedValue << 16) >> 16;
    this.IP += 2;
    return signedValue;
  }

  /**
   * Reads the next 32-bit floating-point value from the code segment at the current
   * instruction pointer (`IP`) and advances the `IP` by 4 bytes.
   *
   * @returns The 32-bit floating-point value read from the code segment.
   */
  nextFloat32(): number {
    const value = this.memory.readFloat32(SEG_CODE, this.IP);
    this.IP += BYTES_PER_ELEMENT;
    return value;
  }

  /**
   * Reads the next address (which is a tagged `CODE` value) from the code segment
   * at the current instruction pointer (`IP`) and advances the `IP` by 4 bytes.
   * The tagged value is decoded to extract the raw code pointer.
   *
   * @returns The decoded code pointer value.
   */
  nextAddress(): number {
    const tagNum = this.nextFloat32();
    const { value: pointer } = fromTaggedValue(tagNum);
    return pointer;
  }

  /**
   * Reads a 16-bit unsigned integer from the code segment at the current
   * instruction pointer (`IP`) and advances the `IP` by 2 bytes.
   * This method reads the bytes directly and assembles them into a 16-bit value,
   * primarily used for internal bytecode interpretation.
   *
   * @returns The 16-bit unsigned integer read from the code segment.
   */
  read16(): number {
    const lowByte = this.memory.read8(SEG_CODE, this.IP);
    const highByte = this.memory.read8(SEG_CODE, this.IP + 1);
    this.IP += 2;
    return (highByte << 8) | lowByte;
  }

  /**
   * Retrieves the current contents of the data stack as an array of numbers.
   * This method is primarily used for debugging and error reporting to capture the
   * state of the data stack.
   *
   * @returns An array of numbers representing the current data stack contents.
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = 0; i < this.SP; i += BYTES_PER_ELEMENT) {
      stackData.push(this.memory.readFloat32(SEG_STACK, i));
    }

    return stackData;
  }

  /**
   * Ensures that the data stack has at least the specified number of elements (32-bit values).
   * This is a helper method used by operations that require a minimum stack depth.
   *
   * @param size The minimum number of 32-bit elements required on the data stack.
   * @param operation The name of the operation requesting the stack size check, for error reporting.
   * @throws {Error} If the data stack does not have enough elements to satisfy the request.
   */
  ensureStackSize(size: number, operation: string): void {
    if (this.SP < size * BYTES_PER_ELEMENT) {
      throw new Error(
        `Stack underflow: '${operation}' requires ${size} operand${size !== 1 ? 's' : ''} (stack: ${JSON.stringify(this.getStackData())})`,
      );
    }
  }

  /**
   * Retrieves the current compiled bytecode from the code segment as an array of 8-bit values.
   * This method is primarily used for debugging and testing the compiler's output.
   *
   * @returns An array containing all bytes currently in the compiled code segment.
   */
  getCompileData(): number[] {
    const compileData: number[] = [];
    for (let i = 0; i < this.compiler.CP; i++) {
      compileData.push(this.memory.read8(SEG_CODE, i));
    }

    return compileData;
  }

  /**
   * Resolves a symbol name to a tagged value that can be executed by the VM.
   *
   * This method enables the unified @symbol system by looking up symbols in the
   * symbol table and returning the appropriate tagged value for either built-in
   * operations (Tag.BUILTIN) or colon definitions (Tag.CODE).
   *
   * @param name The symbol name to resolve (without @ prefix)
   * @returns Tagged value for the symbol, or undefined if not found
   *
   * @example
   * // After defineBuiltin('add', Op.Add):
   * const addRef = vm.resolveSymbol('add'); // Returns Tag.BUILTIN tagged value
   *
   * // After defineCode('square', 1000):
   * const squareRef = vm.resolveSymbol('square'); // Returns Tag.CODE tagged value
   */
  resolveSymbol(name: string): number | undefined {
    return this.symbolTable.findTaggedValue(name);
  }
}
