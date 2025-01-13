import { CODE, BUFFER } from "./constants";
import { VM } from "./vm";

/**
 * Compiler for translating tokens into executable code.
 */
export class Compiler {
  compileMode: boolean;
  nestingScore: number;
  CP: number;
  BP: number;

  constructor(private vm: VM) {
    this.compileMode = false;
    this.nestingScore = 0;
    this.CP = CODE;
    this.BP = BUFFER;
  }

  /**
   * Writes a value to memory at the compiler pointer (CP) and increments CP.
   * @param data - The value to write.
   */
  compileCode(data: number): void {
    this.vm.mem.data[this.CP++] = data;
  }

  /**
   * Resets the compiler pointer to the start of the code area.
   */
  resetCode(): void {
    this.CP = CODE;
  }

  /**
   * Returns the compiled code data.
   * @returns An array of compiled code.
   */
  getCodeData() {
    return this.vm.mem.data.slice(CODE, this.CP);
  }

  /**
   * Writes a value to memory at the buffer pointer (BP) and increments BP.
   * @param data - The value to write.
   */
  compileBuffer(data: number): void {
    this.vm.mem.data[this.BP++] = data;
  }

  /**
   * Resets the buffer pointer to the start of the terminal input buffer.
   */
  resetBuffer(): void {
    this.BP = BUFFER;
  }

  /**
   * Returns the buffer data.
   * @returns An array of buffer values.
   */
  getBufferData() {
    return this.vm.mem.data.slice(BUFFER, this.BP);
  }
}
