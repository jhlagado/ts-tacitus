import { Op } from '../ops/builtins';
import { vm } from './globalState';
import { Token, Tokenizer, TokenType } from './tokenizer';
import { isWhitespace, isGroupingChar } from './utils';

export interface Definition {
  name: string;
  branchPos: number;
}

interface ParserState {
  tokenizer: Tokenizer;
  currentDefinition: Definition | null;
  insideCodeBlock: boolean;
}

/**
 * Main parse function - entry point for parsing Tacit code
 */
export function parse(tokenizer: Tokenizer): void {
  vm.compiler.reset();

  const state: ParserState = {
    tokenizer,
    currentDefinition: null,
    insideCodeBlock: false,
  };

  parseProgram(state);
  validateFinalState(state);

  // Add Abort opcode at the end
  vm.compiler.compile8(Op.Abort);
}

/**
 * Parse the entire program
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
 * Validate the final state after parsing
 */
function validateFinalState(state: ParserState): void {
  if (state.currentDefinition) {
    throw new Error(`Unclosed definition for ${state.currentDefinition.name}`);
  }
}

/**
 * Process a token based on its type
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
  }
}

/**
 * Compile a number literal
 */
function compileNumberLiteral(value: number): void {
  vm.compiler.compile8(Op.LiteralNumber);
  vm.compiler.compileFloat(value);
}

/**
 * Compile a string literal
 */
function compileStringLiteral(value: string): void {
  vm.compiler.compile8(Op.LiteralString);
  const address = vm.digest.add(value);
  vm.compiler.compile16(address);
}

/**
 * Process a word token
 */
function processWordToken(value: string, state: ParserState): void {
  // Check if it's a special character that should be handled differently
  if (value === ':' || value === ';' || value === '(' || value === ')') {
    processSpecialToken(value, state);
  } else {
    // Handle normal words
    const compile = vm.symbolTable.find(value);
    if (compile === undefined) {
      throw new Error(`Unknown word: ${value}`);
    }
    compile(vm);
  }
}

/**
 * Process special tokens like :, ;, (, )
 */
function processSpecialToken(value: string, state: ParserState): void {
  if (value === ':') {
    beginDefinition(state);
  } else if (value === ';') {
    endDefinition(state);
  } else if (value === '(') {
    beginCodeBlock(state);
  } else if (value === ')') {
    handleUnexpectedClosingParenthesis();
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

  // Compile as a literal string
  const addr = vm.digest.add(sym);
  vm.compiler.compile8(Op.LiteralString);
  vm.compiler.compile16(addr);
}

/**
 * Begin a word definition with :
 */
function beginDefinition(state: ParserState): void {
  // Check if we're inside a code block
  if (state.insideCodeBlock) {
    throw new Error('Cannot nest definition inside code block');
  }

  // Colon definition
  if (state.currentDefinition) {
    throw new Error('Nested definitions are not allowed');
  }

  // Get the name token
  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD && nameToken.type !== TokenType.NUMBER) {
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
  state.currentDefinition = {
    name: wordName,
    branchPos,
  };

  // Mark for preservation
  vm.compiler.preserve = true;
}

/**
 * End a word definition with ;
 */
function endDefinition(state: ParserState): void {
  // End definition
  if (!state.currentDefinition) {
    throw new Error('Unexpected semicolon');
  }

  // Compile exit instruction
  vm.compiler.compile8(Op.Exit);

  // Patch branch offset
  patchBranchOffset(state.currentDefinition.branchPos);

  state.currentDefinition = null;
}

/**
 * Begin a code block with (
 */
function beginCodeBlock(state: ParserState): void {
  vm.compiler.preserve = true;
  vm.compiler.nestingScore++;

  const wasInsideCodeBlock = state.insideCodeBlock;
  state.insideCodeBlock = true;

  // Compile branch instruction to call block
  vm.compiler.compile8(Op.BranchCall);
  const branchPos = vm.compiler.CP;
  vm.compiler.compile16(0); // Will be patched later

  parseCodeBlock(state);

  // Compile exit instruction
  vm.compiler.compile8(Op.Exit);

  // Patch branch offset
  patchBranchOffset(branchPos);

  state.insideCodeBlock = wasInsideCodeBlock;
  vm.compiler.nestingScore--;
}

/**
 * Parse the contents of a code block
 */
function parseCodeBlock(state: ParserState): void {
  while (true) {
    const blockToken = state.tokenizer.nextToken();

    if (blockToken.type === TokenType.EOF) {
      throw new Error('Unclosed code block');
    }

    if (blockToken.type === TokenType.SPECIAL && blockToken.value === ')') {
      // End of block
      break;
    }

    // Process token
    processToken(blockToken, state);
  }
}

/**
 * Handle an unexpected closing parenthesis
 */
function handleUnexpectedClosingParenthesis(): void {
  throw new Error('Unexpected closing parenthesis');
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
