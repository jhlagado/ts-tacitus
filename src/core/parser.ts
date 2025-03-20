import { Op } from "../ops/builtins";
import { vm } from "./globalState";
import { stringCreate } from "../data/string";
import { Tokenizer, TokenType } from "./tokenizer";

export interface Definition {
  name: string;
  branchPos: number;
}

export function parse(tokenizer: Tokenizer): void {
  vm.compiler.reset();
  let currentDefinition: Definition | null = null;

  while (true) {
    const token = tokenizer.nextToken();

    if (token.type === TokenType.EOF) {
      break;
    }

    switch (token.type) {
      case TokenType.STRING:
        // Handle string literals
        const stringValue = stringCreate(vm.digest, token.value as string);
        vm.compiler.compile8(Op.LiteralNumber);
        vm.compiler.compileFloat(stringValue);
        break;

      case TokenType.NUMBER:
        // Handle numbers
        vm.compiler.compile8(Op.LiteralNumber);
        vm.compiler.compileFloat(token.value as number);
        break;

      case TokenType.SPECIAL:
        // Handle special characters and update definition state
        currentDefinition = handleSpecialToken(
          token.value as string,
          tokenizer,
          currentDefinition
        );
        break;

      case TokenType.WORD:
        // Handle words (identifiers)
        const compile = vm.symbolTable.find(token.value as string);
        if (compile === undefined) {
          throw new Error(`Unknown word: ${token.value}`);
        }
        compile(vm);
        break;
    }
  }

  // Check for unclosed structures
  if (currentDefinition) {
    throw new Error(`Unfinished definition: ${currentDefinition.name}`);
  }
}

function handleSpecialToken(
  value: string,
  tokenizer: Tokenizer,
  currentDefinition: Definition | null
): Definition | null {
  switch (value) {
    case ":": {
      // Get word name
      const nameToken = tokenizer.nextToken();
      if (nameToken.type !== TokenType.WORD) {
        throw new Error("Expected word name after :");
      }

      // Check for redefinition
      if (vm.symbolTable.find(nameToken.value as string) !== undefined) {
        throw new Error(`Word already defined: ${nameToken.value}`);
      }

      // Compile branch to skip definition
      vm.compiler.compile8(Op.Branch);
      const branchPos = vm.compiler.CP;
      vm.compiler.compile16(0); // Placeholder offset

      // Set up the definition
      const startAddress = vm.compiler.CP;
      vm.symbolTable.defineCall(nameToken.value as string, startAddress);

      // Mark for preservation
      vm.compiler.preserve = true;

      // Return new definition state
      return { name: nameToken.value as string, branchPos };
    }

    case ";": {
      if (!currentDefinition) {
        throw new Error("Unexpected ;");
      }

      // End the definition
      vm.compiler.compile8(Op.Exit);

      // Update branch offset
      const endAddress = vm.compiler.CP;
      const branchOffset = endAddress - (currentDefinition.branchPos + 2);

      // Save current CP, update branch offset, restore CP
      const prevCP = vm.compiler.CP;
      vm.compiler.CP = currentDefinition.branchPos;
      vm.compiler.compile16(branchOffset);
      vm.compiler.CP = prevCP;

      // Return null to indicate definition ended
      return null;
    }

    case "(": {
      // Handle code block
      vm.compiler.preserve = true;
      vm.compiler.nestingScore++;

      // Skip the block with a branch
      vm.compiler.compile8(Op.Branch);
      const blockBranchPos = vm.compiler.CP;
      vm.compiler.compile16(0); // Placeholder offset

      // Process tokens inside the block
      let blockDepth = 1;
      while (blockDepth > 0) {
        const blockToken = tokenizer.nextToken();

        if (blockToken.type === TokenType.EOF) {
          throw new Error("Unclosed block");
        }

        if (blockToken.type === TokenType.SPECIAL && blockToken.value === "(") {
          blockDepth++;
        } else if (
          blockToken.type === TokenType.SPECIAL &&
          blockToken.value === ")"
        ) {
          blockDepth--;
          if (blockDepth === 0) break;
        }

        // Process the token within the block
        // (We'll need a more comprehensive solution for this part)
        // For now, we'll just continue reading tokens
      }

      // Fix up the branch offset
      const blockEndPos = vm.compiler.CP;
      const blockBranchOffset = blockEndPos - (blockBranchPos + 2);
      vm.compiler.CP = blockBranchPos;
      vm.compiler.compile16(blockBranchOffset);
      vm.compiler.CP = blockEndPos;

      // Definition status is unchanged
      return currentDefinition;
    }

    case ")":
      throw new Error("Unexpected )");

    default:
      // Other special tokens don't affect definition state
      return currentDefinition;
  }
}
