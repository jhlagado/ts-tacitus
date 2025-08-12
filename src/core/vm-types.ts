/**
 * @file src/core/vm-types.ts
 * Core VM data structures and types for C/assembly port preparation.
 * Defines focused, single-responsibility interfaces to replace monolithic VM class.
 */

/** VM execution result codes (C-ready enum) */
export enum VMResult {
  OK = 0,
  STACK_OVERFLOW = 1,
  STACK_UNDERFLOW = 2,
  RETURN_STACK_OVERFLOW = 3,
  RETURN_STACK_UNDERFLOW = 4,
  INVALID_OPCODE = 5,
  MEMORY_ACCESS_ERROR = 6,
  TYPE_ERROR = 7
}

/**
 * Core VM structure (32 bytes, cache-friendly)
 * Direct mapping target for C struct tacit_vm_t
 */
export interface VMCore {
  /** Raw 64KB memory buffer (segmented) */
  memory: Uint8Array;
  
  /** Stack pointer - byte offset in STACK segment */
  SP: number;
  
  /** Return stack pointer - byte offset in RSTACK segment */
  RP: number;
  
  /** Instruction pointer - byte offset in CODE segment */
  IP: number;
  
  /** Base pointer - stack frame base */
  BP: number;
  
  /** Receiver register - stack slot index for method dispatch */
  receiver: number;
  
  /** List nesting depth counter */
  listDepth: number;
  
  /** Execution state flag */
  running: boolean;
  
  /** Debug mode flag */
  debug: boolean;
}

/**
 * Stack operations interface
 * Maps to C functions: vm_push, vm_pop, vm_peek, etc.
 */
export interface VMStack {
  push(vm: VMCore, value: number): VMResult;
  pop(vm: VMCore): [VMResult, number];
  peek(vm: VMCore): [VMResult, number];
  popArray(vm: VMCore, size: number): [VMResult, number[]];
  ensureSize(vm: VMCore, size: number): boolean;
  rpush(vm: VMCore, value: number): VMResult;
  rpop(vm: VMCore): [VMResult, number];
  getStackData(vm: VMCore): number[];
}

/**
 * Memory access interface
 * Maps to C functions: vm_read8, vm_write32, etc.
 */
export interface VMMemory {
  read8(vm: VMCore, segment: number, addr: number): number;
  read16(vm: VMCore, segment: number, addr: number): number;
  readFloat32(vm: VMCore, segment: number, addr: number): number;
  write8(vm: VMCore, segment: number, addr: number, value: number): void;
  write16(vm: VMCore, segment: number, addr: number, value: number): void;
  writeFloat32(vm: VMCore, segment: number, addr: number, value: number): void;
}

/**
 * Bytecode execution interface
 * Maps to C functions: vm_next8, vm_next_opcode, etc.
 */
export interface VMExecution {
  next8(vm: VMCore): number;
  nextOpcode(vm: VMCore): number;
  next16(vm: VMCore): number;
  nextFloat32(vm: VMCore): number;
  nextAddress(vm: VMCore): number;
  read16(vm: VMCore): number;
  eval(vm: VMCore): VMResult;
}

/**
 * Symbol resolution interface
 * Maps to C functions: vm_resolve_symbol, vm_push_symbol_ref
 */
export interface VMSymbols {
  resolveSymbol(vm: VMCore, name: string): number | undefined;
  pushSymbolRef(vm: VMCore, name: string): VMResult;
}