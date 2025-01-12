import { push, reset } from "./memory";
import { builtins } from "./builtins";
import { Dictionary, Ref, Verb } from "./types";
import { define } from "./dictionary";

export class Compiler {
  compileMode: boolean;
  nestingScore: number;
  compileBuffer: Ref;
  dictionary: Dictionary<Verb>; // Add dictionary

  constructor(compileBuffer: Ref) {
    this.compileMode = false;
    this.nestingScore = 0;
    this.compileBuffer = compileBuffer;

    // Initialize the dictionary with built-ins
    this.dictionary = {};
    for (const [name, word] of Object.entries(builtins)) {
      define(this.dictionary, name, word);
    }
  }

  // Write a value to the compile buffer
  compile(dest: Ref, data: Verb | number): void {
    push(dest, data);
  }

  // Reset the compile buffer
  reset(): void {
    reset(this.compileBuffer);
  }

  // Enter compilation mode
  enterCompilationMode(): void {
    this.compileMode = true;
    this.reset();
  }

  // Exit compilation mode
  exitCompilationMode(): void {
    this.compileMode = false;
  }
}
