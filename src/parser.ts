// src/parser.ts
import { vm } from "./globalState";
import { Op, opTable } from "./builtins"; // Import Op enum and TIB constant

export function parse(tokens: (string | number)[]) {
  vm.compiler.resetBuffer();
  vm.compiler.compileMode = false;
  for (const token of tokens) {
    if (typeof token === "number") {
      // Compile a literal number
      const num = token;
      vm.compiler.compileBuffer(Op.LiteralNumber); // Use Op enum
      vm.compiler.compileBuffer(num);
    } else {
      // Look up the word in the Op enum
      const opcode = opTable[token as keyof typeof Op]; // Get the verb index from Op enum
      if (opcode === undefined) {
        throw new Error(`Unknown word: ${token}`);
      }
      vm.compiler.compileBuffer(opcode); // Compile the verb index
    }
  }
  vm.compiler.compileBuffer(Op.ExitDef); // Use Op enum
}
