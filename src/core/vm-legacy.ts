/**
 * @file src/core/vm-legacy.ts
 * Legacy VM class wrapper for backward compatibility.
 * Maintains existing API while delegating to decomposed components.
 */

import { VMCore, VMResult } from './vm-types';
import { createVMCore, resetVMCore } from './vm-core';
import { vmMemory } from './vm-memory';
import { vmStack } from './vm-stack';
import { vmExecution } from './vm-execution';
import { Memory } from './memory';
import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { Digest } from '../strings/digest';
import { registerBuiltins } from '../ops/builtins-register';
import {
  StackUnderflowError,
  StackOverflowError,
  ReturnStackUnderflowError,
  ReturnStackOverflowError,
} from './errors';

/**
 * Legacy VM class wrapper
 * Maintains backward compatibility while using decomposed components
 */
export class VM {
  /** Core VM state (new decomposed structure) */
  private core: VMCore;
  
  /** Legacy memory instance for compatibility */
  memory: Memory;
  
  /** Compiler instance */
  compiler!: Compiler;
  
  /** String digest */
  digest: Digest;
  
  /** Symbol table */
  symbolTable: SymbolTable;

  constructor() {
    this.core = createVMCore();
    this.memory = new Memory(); // Legacy compatibility
    this.digest = new Digest(this.memory);
    this.symbolTable = new SymbolTable(this.digest);
    registerBuiltins(this, this.symbolTable);
  }

  // Delegate pointer accessors to core
  get SP(): number { return this.core.SP; }
  set SP(value: number) { this.core.SP = value; }
  
  get RP(): number { return this.core.RP; }
  set RP(value: number) { this.core.RP = value; }
  
  get IP(): number { return this.core.IP; }
  set IP(value: number) { this.core.IP = value; }
  
  get BP(): number { return this.core.BP; }
  set BP(value: number) { this.core.BP = value; }
  
  get running(): boolean { return this.core.running; }
  set running(value: boolean) { this.core.running = value; }
  
  get debug(): boolean { return this.core.debug; }
  set debug(value: boolean) { this.core.debug = value; }
  
  get listDepth(): number { return this.core.listDepth; }
  set listDepth(value: number) { this.core.listDepth = value; }
  
  get receiver(): number { return this.core.receiver; }
  set receiver(value: number) { this.core.receiver = value; }

  initializeCompiler(compiler: Compiler): void {
    this.compiler = compiler;
  }

  eval(): void {
    const result = vmExecution.eval(this.core);
    if (result !== VMResult.OK) {
      throw new Error(`eval failed with result: ${result}`);
    }
  }

  push(value: number): void {
    const result = vmStack.push(this.core, value);
    if (result === VMResult.STACK_OVERFLOW) {
      throw new StackOverflowError('push', this.getStackData());
    }
  }

  pop(): number {
    const [result, value] = vmStack.pop(this.core);
    if (result === VMResult.STACK_UNDERFLOW) {
      throw new StackUnderflowError('pop', 1, this.getStackData());
    }
    return value;
  }

  peek(): number {
    const [result, value] = vmStack.peek(this.core);
    if (result === VMResult.STACK_UNDERFLOW) {
      throw new StackUnderflowError('peek', 1, this.getStackData());
    }
    return value;
  }

  popArray(size: number): number[] {
    const [result, values] = vmStack.popArray(this.core, size);
    if (result === VMResult.STACK_UNDERFLOW) {
      throw new StackUnderflowError('popArray', size, this.getStackData());
    }
    return values;
  }

  rpush(value: number): void {
    const result = vmStack.rpush(this.core, value);
    if (result === VMResult.RETURN_STACK_OVERFLOW) {
      throw new ReturnStackOverflowError('rpush', this.getStackData());
    }
  }

  rpop(): number {
    const [result, value] = vmStack.rpop(this.core);
    if (result === VMResult.RETURN_STACK_UNDERFLOW) {
      throw new ReturnStackUnderflowError('rpop', this.getStackData());
    }
    return value;
  }

  reset(): void {
    this.core.IP = 0;
  }

  next8(): number {
    return vmExecution.next8(this.core);
  }

  nextOpcode(): number {
    return vmExecution.nextOpcode(this.core);
  }

  next16(): number {
    return vmExecution.next16(this.core);
  }

  nextFloat32(): number {
    return vmExecution.nextFloat32(this.core);
  }

  nextAddress(): number {
    return vmExecution.nextAddress(this.core);
  }

  read16(): number {
    return vmExecution.read16(this.core);
  }

  getStackData(): number[] {
    return vmStack.getStackData(this.core);
  }

  ensureStackSize(size: number, operation: string): void {
    if (!vmStack.ensureSize(this.core, size)) {
      throw new Error(
        `Stack underflow: '${operation}' requires ${size} operand${size !== 1 ? 's' : ''} (stack: ${JSON.stringify(this.getStackData())})`,
      );
    }
  }

  getCompileData(): number[] {
    const compileData: number[] = [];
    for (let i = 0; i < this.compiler.CP; i++) {
      compileData.push(this.memory.read8(4, i)); // SEG_CODE = 4
    }
    return compileData;
  }

  resolveSymbol(name: string): number | undefined {
    return this.symbolTable.findTaggedValue(name);
  }

  pushSymbolRef(name: string): void {
    const taggedValue = this.resolveSymbol(name);
    if (taggedValue === undefined) {
      throw new Error(`Symbol not found: ${name}`);
    }
    this.push(taggedValue);
  }

  getReceiver(): number {
    return this.core.receiver;
  }

  setReceiver(slotIndex: number): void {
    this.core.receiver = slotIndex;
  }
}