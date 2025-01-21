import { Op, opcodes } from "./builtins";
import { vm } from "./globalState";

export function parse(tokens: (string | number)[]): void {
  vm.compiler.compileMode = false;
  vm.compiler.reset();
  for (const token of tokens) {
    if (vm.debug) console.log("token", token);

    if (typeof token === "number") {
      vm.compiler.compile8(Op.LiteralNumber);      
      vm.compiler.compileFloat(token); 
    } else if (token === "{") {
      vm.compiler.preserve = true;
      vm.compiler.nestingScore++;
      vm.compiler.compileMode = true;
      vm.compiler.compile8(Op.BranchCall);
      vm.push(vm.compiler.CP); // Push the current address for later patching
      vm.compiler.compile16(0); // Placeholder for the relative offset (signed integer)
    } else if (token === "}") {
      if (!vm.compiler.compileMode) {
        throw new Error("Unexpected '}' outside compilation mode");
      }
      vm.compiler.compile8(Op.Exit);
      const branchAddress = vm.pop(); // Get the address of the branch instruction
      const endAddress = vm.compiler.CP;
      const offset = endAddress - (branchAddress + 1); // Calculate the relative offset
      vm.compiler.CP = branchAddress; // Move to the offset location
      vm.compiler.compile16(offset); // Write the relative offset (signed integer)
      vm.compiler.CP = endAddress; // Restore the pointer
      vm.compiler.nestingScore--;
      if (vm.compiler.nestingScore === 0) {
        vm.compiler.compileMode = false;
      }
    } else {
      // Look up the word in the opTable
      const opcode = opcodes[token as keyof typeof Op];
      if (opcode === undefined) {
        throw new Error(`Unknown word: ${token}`);
      }
      vm.compiler.compile8(opcode);
    }
  }
  vm.compiler.compile8(Op.Abort);
}