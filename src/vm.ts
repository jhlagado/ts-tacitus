import { Compiler } from "./compiler";
import { Dictionary } from "./dictionary";
import { Memory, STACK, RSTACK, STACK_SIZE, RSTACK_SIZE, CODE } from "./memory";
import { Heap } from "./heap";
import { TAG, fromTaggedPtr, toTaggedPtr } from "./tagged-ptr";

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
    this.dictionary = new Dictionary(this.memory);
    this.heap = new Heap(this.memory);
    this.debug = false;
    // this.debug = true;
  }

  /**
   * Pushes a 32-bit float onto the stack.
   */
  push(value: number): void {
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
  pop(): number {
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

  pushAddress(value: number): void {
    this.push(toTaggedPtr(TAG.ADDRESS, value));
  }

  popAddress(): number {
    const nPtr = this.pop();
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.ADDRESS) {
      throw new Error(`Expected an ADDRESS, got tag ${tag}`);
    }
    return pointer;
  }

  pushInteger(value: number): void {
    this.push(toTaggedPtr(TAG.INTEGER, value));
  }

  popInteger(): number {
    const nPtr = this.pop();
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.INTEGER) {
      throw new Error(`Expected an ADDRESS, got tag ${tag}`);
    }
    return pointer;
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
    this.memory.writeFloat(this.RP, value); // Write 32-bit value
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
    return this.memory.readFloat(this.RP); // Read 32-bit value
  }

  rpushAddress(value: number): void {
    this.rpush(toTaggedPtr(TAG.ADDRESS, value));
  }

  rpopAddress(): number {
    const nPtr = this.rpop();
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.ADDRESS) {
      throw new Error(`Expected an ADDRESS, got tag ${tag}`);
    }
    return pointer;
  }

  rpushInteger(value: number): void {
    this.rpush(toTaggedPtr(TAG.INTEGER, value));
  }

  rpopInteger(): number {
    const nPtr = this.rpop();
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.INTEGER) {
      throw new Error(`Expected an ADDRESS, got tag ${tag}`);
    }
    return pointer;
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
    // Read the 16-bit value from memory
    const unsignedValue = this.memory.read16(this.IP);

    // Interpret the 16-bit value as a signed integer
    const signedValue = (unsignedValue << 16) >> 16; // Sign-extend to 32 bits

    this.IP += 2; // Move instruction pointer by 2 bytes
    return signedValue;
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
   * Reads the next address (tagged as ADDRESS) from memory and increments the instruction pointer.
   */
  nextAddress(): number {
    const nPtr = this.nextFloat(); // Read the tagged pointer as a float
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.ADDRESS) {
      throw new Error(`Expected an ADDRESS, got tag ${tag}`);
    }
    return pointer;
  }

  /**
   * Reads the next integer (tagged as INTEGER) from memory and increments the instruction pointer.
   */
  nextInteger(): number {
    const nPtr = this.nextFloat(); // Read the tagged pointer as a float
    const { tag, pointer } = fromTaggedPtr(nPtr);
    if (tag !== TAG.INTEGER) {
      throw new Error(`Expected an INTEGER, got tag ${tag}`);
    }
    return pointer;
  }

  /**
   * Returns the current stack data as an array of 32-bit values.
   */
  getStackData(): number[] {
    const stackData: number[] = [];
    for (let i = STACK; i < this.SP; i += 4) {
      stackData.push(this.memory.readFloat(i));
    }
    return stackData;
  }

  getCompileData(): number[] {
    const compileData: number[] = [];
    for (let i = CODE; i < this.compiler.CP; i++) {
      compileData.push(this.memory.read8(i));
    }
    return compileData;
  }
}
