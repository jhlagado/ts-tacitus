import { Compiler } from "./compiler";
import { Dictionary } from "./dictionary";
import { STACK, RSTACK, STACK_SIZE, RSTACK_SIZE, CODE, MEMORY_SIZE } from "./constants";
import { Heap } from "./heap";

export class VM {
  memory: number[];
  SP: number;
  RP: number;
  IP: number;
  running: boolean;
  compiler: Compiler;
  dictionary: Dictionary;
  debug: boolean;
  heap: Heap; // Add Heap instance
  
  constructor() {
    this.memory = new Array(MEMORY_SIZE).fill(0);
    this.IP = CODE; // Start execution at CODE
    this.running = true;
    this.SP = STACK;
    this.RP = RSTACK;
    this.compiler = new Compiler(this);
    this.dictionary = new Dictionary();
    this.heap = new Heap(this.memory);
    this.debug = false;
  }

  /**
   * Pushes a value onto the stack.
   * @param value - The value to push.
   */
  push(value: number): void {
    if (this.SP >= STACK + STACK_SIZE) {
      throw new Error("Stack overflow");
    }
    this.memory[this.SP++] = value;
  }

  /**
   * Pops a value from the stack.
   * @returns The popped value.
   */
  pop(): number {
    if (this.SP <= STACK) {
      throw new Error("Stack underflow");
    }
    return this.memory[--this.SP];
  }

  /**
   * Pushes a value onto the return stack.
   * @param value - The value to push.
   */
  rpush(value: number): void {
    if (this.RP >= RSTACK + RSTACK_SIZE) {
      throw new Error("Return stack overflow");
    }
    this.memory[this.RP++] = value;
  }

  /**
   * Pops a value from the return stack.
   * @returns The popped value.
   */
  rpop(): number {
    if (this.RP <= RSTACK) {
      throw new Error("Return stack underflow");
    }
    return this.memory[--this.RP];
  }

  /**
   * Reads the next value from memory and increments the instruction pointer.
   * @returns The next value.
   */
  next(): number {
    return this.memory[this.IP++];
  }

  /**
   * Returns the current stack data.
   * @returns An array of stack values.
   */
  getStackData(): number[] {
    return this.memory.slice(STACK, this.SP);
  }
}
