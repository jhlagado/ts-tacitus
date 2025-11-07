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
 * Virtual Machine interface - a plain JavaScript object for executing Tacit bytecode.
 */
export interface VM {
  /** Memory instance for unified data segment access */
  memory: Memory;
  /** Data stack pointer in cells (one past top of stack) */
  sp: number;
  /** Return stack pointer in cells (one past top of return stack) */
  rsp: number;
  /** Current frame base pointer in absolute cells */
  bp: number;
  /** Global heap bump pointer in cells */
  gp: number;
  /** Instruction pointer (byte offset into code segment) */
  IP: number;
  /** Execution state flag */
  running: boolean;
  /** Compiler instance for bytecode generation */
  compiler: Compiler;
  /** String digest for string interning */
  digest: Digest;
  /** Debug mode flag (enables invariant checks) */
  debug: boolean;
  /** Current list nesting depth */
  listDepth: number;
  /** Dictionary head cell index (0 = NIL/empty dictionary) */
  head: number;
  /** Current local variable count */
  localCount: number;
}

/**
 * Creates and returns a new initialized VM instance as a plain object.
 * This is the standard way to create a VM.
 *
 * @returns A new VM instance with all fields initialized
 */
export function createVM(): VM {
  const memory = new Memory();
  const digest = new Digest(memory);
  const vm: VM = {
    memory,
    IP: 0,
    running: true,
    sp: STACK_BASE_CELLS,
    rsp: RSTACK_BASE_CELLS,
    bp: RSTACK_BASE_CELLS,
    gp: 0,
    digest,
    debug: false,
    listDepth: 0,
    localCount: 0,
    head: 0,
    compiler: null as unknown as Compiler,
  };
  vm.compiler = new Compiler(vm);
  registerBuiltins(vm);
  return vm;
}

/**
 * Pushes a value onto the data stack.
 *
 * @param vm - VM instance
 * @param value - The value to push
 * @throws {StackOverflowError} If stack overflow occurs
 */
export function push(vm: VM, value: number): void {
  if (vm.sp >= STACK_TOP_CELLS) {
    throw new StackOverflowError('push', getStackData(vm));
  }

  const offsetBytes = (vm.sp - STACK_BASE_CELLS) * CELL_SIZE_BYTES;
  vm.memory.writeFloat32(SEG_DATA, STACK_BASE + offsetBytes, value);
  vm.sp += 1;
  if (vm.debug) {
    ensureInvariants(vm);
  }
}

/**
 * Pops a value from the data stack.
 *
 * @param vm - VM instance
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
  return vm.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
}

/**
 * Peeks at the top stack value.
 *
 * @param vm - VM instance
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
 *
 * @param vm - VM instance
 * @param value - The value to push
 * @throws {ReturnStackOverflowError} If return stack overflow occurs
 */
export function rpush(vm: VM, value: number): void {
  if (vm.rsp >= RSTACK_TOP_CELLS) {
    throw new ReturnStackOverflowError('rpush', getStackData(vm));
  }

  const offsetBytes = (vm.rsp - RSTACK_BASE_CELLS) * CELL_SIZE_BYTES;
  vm.memory.writeFloat32(SEG_DATA, RSTACK_BASE + offsetBytes, value);
  vm.rsp += 1;
  if (vm.debug) {
    ensureInvariants(vm);
  }
}

/**
 * Pops a value from the return stack.
 *
 * @param vm - VM instance
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
  return vm.memory.readFloat32(SEG_DATA, RSTACK_BASE + offsetBytes);
}

/**
 * Gets the current data stack contents.
 *
 * @param vm - VM instance
 * @returns Array of stack values
 */
export function getStackData(vm: VM): number[] {
  const stackData: number[] = [];
  const depthCells = vm.sp - STACK_BASE_CELLS;
  for (let i = 0; i < depthCells; i += 1) {
    const byteOffset = STACK_BASE + i * CELL_SIZE_BYTES;
    stackData.push(vm.memory.readFloat32(SEG_DATA, byteOffset));
  }

  return stackData;
}

/**
 * Ensures stack has minimum number of elements.
 *
 * @param vm - VM instance
 * @param size - Required stack depth
 * @param operation - Operation name for error reporting
 * @throws {StackUnderflowError} If insufficient stack elements
 */
export function ensureStackSize(vm: VM, size: number, operation: string): void {
  if (vm.sp - STACK_BASE_CELLS < size) {
    throw new StackUnderflowError(operation, size, getStackData(vm));
  }
}

/**
 * Resolves a symbol name to a tagged value.
 *
 * @param vm - VM instance
 * @param name - The symbol name to resolve
 * @returns Tagged value for the symbol, or undefined if not found
 */
export function resolveSymbol(vm: VM, name: string): number | undefined {
  const result = lookup(vm, name);
  return isNIL(result) ? undefined : result;
}

/**
 * Pushes a symbol reference onto the stack.
 *
 * @param vm - VM instance
 * @param name - The symbol name to resolve and push
 * @throws {Error} If the symbol is not found
 */
export function pushSymbolRef(vm: VM, name: string): void {
  const taggedValue = resolveSymbol(vm, name);
  if (taggedValue === undefined) {
    throw new Error(`Symbol not found: ${name}`);
  }
  push(vm, taggedValue);
}

function checkInv(vm: { sp: number; rsp: number; bp: number; gp: number }): void {
  if (vm.sp < 0 || vm.rsp < 0 || vm.bp < 0) {
    throw new Error('Invariant violation: negative stack pointer');
  }
  if (!Number.isInteger(vm.sp) || !Number.isInteger(vm.rsp) || !Number.isInteger(vm.bp)) {
    throw new Error('Invariant violation: non-integer stack pointer');
  }
  if (vm.gp < 0) {
    throw new Error('Invariant violation: negative global pointer');
  }
  if (!Number.isInteger(vm.gp)) {
    throw new Error('Invariant violation: non-integer global pointer');
  }
  if (vm.sp < STACK_BASE_CELLS || vm.sp > STACK_TOP_CELLS) {
    throw new Error('Invariant violation: SP outside stack segment');
  }
  if (vm.rsp < RSTACK_BASE_CELLS || vm.rsp > RSTACK_TOP_CELLS) {
    throw new Error('Invariant violation: RSP outside return stack segment');
  }
  if (vm.bp > vm.rsp) {
    throw new Error(`Invariant violation: BP (${vm.bp}) > RSP (${vm.rsp})`);
  }
}

function read8(vm: { memory: Memory; IP: number }): number {
  const value = vm.memory.read8(SEG_CODE, vm.IP);
  vm.IP += 1;
  return value;
}

function readOp(vm: { memory: Memory; IP: number }): number {
  const firstByte = vm.memory.read8(SEG_CODE, vm.IP);
  vm.IP += 1;
  if ((firstByte & 0x80) !== 0) {
    const secondByte = vm.memory.read8(SEG_CODE, vm.IP);
    vm.IP += 1;
    const lowBits = firstByte & 0x7f;
    const highBits = secondByte << 7;
    return highBits | lowBits;
  }
  return firstByte;
}

function readI16(vm: { memory: Memory; IP: number }): number {
  const unsignedValue = vm.memory.read16(SEG_CODE, vm.IP);
  const signedValue = (unsignedValue << 16) >> 16;
  vm.IP += 2;
  return signedValue;
}

function readU16(vm: { memory: Memory; IP: number }): number {
  const value = vm.memory.read16(SEG_CODE, vm.IP);
  vm.IP += 2;
  return value;
}

function readF32(vm: { memory: Memory; IP: number }): number {
  const value = vm.memory.readFloat32(SEG_CODE, vm.IP);
  vm.IP += CELL_SIZE;
  return value;
}

function readAddr(vm: { memory: Memory; IP: number }): number {
  const tagNum = readF32(vm);
  const { value: pointer } = fromTaggedValue(tagNum);
  return pointer;
}

/**
 * Test-only helper: forcibly set BP using a raw byte offset without alignment coercion.
 * This bypasses normal validation to allow corruption/underflow tests to simulate
 * malformed frames. Caller must ensure provided bytes are within overall return stack
 * segment range. Alignment is still enforced (throws if not cell-aligned) to avoid
 * undefined behavior in core logic.
 *
 * @param vm - VM instance
 * @param rawBytes - Byte offset to force as BP
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
 *
 * @param vm - VM instance
 * @param size - Number of values to pop
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
 *
 * @param vm - VM instance
 * @param size - Required return stack depth
 * @param operation - Operation name for error reporting
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
 *
 * @param vm - VM instance
 * @returns The decoded code pointer
 */
export function nextAddress(vm: VM): number {
  return readAddr(vm);
}

/**
 * Peeks at a value at a specific slot offset from the top of the stack.
 *
 * @param vm - VM instance
 * @param slotOffset - Number of slots from the top (0 = top, 1 = second from top, etc.)
 * @returns The value at the specified offset
 * @throws {StackUnderflowError} If the stack doesn't have enough values
 */
export function peekAt(vm: VM, slotOffset: number): number {
  const requiredCells = slotOffset + 1;
  if (vm.sp - STACK_BASE_CELLS < requiredCells) {
    throw new StackUnderflowError('peekAt', requiredCells, getStackData(vm));
  }

  const offsetBytes = (vm.sp - STACK_BASE_CELLS - requiredCells) * CELL_SIZE_BYTES;
  return vm.memory.readFloat32(SEG_DATA, STACK_BASE + offsetBytes);
}

/**
 * Push one cell to the global window.
 *
 * @param vm - VM instance
 * @param value - Value to push
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
 *
 * @param vm - VM instance
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
 *
 * @param vm - VM instance
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
 *
 * @param vm - VM instance
 * @returns The byte value
 */
export function next8(vm: VM): number {
  return read8(vm);
}

/**
 * Reads the next opcode from code and advances IP.
 *
 * @param vm - VM instance
 * @returns The decoded opcode or user-defined word address
 */
export function nextOpcode(vm: VM): number {
  return readOp(vm);
}

/**
 * Reads the next 16-bit signed integer from code and advances IP.
 *
 * @param vm - VM instance
 * @returns The signed integer value
 */
export function nextInt16(vm: VM): number {
  return readI16(vm);
}

/**
 * Reads the next float from code and advances IP.
 *
 * @param vm - VM instance
 * @returns The float value
 */
export function nextFloat32(vm: VM): number {
  return readF32(vm);
}

/**
 * Reads the next 16-bit unsigned integer from code and advances IP.
 *
 * @param vm - VM instance
 * @returns The unsigned integer value
 */
export function nextUint16(vm: VM): number {
  return readU16(vm);
}

/**
 * Returns current data stack depth in slots (cells).
 *
 * @param vm - VM instance
 * @returns Stack depth in cells
 */
export function depth(vm: VM): number {
  return vm.sp - STACK_BASE_CELLS;
}

/**
 * Returns current return stack depth in slots (cells).
 *
 * @param vm - VM instance
 * @returns Return stack depth in cells
 */
export function rdepth(vm: VM): number {
  return vm.rsp - RSTACK_BASE_CELLS;
}

/**
 * Development-only invariant checks (enabled when vm.debug === true).
 * Validates relationships among SP, RSP, BP and segment bounds.
 *
 * @param vm - VM instance
 */
export function ensureInvariants(vm: VM): void {
  if (vm.sp < 0 || vm.rsp < 0 || vm.bp < 0) {
    throw new Error('Invariant violation: negative stack pointer');
  }
  if (!Number.isInteger(vm.sp) || !Number.isInteger(vm.rsp) || !Number.isInteger(vm.bp)) {
    throw new Error('Invariant violation: non-integer stack pointer');
  }
  if (vm.gp < 0) {
    throw new Error('Invariant violation: negative global pointer');
  }
  if (!Number.isInteger(vm.gp)) {
    throw new Error('Invariant violation: non-integer global pointer');
  }
  if (vm.sp < STACK_BASE_CELLS || vm.sp > STACK_TOP_CELLS) {
    throw new Error('Invariant violation: SP outside stack segment');
  }
  if (vm.rsp < RSTACK_BASE_CELLS || vm.rsp > RSTACK_TOP_CELLS) {
    throw new Error('Invariant violation: RSP outside return stack segment');
  }
  if (vm.bp > vm.rsp) {
    throw new Error(`Invariant violation: BP (${vm.bp}) > RSP (${vm.rsp})`);
  }
}
