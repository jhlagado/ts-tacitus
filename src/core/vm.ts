/**
 * @file src/core/vm.ts
 * Core Virtual Machine implementation for Tacit bytecode execution.
 */

import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { Memory } from './memory';
import {
  SEG_CODE,
  SEG_DATA,
  CELL_SIZE,
  STACK_BASE,
  RSTACK_BASE,
  RSTACK_TOP,
  STACK_TOP,
} from './constants';
import { fromTaggedValue, NIL } from './tagged';
import { Digest } from '../strings/digest';
import { registerBuiltins } from '../ops/builtins-register';
import {
  StackUnderflowError,
  StackOverflowError,
  ReturnStackUnderflowError,
  ReturnStackOverflowError,
} from './errors';

const CELL_SIZE_BYTES = CELL_SIZE;

/**
 * Virtual Machine for executing Tacit bytecode.
 */
export class VM {
  memory: Memory;

  // Canonical stack and heap registers measured in cells (plain fields)
  public sp: number; // data stack pointer (one past TOS)
  public rsp: number; // return stack pointer (one past RTOS)
  public bp: number; // current frame base pointer (absolute cells)
  public gp: number; // global heap bump pointer (cells)

  IP: number;

  running: boolean;

  compiler!: Compiler;

  digest: Digest;

  debug: boolean;

  symbolTable: SymbolTable;

  listDepth: number;

  // Phase 2: frameBpInCells removed; frames are always cell-based.

  dictHead: number;
  dictLocalSlots: number;

  private get stackBaseCells(): number {
    return STACK_BASE / CELL_SIZE;
  }

  private get stackTopCells(): number {
    return STACK_TOP / CELL_SIZE;
  }

  private get rstackBaseCells(): number {
    return RSTACK_BASE / CELL_SIZE;
  }

  private get rstackTopCells(): number {
    return RSTACK_TOP / CELL_SIZE;
  }

  /**
   * Creates a new VM instance with initialized memory and built-in operations.
   */
  constructor() {
    this.memory = new Memory();
    this.IP = 0;
    this.running = true;
    this.sp = this.stackBaseCells;
    this.rsp = this.rstackBaseCells;
    this.bp = this.rstackBaseCells;
    this.gp = 0;

    this.digest = new Digest(this.memory);
    this.debug = false;
    this.listDepth = 0;
    this.dictHead = NIL;
    this.dictLocalSlots = 0;

    this.symbolTable = new SymbolTable(this.digest);
    this.symbolTable.attachVM(this);
    registerBuiltins(this, this.symbolTable);
  }

  /**
   * Initializes the compiler for the VM.
   * @param compiler The compiler instance
   */
  initializeCompiler(compiler: Compiler): void {
    this.compiler = compiler;
  }

  // Uppercase SP/RSP/BP/GP shims removed: use sp/rsp/bp/gp (absolute cells)

  /**
   * Test-only helper: forcibly set BP using a raw byte offset without alignment coercion.
   * This bypasses normal validation to allow corruption/underflow tests to simulate
   * malformed frames. Caller must ensure provided bytes are within overall return stack
   * segment range. Alignment is still enforced (throws if not cell-aligned) to avoid
   * undefined behavior in core logic.
   * @param rawBytes Byte offset to force as BP
   */
  unsafeSetBPBytes(rawBytes: number) {
    if ((rawBytes & (CELL_SIZE_BYTES - 1)) !== 0) {
      throw new Error(`unsafeSetBPBytes: non-cell-aligned value ${rawBytes}`);
    }
    const relativeCells = rawBytes / CELL_SIZE_BYTES;
    this.bp = this.rstackBaseCells + relativeCells;
    if (this.debug) this.ensureInvariants();
  }

  /**
   * Development-only invariant checks (enabled when vm.debug === true).
   * Validates relationships among SP, RSP, BP and segment bounds.
   */
  ensureInvariants() {
    // Non-negative integers
    if (this.sp < 0 || this.rsp < 0 || this.bp < 0) {
      throw new Error('Invariant violation: negative stack pointer');
    }
    if (
      !Number.isInteger(this.sp) ||
      !Number.isInteger(this.rsp) ||
      !Number.isInteger(this.bp)
    ) {
      throw new Error('Invariant violation: non-integer stack pointer');
    }
    // Global pointer sanity (non-negative integer)
    if (this.gp < 0) {
      throw new Error('Invariant violation: negative global pointer');
    }
    if (!Number.isInteger(this.gp)) {
      throw new Error('Invariant violation: non-integer global pointer');
    }
    // Bounds vs configured sizes
    if (this.sp < this.stackBaseCells || this.sp > this.stackTopCells) {
      throw new Error('Invariant violation: SP outside stack segment');
    }
    if (this.rsp < this.rstackBaseCells || this.rsp > this.rstackTopCells) {
      throw new Error('Invariant violation: RSP outside return stack segment');
    }
    // BP within [0, RSP]
    if (this.bp > this.rsp) {
      throw new Error(`Invariant violation: BP (${this.bp}) > RSP (${this.rsp})`);
    }
  }

  /**
   * Pushes a value onto the data stack.
   * @param value The value to push
   * @throws {StackOverflowError} If stack overflow occurs
   */
  push(value: number): void {
    if (this.sp >= this.stackTopCells) {
      throw new StackOverflowError('push', this.getStackData());
    }

    const offsetBytes = (this.sp - this.stackBaseCells) * CELL_SIZE_BYTES;
    // Write via unified data segment
    this.memory.writeFloat32(SEG_DATA, STACK_BASE + offsetBytes, value);
    this.sp += 1;
    if (this.debug) this.ensureInvariants();
  }

  /**
   * Pops a value from the data stack.
   * @returns The popped value
   * @throws {StackUnderflowError} If stack underflow occurs
   */
  pop(): number {
    if (this.sp <= this.stackBaseCells) {
      throw new StackUnderflowError('pop', 1, this.getStackData());
    }

    this.sp -= 1;
    const offsetBytes = (this.sp - this.stackBaseCells) * CELL_SIZE_BYTES;
    if (this.debug) this.ensureInvariants();
    // Read via unified data segment
    return this.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
  }

  /**
   * Peeks at the top stack value.
   * @returns The top value
   * @throws {StackUnderflowError} If stack is empty
   */
  peek(): number {
    if (this.sp <= this.stackBaseCells) {
      throw new StackUnderflowError('peek', 1, this.getStackData());
    }

    const offsetBytes = (this.sp - this.stackBaseCells - 1) * CELL_SIZE_BYTES;
    return this.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
  }

  /**
   * Peeks at a value at a specific slot offset from the top of the stack.
   * @param slotOffset Number of slots from the top (0 = top, 1 = second from top, etc.)
   * @returns The value at the specified offset
   * @throws {StackUnderflowError} If the stack doesn't have enough values
   */
  peekAt(slotOffset: number): number {
    const requiredCells = slotOffset + 1;
    if (this.sp - this.stackBaseCells < requiredCells) {
      throw new StackUnderflowError('peekAt', requiredCells, this.getStackData());
    }

    const offsetBytes = (this.sp - this.stackBaseCells - requiredCells) * CELL_SIZE_BYTES;
    return this.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
  }

  /**
   * Pops multiple values from the stack.
   * @param size Number of values to pop
   * @returns Array of values in stack order
   * @throws {StackUnderflowError} If stack underflow occurs
   */
  popArray(size: number): number[] {
    if (this.sp - this.stackBaseCells < size) {
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
    if (this.rsp >= this.rstackTopCells) {
      throw new ReturnStackOverflowError('rpush', this.getStackData());
    }

    const offsetBytes = (this.rsp - this.rstackBaseCells) * CELL_SIZE_BYTES;
    // Write via unified data segment
    this.memory.writeFloat32(SEG_DATA, RSTACK_BASE + offsetBytes, value);
    this.rsp += 1;
    if (this.debug) this.ensureInvariants();
  }

  /**
   * Pops a value from the return stack.
   * @returns The popped value
   * @throws {ReturnStackUnderflowError} If return stack underflow occurs
   */
  rpop(): number {
    if (this.rsp <= this.rstackBaseCells) {
      throw new ReturnStackUnderflowError('rpop', this.getStackData());
    }

    this.rsp -= 1;
    const offsetBytes = (this.rsp - this.rstackBaseCells) * CELL_SIZE_BYTES;
    if (this.debug) this.ensureInvariants();
    // Read via unified data segment
    return this.memory.readFloat32(SEG_DATA, RSTACK_BASE + offsetBytes);
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
    const depthCells = this.sp - this.stackBaseCells;
    for (let i = 0; i < depthCells; i += 1) {
      // Read via unified data segment for forward-compatibility
      const byteOffset = STACK_BASE + i * CELL_SIZE_BYTES;
      stackData.push(this.memory.readFloat32(SEG_DATA, byteOffset));
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
    if (this.sp - this.stackBaseCells < size) {
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

// Registers are plain public fields (sp, rsp, bp, gp). No special accessors required.
