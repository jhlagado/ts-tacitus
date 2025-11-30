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
import { executeOp } from '../ops/builtins';
import {
  type VM,
  getStackData,
  emitOpcode,
  emitUint16,
  emitFloat32,
  emitUserWordCall,
  resetCompiler,
  depth,
  pop,
} from '../core/vm';
import {
  type Token,
  type Tokenizer,
  TokenType,
  tokenizerNext,
  tokenizerPushBack,
} from './tokenizer';
import {
  isSpecialChar,
  getTaggedInfo,
  Tag,
  getRefArea,
  isNIL,
  UndefinedWordError,
  SyntaxError,
  GLOBAL_BASE,
  getCellFromRef,
  Tagged,
  NIL,
  MIN_USER_OPCODE,
  digestIntern,
} from '@src/core';
import { ensureNoOpenDefinition } from './definition-system';
import {
  runImmediateCode,
  ensureNoOpenConditionals,
  executeImmediateOpcode,
  isBuiltinImmediateOpcode,
} from './meta';
import { lookup } from '../core/dictionary';
import { decodeX1516 } from '../core/code-ref';
import { runTacitCompileLoop } from './compile-loop';
import { compilePathList } from './helpers/bracket-path';

export function tokenNext(vm: VM): { type: TokenType; raw: number } {
  const { tokenizer } = vm.compile;
  if (!tokenizer) {
    throw new Error('token-next: no active tokenizer');
  }

  const token = tokenizerNext(tokenizer);
  let payload: number;

  switch (token.type) {
    case TokenType.NUMBER:
      payload = typeof token.value === 'number' ? token.value : Number(token.value ?? 0);
      break;
    case TokenType.STRING:
    case TokenType.WORD:
    case TokenType.SPECIAL:
    case TokenType.REF_SIGIL: {
      const str = String(token.value ?? '');
      const addr = digestIntern(vm.compile.digest, str);
      payload = Tagged(addr, Tag.STRING);
      break;
    }
    case TokenType.EOF:
      payload = NIL;
      break;
    default:
      payload = NIL;
  }

  return { type: token.type, raw: payload };
}

function tryRunTacitCompileLoop(vm: VM): boolean {
  if (process.env['TACIT_COMPILE_LOOP'] !== '1') {
    return false;
  }

  const stackDepthBefore = depth(vm);
  try {
    runTacitCompileLoop(vm);
    const stackDepthAfter = depth(vm);
    if (stackDepthAfter < stackDepthBefore + 1) {
      throw new Error('Tacit compile loop must push handled flag');
    }
    const handledFlag = pop(vm);
    if (depth(vm) !== stackDepthBefore) {
      throw new Error('Tacit compile loop must leave stack depth unchanged');
    }
    return handledFlag !== 0;
  } finally {
    /* empty */
  }
}

/**
 * Main parse function - entry point for parsing Tacit code.
 *
 * By default, this resets the compiler state, parses the entire program,
 * validates final state, and appends an Abort instruction. Callers can opt
 * out of reset/Abort (e.g., for nested include expansion) via options.
 */
type InternalParseOptions = {
  resetCompiler: boolean;
  emitAbort: boolean;
  sourceName?: string | null;
};

function runParse(vm: VM, tokenizer: Tokenizer, options: InternalParseOptions): void {
  const { resetCompiler: doReset, emitAbort, sourceName } = options;
  if (doReset) {
    resetCompiler(vm);
  }

  const previousTokenizer = vm.compile.tokenizer;
  const previousBranchPos = vm.compile.branchPos;
  const previousCheckpoint = vm.compile.checkpoint;
  const previousEntryCell = vm.compile.entryCell;
  const previousSourceName = vm.compile.currentSource;

  vm.compile.branchPos = -1;
  vm.compile.checkpoint = -1;
  vm.compile.entryCell = -1;
  if (sourceName !== undefined) {
    vm.compile.currentSource = sourceName;
  }
  vm.compile.tokenizer = tokenizer;
  try {
    const handledByTacit = tryRunTacitCompileLoop(vm);
    if (!handledByTacit) {
      parseProgram(vm, tokenizer);
      validateFinalState(vm);
      if (emitAbort) {
        emitOpcode(vm, Op.Abort);
      }
    }
  } finally {
    vm.compile.branchPos = previousBranchPos;
    vm.compile.checkpoint = previousCheckpoint;
    vm.compile.entryCell = previousEntryCell;
    vm.compile.tokenizer = previousTokenizer ?? null;
    if (sourceName !== undefined) {
      vm.compile.currentSource = previousSourceName ?? null;
    }
  }
}

/**
 * Parse a root program: resets compiler state, validates, and appends Abort.
 * Saves/restores branch/checkpoint/entry/tokenizer/currentSource and leaves
 * lastDefinitionCell reflecting the last entry emitted during this parse.
 */
export function parseRoot(vm: VM, tokenizer: Tokenizer, sourceName?: string | null): void {
  runParse(vm, tokenizer, { resetCompiler: true, emitAbort: true, sourceName });
}

/**
 * Parse a child stream (e.g., include): no reset, no Abort, preserves compiler context.
 * Saves/restores branch/checkpoint/entry/tokenizer/currentSource and updates
 * lastDefinitionCell to reflect any new definitions emitted while parsing.
 */
export function parseChild(vm: VM, tokenizer: Tokenizer, sourceName?: string | null): void {
  runParse(vm, tokenizer, { resetCompiler: false, emitAbort: false, sourceName });
}

// Backward compatibility: parse defaults to root behavior; prefer parseRoot/parseChild explicitly.
export function parse(vm: VM, tokenizer: Tokenizer, sourceName?: string | null): void {
  parseRoot(vm, tokenizer, sourceName);
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
    const token = tokenizerNext(tokenizer);
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
  ensureNoOpenDefinition(vm);
  ensureNoOpenConditionals(vm);

  if (vm.compile.listDepth !== 0) {
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
      emitOpcode(vm, Op.LiteralNumber);
      emitFloat32(vm, token.value as number);
      break;
    case TokenType.STRING:
      emitOpcode(vm, Op.LiteralString);
      emitUint16(vm, digestIntern(vm.compile.digest, token.value as string));
      break;
    case TokenType.SPECIAL:
      handleSpecial(vm, token.value as string, tokenizer);
      break;
    case TokenType.WORD:
      emitWord(vm, token.value as string, tokenizer);
      break;
    case TokenType.SYMBOL:
      emitOpcode(vm, Op.LiteralString);
      emitUint16(vm, digestIntern(vm.compile.digest, token.value as string));
      emitOpcode(vm, Op.PushSymbolRef);
      break;
    case TokenType.REF_SIGIL:
      emitRefSigil(vm, tokenizer);
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
  // backtick removed
  const tval = lookup(vm, value);
  if (isNIL(tval)) {
    throw new UndefinedWordError(value, getStackData(vm));
  }

  const info = getTaggedInfo(tval);
  if (info.meta === 1) {
    if (info.tag !== Tag.CODE) {
      throw new SyntaxError(`Immediate word ${value} is not executable`, getStackData(vm));
    }
    const opcodeValue = info.value;
    if (isBuiltinImmediateOpcode(opcodeValue)) {
      executeImmediateOpcode(vm, opcodeValue);
      return;
    }
    if (opcodeValue < MIN_USER_OPCODE) {
      executeOp(vm, opcodeValue);
      return;
    }
    const decodedAddress = decodeX1516(opcodeValue);
    runImmediateCode(vm, decodedAddress);
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

    const nextToken = tokenizerNext(tokenizer);
    if (nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compilePathList(vm, tokenizer);
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Load);
      emitOpcode(vm, Op.Nip);
    } else {
      tokenizerPushBack(tokenizer, nextToken);
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
    emitOpcode(vm, Op.Fetch);

    const nextToken = tokenizerNext(tokenizer);
    if (nextToken.type === TokenType.SPECIAL && nextToken.value === '[') {
      compilePathList(vm, tokenizer);
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Load);
      emitOpcode(vm, Op.Nip);
    } else {
      tokenizerPushBack(tokenizer, nextToken);
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
export function emitRefSigil(vm: VM, tokenizer: Tokenizer): void {
  const nextToken = tokenizerNext(tokenizer);
  if (nextToken.type !== TokenType.WORD) {
    throw new SyntaxError('Expected variable name after &', getStackData(vm));
  }
  const varName = nextToken.value as string;
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
  if (vm.compile.entryCell !== -1) {
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
 * Compiles a bracket path like [0 1] into a list literal on the stack.
 * Supports numeric indices; closes on ']'.
 */
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
    compilePathList(vm, tokenizer);
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
  emitOpcode(vm, Op.LiteralString);
  emitUint16(vm, digestIntern(vm.compile.digest, s));
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
  vm.compile.listDepth++;
  emitOpcode(vm, Op.OpenList);
}

/**
 * End an LIST with closing bracket (]).
 * Mirrors endList but targets LIST ops.
 */
export function endList(vm: VM): void {
  if (vm.compile.listDepth <= 0) {
    throw new SyntaxError('Unexpected closing parenthesis', getStackData(vm));
  }

  emitOpcode(vm, Op.CloseList);
  vm.compile.listDepth--;
}

// Style aliases (Phase 1): prefer shorter emit/handle names for public API
// old aliases removed
