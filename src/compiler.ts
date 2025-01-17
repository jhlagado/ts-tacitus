import { CODE } from "./memory";
import { VM } from "./vm";

export class Compiler {
  compileMode: boolean;
  nestingScore: number;
  CP: number; // Compile pointer (points to CODE area, 16-bit address)
  BP: number; // Buffer pointer (points to start of CODE area, 16-bit address)
  preserve: boolean;

  constructor(private vm: VM) {
    this.compileMode = false;
    this.nestingScore = 0;
    this.CP = CODE; // Start compiling at CODE
    this.BP = CODE; // Buffer starts at CODE
    this.preserve = false;
  }

  /**
   * Compiles an 8-bit value to the CODE area.
   */
  compile8(value: number): void {
    this.vm.memory.write8(this.CP, value);
    this.CP += 1; // Move to the next byte
  }

  /**
   * Compiles a 16-bit value to the CODE area.
   */
  compile16(value: number): void {
    this.vm.memory.write16(this.CP, value);
    this.CP += 2; // Move to the next 16-bit aligned address
  }

  /**
   * Compiles a 32-bit value to the CODE area.
   */
  compile32(value: number): void {
    this.vm.memory.write32(this.CP, value);
    this.CP += 4; // Move to the next 32-bit aligned address
  }

  /**
   * Compiles a 32-bit value to the CODE area.
   */
  compileFloat(value: number): void {
    this.vm.memory.writeFloat(this.CP, value);
    this.CP += 4; // Move to the next 32-bit aligned address
  }

  /**
   * Returns the compiled data from the CODE area.
   */
//   getData(): number[] {
//     const data: number[] = [];
//     for (let i = this.BP; i < this.CP; i++) {
//       data.push(this.vm.memory.read8(i)); // Read 8-bit values
//     }
//     return data;
//   }

  /**
   * Resets the compile pointer to the buffer pointer.
   */
  reset(): void {
    if (this.preserve) {
      this.BP = this.CP; // Preserve the compiled code
    } else {
      this.CP = this.BP; // Reuse the memory
    }
  }
}
