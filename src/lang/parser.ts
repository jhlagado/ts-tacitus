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
import { getStackData } from '../core/vm';
import type { VM } from '../core/vm';
import type { Token, Tokenizer } from './tokenizer';
import { TokenType } from './tokenizer';
import {
  isSpecialChar,
  fromTaggedValue,
  Tag,
  getRefRegion,
  isNIL,
  UndefinedWordError,
  SyntaxError,
} from '@src/core';
import { emitNumber, emitString } from './literals';
import type { ActiveDefinition } from './state';
import { ensureNoOpenDefinition } from './definitions';
import { executeImmediateWord, ensureNoOpenConditionals } from './meta';
import { lookup, defineLocal } from '../core/dictionary';

/**
 * Main parse function - entry point for parsing Tacit code.
 *
 * This function initializes the parser state, processes the entire program,
 * validates the final state, and adds an abort instruction at the end.
 *
 * @param {VM} vm - The VM instance to use for compilation
 * @param {Tokenizer} tokenizer - The tokenizer that provides the stream of tokens to parse
 */
export function parse(vm: VM, tokenizer: Tokenizer): void {
  vm.compiler.reset();

  const currentDefinition: { current: ActiveDefinition | null } = { current: null };
  (vm as VM & { _currentDefinition: { current: ActiveDefinition | null } })._currentDefinition = currentDefinition;

  try {
    parseProgram(vm, tokenizer, currentDefinition);

    validateFinalState(vm, currentDefinition);

    vm.compiler.compileOpcode(Op.Abort);
  } finally {
    delete (vm as VM & { _currentDefinition?: { current: ActiveDefinition | null } })._currentDefinition;
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
export function parseProgram(
  vm: VM,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  while (true) {
    const token = tokenizer.nextToken();
    if (token.type === TokenType.EOF) {
      break;
    }

    processToken(vm, token, tokenizer, currentDefinition);
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
export function validateFinalState(
  vm: VM,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  ensureNoOpenDefinition(currentDefinition);
  ensureNoOpenConditionals(vm);

  if (vm.listDepth !== 0) {
    throw new SyntaxError('Unclosed list or LIST', getStackData(vm));
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
export function processToken(
  vm: VM,
  token: Token,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  switch (token.type) {
    case TokenType.NUMBER:
      emitNumber(vm, token.value as number);
      break;
    case TokenType.STRING:
      emitString(vm, token.value as string);
      break;
    case TokenType.SPECIAL:
      handleSpecial(vm, token.value as string, tokenizer, currentDefinition);
      break;
    case TokenType.WORD:
      emitWord(vm, token.value as string, tokenizer, currentDefinition);
      break;
    case TokenType.SYMBOL:
      emitAtSymbol(vm, token.value as string, tokenizer, currentDefinition);
      break;
    case TokenType.REF_SIGIL:
      emitRefSigil(vm, token.value as string, tokenizer, currentDefinition);
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
export function emitWord(
  vm: VM,
  value: string,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  if (value === 'var') {
    emitVarDecl(vm, tokenizer, currentDefinition);
    return;
  }

  if (value === '->') {
    emitAssignment(vm, tokenizer, currentDefinition);
    return;
  }

  // 'global' keyword has been removed; treat as undefined or standard word if defined elsewhere.

  if (value === '+>') {
    emitIncrement(vm, tokenizer, currentDefinition);
    return;
  }

  // backtick removed
  const tval = lookup(vm, value);
  if (isNIL(tval)) {
    throw new UndefinedWordError(value, getStackData(vm));
  }

  const info = fromTaggedValue(tval);
  const isImmediate = info.meta === 1;

  if (isImmediate) {
    executeImmediateWord(vm, value, { taggedValue: tval, isImmediate }, tokenizer, currentDefinition);
    return;
  }

  const { tag, value: tagValue } = info;
  const entryValue = tval;

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

    const nextToken = tokenizer.nextToken();
    if (nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compileBracketPathAsList(vm, tokenizer, currentDefinition);
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Load);
      vm.compiler.compileOpcode(Op.Nip);
    } else {
      tokenizer.pushBack(nextToken);
    }
    return;
  }

  if (tag === Tag.DATA_REF) {
    if (getRefRegion(entryValue) !== 'global') {
      throw new UndefinedWordError(value, getStackData(vm));
    }

    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(entryValue);

    const nextToken = tokenizer.nextToken();
    if (nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compileBracketPathAsList(vm, tokenizer, currentDefinition);
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Load);
      vm.compiler.compileOpcode(Op.Nip);
    } else {
      tokenizer.pushBack(nextToken);
      vm.compiler.compileOpcode(Op.Load);
    }
    return;
  }

  throw new UndefinedWordError(value, getStackData(vm));
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
export function emitAtSymbol(
  vm: VM,
  symbolName: string,
  _tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
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
export function emitRefSigil(
  vm: VM,
  varName: string,
  _tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  const tval = lookup(vm, varName);
  if (isNIL(tval)) {
    throw new UndefinedWordError(varName, getStackData(vm));
  }

  const { tag, value: slotNumber } = fromTaggedValue(tval);

  // Inside function: allow locals and globals
  if (currentDefinition.current) {
    if (tag === Tag.LOCAL) {
      vm.compiler.compileOpcode(Op.VarRef);
      vm.compiler.compile16(slotNumber);
      vm.compiler.compileOpcode(Op.Fetch);
      return;
    }
    if (tag === Tag.DATA_REF) {
      if (getRefRegion(tval) !== 'global') {
        throw new Error(`${varName} is not a local variable`);
      }
      vm.compiler.compileOpcode(Op.LiteralNumber);
      vm.compiler.compileFloat32(tval);
      vm.compiler.compileOpcode(Op.Fetch);
      return;
    }
    throw new Error(`${varName} is not a local variable`);
  }

  // Top level: allow &global; locals are invalid (no frame)
  if (tag === Tag.DATA_REF && getRefRegion(tval) === 'global') {
    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(tval);
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
export function emitVarDecl(
  vm: VM,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  if (!currentDefinition.current) {
    throw new SyntaxError(
      'Variable declarations only allowed inside function definitions',
      getStackData(vm),
    );
  }

  const nameToken = tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after var', getStackData(vm));
  }

  const varName = nameToken.value as string;

  if (
    varName.length === 0 ||
    varName === ':' ||
    varName === ';' ||
    (varName.length === 1 && isSpecialChar(varName))
  ) {
    throw new SyntaxError('Expected variable name after var', getStackData(vm));
  }

  vm.compiler.emitReserveIfNeeded();

  defineLocal(vm, varName);
  const slotNumber = vm.localCount - 1;

  vm.compiler.compileOpcode(Op.InitVar);
  vm.compiler.compile16(slotNumber);
}

/**
 * Process global variable declaration with 'global' keyword.
 *
 * Syntax: value global name
 * Behavior: registers a global slot for 'name' and stores TOS into it at runtime.
 */
// emitGlobalDecl removed: globals are not supported in this phase.

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
export function emitAssignment(
  vm: VM,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  const nameToken = tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after ->', getStackData(vm));
  }

  const varName = nameToken.value as string;

  if (
    varName.length === 0 ||
    varName === ':' ||
    varName === ';' ||
    (varName.length === 1 && isSpecialChar(varName))
  ) {
    throw new SyntaxError('Expected variable name after ->', getStackData(vm));
  }

  const tval = lookup(vm, varName);
  if (isNIL(tval)) {
    throw new Error(`Undefined local or global variable: ${varName}`);
  }

  const { tag, value: slotNumber } = fromTaggedValue(tval);
  if (tag === Tag.LOCAL) {
    // Check for bracketed path assignment: value -> x[ ... ]
    const maybeBracket = tokenizer.nextToken();
    if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      // Compile &x semantics for path-based assignment
      vm.compiler.compileOpcode(Op.VarRef);
      vm.compiler.compile16(slotNumber);
      vm.compiler.compileOpcode(Op.Fetch);
      compileBracketPathAsList(vm, tokenizer, currentDefinition);
      // Inline update: select → nip → store
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Nip);
      vm.compiler.compileOpcode(Op.Store);
      return;
    } else {
      // No bracket; put the token back
      tokenizer.pushBack(maybeBracket);
    }
    // Simple variable assignment
    vm.compiler.compileOpcode(Op.VarRef);
    vm.compiler.compile16(slotNumber);
    vm.compiler.compileOpcode(Op.Store);
    return;
  }
  if (tag === Tag.DATA_REF) {
    if (getRefRegion(tval) !== 'global') {
      throw new SyntaxError(
        'Assignment operator (->) only allowed for locals or globals',
        getStackData(vm),
      );
    }
    const maybeBracket = tokenizer.nextToken();
    if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      vm.compiler.compileOpcode(Op.LiteralNumber);
      vm.compiler.compileFloat32(tval);
      vm.compiler.compileOpcode(Op.Fetch);
      compileBracketPathAsList(vm, tokenizer, currentDefinition);
      vm.compiler.compileOpcode(Op.Select);
      vm.compiler.compileOpcode(Op.Nip);
      vm.compiler.compileOpcode(Op.Store);
      return;
    } else {
      tokenizer.pushBack(maybeBracket);
    }
    vm.compiler.compileOpcode(Op.LiteralNumber);
    vm.compiler.compileFloat32(tval);
    vm.compiler.compileOpcode(Op.Store);
    return;
  }
  // Otherwise, not a recognized assignable
  throw new SyntaxError(
    'Assignment operator (->) only allowed for locals or globals',
    getStackData(vm),
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
export function emitIncrement(
  vm: VM,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  if (!currentDefinition.current) {
    throw new SyntaxError(
      'Increment operator (+>) only allowed inside function definitions',
      getStackData(vm),
    );
  }

  const nameToken = tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after +>', getStackData(vm));
  }

  const varName = nameToken.value as string;

  const tval = lookup(vm, varName);
  if (isNIL(tval)) {
    throw new Error(`Undefined local variable: ${varName}`);
  }

  const { tag, value: slotNumber } = fromTaggedValue(tval);
  if (tag !== Tag.LOCAL) {
    throw new Error(`${varName} is not a local variable`);
  }

  // Check for optional bracketed path: value +> x[ ... ]
  const maybeBracket = tokenizer.nextToken();
  if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
    // Build destination sub-address from local list slot: &x fetch [path] select nip
    vm.compiler.compileOpcode(Op.VarRef);
    vm.compiler.compile16(slotNumber);
    vm.compiler.compileOpcode(Op.Fetch);
    compileBracketPathAsList(vm, tokenizer, currentDefinition);
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
  } else {
    // No bracket; put the token back for outer parsing
    tokenizer.pushBack(maybeBracket);
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
function compileBracketPathAsList(
  vm: VM,
  tokenizer: Tokenizer,
  _currentDefinition: { current: ActiveDefinition | null },
): void {
  // Build list: OpenList, emit elements, CloseList
  vm.compiler.compileOpcode(Op.OpenList);
  while (true) {
    const tok = tokenizer.nextToken();
    if (tok.type === TokenType.SPECIAL && tok.value === ']') {
      break;
    }
    if (tok.type === TokenType.NUMBER) {
      emitNumber(vm, tok.value as number);
      continue;
    } else if (tok.type === TokenType.STRING) {
      emitString(vm, tok.value as string);
      continue;
    }
    // Allow empty path [] or numbers only for now
    throw new SyntaxError(
      'Only numeric indices or string keys are supported in bracket paths',
      getStackData(vm),
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
export function handleSpecial(
  vm: VM,
  value: string,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  if (value === '(') {
    beginList(vm);
  } else if (value === ')') {
    endList(vm);
  } else if (value === "'") {
    // Apostrophe shorthand: read next non-space, non-grouping run as a string
    parseApostropheString(vm, tokenizer);
  } else if (value === '[') {
    // General postfix bracket path for any expression on stack: expr[ ... ]
    // Compile path list and then value-by-default retrieval via select→load→nip
    compileBracketPathAsList(vm, tokenizer, currentDefinition);
    vm.compiler.compileOpcode(Op.Select);
    vm.compiler.compileOpcode(Op.Load);
    vm.compiler.compileOpcode(Op.Nip);
  }
}

/**
 * Parse apostrophe-based bare string shorthand: 'key → LiteralString("key")
 * Reads characters directly until whitespace or grouping.
 */
function parseApostropheString(vm: VM, tokenizer: Tokenizer): void {
  let s = '';
  while (tokenizer.position < tokenizer.input.length) {
    const ch = tokenizer.input[tokenizer.position];
    // reuse core helpers via emitString path; stop on space or grouping
    if (isSpecialChar(ch) || ch.trim() === '') {
      break;
    }
    s += ch;
    tokenizer.position++;
    tokenizer.column++;
  }
  emitString(vm, s);
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
export function beginList(vm: VM): void {
  vm.listDepth++;
  vm.compiler.compileOpcode(Op.OpenList);
}

/**
 * End an LIST with closing bracket (]).
 * Mirrors endList but targets LIST ops.
 */
export function endList(vm: VM): void {
  if (vm.listDepth <= 0) {
    throw new SyntaxError('Unexpected closing parenthesis', getStackData(vm));
  }

  vm.compiler.compileOpcode(Op.CloseList);
  vm.listDepth--;
}

// Style aliases (Phase 1): prefer shorter emit/handle names for public API
// old aliases removed
