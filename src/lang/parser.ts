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
import {
  type VM,
  getStackData,
  emitOpcode,
  emitUint16,
  emitUserWordCall,
  ensureReserveEmitted,
  resetCompiler,
} from '../core/vm';
import { type Token, type Tokenizer, TokenType } from './tokenizer';
import {
  isSpecialChar,
  getTaggedInfo,
  Tag,
  getRefArea,
  isNIL,
  UndefinedWordError,
  SyntaxError,
  GLOBAL_BASE,
  GLOBAL_SIZE,
  createGlobalRef,
  getCellFromRef,
  Tagged,
} from '@src/core';
import { emitNumber, emitString } from './literals';
import { ensureNoOpenDefinition } from './definitions';
import { executeImmediateWord, ensureNoOpenConditionals } from './meta';
import { lookup, define } from '../core/dictionary';
import { decodeX1516 } from '../core/code-ref';

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
  resetCompiler(vm);

  vm.currentDefinition = null;

  try {
    parseProgram(vm, tokenizer);

    validateFinalState(vm);

    emitOpcode(vm, Op.Abort);
  } finally {
    vm.currentDefinition = null;
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
export function parseProgram(vm: VM, tokenizer: Tokenizer): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const token = tokenizer.nextToken();
    if (token.type === TokenType.EOF) {
      break;
    }

    processToken(vm, token, tokenizer);
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
export function validateFinalState(vm: VM): void {
  ensureNoOpenDefinition(vm.currentDefinition);
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
export function processToken(vm: VM, token: Token, tokenizer: Tokenizer): void {
  switch (token.type) {
    case TokenType.NUMBER:
      emitNumber(vm, token.value as number);
      break;
    case TokenType.STRING:
      emitString(vm, token.value as string);
      break;
    case TokenType.SPECIAL:
      handleSpecial(vm, token.value as string, tokenizer);
      break;
    case TokenType.WORD:
      emitWord(vm, token.value as string, tokenizer);
      break;
    case TokenType.SYMBOL:
      emitAtSymbol(vm, token.value as string, tokenizer);
      break;
    case TokenType.REF_SIGIL:
      emitRefSigil(vm, token.value as string, tokenizer);
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
export function emitWord(vm: VM, value: string, tokenizer: Tokenizer): void {
  if (value === 'var') {
    emitVarDecl(vm, tokenizer);
    return;
  }

  if (value === '->') {
    emitAssignment(vm, tokenizer);
    return;
  }

  if (value === 'global') {
    emitGlobalDecl(vm, tokenizer);
    return;
  }

  if (value === '+>') {
    emitIncrement(vm, tokenizer);
    return;
  }

  // backtick removed
  const tval = lookup(vm, value);
  if (isNIL(tval)) {
    throw new UndefinedWordError(value, getStackData(vm));
  }

  const info = getTaggedInfo(tval);
  const isImmediate = info.meta === 1;

  if (isImmediate) {
    executeImmediateWord(vm, value, { taggedValue: tval, isImmediate }, tokenizer);
    return;
  }

  const { tag, value: tagValue } = info;
  const entryValue = tval;

  if (tag === Tag.CODE) {
    // If encoded value < 128, it's invalid X1516 format, so treat as builtin opcode
    if (tagValue < 128) {
      // Use encoded value directly as opcode (0-127), emit single byte
      emitOpcode(vm, tagValue);
      return;
    }
    // Otherwise, decode X1516 and compile as user word call (two bytes)
    const decodedAddress = decodeX1516(tagValue);
    emitUserWordCall(vm, decodedAddress);
    return;
  }

  if (tag === Tag.LOCAL) {
    emitOpcode(vm, Op.VarRef);
    emitUint16(vm, tagValue);
    emitOpcode(vm, Op.Load);

    const nextToken = tokenizer.nextToken();
    if (nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compileBracketPathAsList(vm, tokenizer);
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Load);
      emitOpcode(vm, Op.Nip);
    } else {
      tokenizer.pushBack(nextToken);
    }
    return;
  }

  if (tag === Tag.REF) {
    if (getRefArea(entryValue) !== 'global') {
      throw new UndefinedWordError(value, getStackData(vm));
    }

    // Calculate offset from cell index: offset = cellIndex - GLOBAL_BASE
    const cellIndex = getCellFromRef(entryValue);
    const offset = cellIndex - GLOBAL_BASE;

    emitOpcode(vm, Op.GlobalRef);
    emitUint16(vm, offset);

    const nextToken = tokenizer.nextToken();
    if (nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compileBracketPathAsList(vm, tokenizer);
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Load);
      emitOpcode(vm, Op.Nip);
    } else {
      tokenizer.pushBack(nextToken);
      emitOpcode(vm, Op.Load);
    }
    return;
  }

  throw new UndefinedWordError(value, getStackData(vm));
}

/**
 * Process @symbol tokens for unified code references.
 *
 * This function handles @symbol syntax by calling vm.pushSymbolRef() to resolve
 * the symbol to a Tag.CODE tagged value and push it to the stack.
 * The resulting tagged value can be used with 'eval' for metaprogramming.
 *
 * Examples:
 * - @add → Tag.CODE(Op.Add) (value < 128, stored directly)
 * - @square → Tag.CODE(bytecode_addr)
 *
 * @param {string} symbolName - The symbol name after @ (without the @ prefix)
 * @param {ParserState} state - Current parser state (unused but maintains consistency)
 */
export function emitAtSymbol(vm: VM, symbolName: string, _tokenizer: Tokenizer): void {
  emitOpcode(vm, Op.LiteralString);
  const stringAddress = vm.digest.add(symbolName);
  emitUint16(vm, stringAddress);

  emitOpcode(vm, Op.PushSymbolRef);
}

/**
 * Process &variable tokens for explicit reference access.
 *
 * This function handles &variable syntax by compiling VarRef + Fetch
 * to create a REF to the local variable slot.
 *
 * @param {string} varName - The variable name after & (without the & prefix)
 * @param {ParserState} state - The current parser state
 * @throws {Error} If variable is undefined or not a local variable
 */
export function emitRefSigil(vm: VM, varName: string, _tokenizer: Tokenizer): void {
  const tval = lookup(vm, varName);
  if (isNIL(tval)) {
    throw new UndefinedWordError(varName, getStackData(vm));
  }

  const { tag, value } = getTaggedInfo(tval);

  // NEW: Handle code references (unified Tag.CODE)
  if (tag === Tag.CODE) {
    emitOpcode(vm, Op.LiteralCode);
    emitUint16(vm, value); // Tag.CODE value (builtin < 128 or X1516 encoded >= 128)
    return;
  }

  // Existing variable reference logic...
  // Inside function: allow locals and globals
  // &buf compiles to VarRef + Fetch, where Fetch returns a REF (does NOT materialize)
  if (vm.currentDefinition) {
    if (tag === Tag.LOCAL) {
      emitOpcode(vm, Op.VarRef);
      emitUint16(vm, value);
      emitOpcode(vm, Op.Fetch);
      return;
    }
    if (tag === Tag.REF) {
      if (getRefArea(tval) !== 'global') {
        throw new Error(`${varName} is not a variable or function`);
      }
      // Calculate offset from absolute cell index
      const absoluteCellIndex = getCellFromRef(tval);
      const offset = absoluteCellIndex - GLOBAL_BASE;
      emitOpcode(vm, Op.GlobalRef);
      emitUint16(vm, offset);
      emitOpcode(vm, Op.Fetch);
      return;
    }
    throw new Error(`${varName} is not a variable or function`);
  }

  // Top level: allow &global; locals are invalid (no frame)
  if (tag === Tag.REF && getRefArea(tval) === 'global') {
    // Calculate offset from absolute cell index
    const absoluteCellIndex = getCellFromRef(tval);
    const offset = absoluteCellIndex - GLOBAL_BASE;
    emitOpcode(vm, Op.GlobalRef);
    emitUint16(vm, offset);
    emitOpcode(vm, Op.Fetch);
    return;
  }
  throw new Error(`${varName} is not a variable or function`);
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
export function emitVarDecl(vm: VM, tokenizer: Tokenizer): void {
  if (!vm.currentDefinition) {
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

  ensureReserveEmitted(vm);

  const slotNumber = vm.localCount++;
  define(vm, varName, Tagged(slotNumber, Tag.LOCAL));

  emitOpcode(vm, Op.InitVar);
  emitUint16(vm, slotNumber);
}

/**
 * Process global variable declaration with 'global' keyword.
 *
 * Syntax: value global name
 * Behavior: registers a global slot for 'name' and stores TOS into it at runtime.
 *
 * Steps:
 * 1. Check top-level scope (must NOT be inside function)
 * 2. Read variable name
 * 3. Calculate offset: offset = vm.gp (relative to GLOBAL_BASE)
 * 4. Check 16-bit offset limit: offset <= 0xffff
 * 5. Check runtime boundary: vm.gp < GLOBAL_SIZE
 * 6. Emit GlobalRef <offset>; Store
 * 7. Register in dictionary: define(vm, name, createGlobalRef(offset))
 * 8. Increment vm.gp after successful declaration
 */
export function emitGlobalDecl(vm: VM, tokenizer: Tokenizer): void {
  // Top-level restriction: must NOT be inside function
  if (vm.currentDefinition) {
    throw new SyntaxError('Global declarations only allowed at top level', getStackData(vm));
  }

  const nameToken = tokenizer.nextToken();
  if (nameToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after global', getStackData(vm));
  }

  const varName = nameToken.value as string;

  if (
    varName.length === 0 ||
    varName === ':' ||
    varName === ';' ||
    (varName.length === 1 && isSpecialChar(varName))
  ) {
    throw new SyntaxError('Expected variable name after global', getStackData(vm));
  }

  // Calculate offset: vm.gp is already relative to GLOBAL_BASE
  const offset = vm.gp;

  // Check 16-bit offset limit (compile-time constraint)
  if (offset > 0xffff) {
    throw new SyntaxError('Global variable limit exceeded (64K)', getStackData(vm));
  }

  // Check runtime boundary (actual area limit)
  if (vm.gp >= GLOBAL_SIZE) {
    throw new SyntaxError('Global area exhausted', getStackData(vm));
  }

  // Reserve the global cell by incrementing gp FIRST
  // This ensures the cell is allocated before dictionary registration
  vm.gp += 1;

  // Register in dictionary (uses the offset we calculated before incrementing)
  const globalRef = createGlobalRef(offset);
  define(vm, varName, globalRef);

  // Emit InitGlobal opcode (matches InitVar pattern for locals)
  // Directly writes to global cell without Store opcode compatibility checks
  emitOpcode(vm, Op.InitGlobal);
  emitUint16(vm, offset);
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
export function emitAssignment(vm: VM, tokenizer: Tokenizer): void {
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

  const { tag, value: slotNumber } = getTaggedInfo(tval);
  if (tag === Tag.LOCAL) {
    // Check for bracketed path assignment: value -> x[ ... ]
    const maybeBracket = tokenizer.nextToken();
    if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      // Compile &x semantics for path-based assignment
      emitOpcode(vm, Op.VarRef);
      emitUint16(vm, slotNumber);
      emitOpcode(vm, Op.Fetch);
      compileBracketPathAsList(vm, tokenizer);
      // Inline update: select → nip → store
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Nip);
      emitOpcode(vm, Op.Store);
      return;
    } else {
      // No bracket; put the token back
      tokenizer.pushBack(maybeBracket);
    }
    // Simple variable assignment
    emitOpcode(vm, Op.VarRef);
    emitUint16(vm, slotNumber);
    emitOpcode(vm, Op.Store);
    return;
  }
  if (tag === Tag.REF) {
    if (getRefArea(tval) !== 'global') {
      throw new SyntaxError(
        'Assignment operator (->) only allowed for locals or globals',
        getStackData(vm),
      );
    }
    // Calculate offset from absolute cell index
    const absoluteCellIndex = getCellFromRef(tval);
    const offset = absoluteCellIndex - GLOBAL_BASE;

    const maybeBracket = tokenizer.nextToken();
    if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      emitOpcode(vm, Op.GlobalRef);
      emitUint16(vm, offset);
      emitOpcode(vm, Op.Fetch);
      compileBracketPathAsList(vm, tokenizer);
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Nip);
      emitOpcode(vm, Op.Store);
      return;
    } else {
      tokenizer.pushBack(maybeBracket);
    }
    emitOpcode(vm, Op.GlobalRef);
    emitUint16(vm, offset);
    emitOpcode(vm, Op.Store);
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
export function emitIncrement(vm: VM, tokenizer: Tokenizer): void {
  if (!vm.currentDefinition) {
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

  const { tag, value: slotNumber } = getTaggedInfo(tval);
  if (tag !== Tag.LOCAL) {
    throw new Error(`${varName} is not a local variable`);
  }

  // Check for optional bracketed path: value +> x[ ... ]
  const maybeBracket = tokenizer.nextToken();
  if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
    // Build destination sub-address from local list slot: &x fetch [path] select nip
    emitOpcode(vm, Op.VarRef);
    emitUint16(vm, slotNumber);
    emitOpcode(vm, Op.Fetch);
    compileBracketPathAsList(vm, tokenizer);
    emitOpcode(vm, Op.Select);
    emitOpcode(vm, Op.Nip);

    // Now perform RMW on that address: swap, over, fetch, add, swap, store
    emitOpcode(vm, Op.Swap);
    emitOpcode(vm, Op.Over);
    emitOpcode(vm, Op.Fetch);
    emitOpcode(vm, Op.Add);
    emitOpcode(vm, Op.Swap);
    emitOpcode(vm, Op.Store);
    return;
  } else {
    // No bracket; put the token back for outer parsing
    tokenizer.pushBack(maybeBracket);
  }

  // Simple locals-only increment sugar: value x add -> x
  // Start: [..., inc]
  emitOpcode(vm, Op.VarRef);
  emitUint16(vm, slotNumber); // [..., inc, addr]
  emitOpcode(vm, Op.Swap); // [..., addr, inc]
  emitOpcode(vm, Op.Over); // [..., addr, inc, addr]
  emitOpcode(vm, Op.Fetch); // [..., addr, inc, value]
  emitOpcode(vm, Op.Add); // [..., addr, sum]
  emitOpcode(vm, Op.Swap); // [..., sum, addr]
  emitOpcode(vm, Op.Store); // []
}

/**
 * Compiles a bracket path like [0 1] into a list literal on the stack.
 * Supports numeric indices; closes on ']'.
 */
function compileBracketPathAsList(vm: VM, tokenizer: Tokenizer): void {
  // Build list: OpenList, emit elements, CloseList
  emitOpcode(vm, Op.OpenList);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
  emitOpcode(vm, Op.CloseList);
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
export function handleSpecial(vm: VM, value: string, tokenizer: Tokenizer): void {
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
    compileBracketPathAsList(vm, tokenizer);
    emitOpcode(vm, Op.Select);
    emitOpcode(vm, Op.Load);
    emitOpcode(vm, Op.Nip);
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
  emitOpcode(vm, Op.OpenList);
}

/**
 * End an LIST with closing bracket (]).
 * Mirrors endList but targets LIST ops.
 */
export function endList(vm: VM): void {
  if (vm.listDepth <= 0) {
    throw new SyntaxError('Unexpected closing parenthesis', getStackData(vm));
  }

  emitOpcode(vm, Op.CloseList);
  vm.listDepth--;
}

// Style aliases (Phase 1): prefer shorter emit/handle names for public API
// old aliases removed
