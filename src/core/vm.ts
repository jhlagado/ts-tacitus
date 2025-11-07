/**
 * @file src/core/vm.ts
 * Core Virtual Machine implementation for Tacit bytecode execution.
 */

import { Compiler } from '../lang/compiler';
import { Memory } from './memory';
import { lookup } from './dictionary';
import {
  SEG_CODE,
  SEG_DATA,
  CELL_SIZE,
  STACK_BASE,
  RSTACK_BASE,
  // Derived cell constants for direct use (avoid tiny getters)
  STACK_BASE_CELLS,
  STACK_TOP_CELLS,
  RSTACK_BASE_CELLS,
  RSTACK_TOP_CELLS,
  GLOBAL_BASE,
  GLOBAL_SIZE_CELLS,
} from './constants';
import { fromTaggedValue, isNIL } from './tagged';
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

  listDepth: number;

  // Phase 2: frameBpInCells removed; frames are always cell-based.

  // Heap-backed dictionary head (cell index relative to GLOBAL_BASE_CELLS, 0 = NIL/empty)
  head: number;
  localCount: number;

  /**
   * Creates a new VM instance with initialized memory and built-in operations.
   */
  constructor() {
    this.memory = new Memory();
    this.IP = 0;
    this.running = true;
    this.sp = STACK_BASE_CELLS;
    this.rsp = RSTACK_BASE_CELLS;
    this.bp = RSTACK_BASE_CELLS;
    this.gp = 0;

    this.digest = new Digest(this.memory);
    this.debug = false;
    this.listDepth = 0;
    this.localCount = 0;

    this.head = 0; // cell index (0 = NIL, empty dictionary)
    this.compiler = new Compiler(this);
    registerBuiltins(this);
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
    if (!Number.isInteger(this.sp) || !Number.isInteger(this.rsp) || !Number.isInteger(this.bp)) {
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
    if (this.sp < STACK_BASE_CELLS || this.sp > STACK_TOP_CELLS) {
      throw new Error('Invariant violation: SP outside stack segment');
    }
    if (this.rsp < RSTACK_BASE_CELLS || this.rsp > RSTACK_TOP_CELLS) {
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
    if (this.sp >= STACK_TOP_CELLS) {
      throw new StackOverflowError('push', this.getStackData());
    }

    const offsetBytes = (this.sp - STACK_BASE_CELLS) * CELL_SIZE_BYTES;
    // Write via unified data segment
    this.memory.writeFloat32(SEG_DATA, STACK_BASE + offsetBytes, value);
    this.sp += 1;
    if (this.debug) {
this.ensureInvariants();
}
  }

  /**
   * Pops a value from the data stack.
   * @returns The popped value
   * @throws {StackUnderflowError} If stack underflow occurs
   */
  pop(): number {
    if (this.sp <= STACK_BASE_CELLS) {
      throw new StackUnderflowError('pop', 1, this.getStackData());
    }

    this.sp -= 1;
    const offsetBytes = (this.sp - STACK_BASE_CELLS) * CELL_SIZE_BYTES;
    if (this.debug) {
this.ensureInvariants();
}
    // Read via unified data segment
    return this.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
  }

  /**
   * Peeks at the top stack value.
   * @returns The top value
   * @throws {StackUnderflowError} If stack is empty
   */
  peek(): number {
    if (this.sp <= STACK_BASE_CELLS) {
      throw new StackUnderflowError('peek', 1, this.getStackData());
    }

    const offsetBytes = (this.sp - STACK_BASE_CELLS - 1) * CELL_SIZE_BYTES;
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
    if (this.sp - STACK_BASE_CELLS < requiredCells) {
      throw new StackUnderflowError('peekAt', requiredCells, this.getStackData());
    }

    const offsetBytes = (this.sp - STACK_BASE_CELLS - requiredCells) * CELL_SIZE_BYTES;
    return this.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
  }

  // ---------------- Global data window (heap-as-stack) minimal API ----------------

  /** Push one cell to the global window. */
  gpush(value: number): void {
    if (this.gp >= GLOBAL_SIZE_CELLS) {
      throw new Error('gpush on full heap');
    }
    const byteOffset = GLOBAL_BASE + this.gp * CELL_SIZE_BYTES;
    this.memory.writeFloat32(SEG_DATA, byteOffset, value);
    this.gp += 1;
  }

  /** Peek top cell from the global window (no pop). */
  gpeek(): number {
    if (this.gp === 0) {
      throw new Error('gpeek on empty heap');
    }
    const byteOffset = GLOBAL_BASE + (this.gp - 1) * CELL_SIZE_BYTES;
    return this.memory.readFloat32(SEG_DATA, byteOffset);
  }

  /** Pop one cell from the global window and return it. */
  gpop(): number {
    if (this.gp === 0) {
      throw new Error('gpop on empty heap');
    }
    this.gp -= 1;
    const byteOffset = GLOBAL_BASE + this.gp * CELL_SIZE_BYTES;
    return this.memory.readFloat32(SEG_DATA, byteOffset);
  }

  /**
   * Pushes a value onto the return stack.
   * @param value The value to push
   * @throws {ReturnStackOverflowError} If return stack overflow occurs
   */
  rpush(value: number): void {
    if (this.rsp >= RSTACK_TOP_CELLS) {
      throw new ReturnStackOverflowError('rpush', this.getStackData());
    }

    const offsetBytes = (this.rsp - RSTACK_BASE_CELLS) * CELL_SIZE_BYTES;
    // Write via unified data segment
    this.memory.writeFloat32(SEG_DATA, RSTACK_BASE + offsetBytes, value);
    this.rsp += 1;
    if (this.debug) {
this.ensureInvariants();
}
  }

  /**
   * Pops a value from the return stack.
   * @returns The popped value
   * @throws {ReturnStackUnderflowError} If return stack underflow occurs
   */
  rpop(): number {
    if (this.rsp <= RSTACK_BASE_CELLS) {
      throw new ReturnStackUnderflowError('rpop', this.getStackData());
    }

    this.rsp -= 1;
    const offsetBytes = (this.rsp - RSTACK_BASE_CELLS) * CELL_SIZE_BYTES;
    if (this.debug) {
this.ensureInvariants();
}
    // Read via unified data segment
    return this.memory.readFloat32(SEG_DATA, RSTACK_BASE + offsetBytes);
  }

  /**
   * Reads the next byte from code and advances IP.
   * @returns The byte value
   */
  next8(): number {
    return next8FromCode(this);
  }

  /**
   * Reads the next opcode from code and advances IP.
   * @returns The decoded opcode or user-defined word address
   */
  nextOpcode(): number {
    return nextOpcodeFromCode(this);
  }

  /**
   * Reads the next 16-bit signed integer from code and advances IP.
   * @returns The signed integer value
   */
  nextInt16(): number {
    return nextInt16FromCode(this);
  }

  /**
   * Reads the next float from code and advances IP.
   * @returns The float value
   */
  nextFloat32(): number {
    return nextFloat32FromCode(this);
  }

  /**
   * Reads the next 16-bit unsigned integer from code and advances IP.
   * @returns The unsigned integer value
   */
  nextUint16(): number {
    return nextUint16FromCode(this);
  }

  /**
   * Gets the current data stack contents.
   * @returns Array of stack values
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    const depthCells = this.sp - STACK_BASE_CELLS;
    for (let i = 0; i < depthCells; i += 1) {
      // Read via unified data segment for forward-compatibility
      const byteOffset = STACK_BASE + i * CELL_SIZE_BYTES;
      stackData.push(this.memory.readFloat32(SEG_DATA, byteOffset));
    }

    return stackData;
  }

  /** Returns current data stack depth in slots (cells). */
  depth(): number {
    return this.sp - STACK_BASE_CELLS;
  }

  /** Returns current return stack depth in slots (cells). */
  rdepth(): number {
    return this.rsp - RSTACK_BASE_CELLS;
  }

  /**
   * Ensures stack has minimum number of elements.
   * @param size Required stack depth
   * @param operation Operation name for error reporting
   * @throws {StackUnderflowError} If insufficient stack elements
   */
  ensureStackSize(size: number, operation: string): void {
    if (this.sp - STACK_BASE_CELLS < size) {
      throw new StackUnderflowError(operation, size, this.getStackData());
    }
  }

  /**
   * Gets the current compiled bytecode.
   * @returns Array of code bytes
   */

  /**
   * Resolves a symbol name to a tagged value.
   * @param name The symbol name to resolve
   * @returns Tagged value for the symbol, or undefined if not found
   */
  resolveSymbol(name: string): number | undefined {
    const result = lookup(this, name);
    return isNIL(result) ? undefined : result;
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

// ---------- Pure helpers to decouple logic from VM class ----------

export function ensureInvariantsPure(vmLike: {
  sp: number;
  rsp: number;
  bp: number;
  gp: number;
}): void {
  if (vmLike.sp < 0 || vmLike.rsp < 0 || vmLike.bp < 0) {
    throw new Error('Invariant violation: negative stack pointer');
  }
  if (
    !Number.isInteger(vmLike.sp) ||
    !Number.isInteger(vmLike.rsp) ||
    !Number.isInteger(vmLike.bp)
  ) {
    throw new Error('Invariant violation: non-integer stack pointer');
  }
  if (vmLike.gp < 0) {
    throw new Error('Invariant violation: negative global pointer');
  }
  if (!Number.isInteger(vmLike.gp)) {
    throw new Error('Invariant violation: non-integer global pointer');
  }
  if (vmLike.sp < STACK_BASE_CELLS || vmLike.sp > STACK_TOP_CELLS) {
    throw new Error('Invariant violation: SP outside stack segment');
  }
  if (vmLike.rsp < RSTACK_BASE_CELLS || vmLike.rsp > RSTACK_TOP_CELLS) {
    throw new Error('Invariant violation: RSP outside return stack segment');
  }
  if (vmLike.bp > vmLike.rsp) {
    throw new Error(`Invariant violation: BP (${vmLike.bp}) > RSP (${vmLike.rsp})`);
  }
}

export function next8FromCode(vmLike: { memory: Memory; IP: number }): number {
  const value = vmLike.memory.read8(SEG_CODE, vmLike.IP);
  vmLike.IP += 1;
  return value;
}

export function nextOpcodeFromCode(vmLike: { memory: Memory; IP: number }): number {
  const firstByte = vmLike.memory.read8(SEG_CODE, vmLike.IP);
  vmLike.IP += 1;
  if ((firstByte & 0x80) !== 0) {
    const secondByte = vmLike.memory.read8(SEG_CODE, vmLike.IP);
    vmLike.IP += 1;
    const lowBits = firstByte & 0x7f;
    const highBits = secondByte << 7;
    return highBits | lowBits;
  }
  return firstByte;
}

export function nextInt16FromCode(vmLike: { memory: Memory; IP: number }): number {
  const unsignedValue = vmLike.memory.read16(SEG_CODE, vmLike.IP);
  const signedValue = (unsignedValue << 16) >> 16;
  vmLike.IP += 2;
  return signedValue;
}

export function nextUint16FromCode(vmLike: { memory: Memory; IP: number }): number {
  const value = vmLike.memory.read16(SEG_CODE, vmLike.IP);
  vmLike.IP += 2;
  return value;
}

export function nextFloat32FromCode(vmLike: { memory: Memory; IP: number }): number {
  const value = vmLike.memory.readFloat32(SEG_CODE, vmLike.IP);
  vmLike.IP += CELL_SIZE;
  return value;
}

export function nextAddressFromCode(vmLike: { memory: Memory; IP: number }): number {
  const tagNum = nextFloat32FromCode(vmLike);
  const { value: pointer } = fromTaggedValue(tagNum);
  return pointer;
}

/**
 * Test-only helper: forcibly set BP using a raw byte offset without alignment coercion.
 * This bypasses normal validation to allow corruption/underflow tests to simulate
 * malformed frames. Caller must ensure provided bytes are within overall return stack
 * segment range. Alignment is still enforced (throws if not cell-aligned) to avoid
 * undefined behavior in core logic.
 * @param vm VM instance
 * @param rawBytes Byte offset to force as BP
 */
export function unsafeSetBPBytes(
  vm: { bp: number; debug: boolean; ensureInvariants: () => void },
  rawBytes: number,
): void {
  if ((rawBytes & (CELL_SIZE_BYTES - 1)) !== 0) {
    throw new Error(`unsafeSetBPBytes: non-cell-aligned value ${rawBytes}`);
  }
  const relativeCells = rawBytes / CELL_SIZE_BYTES;
  vm.bp = RSTACK_BASE_CELLS + relativeCells;
  if (vm.debug) {
vm.ensureInvariants();
}
}

/**
 * Pops multiple values from the stack.
 * @param vm VM instance
 * @param size Number of values to pop
 * @returns Array of values in stack order
 * @throws {StackUnderflowError} If stack underflow occurs
 */
export function popArray(
  vm: {
    sp: number;
    getStackData: () => number[];
    pop: () => number;
  },
  size: number,
): number[] {
  if (vm.sp - STACK_BASE_CELLS < size) {
    throw new StackUnderflowError('popArray', size, vm.getStackData());
  }

  const result: number[] = [];
  for (let i = 0; i < size; i++) {
    result.unshift(vm.pop());
  }

  return result;
}

/**
 * Ensures return stack has minimum number of elements.
 * @param vm VM instance
 * @param size Required return stack depth
 * @param operation Operation name for error reporting
 * @throws {ReturnStackUnderflowError} If insufficient return stack elements
 */
export function ensureRStackSize(
  vm: { rsp: number; getStackData: () => number[] },
  size: number,
  operation: string,
): void {
  if (vm.rsp - RSTACK_BASE_CELLS < size) {
    throw new ReturnStackUnderflowError(operation, vm.getStackData());
  }
}

/**
 * Reads the next address from code and advances IP.
 * @param vm VM instance
 * @returns The decoded code pointer
 */
export function nextAddress(vm: { memory: Memory; IP: number }): number {
  return nextAddressFromCode(vm);
}
