import { CODE, BUFFER } from "./constants";
import { VM } from "./vm";

export class Compiler {
  compileMode: boolean;
  parseMode: boolean;
  nestingScore: number;
  private CP: number; // Compiler pointer (CODE mode)
  private BP: number; // Buffer pointer (BUFFER mode)

  constructor(private vm: VM) {
    this.compileMode = false;
    this.parseMode = false;
    this.nestingScore = 0;
    this.CP = CODE;
    this.BP = BUFFER;
  }

  /**
   * Returns the current pointer based on parseMode.
   * @returns CP if not in parseMode, BP otherwise.
   */
  getPointer(): number {
    return this.parseMode ? this.BP : this.CP;
  }

  /**
   * Sets the current pointer based on parseMode.
   * @param value - The value to set the pointer to.
   */
  setPointer(value: number): void {
    if (this.parseMode) {
      this.BP = value;
    } else {
      this.CP = value;
    }
  }

  /**
   * Resets the current pointer to its initial value based on parseMode.
   */
  reset(): void {
    if (this.parseMode) {
      this.BP = BUFFER;
    } else {
      this.CP = CODE;
    }
  }

  /**
   * Compiles a value to the appropriate memory region based on parseMode.
   * @param data - The value to compile.
   */
  compile(data: number): void {
    if (this.parseMode) {
      this.vm.mem.data[this.BP++] = data;
    } else {
      this.vm.mem.data[this.CP++] = data;
    }
  }

  /**
   * Returns the compiled data from the appropriate memory region based on parseMode.
   * @returns An array of compiled data.
   */
  getData(): number[] {
    const start = this.parseMode ? BUFFER : CODE;
    const end = this.parseMode ? this.BP : this.CP;
    return this.vm.mem.data.slice(start, end);
  }
}
