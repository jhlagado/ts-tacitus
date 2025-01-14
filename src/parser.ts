import { Op, opTable } from "./builtins";
import { vm } from "./globalState";

export function parse(tokens: (string | number)[]): void {
  vm.compiler.compileMode = false;
  vm.compiler.reset();
  for (const token of tokens) {
    if (vm.debug) console.log("token", token);

    if (typeof token === "number") {
      vm.compiler.compile(Op.LiteralNumber);
      vm.compiler.compile(token);
    } else if (token === "{") {
      vm.compiler.preserve = true;
      vm.compiler.nestingScore++;
      vm.compiler.compileMode = true;
      vm.compiler.compile(Op.BranchCall);
      vm.push(vm.compiler.getPointer()); // Push the current address for later patching
      vm.compiler.compile(0); // Placeholder for the relative offset
    } else if (token === "}") {
      if (!vm.compiler.compileMode) {
        throw new Error("Unexpected '}' outside compilation mode");
      }
      vm.compiler.compile(Op.Exit);
      const branchAddress = vm.pop(); // Get the address of the branch instruction
      const endAddress = vm.compiler.getPointer();
      const offset = endAddress - (branchAddress + 1); // Calculate the relative offset
      vm.compiler.setPointer(branchAddress); // Move to the offset location
      vm.compiler.compile(offset); // Write the relative offset
      vm.compiler.setPointer(endAddress); // Restore the pointer
      vm.compiler.nestingScore--;
      if (vm.compiler.nestingScore === 0) {
        vm.compiler.compileMode = false;
      }
    } else {
      // Look up the word in the opTable
      const opcode = opTable[token as keyof typeof Op];
      if (opcode === undefined) {
        throw new Error(`Unknown word: ${token}`);
      }
      vm.compiler.compile(opcode);
    }
  }
  vm.compiler.compile(Op.Exit);
}
