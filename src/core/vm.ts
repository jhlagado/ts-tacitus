import { Compiler } from './compiler';
import { SymbolTable } from './symbol-table';
import { Memory, STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK, SEG_CODE } from './memory';
import { Heap } from '../heap/heap';
import { fromTaggedValue, isRefCounted, toTaggedValue, CoreTag } from './tagged';
import { Digest } from './digest';
import { defineBuiltins } from '../ops/define-builtins';

export class VM {
  memory: Memory;
  SP: number; // Stack pointer (points to the next free slot)
  RP: number; // Return stack pointer (points to the next free slot)
  IP: number; // Instruction pointer
  running: boolean;
  compiler: Compiler;
  digest: Digest;
  symbolTable: SymbolTable;
  debug: boolean;
  heap: Heap;

  constructor() {
    this.memory = new Memory();
    this.IP = 0; // Start execution at CODE
    this.running = true;
    this.SP = 0; // Stack starts at STACK
    this.RP = 0; // Return stack starts at RSTACK
    this.compiler = new Compiler(this);
    this.digest = new Digest(this.memory);
    this.heap = new Heap(this.memory);
    this.debug = false;

    this.symbolTable = new SymbolTable(this.digest);
    defineBuiltins(this.symbolTable);
  }

  eval() {
    this.rpush(toTaggedValue(this.IP, false, CoreTag.CODE));
    const { value: pointer } = fromTaggedValue(this.pop());
    this.IP = pointer;
  }

  /**
   * Pushes a 32-bit float onto the stack.
   */
  push(value: number, transfer: boolean = false): void {
    if (transfer && isRefCounted(value)) {
      this.heap.incrementRef(value);
    }
    if (this.SP + 4 > STACK_SIZE) {
      throw new Error(
        `Stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(this.getStackData())})`
      );
    }
    this.memory.writeFloat(SEG_STACK, this.SP, value); // Write 32-bit float
    this.SP += 4; // Move stack pointer by 4 bytes
  }

  /**
   * Pops a 32-bit float from the stack.
   */
  pop(): number {
    if (this.SP <= 0) {
      throw new Error(
        `Stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`
      );
    }
    this.SP -= 4; // Move stack pointer back by 4 bytes
    const tvalue = this.memory.readFloat(SEG_STACK, this.SP); // Read 32-bit float

    if (isRefCounted(tvalue)) {
      const { value } = fromTaggedValue(tvalue);
      this.heap.decrementRef(value); // 1 → 0 (frees if needed)
    }
    return tvalue;
  }

  peek(): number {
    const value = this.pop();
    this.push(value, true); // Push back the value
    return value;
  }

  /**
   * Pops 'size' 32-bit values from the stack and returns them in an array.
   * The values are returned in the order they were on the stack (bottom first).
   */
  popArray(size: number): number[] {
    // unshift corrupts NaN boxing so be careful working with tagged values
    const result: number[] = Array(size);
    for (let i = size - 1; i >= 0; i--) {
      result[i] = this.pop();
    }
    return result;
  }

  /**
   * Pushes a 32-bit value onto the return stack.
   */
  rpush(value: number): void {
    if (this.RP + 4 > RSTACK_SIZE) {
      throw new Error(
        `Return stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    this.memory.writeFloat(SEG_RSTACK, this.RP, value); // Write 32-bit value
    this.RP += 4; // Move return stack pointer by 4 bytes
  }

  /**
   * Pops a 32-bit value from the return stack.
   */
  rpop(): number {
    if (this.RP <= 0) {
      throw new Error(
        `Return stack underflow: Cannot pop value (stack: ${JSON.stringify(this.getStackData())})`
      );
    }
    this.RP -= 4; // Move return stack pointer back by 4 bytes
    return this.memory.readFloat(SEG_RSTACK, this.RP); // Read 32-bit value
  }

  reset() {
    this.IP = 0;
  }

  /**
   * Reads the next 8-bit value from memory and increments the instruction pointer.
   */
  next8(): number {
    const value = this.memory.read8(SEG_CODE, this.IP); // Read 8-bit value
    this.IP += 1; // Move instruction pointer by 1 byte
    return value;
  }

  /**
   * Reads the next 16-bit value from memory and increments the instruction pointer.
   */
  next16(): number {
    // Read the 16-bit value from memory
    const unsignedValue = this.memory.read16(SEG_CODE, this.IP);

    // Interpret the 16-bit value as a signed integer
    const signedValue = (unsignedValue << 16) >> 16; // Sign-extend to 32 bits

    this.IP += 2; // Move instruction pointer by 2 bytes
    return signedValue;
  }

  /**
   * Reads the next 32-bit float from memory and increments the instruction pointer.
   */
  nextFloat(): number {
    const value = this.memory.readFloat(SEG_CODE, this.IP); // Read 32-bit float
    this.IP += 4; // Move instruction pointer by 4 bytes
    return value;
  }

  /**
   * Reads the next address (tagged as CODE) from memory and increments the instruction pointer.
   */
  nextAddress(): number {
    const tagNum = this.nextFloat(); // Read the tagged pointer as a float
    const { value: pointer } = fromTaggedValue(tagNum);
    return pointer;
  }

  /**
   * Returns the current stack data as an array of 32-bit values.
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = 0; i < this.SP; i += 4) {
      stackData.push(this.memory.readFloat(SEG_STACK, i));
    }
    return stackData;
  }

  getCompileData(): number[] {
    const compileData: number[] = [];
    for (let i = 0; i < this.compiler.CP; i++) {
      compileData.push(this.memory.read8(SEG_CODE, i));
    }
    return compileData;
  }
}
