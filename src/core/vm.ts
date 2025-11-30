/**
 * @file src/core/vm.ts
 * Core Virtual Machine implementation for Tacit bytecode execution.
 */

import {
  type CompilerState,
  makeCompiler,
  compilerCompileOpcode,
  compilerCompile16,
  compilerCompileFloat32,
  compilerCompileUserWordCall,
  compilerCompileAddress,
  compilerEmitReserveIfNeeded,
  compilerEnterFunction,
  compilerExitFunction,
  compilerPatch16,
  compilerPatchOpcode,
  compilerReset,
} from '../lang/compiler';
import {
  type Memory,
  createMemory,
  memoryWriteCell,
  memoryReadCell,
  memoryRead8,
  memoryRead16,
  memoryReadFloat32,
} from './memory';
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
  CODE_ALIGN_BYTES,
} from './constants';
import { Op } from '../ops/opcodes';
import { getTaggedInfo, isNIL, Tag } from './tagged';
import { decodeX1516 } from './code-ref';
import { createDigest, type Digest } from '../strings/digest';
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
  ip: number;
  /** Execution state flag */
  running: boolean;
  /** Error flag/register (0/1 for now) */
  err: number;
  /** Flag: currently executing in a finally cleanup block */
  inFinally: boolean;
  /** Compile-time state bundle */
  compile: CompilerState;
  /** Debug mode flag (enables invariant checks) */
  debug: boolean;
}

function resetCompileState(vm: VM, digest: Digest, head: number, includeHost: CompilerState['includeHost'], currentSource: string | null): CompilerState {
  const base = makeCompiler(digest);
  return {
    ...base,
    head,
    includeHost,
    currentSource,
    lastDefinitionCell: -1,
  };
}

/**
 * Cached VM instance for test use (only used when useCache=true).
 */
let cachedTestVM: VM | null = null;
let builtinSnapshot: { head: number; gp: number } | null = null;

/**
 * Creates and returns a new initialized VM instance as a plain object.
 * This is the standard way to create a VM.
 *
 * @param useCache - If true, reuses a cached VM instance with registers reset (tests only). Set to false to disable caching. Defaults to false to avoid test cross-talk.
 * @returns A new VM instance with all fields initialized
 */
export function createVM(useCache = true): VM {
  if (useCache) {
    // Test mode: reuse cached VM with registers reset
      if (cachedTestVM === null || builtinSnapshot === null) {
        // First call: create VM normally, then snapshot state after builtins
        const memory = createMemory();
        const digest = createDigest(memory);
        const baseCompiler = makeCompiler(digest);
        const vm: VM = {
          memory,
          ip: 0,
          running: true,
          err: 0,
          inFinally: false,
          sp: STACK_BASE,
          rsp: RSTACK_BASE,
          bp: RSTACK_BASE,
          gp: 0,
          debug: false,
          compile: baseCompiler,
        };
      registerBuiltins(vm);
      // Snapshot state AFTER builtins are registered
      cachedTestVM = vm;
      builtinSnapshot = {
        head: vm.compile.head, // Already set correctly by define() during registerBuiltins()
        gp: vm.gp,
      };
    } else {
      // Reset registers to initial state, restore dictionary to builtin snapshot
      cachedTestVM.ip = 0;
      cachedTestVM.running = true;
      cachedTestVM.err = 0;
      cachedTestVM.inFinally = false;
      cachedTestVM.sp = STACK_BASE;
      cachedTestVM.rsp = RSTACK_BASE;
      cachedTestVM.bp = RSTACK_BASE;
      cachedTestVM.debug = false;
      cachedTestVM.gp = builtinSnapshot.gp;
      const includeHost = cachedTestVM.compile.includeHost;
      const currentSource = cachedTestVM.compile.currentSource;
      const digest = cachedTestVM.compile.digest;
      cachedTestVM.compile = resetCompileState(
        cachedTestVM,
        digest,
        builtinSnapshot.head,
        includeHost,
        currentSource,
      );
    }
    return cachedTestVM;
  }

  // Normal mode: create fresh VM (no caching)
  const memory = createMemory();
  const digest = createDigest(memory);
  const vm: VM = {
    memory,
    ip: 0,
    running: true,
    err: 0,
    inFinally: false,
    sp: STACK_BASE,
    rsp: RSTACK_BASE,
    bp: RSTACK_BASE,
    gp: 0,
    debug: false,
    compile: makeCompiler(digest),
  };
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

  memoryWriteCell(vm.memory, vm.sp, value);
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
  return memoryReadCell(vm.memory, vm.sp);
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

  return memoryReadCell(vm.memory, vm.sp - 1);
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

  memoryWriteCell(vm.memory, vm.rsp, value);
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
  return memoryReadCell(vm.memory, vm.rsp);
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
    stackData.push(memoryReadCell(vm.memory, STACK_BASE + i));
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
function _checkInv(vm: VM): void {
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

function read8(vm: VM): number {
  const value = memoryRead8(vm.memory, SEG_CODE, vm.ip);
  vm.ip += 1;
  return value;
}

function readOp(vm: VM): number {
  const firstByte = memoryRead8(vm.memory, SEG_CODE, vm.ip);
  vm.ip += 1;
  if ((firstByte & 0x80) !== 0) {
      const secondByte = memoryRead8(vm.memory, SEG_CODE, vm.ip);
    vm.ip += 1;
    const lowBits = firstByte & 0x7f;
    const highBits = secondByte << 7;
    return highBits | lowBits;
  }
  return firstByte;
}

function readI16(vm: VM): number {
  const unsignedValue = memoryRead16(vm.memory, SEG_CODE, vm.ip);
  const signedValue = (unsignedValue << 16) >> 16;
  vm.ip += 2;
  return signedValue;
}

function readU16(vm: VM): number {
  const value = memoryRead16(vm.memory, SEG_CODE, vm.ip);
  vm.ip += 2;
  return value;
}

function readF32(vm: VM): number {
  const value = memoryReadFloat32(vm.memory, SEG_CODE, vm.ip);
  vm.ip += CELL_SIZE;
  return value;
}

function readAddr(vm: VM): number {
  const tagNum = readF32(vm);
  const { value: pointer, tag } = getTaggedInfo(tagNum);
  // If it's a CODE tag, decode the X1516 encoded address
  if (tag === Tag.CODE) {
    return decodeX1516(pointer);
  }
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
 * Reads the next address from code and advances ip.
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

  return memoryReadCell(vm.memory, vm.sp - requiredCells);
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
  memoryWriteCell(vm.memory, GLOBAL_BASE + vm.gp, value);
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
  return memoryReadCell(vm.memory, GLOBAL_BASE + vm.gp - 1);
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
  return memoryReadCell(vm.memory, GLOBAL_BASE + vm.gp);
}

/**
 * Reads the next byte from code and advances ip.
 *
 * @param vm - VM instance
 * @returns The byte value
 */
export function next8(vm: VM): number {
  return read8(vm);
}

/**
 * Reads the next opcode from code and advances ip.
 *
 * @param vm - VM instance
 * @returns The decoded opcode or user-defined word address
 */
export function nextOpcode(vm: VM): number {
  return readOp(vm);
}

/**
 * Reads the next 16-bit signed integer from code and advances ip.
 *
 * @param vm - VM instance
 * @returns The signed integer value
 */
export function nextInt16(vm: VM): number {
  return readI16(vm);
}

/**
 * Reads the next float from code and advances ip.
 *
 * @param vm - VM instance
 * @returns The float value
 */
export function nextFloat32(vm: VM): number {
  return readF32(vm);
}

/**
 * Reads the next 16-bit unsigned integer from code and advances ip.
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

/**
 * Emits an opcode to the current compilation buffer.
 */
export function emitOpcode(vm: VM, opcode: number): void {
  compilerCompileOpcode(vm, vm.compile, opcode);
}

/**
 * Emits a 16-bit unsigned value to the code buffer.
 */
export function emitUint16(vm: VM, value: number): void {
  compilerCompile16(vm, vm.compile, value);
}

/**
 * Emits a 32-bit float to the code buffer.
 */
export function emitFloat32(vm: VM, value: number): void {
  compilerCompileFloat32(vm, vm.compile, value);
}

/**
 * Emits a user word call using X1516 encoding regardless of address range.
 */
export function emitUserWordCall(vm: VM, address: number): void {
  compilerCompileUserWordCall(vm, vm.compile, address);
}

/**
 * Emits a tagged address literal into the code buffer.
 */
export function emitTaggedAddress(vm: VM, address: number): void {
  compilerCompileAddress(vm, vm.compile, address);
}

/**
 * Ensures a Reserve opcode has been emitted for locals in the current function.
 */
export function ensureReserveEmitted(vm: VM): void {
  compilerEmitReserveIfNeeded(vm, vm.compile);
}

/**
 * Marks the beginning of a function body for compilation.
 */
export function beginFunctionCompile(vm: VM): void {
  compilerEnterFunction(vm.compile);
}

/**
 * Marks the end of a function body for compilation.
 */
export function finishFunctionCompile(vm: VM): void {
  compilerExitFunction(vm, vm.compile);
}

/**
 * Resets the compiler's compile pointer based on the preserve flag.
 */
export function resetCompiler(vm: VM): void {
  compilerReset(vm.compile);
}

/**
 * Sets whether the current compilation should preserve the generated code.
 */
export function setCompilerPreserve(vm: VM, preserve: boolean): void {
  vm.compile.preserve = preserve;
}

/**
 * Returns the current compile pointer.
 */
export function getCompilePointer(vm: VM): number {
  return vm.compile.CP;
}

/**
 * Sets the compile pointer to a specific address.
 */
export function setCompilePointer(vm: VM, address: number): void {
  vm.compile.CP = address;
}

/**
 * Aligns the compile pointer to the configured CODE alignment by emitting NOP padding.
 * Safe to call as a no-op when CODE_ALIGN_BYTES = 1.
 */
export function alignCompilePointer(vm: VM): void {
  while (vm.compile.CP % CODE_ALIGN_BYTES !== 0) {
    emitOpcode(vm, Op.Nop);
  }
}

/**
 * Patches a 16-bit value at the specified code address.
 */
export function patchUint16(vm: VM, address: number, value: number): void {
  compilerPatch16(vm, vm.compile, address, value);
}

/**
 * Patches an opcode at the specified code address.
 */
export function patchOpcode(vm: VM, address: number, opcode: number): void {
  compilerPatchOpcode(vm, vm.compile, address, opcode);
}

export { resolveSymbol, pushSymbolRef } from './symbols';
