import { allot, createHeap, mark, pop, push, next, reset, getItems } from "./memory";
import { Compiler } from "./compiler";
import { Ref, Cell } from "./types";

export class VM {
  heap: Ref;
  stack: Ref;
  rstack: Ref;
  buffer: Ref;
  IP: Ref;
  running: boolean;
  compiler: Compiler; // Add a Compiler instance

  constructor() {
    this.heap = createHeap(10000);
    this.stack = allot(this.heap, 100);
    this.rstack = allot(this.heap, 100);
    this.buffer = allot(this.heap, 100);
    this.IP = mark(this.heap);
    this.running = true;

    // Initialize the Compiler
    const compileBuffer = allot(this.heap, 100);
    this.compiler = new Compiler(compileBuffer);
  }

  // Stack operations
  push(value: Cell): void {
    push(this.stack, value);
  }

  pop(): Cell {
    return pop(this.stack);
  }

  // Return stack operations
  rpush(value: Cell): void {
    push(this.rstack, value);
  }

  rpop(): Cell {
    return pop(this.rstack);
  }

  // Instruction pointer operations
  next(): Cell {
    return next(this.IP);
  }

  // Reset the buffer
  resetBuffer(): void {
    reset(this.buffer);
  }

  // Get items from the stack
  getStackItems(): Cell[] {
    return getItems(this.stack);
  }
}