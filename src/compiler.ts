import { CODE } from "./constants";
import { VM } from "./vm";

export class Compiler {
  compileMode: boolean;
  nestingScore: number;
  CP: number; // Compile pointer (points to CODE area)
  BP: number; // Buffer pointer (points to start of CODE area)
  preserve: boolean;

  constructor(private vm: VM) {
    this.compileMode = false;
    this.nestingScore = 0;
    this.CP = CODE; // Start compiling at CODE
    this.BP = CODE; // Buffer starts at CODE
    this.preserve = false;
  }

  /**
   * Compiles a value to the CODE area.
   */
  compile(data: number): void {
    this.vm.mem.data[this.CP++] = data;
  }

  /**
   * Returns the compiled data from the CODE area.
   */
  getData(): number[] {
    return this.vm.mem.data.slice(this.BP, this.CP);
  }

  /**
   * Resets the compile pointer to the buffer pointer.
   */
  reset(): void {
    if (this.preserve) {
      this.BP = this.CP;
    } else {
      this.CP = this.BP;
    }
  }
}
