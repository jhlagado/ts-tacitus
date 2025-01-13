import { initMemory } from "./memory";
import { Compiler } from "./compiler";
import { Dictionary } from "./dictionary";
import { Memory } from "./types";
import { TIB, STACK, RSTACK, STACK_SIZE, RSTACK_SIZE } from "./constants";

/**
 * Virtual Machine (VM) for executing Forth-like code.
 */
export class VM {
  mem: Memory;
  SP: number;
  RP: number;
  IP: number;
  running: boolean;
  compiler: Compiler;
  dictionary: Dictionary;

  constructor() {
    this.mem = initMemory();
    this.IP = TIB;
    this.running = true;
    this.SP = STACK;
    this.RP = RSTACK;
    this.compiler = new Compiler(this);
    this.dictionary = new Dictionary();
  }

  /**
   * Pushes a value onto the stack.
   * @param value - The value to push.
   */
  push(value: number): void {
    if (this.SP >= STACK + STACK_SIZE) {
      throw new Error("Stack overflow");
    }
    this.mem.data[this.SP++] = value;
  }

  /**
   * Pops a value from the stack.
   * @returns The popped value.
   */
  pop(): number {
    if (this.SP <= STACK) {
      throw new Error("Stack underflow");
    }
    return this.mem.data[--this.SP];
  }

  /**
   * Pushes a value onto the return stack.
   * @param value - The value to push.
   */
  rpush(value: number): void {
    if (this.RP >= RSTACK + RSTACK_SIZE) {
      throw new Error("Return stack overflow");
    }
    this.mem.data[this.RP++] = value;
  }

  /**
   * Pops a value from the return stack.
   * @returns The popped value.
   */
  rpop(): number {
    if (this.RP <= RSTACK) {
      throw new Error("Return stack underflow");
    }
    return this.mem.data[--this.RP];
  }

  /**
   * Reads the next value from memory and increments the instruction pointer.
   * @returns The next value.
   */
  next(): number {
    return this.mem.data[this.IP++];
  }

  /**
   * Returns the current stack data.
   * @returns An array of stack values.
   */
  getStackData(): number[] {
    return this.mem.data.slice(STACK, this.SP);
  }
}
