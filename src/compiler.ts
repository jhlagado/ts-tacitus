// src/compiler.ts
import { CODE, TIB } from "./constants";
import { VM } from "./vm";

export class Compiler {
  compileMode: boolean;
  nestingScore: number;
  CP: number; // Compiler pointer
  BP: number;

  constructor(private vm: VM) {
    this.compileMode = false;
    this.nestingScore = 0;
    this.CP = CODE; // Initialize CP to CODE
    this.BP = TIB; // Initialize CP to CODE
  }

  // Write a value to vm.mem.data at CP and increment CP
  compileCode(data: number): void {
    this.vm.mem.data[this.CP++] = data; // Write to vm.mem.data and increment CP
  }

  resetCode(): void {
    this.CP = CODE; // Reset CP to CODE
  }

  getCodeData() {
    return this.vm.mem.data.slice(CODE, this.CP);
  }

  compileBuffer(data: number): void {
    this.vm.mem.data[this.BP++] = data; // Write to vm.mem.data and increment CP
  }

  resetBuffer(): void {
    this.BP = TIB; // Reset CP to CODE
  }

  getBufferData() {
    return this.vm.mem.data.slice(TIB, this.BP);
  }
}
