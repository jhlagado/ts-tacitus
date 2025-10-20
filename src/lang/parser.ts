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
import { vm } from './runtime';
import { Token, Tokenizer, TokenType } from './tokenizer';
import { isSpecialChar, fromTaggedValue, Tag, decodeDataRef, SEG_GLOBAL } from '@src/core';
import { UndefinedWordError, SyntaxError } from '@src/core';
import { emitNumber, emitString } from './literals';
import { ParserState, setParserState } from './state';
import { ensureNoOpenDefinition } from './definitions';
import { executeImmediateWord, ensureNoOpenConditionals } from './meta';

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
  };

  setParserState(state);
  try {
    parseProgram(state);

    validateFinalState(state);

    vm.compiler.compileOpcode(Op.Abort);
  } finally {
    setParserState(null);
  }
}

/**
 * Parse the entire program by processing tokens until EOF.
 *
 * This function reads tokens one by one from the tokenizer and processes
 * each token until the end of the input is reached.
 *
 * @param {ParserState} state - The current parser state
 */
export function parseProgram(state: ParserState): void {
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
export function validateFinalState(state: ParserState): void {
  ensureNoOpenDefinition(state);
  ensureNoOpenConditionals();

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
export function processToken(token: Token, state: ParserState): void {
  switch (token.type) {
    case TokenType.NUMBER:
      emitNumber(token.value as number);
      break;
    case TokenType.STRING:
      emitString(token.value as string);
      break;
    case TokenType.SPECIAL:
      handleSpecial(token.value as string, state);
      break;
    case TokenType.WORD:
      emitWord(token.value as string, state);
      break;
    case TokenType.SYMBOL:
      emitAtSymbol(token.value as string);
      break;
    case TokenType.REF_SIGIL:
      emitRefSigil(token.value as string, state);
      break;
    // WORD_QUOTE removed: backtick word-address literals no longer supported
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
export function emitWord(value: string, state: ParserState): void {
  if (value === 'var') {
    emitVarDecl(state);
    return;
  }

  if (value === '->') {
    emitAssignment(state);
    return;
  }

  if (value === 'global') {
    emitGlobalDecl(state);
    return;
  }

  if (value === '+>') {
    emitIncrement(state);
    return;
  }

  // backtick removed

  const entry = vm.symbolTable.findEntry(value);
  if (!entry) {
    throw new UndefinedWordError(value, vm.getStackData());
  }

  if (entry.isImmediate) {
    executeImmediateWord(value, entry);
    return;
  }

  const { tag, value: tagValue } = fromTaggedValue(entry.taggedValue);
  const entryValue = entry.taggedValue;

  if (tag === Tag.CODE) {
    vm.compiler.compileUserWordCall(tagValue);
    return;
  }

  if (tag === Tag.BUILTIN) {
    vm.compiler.compileOpcode(tagValue);
    return;
  }

  if (tag === Tag.LOCAL) {
    vm.compiler.compileOpcode(Op.VarRef);
    vm.compiler.compile16(tagValue);
    vm.compiler.compileOpcode(Op.Load);

    const nextToken = state.tokenizer.nextToken();
    if (nextToken && nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compileBracketPathAsList(state);
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Load);
      vm.compiler.compileOpcode(Op.Nip);
    } else if (nextToken) {
      state.tokenizer.pushBack(nextToken);
    }
    return;
  }

  if (tag === Tag.DATA_REF) {
    const components = decodeDataRef(entryValue);
    if (components.segment !== SEG_GLOBAL) {
      throw new UndefinedWordError(value, vm.getStackData());
    }

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(entryValue);

    const nextToken = state.tokenizer.nextToken();
    if (nextToken && nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compileBracketPathAsList(state);
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Load);
      vm.compiler.compileOpcode(Op.Nip);
    } else if (nextToken) {
      state.tokenizer.pushBack(nextToken);
      vm.compiler.compileOpcode(Op.Load);
    } else {
      vm.compiler.compileOpcode(Op.Load);
    }
    return;
  }

  throw new UndefinedWordError(value, vm.getStackData());
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
export function emitAtSymbol(symbolName: string): void {
  vm.compiler.compileOpcode(Op.LiteralString);
  const stringAddress = vm.digest.add(symbolName);
  vm.compiler.compile16(stringAddress);

  vm.compiler.compileOpcode(Op.PushSymbolRef);
}

/**
 * Process &variable tokens for explicit reference access.
 *
 * This function handles &variable syntax by compiling VarRef + Fetch
 * to create a DATA_REF to the local variable slot.
 *
 * @param {string} varName - The variable name after & (without the & prefix)
 * @param {ParserState} state - The current parser state
 * @throws {Error} If variable is undefined or not a local variable
 */
export function emitRefSigil(varName: string, state: ParserState): void {
  const taggedValue = vm.symbolTable.findTaggedValue(varName);
  if (taggedValue === undefined) {
    throw new UndefinedWordError(varName, vm.getStackData());
  }

  const { tag, value: slotNumber } = fromTaggedValue(taggedValue);

  // Inside function: allow locals and globals
  if (state.currentDefinition) {
    if (tag === Tag.LOCAL) {
      vm.compiler.compileOpcode(Op.VarRef);
      vm.compiler.compile16(slotNumber);
      vm.compiler.compileOpcode(Op.Fetch);
      return;
    }
    if (tag === Tag.DATA_REF) {
      const components = decodeDataRef(taggedValue);
      if (components.segment !== SEG_GLOBAL) {
        throw new Error(`${varName} is not a local variable`);
      }
      vm.compiler.compileOpcode(Op.LiteralNumber);
      vm.compiler.compileFloat32(taggedValue);
      vm.compiler.compileOpcode(Op.Fetch);
      return;
    }
    throw new Error(`${varName} is not a local variable`);
  }

  // Top level: allow &global; locals are invalid (no frame)
  if (tag === Tag.DATA_REF && decodeDataRef(taggedValue).segment === SEG_GLOBAL) {
    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(taggedValue);
    return;
  }
  throw new Error(`${varName} is not a global variable`);
}

/**
 * Process variable declarations with 'var' keyword.
 *
 * This function handles variable declarations in Tacit using the syntax: value var name
 * It expects a value to already be on the stack and reads the variable name from the next token.
 *
 * @param {ParserState} state - The current parser state
 * @throws {Error} If not inside a function definition or invalid variable name
 */
export function emitVarDecl(state: ParserState): void {
  if (!state.currentDefinition) {
    throw new SyntaxError(
      'Variable declarations only allowed inside function definitions',
      vm.getStackData(),
    );
  }

  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after var', vm.getStackData());
  }

  const varName = nameToken.value as string;

  if (
    varName.length === 0 ||
    varName === ':' ||
    varName === ';' ||
    (varName.length === 1 && isSpecialChar(varName))
  ) {
    throw new SyntaxError('Expected variable name after var', vm.getStackData());
  }

  vm.compiler.emitReserveIfNeeded();

  vm.symbolTable.defineLocal(varName);
  const slotNumber = vm.symbolTable.getLocalCount() - 1;

  vm.compiler.compileOpcode(Op.InitVar);
  vm.compiler.compile16(slotNumber);
}

/**
 * Process global variable declaration with 'global' keyword.
 *
 * Syntax: value global name
 * Behavior: registers a global slot for 'name' and stores TOS into it at runtime.
 */
export function emitGlobalDecl(state: ParserState): void {
  if (state.currentDefinition) {
    throw new SyntaxError(
      'Global declarations not allowed inside function definitions',
      vm.getStackData(),
    );
  }

  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after global', vm.getStackData());
  }

  const varName = nameToken.value as string;

  if (
    varName.length === 0 ||
    varName === ':' ||
    varName === ';' ||
    (varName.length === 1 && isSpecialChar(varName))
  ) {
    throw new SyntaxError('Expected variable name after global', vm.getStackData());
  }
  // Define global symbol and get its DATA_REF handle
  const globalRef = vm.symbolTable.defineGlobal(varName);
  // Emit: LiteralNumber(DATA_REF) → Store
  vm.compiler.compileOpcode(Op.LiteralNumber);
  vm.compiler.compileFloat32(globalRef);
  vm.compiler.compileOpcode(Op.Store);
}

/**
 * Process assignment operator '->'.
 *
 * This function handles local variable assignment using the syntax: value -> variable
 * It expects a value to already be on the stack and reads the variable name from the next token.
 * Compiles to: VarRef slot_number, Store
 *
 * @param {ParserState} state - The current parser state
 * @throws {Error} If not inside a function definition or invalid variable name
 */
export function emitAssignment(state: ParserState): void {
  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after ->', vm.getStackData());
  }

  const varName = nameToken.value as string;

  if (
    varName.length === 0 ||
    varName === ':' ||
    varName === ';' ||
    (varName.length === 1 && isSpecialChar(varName))
  ) {
    throw new SyntaxError('Expected variable name after ->', vm.getStackData());
  }

  const taggedValue = vm.symbolTable.findTaggedValue(varName);
  if (taggedValue === undefined) {
    throw new Error(`Undefined local or global variable: ${varName}`);
  }

  const { tag, value: slotNumber } = fromTaggedValue(taggedValue);
  if (tag === Tag.LOCAL) {
    // Check for bracketed path assignment: value -> x[ ... ]
    const maybeBracket = state.tokenizer.nextToken();
    if (maybeBracket && maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      // Compile &x semantics for path-based assignment
      vm.compiler.compileOpcode(Op.VarRef);
      vm.compiler.compile16(slotNumber);
      vm.compiler.compileOpcode(Op.Fetch);
      compileBracketPathAsList(state);
      // Inline update: select → nip → store
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Nip);
      vm.compiler.compileOpcode(Op.Store);
      return;
    } else if (maybeBracket) {
      // No bracket; put the token back
      state.tokenizer.pushBack(maybeBracket);
    }
    // Simple variable assignment
    vm.compiler.compileOpcode(Op.VarRef);
    vm.compiler.compile16(slotNumber);
    vm.compiler.compileOpcode(Op.Store);
    return;
  }
  if (tag === Tag.DATA_REF) {
    const components = decodeDataRef(taggedValue);
    if (components.segment !== SEG_GLOBAL) {
      throw new SyntaxError(
        'Assignment operator (->) only allowed for locals or globals',
        vm.getStackData(),
      );
    }
    const maybeBracket = state.tokenizer.nextToken();
    if (maybeBracket && maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      vm.compiler.compileOpcode(Op.LiteralNumber);
      vm.compiler.compileFloat32(taggedValue);
      vm.compiler.compileOpcode(Op.Fetch);
      compileBracketPathAsList(state);
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Nip);
      vm.compiler.compileOpcode(Op.Store);
      return;
    } else if (maybeBracket) {
      state.tokenizer.pushBack(maybeBracket);
    }
    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(taggedValue);
    vm.compiler.compileOpcode(Op.Store);
    return;
  }
  // Otherwise, not a recognized assignable
  throw new SyntaxError(
    'Assignment operator (->) only allowed for locals or globals',
    vm.getStackData(),
  );
}

/**
 * Implement locals-only increment operator: value +> x
 *
 * Sugar for: value x add -> x
 * Bytecode sequence (starting with [..., inc] on stack):
 *   VarRef slot
 *   Swap
 *   Over
 *   Fetch
 *   Add
 *   Swap
 *   Store
 */
export function emitIncrement(state: ParserState): void {
  if (!state.currentDefinition) {
    throw new SyntaxError(
      'Increment operator (+>) only allowed inside function definitions',
      vm.getStackData(),
    );
  }

  const nameToken = state.tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after +>', vm.getStackData());
  }

  const varName = nameToken.value as string;

  const taggedValue = vm.symbolTable.findTaggedValue(varName);
  if (taggedValue === undefined) {
    throw new Error(`Undefined local variable: ${varName}`);
  }

  const { tag, value: slotNumber } = fromTaggedValue(taggedValue);
  if (tag !== Tag.LOCAL) {
    throw new Error(`${varName} is not a local variable`);
  }

  // Check for optional bracketed path: value +> x[ ... ]
  const maybeBracket = state.tokenizer.nextToken();
  if (maybeBracket && maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
    // Build destination sub-address from local list slot: &x fetch [path] select nip
    vm.compiler.compileOpcode(Op.VarRef);
    vm.compiler.compile16(slotNumber);
    vm.compiler.compileOpcode(Op.Fetch);
    compileBracketPathAsList(state);
    vm.compiler.compileOpcode(Op.Select);
    vm.compiler.compileOpcode(Op.Nip);

    // Now perform RMW on that address: swap, over, fetch, add, swap, store
    vm.compiler.compileOpcode(Op.Swap);
    vm.compiler.compileOpcode(Op.Over);
    vm.compiler.compileOpcode(Op.Fetch);
    vm.compiler.compileOpcode(Op.Add);
    vm.compiler.compileOpcode(Op.Swap);
    vm.compiler.compileOpcode(Op.Store);
    return;
  } else if (maybeBracket) {
    // No bracket; put the token back for outer parsing
    state.tokenizer.pushBack(maybeBracket);
  }

  // Simple locals-only increment sugar: value x add -> x
  // Start: [..., inc]
  vm.compiler.compileOpcode(Op.VarRef);
  vm.compiler.compile16(slotNumber); // [..., inc, addr]
  vm.compiler.compileOpcode(Op.Swap); // [..., addr, inc]
  vm.compiler.compileOpcode(Op.Over); // [..., addr, inc, addr]
  vm.compiler.compileOpcode(Op.Fetch); // [..., addr, inc, value]
  vm.compiler.compileOpcode(Op.Add); // [..., addr, sum]
  vm.compiler.compileOpcode(Op.Swap); // [..., sum, addr]
  vm.compiler.compileOpcode(Op.Store); // []
}

/**
 * Compiles a bracket path like [0 1] into a list literal on the stack.
 * Supports numeric indices; closes on ']'.
 */
function compileBracketPathAsList(state: ParserState): void {
  // Build list: OpenList, emit elements, CloseList
  vm.compiler.compileOpcode(Op.OpenList);
  while (true) {
    const tok = state.tokenizer.nextToken();
    if (tok.type === TokenType.SPECIAL && tok.value === ']') {
      break;
    }
    if (tok.type === TokenType.NUMBER) {
      emitNumber(tok.value as number);
      continue;
    } else if (tok.type === TokenType.STRING) {
      emitString(tok.value as string);
      continue;
    }
    // Allow empty path [] or numbers only for now
    throw new SyntaxError(
      'Only numeric indices or string keys are supported in bracket paths',
      vm.getStackData(),
    );
  }
  vm.compiler.compileOpcode(Op.CloseList);
}

/**
 * Process special tokens such as (, ), `, and postfix list selectors.
 *
 * This function dispatches to the appropriate handler based on the special token:
 * - '(' begins a list
 * - ')' ends a list
 * - '{' or '}' raises a legacy syntax error (brace blocks removed)
 * - '`' begins a symbol literal
 *
 * @param {string} value - The special token value
 * @param {ParserState} state - The current parser state
 */
export function handleSpecial(value: string, state: ParserState): void {
  if (value === '(') {
    beginList(state);
  } else if (value === ')') {
    endList(state);
  } else if (value === "'") {
    // Apostrophe shorthand: read next non-space, non-grouping run as a string
    parseApostropheString(state);
  } else if (value === '[') {
    // General postfix bracket path for any expression on stack: expr[ ... ]
    // Compile path list and then value-by-default retrieval via select→load→nip
    compileBracketPathAsList(state);
    vm.compiler.compileOpcode(Op.Select);
    vm.compiler.compileOpcode(Op.Load);
    vm.compiler.compileOpcode(Op.Nip);
  }
}

/**
 * Parse apostrophe-based bare string shorthand: 'key → LiteralString("key")
 * Reads characters directly until whitespace or grouping.
 */
function parseApostropheString(state: ParserState): void {
  let s = '';
  while (state.tokenizer.position < state.tokenizer.input.length) {
    const ch = state.tokenizer.input[state.tokenizer.position];
    // reuse core helpers via emitString path; stop on space or grouping
    if (isSpecialChar(ch) || ch.trim() === '') break;
    s += ch;
    state.tokenizer.position++;
    state.tokenizer.column++;
  }
  emitString(s);
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
/**
 * Begin an LIST with opening bracket ([).
 * Mirrors beginList but targets LIST ops.
 */
export function beginList(_state: ParserState): void {
  vm.listDepth++;
  vm.compiler.compileOpcode(Op.OpenList);
}

/**
 * End an LIST with closing bracket (]).
 * Mirrors endList but targets LIST ops.
 */
export function endList(_state: ParserState): void {
  if (vm.listDepth <= 0) {
    throw new SyntaxError('Unexpected closing parenthesis', vm.getStackData());
  }

  vm.compiler.compileOpcode(Op.CloseList);
  vm.listDepth--;
}

// Style aliases (Phase 1): prefer shorter emit/handle names for public API
// old aliases removed
