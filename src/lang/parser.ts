/**
 * @file src/lang/parser.ts
 * 
 * This file implements the parser for the Tacit language.
 * 
 * The parser processes tokens from the tokenizer and generates bytecode for the VM.
 * It handles language constructs such as word definitions, control structures,
 * literals, and lists. The parser maintains state during compilation and ensures
 * proper nesting of language constructs.
 * 
 * The parser is responsible for:
 * - Converting tokens into VM opcodes
 * - Managing word definitions and symbol table entries
 * - Handling control flow structures like IF/ELSE
 * - Compiling literals (numbers, strings, symbols)
 * - Managing list construction
 * - Validating syntax and reporting errors
 */

import { Op } from '../ops/opcodes';
import { vm } from '../core/globalState';
import { Token, Tokenizer, TokenType } from './tokenizer';
import { isWhitespace, isGroupingChar } from '../core/utils';
import { toTaggedValue, Tag } from '../core/tagged';
import {
  UnclosedDefinitionError,
  UndefinedWordError,
  SyntaxError,
  NestedDefinitionError,
  WordAlreadyDefinedError,
  UnexpectedTokenError,
} from '../core/errors';

/**
 * Represents a word definition in the Tacit language.
 * 
 * During compilation, word definitions are tracked to ensure proper
 * structure and to patch branch offsets when the definition is complete.
 * 
 * @property {string} name - The name of the defined word
 * @property {number} branchPos - Position in bytecode where branch offset needs to be patched
 */
export interface Definition {
  name: string;
  branchPos: number;
}

/**
 * Maintains the state of the parser during compilation.
 * 
 * The parser state tracks the current tokenizer, any active word definition,
 * whether we're inside a code block, and the next available function index
 * for user-defined words.
 * 
 * @property {Tokenizer} tokenizer - The tokenizer providing input tokens
 * @property {Definition | null} currentDefinition - The currently active word definition, if any
 * @property {boolean} insideCodeBlock - Whether parsing is currently inside a code block
 * @property {number} nextFunctionIndex - The next available index for user-defined functions
 */
interface ParserState {
  tokenizer: Tokenizer;
  currentDefinition: Definition | null;
  insideCodeBlock: boolean;
  nextFunctionIndex: number;
}

/**
 * Main parse function - entry point for parsing Tacit code.
 * 
 * This function initializes the parser state, processes the entire program,
 * validates the final state, and adds an abort instruction at the end.
 * 
 * @param {Tokenizer} tokenizer - The tokenizer that provides the stream of tokens to parse
 */
export function parse(tokenizer: Tokenizer): void {
  // Reset the compiler state
  vm.compiler.reset();
  
  // Initialize parser state
  const state: ParserState = {
    tokenizer,
    currentDefinition: null,
    insideCodeBlock: false,
    nextFunctionIndex: 128, // Start user-defined words at index 128
  };

  // Process the entire program
  parseProgram(state);
  
  // Ensure all definitions are properly closed
  validateFinalState(state);
  
  // Add an abort instruction at the end to stop execution
  vm.compiler.compileOpcode(Op.Abort);
}

/**
 * Parse the entire program by processing tokens until EOF.
 * 
 * This function reads tokens one by one from the tokenizer and processes
 * each token until the end of the input is reached.
 * 
 * @param {ParserState} state - The current parser state
 */
function parseProgram(state: ParserState): void {
  while (true) {
    const token = state.tokenizer.nextToken();
    if (token.type === TokenType.EOF) {
      break;
    }

    processToken(token, state);
  }
}

/**
 * Validate the final state after parsing to ensure all constructs are properly closed.
 * 
 * This function checks that there are no unclosed definitions at the end of parsing.
 * If an unclosed definition is found, an error is thrown.
 * 
 * @param {ParserState} state - The current parser state
 * @throws {Error} If there are any unclosed definitions
 */
function validateFinalState(state: ParserState): void {
  if (state.currentDefinition) {
    throw new UnclosedDefinitionError(state.currentDefinition.name, vm.getStackData());
  }
}

/**
 * Process a token based on its type and generate appropriate bytecode.
 * 
 * This function dispatches to different handlers based on the token type:
 * - Numbers are compiled as numeric literals
 * - Strings are compiled as string literals
 * - Special tokens (like :, ;, etc.) are processed by their specific handlers
 * - Words are processed as function calls or language constructs
 * - Word quotes are compiled as address literals
 * 
 * @param {Token} token - The token to process
 * @param {ParserState} state - The current parser state
 * @throws {Error} If a quoted word is undefined
 */
function processToken(token: Token, state: ParserState): void {
  switch (token.type) {
    case TokenType.NUMBER:
      compileNumberLiteral(token.value as number);
      break;
    case TokenType.STRING:
      compileStringLiteral(token.value as string);
      break;
    case TokenType.SPECIAL:
      processSpecialToken(token.value as string, state);
      break;
    case TokenType.WORD:
      processWordToken(token.value as string, state);
      break;
    case TokenType.WORD_QUOTE:
      // Handle word quotes (symbol literals prefixed with `)
      const wordName = token.value as string;
      const address = vm.symbolTable.find(wordName) as number | undefined;
      if (address === undefined) {
        throw new UndefinedWordError(wordName, vm.getStackData());
      }

      // Compile as a literal address
      vm.compiler.compileOpcode(Op.LiteralAddress);
      vm.compiler.compile16(address);
      break;
  }
}

/**
 * Compile a number literal into bytecode.
 * 
 * This function generates the bytecode for pushing a numeric literal onto the stack.
 * It compiles the LiteralNumber opcode followed by the 32-bit floating point value.
 * 
 * @param {number} value - The numeric value to compile
 */
function compileNumberLiteral(value: number): void {
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(value);
}

/**
 * Compile a string literal into bytecode.
 * 
 * This function generates the bytecode for pushing a string literal onto the stack.
 * It adds the string to the VM's digest (string table) and compiles the LiteralString
 * opcode followed by the 16-bit address of the string in the digest.
 * 
 * @param {string} value - The string value to compile
 */
function compileStringLiteral(value: string): void {
  vm.compiler.compileOpcode(Op.LiteralString);
  const address = vm.digest.add(value);
  vm.compiler.compile16(address);
}

/**
 * Process a word token and generate appropriate bytecode.
 * 
 * This function handles special language keywords (like IF/ELSE) and regular word calls.
 * For IF/ELSE constructs, it generates the appropriate conditional branching bytecode.
 * For regular words, it looks up the word in the symbol table and compiles a call to it.
 * 
 * @param {string} value - The word token value to process
 * @param {ParserState} state - The current parser state
 * @throws {Error} If a block is expected but not found, or if a word is undefined
 */
function processWordToken(value: string, state: ParserState): void {
  // Handle IF/ELSE control structure
  if (value === 'IF') {
    console.log(`Parsing IF statement at CP=${vm.compiler.CP}`);
    
    // Compile conditional branch for the IF condition
    const falseJumpAddr = vm.compiler.CP;
    vm.compiler.compileOpcode(Op.IfFalseBranch);
    const jumpOffsetAddr = vm.compiler.CP;
    vm.compiler.compile16(0); // Placeholder for jump offset, will be patched later
    
    // Expect and parse the THEN block
    const thenToken = state.tokenizer.nextToken();
    if (thenToken.type !== TokenType.BLOCK_START) {
      throw new SyntaxError('Expected { for then-block in IF statement', vm.getStackData());
    }

    parseCurlyBlock(state);
    const endOfThen = vm.compiler.CP;
    
    // Check for optional ELSE block
    const next = state.tokenizer.peekToken();
    if (next && next.value === 'ELSE') {
      state.tokenizer.nextToken();
      
      // Compile unconditional branch to skip the ELSE block when the IF condition is true
      const elseJumpAddr = vm.compiler.CP;
      vm.compiler.compileOpcode(Op.Branch);
      const elseJumpOffsetAddr = vm.compiler.CP;
      vm.compiler.compile16(0); // Placeholder for jump offset, will be patched later
      
      // Expect and parse the ELSE block
      const elseBlockStart = vm.compiler.CP;
      const elseBlockToken = state.tokenizer.nextToken();
      if (elseBlockToken.type !== TokenType.BLOCK_START) {
        throw new SyntaxError('Expected { for else-block in IF statement', vm.getStackData());
      }

      parseCurlyBlock(state);
      const endOfElse = vm.compiler.CP;
      
      // Patch the jump offsets now that we know the block sizes
      const falseJumpOffset = elseBlockStart - (falseJumpAddr + 3);
      vm.compiler.patch16(jumpOffsetAddr, falseJumpOffset);
      console.log(`Patched IF jump at offsetAddr=${jumpOffsetAddr}, offset=${falseJumpOffset}`);
      
      const elseJumpOffset = endOfElse - (elseJumpAddr + 3);
      vm.compiler.patch16(elseJumpOffsetAddr, elseJumpOffset);
      console.log(
        `Patched ELSE jump at offsetAddr=${elseJumpOffsetAddr}, offset=${elseJumpOffset}`,
      );
    } else {
      // No ELSE block, just patch the IF jump
      const falseJumpOffset = endOfThen - (falseJumpAddr + 3);
      vm.compiler.patch16(jumpOffsetAddr, falseJumpOffset);
      console.log(
        `Patched IF jump at offsetAddr=${jumpOffsetAddr}, offset=${falseJumpOffset} (no ELSE)`,
      );
    }
  } 
  // Handle block combinators like 'do'
  else if (value === 'do') {
    const blockToken = state.tokenizer.nextToken();
    if (blockToken.type !== TokenType.BLOCK_START) {
      throw new SyntaxError('Expected { after do combinator', vm.getStackData());
    }
    
    // Compile SkipBlock with placeholder offset
    const skipAddr = vm.compiler.CP;
    vm.compiler.compileOpcode(Op.BranchCall); // SkipBlock
    const offsetAddr = vm.compiler.CP;
    vm.compiler.compile16(0); // Placeholder
    
    // Compile block in-place
    parseCurlyBlock(state);
    vm.compiler.compileOpcode(Op.Exit); // Block must end with exit
    const blockEnd = vm.compiler.CP;
    
    // Back-patch the skip offset
    const skipOffset = blockEnd - (skipAddr + 3); // +3 for opcode + 16-bit offset
    vm.compiler.patch16(offsetAddr, skipOffset);
    
    // Compile call to doOp
    const doIndex = vm.symbolTable.find('do');
    if (doIndex === undefined) {
      throw new UndefinedWordError('do', vm.getStackData());
    }
    vm.compiler.compileOpcode(doIndex);
    return;
  }
  // Handle special tokens that might appear as words
  else if (value === ':' || value === ';' || value === '`') {
    processSpecialToken(value, state);
  } 
  // Handle regular word calls
  else {
    const functionIndex = vm.symbolTable.find(value);
    if (functionIndex === undefined) {
      throw new UndefinedWordError(value, vm.getStackData());
    }

    vm.compiler.compileOpcode(functionIndex);
  }
}

/**
 * Process special tokens like :, ;, (, ), and `.
 * 
 * This function dispatches to the appropriate handler based on the special token:
 * - ':' begins a word definition
 * - ';' ends a word definition
 * - '(' begins a list
 * - ')' ends a list
 * - '`' begins a symbol literal
 * 
 * @param {string} value - The special token value
 * @param {ParserState} state - The current parser state
 */
function processSpecialToken(value: string, state: ParserState): void {
  if (value === ':') {
    beginDefinition(state);
  } else if (value === ';') {
    endDefinition(state);
  } else if (value === '(') {
    beginList(state);
  } else if (value === ')') {
    endList(state);
  } else if (value === '`') {
    parseBacktickSymbol(state);
  }
}

/**
 * Handle the backtick symbol for symbol literals.
 * 
 * This function processes a symbol literal (word quote) that begins with a backtick.
 * It reads characters directly from the tokenizer's input until it encounters whitespace
 * or a grouping character, then compiles the symbol as a string literal.
 * 
 * @param {ParserState} state - The current parser state
 */
function parseBacktickSymbol(state: ParserState): void {
  let sym = '';
  // Read characters until whitespace or grouping character
  while (state.tokenizer.position < state.tokenizer.input.length) {
    const ch = state.tokenizer.input[state.tokenizer.position];
    if (isWhitespace(ch) || isGroupingChar(ch)) break;
    sym += ch;
    state.tokenizer.position++;
    state.tokenizer.column++;
  }

  // Add the symbol to the digest and compile as a string literal
  const addr = vm.digest.add(sym);
  vm.compiler.compileOpcode(Op.LiteralString);
  vm.compiler.compile16(addr);
}

/**
 * Begin a word definition with colon (:).
 * 
 * This function handles the start of a word definition in Tacit. It:
 * 1. Validates that definitions are not nested or inside code blocks
 * 2. Reads the word name from the next token
 * 3. Ensures the word is not already defined
 * 4. Compiles a branch instruction to skip over the definition
 * 5. Registers the word in the symbol table
 * 6. Updates the parser state to track the current definition
 * 
 * @param {ParserState} state - The current parser state
 * @throws {Error} If definitions are nested, inside code blocks, or the word is already defined
 */
function beginDefinition(state: ParserState): void {
  // Validate definition context
  if (state.insideCodeBlock) {
    throw new NestedDefinitionError(vm.getStackData());
  }

  if (state.currentDefinition) {
    throw new NestedDefinitionError(vm.getStackData());
  }

  // Get the word name
  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD && nameToken.type !== TokenType.NUMBER) {
    throw new SyntaxError(`Expected word name after :`, vm.getStackData());
  }

  const wordName = String(nameToken.value);
  if (vm.symbolTable.find(wordName) !== undefined) {
    throw new WordAlreadyDefinedError(wordName, vm.getStackData());
  }

  // Compile a branch instruction to skip over the definition
  vm.compiler.compileOpcode(Op.Branch);
  const branchPos = vm.compiler.CP;
  vm.compiler.compile16(0); // Placeholder for branch offset, will be patched later
  
  // Record the start address of the word's code
  const startAddress = vm.compiler.CP;
  
  // Define the word's execution function
  const wordFunction = (vm: typeof import('../core/globalState').vm) => {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE)); // Save return address
    vm.rpush(vm.BP);                          // Save base pointer
    vm.BP = vm.RP;                            // Set new base pointer
    vm.IP = startAddress;                     // Jump to word's code
  };

  // Use a reserved opcode range starting from 128 for user-defined words
  // The actual value doesn't matter as we'll look up by name in executeOp
  const functionIndex = state.nextFunctionIndex++;
  vm.symbolTable.defineCall(wordName, functionIndex, wordFunction);
  
  // Update parser state
  state.currentDefinition = {
    name: wordName,
    branchPos,
  };

  // Mark the compiler state as needing preservation
  vm.compiler.preserve = true;
}

/**
 * End a word definition with semicolon (;).
 * 
 * This function handles the end of a word definition in Tacit. It:
 * 1. Validates that there is an active definition to end
 * 2. Compiles an exit instruction to return from the word
 * 3. Patches the branch offset at the beginning of the definition
 * 4. Updates the parser state to clear the current definition
 * 
 * @param {ParserState} state - The current parser state
 * @throws {Error} If there is no active definition to end
 */
function endDefinition(state: ParserState): void {
  if (!state.currentDefinition) {
    throw new SyntaxError('Unexpected semicolon', vm.getStackData());
  }

  // Compile an exit instruction to return from the word
  vm.compiler.compileOpcode(Op.Exit);
  
  // Patch the branch offset at the beginning of the definition
  // This allows code to skip over the definition when encountered in the program flow
  patchBranchOffset(state.currentDefinition.branchPos);
  
  // Clear the current definition
  state.currentDefinition = null;
}

/**
 * Begin a list with opening parenthesis (().
 * 
 * This function handles the start of a list in Tacit. It:
 * 1. Increments the list depth counter in the VM
 * 2. Compiles an OpenList opcode to start list construction
 * 
 * @param {ParserState} _state - The current parser state (unused)
 */
function beginList(_state: ParserState): void {
  vm.listDepth++;
  vm.compiler.compileOpcode(Op.OpenList);
}

/**
 * End a list with closing parenthesis ()).
 * 
 * This function handles the end of a list in Tacit. It:
 * 1. Validates that there is an open list to close
 * 2. Compiles a CloseList opcode to finalize list construction
 * 3. Decrements the list depth counter in the VM
 * 
 * @param {ParserState} _state - The current parser state (unused)
 * @throws {Error} If there is no open list to close
 */
function endList(_state: ParserState): void {
  if (vm.listDepth <= 0) {
    throw new SyntaxError('Unexpected closing parenthesis', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.CloseList);
  vm.listDepth--;
}

/**
 * Patch a branch offset at the given position in the bytecode.
 * 
 * This function calculates the correct branch offset based on the current
 * compiler position and patches it into the bytecode at the specified position.
 * This is used to resolve forward references in control structures and word definitions.
 * 
 * @param {number} branchPos - The position in the bytecode where the branch offset needs to be patched
 */
function patchBranchOffset(branchPos: number): void {
  // Calculate the branch offset from the branch instruction to the current position
  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2); // +2 accounts for the size of the offset itself
  
  // Save the current compiler position
  const prevCP = vm.compiler.CP;
  
  // Temporarily move the compiler position to patch the offset
  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);
  
  // Restore the compiler position
  vm.compiler.CP = prevCP;
}

/**
 * Parse a curly brace block ({...}).
 * 
 * This function processes all tokens within a curly brace block until
 * the closing brace is encountered. It returns the starting address of
 * the block in the bytecode.
 * 
 * @param {ParserState} state - The current parser state
 * @returns {number} The starting address of the block in the bytecode
 */
function parseCurlyBlock(state: ParserState): number {
  const startAddress = vm.compiler.CP;
  
  // Process tokens until we encounter the closing brace
  while (true) {
    const token = state.tokenizer.nextToken();
    if (token.type === TokenType.BLOCK_END) {
      break;
    }

    processToken(token, state);
  }

  return startAddress;
}
