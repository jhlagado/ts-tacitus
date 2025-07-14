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
    throw new Error(`Unclosed definition for ${state.currentDefinition.name}`);
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
        throw new Error(`Undefined word: ${wordName}`);
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
      throw new Error('Expected { for then-block in IF statement');
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
        throw new Error('Expected { for else-block in IF statement');
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
  // Handle special tokens that might appear as words
  else if (value === ':' || value === ';' || value === '`') {
    processSpecialToken(value, state);
  } 
  // Handle regular word calls
  else {
    const functionIndex = vm.symbolTable.find(value);
    if (functionIndex === undefined) {
      throw new Error(`Unknown word: ${value}`);
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
 * Handle the backtick symbol for symbol literals
 */
function parseBacktickSymbol(state: ParserState): void {
  let sym = '';
  while (state.tokenizer.position < state.tokenizer.input.length) {
    const ch = state.tokenizer.input[state.tokenizer.position];
    if (isWhitespace(ch) || isGroupingChar(ch)) break;
    sym += ch;
    state.tokenizer.position++;
    state.tokenizer.column++;
  }

  const addr = vm.digest.add(sym);
  vm.compiler.compileOpcode(Op.LiteralString);
  vm.compiler.compile16(addr);
}

/**
 * Begin a word definition with :
 */
function beginDefinition(state: ParserState): void {
  if (state.insideCodeBlock) {
    throw new Error('Cannot nest definition inside code block');
  }

  if (state.currentDefinition) {
    throw new Error('Nested definitions are not allowed');
  }

  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD && nameToken.type !== TokenType.NUMBER) {
    throw new Error(`Expected word name after :`);
  }

  const wordName = String(nameToken.value);
  if (vm.symbolTable.find(wordName) !== undefined) {
    throw new Error(`Word already defined: ${wordName}`);
  }

  vm.compiler.compileOpcode(Op.Branch);
  const branchPos = vm.compiler.CP;
  vm.compiler.compile16(0);
  const startAddress = vm.compiler.CP;
  const wordFunction = (vm: typeof import('../core/globalState').vm) => {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    vm.IP = startAddress;
  };

  // Use a reserved opcode range starting from 128 for user-defined words
  // The actual value doesn't matter as we'll look up by name in executeOp
  const functionIndex = state.nextFunctionIndex++;
  vm.symbolTable.defineCall(wordName, functionIndex, wordFunction);
  state.currentDefinition = {
    name: wordName,
    branchPos,
  };

  vm.compiler.preserve = true;
}

/**
 * End a word definition with ;
 */
function endDefinition(state: ParserState): void {
  if (!state.currentDefinition) {
    throw new Error('Unexpected semicolon');
  }

  vm.compiler.compileOpcode(Op.Exit);
  patchBranchOffset(state.currentDefinition.branchPos);
  state.currentDefinition = null;
}

/**
 * Begin a list with (
 */
function beginList(_state: ParserState): void {
  vm.listDepth++;
  vm.compiler.compileOpcode(Op.OpenList);
}

/**
 * End a list with )
 */
function endList(_state: ParserState): void {
  if (vm.listDepth <= 0) {
    throw new Error('Unexpected closing parenthesis');
  }

  vm.compiler.compileOpcode(Op.CloseList);
  vm.listDepth--;
}

/**
 * Patch a branch offset at the given position
 */
function patchBranchOffset(branchPos: number): void {
  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);
  const prevCP = vm.compiler.CP;
  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);
  vm.compiler.CP = prevCP;
}

/**
 * Parse a curly brace block
 */
function parseCurlyBlock(state: ParserState): number {
  const startAddress = vm.compiler.CP;
  while (true) {
    const token = state.tokenizer.nextToken();
    if (token.type === TokenType.BLOCK_END) {
      break;
    }

    processToken(token, state);
  }

  return startAddress;
}
