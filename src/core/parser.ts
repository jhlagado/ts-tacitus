import { Op } from "../ops/builtins";
import { vm } from "./globalState";

export function parse(tokens: (string | number)[]): void {
  vm.compiler.reset();
  let i = 0;
  let currentDefinition: { name: string; branchPos: number } | null = null;

  while (i < tokens.length) {
    const token = tokens[i];
    i++;

    if (token === ":") {
      if (vm.compiler.nestingScore > 0) {
        throw new Error("Cannot nest definition inside code block");
      }

      if (currentDefinition) {
        throw new Error("Nested definitions are not allowed");
      }

      const nameToken = tokens[i];
      if (typeof nameToken !== "string") {
        throw new Error(`Invalid definition name: ${String(nameToken)}`);
      }
      i++;

      // Add this check to prevent redefinition
      if (vm.symbolTable.find(nameToken) !== undefined) {
        throw new Error(`Word already defined: ${nameToken}`);
      }

      vm.compiler.compile8(Op.Branch);
      const branchPos = vm.compiler.CP;
      vm.compiler.compile16(0);

      const startAddress = vm.compiler.CP;

      vm.symbolTable.defineCall(nameToken, startAddress);

      currentDefinition = {
        name: nameToken,
        branchPos: branchPos,
      };
      vm.compiler.preserve = true; // Add this line to preserve definitions
      continue;
    }

    if (token === ";") {
      if (!currentDefinition) {
        throw new Error("Unmatched ;");
      }

      vm.compiler.compile8(Op.Exit);

      const endAddress = vm.compiler.CP;
      const branchOffset = endAddress - (currentDefinition.branchPos + 2);

      const prevCP = vm.compiler.CP;
      vm.compiler.CP = currentDefinition.branchPos;
      vm.compiler.compile16(branchOffset);
      vm.compiler.CP = prevCP;

      currentDefinition = null;
      continue;
    }

    if (typeof token === "number") {
      vm.compiler.compile8(Op.LiteralNumber);
      vm.compiler.compileFloat(token);
    } else if (token === "(") {
      vm.compiler.preserve = true;
      vm.compiler.nestingScore++;
      vm.compiler.compile8(Op.BranchCall);
      vm.push(vm.compiler.CP);
      vm.compiler.compile16(0);
    } else if (token === ")") {
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
      const compile = vm.symbolTable.find(token);
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
