import { Op } from '../ops/opcodes';
import { vm } from '../core/globalState';
import { Token, Tokenizer, TokenType } from './tokenizer';
import { isWhitespace, isGroupingChar } from '../core/utils';
import { toTaggedValue, Tag } from '../core/tagged';

export interface Definition {
  name: string;
  branchPos: number;
}

interface ParserState {
  tokenizer: Tokenizer;
  currentDefinition: Definition | null;
  insideCodeBlock: boolean;
  nextFunctionIndex: number;
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
    nextFunctionIndex: 128, // Start user-defined words at index 128
  };

  parseProgram(state);
  validateFinalState(state);
  vm.compiler.compileOpcode(Op.Abort);
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
    case TokenType.WORD_QUOTE:
      const wordName = token.value as string;
      const address = vm.symbolTable.find(wordName) as number | undefined;
      if (address === undefined) {
        throw new Error(`Undefined word: ${wordName}`);
      }

      vm.compiler.compileOpcode(Op.LiteralAddress);
      vm.compiler.compile16(address);
      break;
  }
}

/**
 * Compile a number literal
 */
function compileNumberLiteral(value: number): void {
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(value);
}

/**
 * Compile a string literal
 */
function compileStringLiteral(value: string): void {
  vm.compiler.compileOpcode(Op.LiteralString);
  const address = vm.digest.add(value);
  vm.compiler.compile16(address);
}

/**
 * Process a word token
 */
function processWordToken(value: string, state: ParserState): void {
  if (value === 'IF') {
    console.log(`Parsing IF statement at CP=${vm.compiler.CP}`);
    const falseJumpAddr = vm.compiler.CP;
    vm.compiler.compileOpcode(Op.IfFalseBranch);
    const jumpOffsetAddr = vm.compiler.CP;
    vm.compiler.compile16(0);
    const thenToken = state.tokenizer.nextToken();
    if (thenToken.type !== TokenType.BLOCK_START) {
      throw new Error('Expected { for then-block in IF statement');
    }

    parseCurlyBlock(state);
    const endOfThen = vm.compiler.CP;
    const next = state.tokenizer.peekToken();
    if (next && next.value === 'ELSE') {
      state.tokenizer.nextToken();
      const elseJumpAddr = vm.compiler.CP;
      vm.compiler.compileOpcode(Op.Branch);
      const elseJumpOffsetAddr = vm.compiler.CP;
      vm.compiler.compile16(0);
      const elseBlockStart = vm.compiler.CP;
      const elseBlockToken = state.tokenizer.nextToken();
      if (elseBlockToken.type !== TokenType.BLOCK_START) {
        throw new Error('Expected { for else-block in IF statement');
      }

      parseCurlyBlock(state);
      const endOfElse = vm.compiler.CP;
      const falseJumpOffset = elseBlockStart - (falseJumpAddr + 3);
      vm.compiler.patch16(jumpOffsetAddr, falseJumpOffset);
      console.log(`Patched IF jump at offsetAddr=${jumpOffsetAddr}, offset=${falseJumpOffset}`);
      const elseJumpOffset = endOfElse - (elseJumpAddr + 3);
      vm.compiler.patch16(elseJumpOffsetAddr, elseJumpOffset);
      console.log(
        `Patched ELSE jump at offsetAddr=${elseJumpOffsetAddr}, offset=${elseJumpOffset}`,
      );
    } else {
      const falseJumpOffset = endOfThen - (falseJumpAddr + 3);
      vm.compiler.patch16(jumpOffsetAddr, falseJumpOffset);
      console.log(
        `Patched IF jump at offsetAddr=${jumpOffsetAddr}, offset=${falseJumpOffset} (no ELSE)`,
      );
    }
  } else if (value === ':' || value === ';' || value === '`') {
    processSpecialToken(value, state);
  } else {
    const functionIndex = vm.symbolTable.find(value);
    if (functionIndex === undefined) {
      throw new Error(`Unknown word: ${value}`);
    }

    vm.compiler.compileOpcode(functionIndex);
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
