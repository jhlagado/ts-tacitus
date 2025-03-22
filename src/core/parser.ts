import { Op } from "../ops/builtins";
import { vm } from "./globalState";
import { Token, Tokenizer, TokenType } from "./tokenizer";

export interface Definition {
  name: string;
  branchPos: number;
}

export function parse(tokenizer: Tokenizer): void {
  vm.compiler.reset();
  let currentDefinition: Definition | null = null;
  let insideCodeBlock = false; // Add a flag to track if we're inside a code block

  function parseBlock(): void {
    const wasInsideCodeBlock = insideCodeBlock;
    insideCodeBlock = true; // Mark that we're inside a code block

    // Compile branch instruction to call block
    vm.compiler.compile8(Op.BranchCall);
    const branchPos = vm.compiler.CP;
    vm.compiler.compile16(0); // Will be patched later

    // Parse tokens inside block
    while (true) {
      const blockToken = tokenizer.nextToken();

      if (blockToken.type === TokenType.EOF) {
        throw new Error("Unclosed code block");
      }

      if (blockToken.type === TokenType.SPECIAL && blockToken.value === ")") {
        // End of block
        break;
      }

      // Process token
      processToken(blockToken);
    }

    // Compile exit instruction
    vm.compiler.compile8(Op.Exit);

    // Patch branch offset
    const endAddress = vm.compiler.CP;
    const branchOffset = endAddress - (branchPos + 2);

    const prevCP = vm.compiler.CP;
    vm.compiler.CP = branchPos;
    vm.compiler.compile16(branchOffset);
    vm.compiler.CP = prevCP;

    insideCodeBlock = wasInsideCodeBlock; // Restore previous state
  }

  function processSpecialToken(value: string): void {
    if (value === ":") {
      // Check if we're inside a code block
      if (insideCodeBlock) {
        throw new Error("Cannot nest definition inside code block");
      }

      // Colon definition
      if (currentDefinition) {
        throw new Error("Nested definitions are not allowed");
      }

      // Rest of colon definition handling...
      const nameToken = tokenizer.nextToken();
      if (
        nameToken.type !== TokenType.WORD &&
        nameToken.type !== TokenType.NUMBER
      ) {
        throw new Error(`Expected word name after :`);
      }

      // Convert nameToken.value to string if it's a number
      const wordName = String(nameToken.value);

      // Check if word already exists
      if (vm.symbolTable.find(wordName) !== undefined) {
        throw new Error(`Word already defined: ${wordName}`);
      }

      // Compile branch instruction to skip definition
      vm.compiler.compile8(Op.Branch);
      const branchPos = vm.compiler.CP;
      vm.compiler.compile16(0); // Will be patched later

      // Register word in symbol table
      const startAddress = vm.compiler.CP;
      vm.symbolTable.defineCall(wordName, startAddress);

      // Store current definition
      currentDefinition = {
        name: wordName,
        branchPos,
      };

      // Mark for preservation
      vm.compiler.preserve = true;
    } else if (value === ";") {
      // End definition
      if (!currentDefinition) {
        throw new Error("Unexpected semicolon");
      }

      // Compile exit instruction
      vm.compiler.compile8(Op.Exit);

      // Patch branch offset
      const endAddress = vm.compiler.CP;
      const branchOffset = endAddress - (currentDefinition.branchPos + 2);

      const prevCP = vm.compiler.CP;
      vm.compiler.CP = currentDefinition.branchPos;
      vm.compiler.compile16(branchOffset);
      vm.compiler.CP = prevCP;

      currentDefinition = null;
    } else if (value === "(") {
      // Handle code block
      vm.compiler.preserve = true;
      vm.compiler.nestingScore++;
      parseBlock();
      vm.compiler.nestingScore--;
    } else if (value === ")") {
      // Handle unexpected closing parenthesis
      throw new Error("Unexpected closing parenthesis");
    }
  }

  function processToken(token: Token): void {
    switch (token.type) {
      case TokenType.NUMBER:
        vm.compiler.compile8(Op.LiteralNumber);
        vm.compiler.compileFloat(token.value as number);
        break;

      case TokenType.STRING:
        // Compile string literal opcode
        vm.compiler.compile8(Op.LiteralString);
        // Store the string in the digest
        const address = vm.digest.add(token.value as string);
        // Compile the address
        vm.compiler.compile16(address);
        break;

      case TokenType.SPECIAL:
        processSpecialToken(token.value as string);
        break;

      case TokenType.WORD:
        // Check if it's a special character that should be handled differently
        if (
          token.value === ":" ||
          token.value === ";" ||
          token.value === "(" ||
          token.value === ")"
        ) {
          processSpecialToken(token.value as string);
        } else {
          // Handle normal words
          const compile = vm.symbolTable.find(token.value as string);
          if (compile === undefined) {
            throw new Error(`Unknown word: ${token.value}`);
          }
          compile(vm);
        }
        break;
    }
  }

  // Main parsing loop
  while (true) {
    const token = tokenizer.nextToken();

    if (token.type === TokenType.EOF) {
      break;
    }

    processToken(token);
  }

  // Final validation
  if (currentDefinition) {
    if (currentDefinition) {
      throw new Error(
        `Unclosed definition for ${(currentDefinition as Definition).name}`
      );
    }
  }

  // Add Abort opcode at the end
  vm.compiler.compile8(Op.Abort);
}
