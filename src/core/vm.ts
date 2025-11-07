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
   * Pushes a value onto the data stack.
   * @param value The value to push
   * @throws {StackOverflowError} If stack overflow occurs
   */
  push(value: number): void {
    push(this, value);
  }

  /**
   * Pops a value from the data stack.
   * @returns The popped value
   * @throws {StackUnderflowError} If stack underflow occurs
   */
  pop(): number {
    return pop(this);
  }

  /**
   * Peeks at the top stack value.
   * @returns The top value
   * @throws {StackUnderflowError} If stack is empty
   */
  peek(): number {
    return peek(this);
  }

  // ---------------- Global data window (heap-as-stack) minimal API ----------------

  /**
   * Pushes a value onto the return stack.
   * @param value The value to push
   * @throws {ReturnStackOverflowError} If return stack overflow occurs
   */
  rpush(value: number): void {
    rpush(this, value);
  }

  /**
   * Pops a value from the return stack.
   * @returns The popped value
   * @throws {ReturnStackUnderflowError} If return stack underflow occurs
   */
  rpop(): number {
    return rpop(this);
  }

  /**
   * Gets the current data stack contents.
   * @returns Array of stack values
   */
  getStackData(): number[] {
    return getStackData(this);
  }

  /**
   * Ensures stack has minimum number of elements.
   * @param size Required stack depth
   * @param operation Operation name for error reporting
   * @throws {StackUnderflowError} If insufficient stack elements
   */
  ensureStackSize(size: number, operation: string): void {
    ensureStackSize(this, size, operation);
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
    return resolveSymbol(this, name);
  }

  /**
   * Pushes a symbol reference onto the stack.
   * @param name The symbol name to resolve and push
   * @throws Error if the symbol is not found
   */
  pushSymbolRef(name: string): void {
    pushSymbolRef(this, name);
  }
}

// Registers are plain public fields (sp, rsp, bp, gp). No special accessors required.

// ---------- Pure helpers to decouple logic from VM class ----------

/**
 * Pushes a value onto the data stack.
 * @param vm VM instance
 * @param value The value to push
 * @throws {StackOverflowError} If stack overflow occurs
 */
export function push(vm: VM, value: number): void {
  if (vm.sp >= STACK_TOP_CELLS) {
    throw new StackOverflowError('push', getStackData(vm));
  }

  const offsetBytes = (vm.sp - STACK_BASE_CELLS) * CELL_SIZE_BYTES;
  // Write via unified data segment
  vm.memory.writeFloat32(SEG_DATA, STACK_BASE + offsetBytes, value);
  vm.sp += 1;
  if (vm.debug) {
    ensureInvariants(vm);
  }
}

/**
 * Pops a value from the data stack.
 * @param vm VM instance
 * @returns The popped value
 * @throws {StackUnderflowError} If stack underflow occurs
 */
export function pop(vm: VM): number {
  if (vm.sp <= STACK_BASE_CELLS) {
    throw new StackUnderflowError('pop', 1, getStackData(vm));
  }

  vm.sp -= 1;
  const offsetBytes = (vm.sp - STACK_BASE_CELLS) * CELL_SIZE_BYTES;
  if (vm.debug) {
    ensureInvariants(vm);
  }
  // Read via unified data segment
  return vm.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
}

/**
 * Peeks at the top stack value.
 * @param vm VM instance
 * @returns The top value
 * @throws {StackUnderflowError} If stack is empty
 */
export function peek(vm: VM): number {
  if (vm.sp <= STACK_BASE_CELLS) {
    throw new StackUnderflowError('peek', 1, getStackData(vm));
  }

  const offsetBytes = (vm.sp - STACK_BASE_CELLS - 1) * CELL_SIZE_BYTES;
  return vm.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
}

/**
 * Pushes a value onto the return stack.
 * @param vm VM instance
 * @param value The value to push
 * @throws {ReturnStackOverflowError} If return stack overflow occurs
 */
export function rpush(vm: VM, value: number): void {
  if (vm.rsp >= RSTACK_TOP_CELLS) {
    throw new ReturnStackOverflowError('rpush', getStackData(vm));
  }

  const offsetBytes = (vm.rsp - RSTACK_BASE_CELLS) * CELL_SIZE_BYTES;
  // Write via unified data segment
  vm.memory.writeFloat32(SEG_DATA, RSTACK_BASE + offsetBytes, value);
  vm.rsp += 1;
  if (vm.debug) {
    ensureInvariants(vm);
  }
}

/**
 * Pops a value from the return stack.
 * @param vm VM instance
 * @returns The popped value
 * @throws {ReturnStackUnderflowError} If return stack underflow occurs
 */
export function rpop(vm: VM): number {
  if (vm.rsp <= RSTACK_BASE_CELLS) {
    throw new ReturnStackUnderflowError('rpop', getStackData(vm));
  }

  vm.rsp -= 1;
  const offsetBytes = (vm.rsp - RSTACK_BASE_CELLS) * CELL_SIZE_BYTES;
  if (vm.debug) {
    ensureInvariants(vm);
  }
  // Read via unified data segment
  return vm.memory.readFloat32(SEG_DATA, RSTACK_BASE + offsetBytes);
}

/**
 * Gets the current data stack contents.
 * @param vm VM instance
 * @returns Array of stack values
 */
export function getStackData(vm: VM): number[] {
  const stackData: number[] = [];
  const depthCells = vm.sp - STACK_BASE_CELLS;
  for (let i = 0; i < depthCells; i += 1) {
    // Read via unified data segment for forward-compatibility
    const byteOffset = STACK_BASE + i * CELL_SIZE_BYTES;
    stackData.push(vm.memory.readFloat32(SEG_DATA, byteOffset));
  }

  return stackData;
}

/**
 * Ensures stack has minimum number of elements.
 * @param vm VM instance
 * @param size Required stack depth
 * @param operation Operation name for error reporting
 * @throws {StackUnderflowError} If insufficient stack elements
 */
export function ensureStackSize(vm: VM, size: number, operation: string): void {
  if (vm.sp - STACK_BASE_CELLS < size) {
    throw new StackUnderflowError(operation, size, getStackData(vm));
  }
}

/**
 * Resolves a symbol name to a tagged value.
 * @param vm VM instance
 * @param name The symbol name to resolve
 * @returns Tagged value for the symbol, or undefined if not found
 */
export function resolveSymbol(vm: VM, name: string): number | undefined {
  const result = lookup(vm, name);
  return isNIL(result) ? undefined : result;
}

/**
 * Pushes a symbol reference onto the stack.
 * @param vm VM instance
 * @param name The symbol name to resolve and push
 * @throws Error if the symbol is not found
 */
export function pushSymbolRef(vm: VM, name: string): void {
  const taggedValue = resolveSymbol(vm, name);
  if (taggedValue === undefined) {
    throw new Error(`Symbol not found: ${name}`);
  }
  push(vm, taggedValue);
}

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
export function unsafeSetBPBytes(vm: VM, rawBytes: number): void {
  if ((rawBytes & (CELL_SIZE_BYTES - 1)) !== 0) {
    throw new Error(`unsafeSetBPBytes: non-cell-aligned value ${rawBytes}`);
  }
  const relativeCells = rawBytes / CELL_SIZE_BYTES;
  vm.bp = RSTACK_BASE_CELLS + relativeCells;
  if (vm.debug) {
    ensureInvariants(vm);
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
export function nextAddress(vm: VM): number {
  return nextAddressFromCode(vm);
}

/**
 * Peeks at a value at a specific slot offset from the top of the stack.
 * @param vm VM instance
 * @param slotOffset Number of slots from the top (0 = top, 1 = second from top, etc.)
 * @returns The value at the specified offset
 * @throws {StackUnderflowError} If the stack doesn't have enough values
 */
export function peekAt(
  vm: { sp: number; memory: Memory; getStackData: () => number[] },
  slotOffset: number,
): number {
  const requiredCells = slotOffset + 1;
  if (vm.sp - STACK_BASE_CELLS < requiredCells) {
    throw new StackUnderflowError('peekAt', requiredCells, vm.getStackData());
  }

  const offsetBytes = (vm.sp - STACK_BASE_CELLS - requiredCells) * CELL_SIZE_BYTES;
  return vm.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
}

/**
 * Push one cell to the global window.
 * @param vm VM instance
 * @param value Value to push
 */
export function gpush(vm: VM, value: number): void {
  if (vm.gp >= GLOBAL_SIZE_CELLS) {
    throw new Error('gpush on full heap');
  }
  const byteOffset = GLOBAL_BASE + vm.gp * CELL_SIZE_BYTES;
  vm.memory.writeFloat32(SEG_DATA, byteOffset, value);
  vm.gp += 1;
}

/**
 * Peek top cell from the global window (no pop).
 * @param vm VM instance
 * @returns The top value
 */
export function gpeek(vm: VM): number {
  if (vm.gp === 0) {
    throw new Error('gpeek on empty heap');
  }
  const byteOffset = GLOBAL_BASE + (vm.gp - 1) * CELL_SIZE_BYTES;
  return vm.memory.readFloat32(SEG_DATA, byteOffset);
}

/**
 * Pop one cell from the global window and return it.
 * @param vm VM instance
 * @returns The popped value
 */
export function gpop(vm: VM): number {
  if (vm.gp === 0) {
    throw new Error('gpop on empty heap');
  }
  vm.gp -= 1;
  const byteOffset = GLOBAL_BASE + vm.gp * CELL_SIZE_BYTES;
  return vm.memory.readFloat32(SEG_DATA, byteOffset);
}

/**
 * Reads the next byte from code and advances IP.
 * @param vm VM instance
 * @returns The byte value
 */
export function next8(vm: VM): number {
  return next8FromCode(vm);
}

/**
 * Reads the next opcode from code and advances IP.
 * @param vm VM instance
 * @returns The decoded opcode or user-defined word address
 */
export function nextOpcode(vm: VM): number {
  return nextOpcodeFromCode(vm);
}

/**
 * Reads the next 16-bit signed integer from code and advances IP.
 * @param vm VM instance
 * @returns The signed integer value
 */
export function nextInt16(vm: VM): number {
  return nextInt16FromCode(vm);
}

/**
 * Reads the next float from code and advances IP.
 * @param vm VM instance
 * @returns The float value
 */
export function nextFloat32(vm: VM): number {
  return nextFloat32FromCode(vm);
}

/**
 * Reads the next 16-bit unsigned integer from code and advances IP.
 * @param vm VM instance
 * @returns The unsigned integer value
 */
export function nextUint16(vm: VM): number {
  return nextUint16FromCode(vm);
}

/**
 * Returns current data stack depth in slots (cells).
 * @param vm VM instance
 * @returns Stack depth in cells
 */
export function depth(vm: VM): number {
  return vm.sp - STACK_BASE_CELLS;
}

/**
 * Returns current return stack depth in slots (cells).
 * @param vm VM instance
 * @returns Return stack depth in cells
 */
export function rdepth(vm: VM): number {
  return vm.rsp - RSTACK_BASE_CELLS;
}

/**
 * Development-only invariant checks (enabled when vm.debug === true).
 * Validates relationships among SP, RSP, BP and segment bounds.
 * @param vm VM instance
 */
export function ensureInvariants(vm: VM): void {
  // Non-negative integers
  if (vm.sp < 0 || vm.rsp < 0 || vm.bp < 0) {
    throw new Error('Invariant violation: negative stack pointer');
  }
  if (!Number.isInteger(vm.sp) || !Number.isInteger(vm.rsp) || !Number.isInteger(vm.bp)) {
    throw new Error('Invariant violation: non-integer stack pointer');
  }
  // Global pointer sanity (non-negative integer)
  if (vm.gp < 0) {
    throw new Error('Invariant violation: negative global pointer');
  }
  if (!Number.isInteger(vm.gp)) {
    throw new Error('Invariant violation: non-integer global pointer');
  }
  // Bounds vs configured sizes
  if (vm.sp < STACK_BASE_CELLS || vm.sp > STACK_TOP_CELLS) {
    throw new Error('Invariant violation: SP outside stack segment');
  }
  if (vm.rsp < RSTACK_BASE_CELLS || vm.rsp > RSTACK_TOP_CELLS) {
    throw new Error('Invariant violation: RSP outside return stack segment');
  }
  // BP within [0, RSP]
  if (vm.bp > vm.rsp) {
    throw new Error(`Invariant violation: BP (${vm.bp}) > RSP (${vm.rsp})`);
  }
}
