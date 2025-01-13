// src/vm.ts
import { initMemory } from "./memory";
import { Compiler } from "./compiler";
import { Dictionary } from "./dictionary";
import { Memory } from "./types";
import { TIB, STACK, RSTACK, STACK_SIZE, RSTACK_SIZE } from "./constants";

export class VM {
  mem: Memory; // Memory array
  SP: number; // Stack pointer
  RP: number; // Return stack pointer
  IP: number;
  running: boolean;
  compiler: Compiler;
  dictionary: Dictionary;

  constructor() {
    this.mem = initMemory(); // Initialize memory
    this.IP = TIB; // Use vm.mem.data for instruction pointer
    this.running = true;

    // Initialize stack and return stack pointers
    this.SP = STACK;
    this.RP = RSTACK;

    // Initialize the Compiler
    this.compiler = new Compiler(this); // Pass VM instance to Compiler

    // Initialize the Dictionary
    this.dictionary = new Dictionary();
  }

  // Stack operations
  push(value: number): void {
    if (this.SP >= STACK + STACK_SIZE) {
      throw new Error("Stack overflow");
    }
    this.mem.data[this.SP++] = value; // Push value and increment SP
  }

  pop(): number {
    if (this.SP <= STACK) {
      throw new Error("Stack underflow");
    }
    return this.mem.data[--this.SP]; // Decrement SP and return value
  }

  // Return stack operations
  rpush(value: number): void {
    if (this.RP >= RSTACK + RSTACK_SIZE) {
      throw new Error("Return stack overflow");
    }
    this.mem.data[this.RP++] = value; // Push value and increment RP
  }

  rpop(): number {
    if (this.RP <= RSTACK) {
      throw new Error("Return stack underflow");
    }
    return this.mem.data[--this.RP]; // Decrement RP and return value
  }

  // Instruction pointer operations
  next(): number {
    return this.mem.data[this.IP++];
  }

  // Get items from the stack
  getStackData(): number[] {
    return this.mem.data.slice(STACK, this.SP);
  }
}
