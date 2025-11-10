/**
 * @file src/core/vm.ts
 * Core Virtual Machine implementation for Tacit bytecode execution.
 */

import { Compiler } from '../lang/compiler';
import { Memory } from './memory';
import { lookup } from './dictionary';
import {
  SEG_CODE,
  CELL_SIZE,
  STACK_BASE,
  STACK_TOP,
  RSTACK_BASE,
  RSTACK_TOP,
  GLOBAL_BASE,
  GLOBAL_SIZE,
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

/**
 * Virtual Machine interface - a plain JavaScript object for executing Tacit bytecode.
 */
export type VM = {
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
};

/**
 * Cached VM instance for test use (only used when useCache=true).
 */
let cachedTestVM: VM | null = null;
let builtinSnapshot: { head: number; gp: number } | null = null;

/**
 * Creates and returns a new initialized VM instance as a plain object.
 * This is the standard way to create a VM.
 *
 * @param useCache - If true (default), reuses a cached VM instance with registers reset (tests only). Set to false to disable caching.
 * @returns A new VM instance with all fields initialized
 */
export function createVM(useCache = true): VM {
  if (useCache) {
    // Test mode: reuse cached VM with registers reset
    if (cachedTestVM === null || builtinSnapshot === null) {
      // First call: create VM normally, then snapshot state after builtins
      const memory = new Memory();
      const digest = new Digest(memory);
      const vm: VM = {
        memory,
        IP: 0,
        running: true,
        sp: STACK_BASE,
        rsp: RSTACK_BASE,
        bp: RSTACK_BASE,
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
      // Snapshot state AFTER builtins are registered
      cachedTestVM = vm;
      builtinSnapshot = {
        head: vm.head, // Already set correctly by define() during registerBuiltins()
        gp: vm.gp,
      };
    } else {
      // Reset registers to initial state, restore dictionary to builtin snapshot
      cachedTestVM.IP = 0;
      cachedTestVM.running = true;
      cachedTestVM.sp = STACK_BASE;
      cachedTestVM.rsp = RSTACK_BASE;
      cachedTestVM.bp = RSTACK_BASE;
      cachedTestVM.debug = false;
      cachedTestVM.listDepth = 0;
      cachedTestVM.localCount = 0;
      cachedTestVM.gp = builtinSnapshot.gp;
      cachedTestVM.head = builtinSnapshot.head;
      cachedTestVM.compiler = new Compiler(cachedTestVM);
    }
    return cachedTestVM;
  }

  // Normal mode: create fresh VM (no caching)
  const memory = new Memory();
  const digest = new Digest(memory);
  const vm: VM = {
    memory,
    IP: 0,
    running: true,
    sp: STACK_BASE,
    rsp: RSTACK_BASE,
    bp: RSTACK_BASE,
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
  if (vm.sp >= STACK_TOP) {
    throw new StackOverflowError('push', getStackData(vm));
  }

  vm.memory.writeCell(vm.sp, value);
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
  if (vm.sp <= STACK_BASE) {
    throw new StackUnderflowError('pop', 1, getStackData(vm));
  }

  vm.sp -= 1;
  if (vm.debug) {
    ensureInvariants(vm);
  }
  return vm.memory.readCell(vm.sp);
}

/**
 * Peeks at the top stack value.
 *
 * @param vm - VM instance
 * @returns The top value
 * @throws {StackUnderflowError} If stack is empty
 */
export function peek(vm: VM): number {
  if (vm.sp <= STACK_BASE) {
    throw new StackUnderflowError('peek', 1, getStackData(vm));
  }

  return vm.memory.readCell(vm.sp - 1);
}

/**
 * Pushes a value onto the return stack.
 *
 * @param vm - VM instance
 * @param value - The value to push
 * @throws {ReturnStackOverflowError} If return stack overflow occurs
 */
export function rpush(vm: VM, value: number): void {
  if (vm.rsp >= RSTACK_TOP) {
    throw new ReturnStackOverflowError('rpush', getStackData(vm));
  }

  vm.memory.writeCell(vm.rsp, value);
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
  if (vm.rsp <= RSTACK_BASE) {
    throw new ReturnStackUnderflowError('rpop', getStackData(vm));
  }

  vm.rsp -= 1;
  if (vm.debug) {
    ensureInvariants(vm);
  }
  return vm.memory.readCell(vm.rsp);
}

/**
 * Gets the current data stack contents.
 *
 * @param vm - VM instance
 * @returns Array of stack values
 */
export function getStackData(vm: VM): number[] {
  const stackData: number[] = [];
  const depthCells = vm.sp - STACK_BASE;
  for (let i = 0; i < depthCells; i += 1) {
    stackData.push(vm.memory.readCell(STACK_BASE + i));
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
  if (vm.sp - STACK_BASE < size) {
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

function _checkInv(vm: { sp: number; rsp: number; bp: number; gp: number }): void {
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
  if (vm.sp < STACK_BASE || vm.sp > STACK_TOP) {
    throw new Error('Invariant violation: SP outside stack segment');
  }
  if (vm.rsp < RSTACK_BASE || vm.rsp > RSTACK_TOP) {
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
 * Pops multiple values from the stack.
 *
 * @param vm - VM instance
 * @param size - Number of values to pop
 * @returns Array of values in stack order
 * @throws {StackUnderflowError} If stack underflow occurs
 */
export function popArray(vm: VM, size: number): number[] {
  if (vm.sp - STACK_BASE < size) {
    throw new StackUnderflowError('popArray', size, getStackData(vm));
  }

  const result: number[] = [];
  for (let i = 0; i < size; i++) {
    result.unshift(pop(vm));
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
export function ensureRStackSize(vm: VM, size: number, operation: string): void {
  if (vm.rsp - RSTACK_BASE < size) {
    throw new ReturnStackUnderflowError(operation, getStackData(vm));
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
  if (vm.sp - STACK_BASE < requiredCells) {
    throw new StackUnderflowError('peekAt', requiredCells, getStackData(vm));
  }

  return vm.memory.readCell(vm.sp - requiredCells);
}

/**
 * Push one cell to the global window.
 *
 * @param vm - VM instance
 * @param value - Value to push
 */
export function gpush(vm: VM, value: number): void {
  if (vm.gp >= GLOBAL_SIZE) {
    throw new Error('gpush on full heap');
  }
  vm.memory.writeCell(GLOBAL_BASE + vm.gp, value);
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
  return vm.memory.readCell(GLOBAL_BASE + vm.gp - 1);
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
  return vm.memory.readCell(GLOBAL_BASE + vm.gp);
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
  return vm.sp - STACK_BASE;
}

/**
 * Returns current return stack depth in slots (cells).
 *
 * @param vm - VM instance
 * @returns Return stack depth in cells
 */
export function rdepth(vm: VM): number {
  return vm.rsp - RSTACK_BASE;
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
  if (vm.sp < STACK_BASE || vm.sp > STACK_TOP) {
    throw new Error('Invariant violation: SP outside stack segment');
  }
  if (vm.rsp < RSTACK_BASE || vm.rsp > RSTACK_TOP) {
    throw new Error('Invariant violation: RSP outside return stack segment');
  }
  if (vm.bp > vm.rsp) {
    throw new Error(`Invariant violation: BP (${vm.bp}) > RSP (${vm.rsp})`);
  }
}
