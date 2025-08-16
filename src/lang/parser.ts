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
import {
  UnclosedDefinitionError,
  UndefinedWordError,
  SyntaxError,
  NestedDefinitionError,
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
 */
interface ParserState {
  tokenizer: Tokenizer;
  currentDefinition:
    | (Definition & { checkpoint: import('../strings/symbol-table').SymbolTableCheckpoint })
    | null;
  insideCodeBlock: boolean;
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
  vm.compiler.reset();

  const state: ParserState = {
    tokenizer,
    currentDefinition: null,
    insideCodeBlock: false,
  };

  parseProgram(state);

  validateFinalState(state);

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

  // Ensure all list/lists were properly closed
  if (vm.listDepth !== 0) {
    throw new SyntaxError('Unclosed list or LIST', vm.getStackData());
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
    case TokenType.BLOCK_START:
      beginStandaloneBlock(state);
      break;
    case TokenType.BLOCK_END:
      throw new UnexpectedTokenError('}', vm.getStackData());
    case TokenType.WORD:
      processWordToken(token.value as string, state);
      break;
    case TokenType.SYMBOL:
      processAtSymbol(token.value as string);
      break;
    case TokenType.WORD_QUOTE: {
      const wordName = token.value as string;
      const address = vm.symbolTable.find(wordName) as number | undefined;
      if (address === undefined) {
        throw new UndefinedWordError(wordName, vm.getStackData());
      }

      vm.compiler.compileOpcode(Op.LiteralAddress);
      vm.compiler.compile16(address);
      break;
    }
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
  if (value === 'IF') {
    console.log(`Parsing IF statement at CP=${vm.compiler.CP}`);

    const falseJumpAddr = vm.compiler.CP;
    vm.compiler.compileOpcode(Op.IfFalseBranch);
    const jumpOffsetAddr = vm.compiler.CP;
    vm.compiler.compile16(0);

    const thenToken = state.tokenizer.nextToken();
    if (thenToken.type !== TokenType.BLOCK_START) {
      throw new SyntaxError('Expected { for then-block in IF statement', vm.getStackData());
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
        throw new SyntaxError('Expected { for else-block in IF statement', vm.getStackData());
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
  } else if (value === 'do') {
    const blockToken = state.tokenizer.nextToken();
    if (blockToken.type !== TokenType.BLOCK_START) {
      throw new SyntaxError('Expected { after do combinator', vm.getStackData());
    }

    beginStandaloneBlock(state);

    const doIndex = vm.symbolTable.find('do');
    if (doIndex === undefined) {
      throw new UndefinedWordError('do', vm.getStackData());
    }
    vm.compiler.compileOpcode(doIndex);
    return;
  } else if (value === 'repeat') {
    const blockToken = state.tokenizer.nextToken();
    if (blockToken.type !== TokenType.BLOCK_START) {
      throw new SyntaxError('Expected { after repeat combinator', vm.getStackData());
    }

    beginStandaloneBlock(state);

    const repeatIndex = vm.symbolTable.find('repeat');
    if (repeatIndex === undefined) {
      throw new UndefinedWordError('repeat', vm.getStackData());
    }
    vm.compiler.compileOpcode(repeatIndex);
    return;
  } else if (value === 'get') {
    const blockToken = state.tokenizer.nextToken();
    if (blockToken.type !== TokenType.BLOCK_START) {
      throw new SyntaxError('Expected { after get combinator', vm.getStackData());
    }

    beginStandaloneBlock(state); // Compile the block and push its code ref

    // Macro expansion for get combinator:
    // 1. Save block code ref to temp register
    vm.compiler.compileOpcode(Op.SaveTemp);
    // 2. Open list (push dummy LIST:0, save SP)
    vm.compiler.compileOpcode(Op.OpenList);
    // 3. Restore block code ref from temp register
    vm.compiler.compileOpcode(Op.RestoreTemp);
    // 4. Eval block (results go above dummy header)
    vm.compiler.compileOpcode(Op.Eval);
    // 5. Close list (package results into list)
    vm.compiler.compileOpcode(Op.CloseList);
    return;
  } else if (value === 'set') {
    const blockToken = state.tokenizer.nextToken();
    if (blockToken.type !== TokenType.BLOCK_START) {
      throw new SyntaxError('Expected { after set combinator', vm.getStackData());
    }

    beginStandaloneBlock(state);

    const setIndex = vm.symbolTable.find('set');
    vm.compiler.compileOpcode(setIndex ?? 999); // Use invalid placeholder if undefined
    return;
  } else if (value === ':' || value === ';' || value === '`') {
    processSpecialToken(value, state);
  } else {
    // First check for bytecode address (colon definitions)
    const bytecodeAddr = vm.symbolTable.findBytecodeAddress(value);
    if (bytecodeAddr !== undefined) {
      // Found a colon definition - compile direct bytecode address
      vm.compiler.compileUserWordCall(bytecodeAddr);
      return;
    }

    // Fall back to built-in lookup (function index)
    const functionIndex = vm.symbolTable.find(value);
    if (functionIndex === undefined) {
      throw new UndefinedWordError(value, vm.getStackData());
    }

    vm.compiler.compileOpcode(functionIndex);
  }
}

/**
 * Process @symbol tokens for unified code references.
 *
 * This function handles @symbol syntax by calling vm.pushSymbolRef() to resolve
 * the symbol to either a Tag.BUILTIN or Tag.CODE tagged value and push it to the stack.
 * The resulting tagged value can be used with 'eval' for metaprogramming.
 *
 * Examples:
 * - @add → Tag.BUILTIN(Op.Add)
 * - @square → Tag.CODE(bytecode_addr)
 *
 * @param {string} symbolName - The symbol name after @ (without the @ prefix)
 * @param {ParserState} state - Current parser state (unused but maintains consistency)
 */
function processAtSymbol(symbolName: string): void {
  // Generate bytecode to call vm.pushSymbolRef() at runtime
  // This pushes the resolved tagged value directly onto the stack

  // Compile a call to the pushSymbolRef built-in with the symbol name
  const pushSymbolRefIndex = vm.symbolTable.find('pushSymbolRef');
  if (pushSymbolRefIndex === undefined) {
    throw new UndefinedWordError('pushSymbolRef', vm.getStackData());
  }

  // First push the symbol name as a string literal
  vm.compiler.compileOpcode(Op.LiteralString);
  const stringAddress = vm.digest.add(symbolName);
  vm.compiler.compile16(stringAddress);

  // Then call pushSymbolRef
  vm.compiler.compileOpcode(pushSymbolRefIndex);
}

/**
 * Process special tokens like :, ;, (, ), {, and `.
 *
 * This function dispatches to the appropriate handler based on the special token:
 * - ':' begins a word definition
 * - ';' ends a word definition
 * - '(' begins a list
 * - ')' ends a list
 * - '{' begins a standalone code block
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
    // Retarget parentheses to LIST construction (keep [ ] as alias during migration)
    beginList(state);
  } else if (value === ')') {
    endList(state);
  } else if (value === '{') {
    beginStandaloneBlock(state);
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
 * Begin a word definition with colon (:).
 *
 * This function handles the start of a word definition in Tacit. It:
 * 1. Validates that definitions are not nested or inside code blocks
 * 2. Reads the word name from the next token
 * 3. Compiles a branch instruction to skip over the definition
 * 4. Defers symbol registration until ';' to allow body to see previous definition
 * 5. Updates the parser state to track the current definition
 *
 * @param {ParserState} state - The current parser state
 * @throws {Error} If definitions are nested, inside code blocks, or the word is already defined
 */
function beginDefinition(state: ParserState): void {
  if (state.insideCodeBlock) {
    throw new NestedDefinitionError(vm.getStackData());
  }

  if (state.currentDefinition) {
    throw new NestedDefinitionError(vm.getStackData());
  }

  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD && nameToken.type !== TokenType.NUMBER) {
    throw new SyntaxError(`Expected word name after :`, vm.getStackData());
  }

  const wordName = String(nameToken.value);

  vm.compiler.compileOpcode(Op.Branch);
  const branchPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  // Save checkpoint so body sees previous definition; defer new define until ';'
  const checkpoint = vm.symbolTable.mark();
  state.currentDefinition = {
    name: wordName,
    branchPos,
    checkpoint,
  };

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

  vm.compiler.compileOpcode(Op.Exit);

  patchBranchOffset(state.currentDefinition.branchPos);

  // Now that body compiled against prior dictionary, register new definition at head
  const { name } = state.currentDefinition;
  // The actual start address is where we began compiling after branch; reconstruct from branch position
  // branchPos is after Op.Branch (1 byte) at the 16-bit offset; the target start was saved earlier as startAddress in beginDefinition.
  // We did not store it; recompute: start address = (branchPos + 2)
  const defStart = state.currentDefinition.branchPos + 2; // start of body immediately after 16-bit placeholder

  vm.symbolTable.defineCode(name, defStart);

  state.currentDefinition = null;
}

/**
 * Begin an LIST with opening bracket ([).
 * Mirrors beginList but targets LIST ops.
 */
function beginList(_state: ParserState): void {
  vm.listDepth++;
  vm.compiler.compileOpcode(Op.OpenList);
}

/**
 * End an LIST with closing bracket (]).
 * Mirrors endList but targets LIST ops.
 */
function endList(_state: ParserState): void {
  if (vm.listDepth <= 0) {
    throw new SyntaxError('Unexpected closing parenthesis', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.CloseList);
  vm.listDepth--;
}

/**
 * Begin a standalone code block with opening brace ({).
 *
 * This function handles standalone code blocks that produce a code reference
 * on the stack. It uses the same pattern as combinators but without the
 * combinator operation at the end.
 *
 * @param {ParserState} state - The current parser state
 */
function beginStandaloneBlock(state: ParserState): void {
  const prevInside = state.insideCodeBlock;
  state.insideCodeBlock = true;
  const { startAddress } = compileCodeBlock(state);
  state.insideCodeBlock = prevInside;
  vm.compiler.compileOpcode(Op.LiteralCode);
  vm.compiler.compile16(startAddress);
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
  const endAddress = vm.compiler.CP;
  const branchOffset = endAddress - (branchPos + 2);

  const prevCP = vm.compiler.CP;

  vm.compiler.CP = branchPos;
  vm.compiler.compile16(branchOffset);

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

  while (true) {
    const token = state.tokenizer.nextToken();
    if (token.type === TokenType.BLOCK_END) {
      break;
    }

    processToken(token, state);
  }

  return startAddress;
}

/**
 * Compile a code block using the standard BranchCall pattern.
 *
 * This function implements the shared compilation pattern used by standalone
 * blocks and combinators. It compiles a BranchCall instruction with a placeholder
 * offset, parses the block content, adds an Exit instruction, and patches the
 * offset to skip over the block when not executing.
 *
 * @param {ParserState} state - The current parser state
 * @returns {object} Object containing startAddress and offsetAddr for further processing
 */
function compileCodeBlock(state: ParserState): { startAddress: number; offsetAddr: number } {
  const skipAddr = vm.compiler.CP;
  vm.compiler.compileOpcode(Op.Branch);
  const offsetAddr = vm.compiler.CP;
  vm.compiler.compile16(0);

  const startAddress = parseCurlyBlock(state);
  vm.compiler.compileOpcode(Op.Exit);
  const blockEnd = vm.compiler.CP;

  const skipOffset = blockEnd - (skipAddr + 3);
  vm.compiler.patch16(offsetAddr, skipOffset);

  return { startAddress, offsetAddr };
}
