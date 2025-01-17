import { Compiler } from "./compiler";
import { Dictionary } from "./dictionary";
import { Memory, STACK, RSTACK, STACK_SIZE, RSTACK_SIZE, CODE } from "./memory";
import { Heap } from "./heap";

export class VM {
  memory: Memory;
  SP: number; // Stack pointer (points to the next free slot)
  RP: number; // Return stack pointer (points to the next free slot)
  IP: number; // Instruction pointer
  running: boolean;
  compiler: Compiler;
  dictionary: Dictionary;
  debug: boolean;
  heap: Heap;

  constructor() {
    this.memory = new Memory();
    this.IP = CODE; // Start execution at CODE
    this.running = true;
    this.SP = STACK; // Stack starts at STACK
    this.RP = RSTACK; // Return stack starts at RSTACK
    this.compiler = new Compiler(this);
    this.dictionary = new Dictionary();
    this.heap = new Heap(this.memory);
    this.debug = false;
  }

  /**
   * Pushes a 32-bit value onto the stack.
   */
  push(value: number): void {
    if (this.SP + 4 > STACK + STACK_SIZE) {
      throw new Error(
        `Stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    this.memory.write32(this.SP, value); // Write 32-bit value
    this.SP += 4; // Move stack pointer by 4 bytes
  }

  /**
   * Pops a 32-bit value from the stack.
   */
  pop(): number {
    if (this.SP <= STACK) {
      throw new Error(
        `Stack underflow: Cannot pop value (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    this.SP -= 4; // Move stack pointer back by 4 bytes
    return this.memory.read32(this.SP); // Read 32-bit value
  }

  /**
   * Pushes a 32-bit float onto the stack.
   */
  pushFloat(value: number): void {
    if (this.SP + 4 > STACK + STACK_SIZE) {
      throw new Error(
        `Stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    this.memory.writeFloat(this.SP, value); // Write 32-bit float
    this.SP += 4; // Move stack pointer by 4 bytes
  }

  /**
   * Pops a 32-bit float from the stack.
   */
  popFloat(): number {
    if (this.SP <= STACK) {
      throw new Error(
        `Stack underflow: Cannot pop value (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    this.SP -= 4; // Move stack pointer back by 4 bytes
    return this.memory.readFloat(this.SP); // Read 32-bit float
  }

  /**
   * Pushes a 32-bit value onto the return stack.
   */
  rpush(value: number): void {
    if (this.RP + 4 > RSTACK + RSTACK_SIZE) {
      throw new Error(
        `Return stack overflow: Cannot push value ${value} (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    this.memory.write32(this.RP, value); // Write 32-bit value
    this.RP += 4; // Move return stack pointer by 4 bytes
  }

  /**
   * Pops a 32-bit value from the return stack.
   */
  rpop(): number {
    if (this.RP <= RSTACK) {
      throw new Error(
        `Return stack underflow: Cannot pop value (stack: ${JSON.stringify(
          this.getStackData()
        )})`
      );
    }
    this.RP -= 4; // Move return stack pointer back by 4 bytes
    return this.memory.read32(this.RP); // Read 32-bit value
  }

  reset() {
    this.IP = CODE;
  }

  /**
   * Reads the next 8-bit value from memory and increments the instruction pointer.
   */
  next8(): number {
    const value = this.memory.read8(this.IP); // Read 8-bit value
    this.IP += 1; // Move instruction pointer by 1 byte
    return value;
  }

  /**
   * Reads the next 16-bit value from memory and increments the instruction pointer.
   */
  next16(): number {
    const value = this.memory.read16(this.IP); // Read 16-bit value
    this.IP += 2; // Move instruction pointer by 2 bytes
    return value;
  }

  /**
   * Reads the next 32-bit value from memory and increments the instruction pointer.
   */
  next32(): number {
    const value = this.memory.read32(this.IP); // Read 32-bit value
    this.IP += 4; // Move instruction pointer by 4 bytes
    return value;
  }

  /**
   * Reads the next 32-bit float from memory and increments the instruction pointer.
   */
  nextFloat(): number {
    const value = this.memory.readFloat(this.IP); // Read 32-bit float
    this.IP += 4; // Move instruction pointer by 4 bytes
    return value;
  }

  /**
   * Returns the current stack data as an array of 32-bit values.
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = STACK; i < this.SP; i += 4) {
      stackData.push(this.memory.read32(i)); // Read 32-bit values
    }
    return stackData;
  }
}
