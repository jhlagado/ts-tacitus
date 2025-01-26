import { Op } from "./builtins";
import { vm } from "./globalState";

export function parse(tokens: (string | number)[]): void {
  vm.compiler.reset();
  let i = 0;
  let currentDefinition: { name: string; branchPos: number } | null = null;

  while (i < tokens.length) {
    const token = tokens[i];
    i++;

    // Handle colon definitions
    if (token === ":") {
      if (vm.compiler.nestingScore > 0) {
        throw new Error("Cannot nest defintion inside code block");
      }

      if (currentDefinition) {
        throw new Error("Nested definitions are not allowed");
      }

      // Get and validate name
      const nameToken = tokens[i];
      if (typeof nameToken !== "string" || !/^[a-zA-Z_]\w*$/.test(nameToken)) {
        throw new Error(`Invalid definition name: ${String(nameToken)}`);
      }
      i++;

      // Compile branch to skip definition body
      vm.compiler.compile8(Op.Branch);
      const branchPos = vm.compiler.CP;
      vm.compiler.compile16(0); // Temporary placeholder offset

      // Get start address AFTER branch instruction
      const startAddress = vm.compiler.CP;

      // Immediately add to dictionary
      vm.dictionary.defineCall(nameToken, startAddress); // Jump directly to definition body

      // Store branch position for later patching
      currentDefinition = {
        name: nameToken,
        branchPos: branchPos,
      };
      continue;
    }

    // Handle semicolon
    if (token === ";") {
      if (!currentDefinition) {
        throw new Error("Unmatched ;");
      }

      // Compile exit operation
      vm.compiler.compile8(Op.Exit);

      // Calculate branch offset (from start of BranchOp instruction)
      const endAddress = vm.compiler.CP;
      const branchOffset = endAddress - (currentDefinition.branchPos + 2);

      // Patch branch offset
      const prevCP = vm.compiler.CP;
      vm.compiler.CP = currentDefinition.branchPos;
      vm.compiler.compile16(branchOffset);
      vm.compiler.CP = prevCP;

      currentDefinition = null;
      continue;
    }

    // Existing token handling
    if (typeof token === "number") {
      vm.compiler.compile8(Op.LiteralNumber);
      vm.compiler.compileFloat(token);
    } else if (token === "{") {
      vm.compiler.preserve = true;
      vm.compiler.nestingScore++;
      vm.compiler.compile8(Op.BranchCall);
      vm.push(vm.compiler.CP);
      vm.compiler.compile16(0);
    } else if (token === "}") {
      if (vm.compiler.nestingScore === 0) {
        throw new Error("Unexpected '}'");
      }
      vm.compiler.compile8(Op.Exit);
      const branchAddress = vm.pop();
      const endAddress = vm.compiler.CP;
      const offset = endAddress - (branchAddress + 2);
      vm.compiler.CP = branchAddress;
      vm.compiler.compile16(offset);
      vm.compiler.CP = endAddress;
      vm.compiler.nestingScore--;
    } else {
      const compile = vm.dictionary.find(token);
      if (compile === undefined) {
        throw new Error(`Unknown word: ${token}`);
      }
      compile(vm);
    }
  }

  if (currentDefinition) {
    throw new Error(`Unclosed definition for ${currentDefinition.name}`);
  }
  vm.compiler.compile8(Op.Abort);
}
