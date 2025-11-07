import { SyntaxError } from '@src/core';
import { vm } from './runtime';
import type { Tokenizer } from './tokenizer';

export interface ActiveDefinition {
  name: string;
  branchPos: number;
  checkpoint: number; // Dictionary mark (heap position)
}

export interface ParserState {
  tokenizer: Tokenizer;
  currentDefinition: ActiveDefinition | null;
}

let currentParserState: ParserState | null = null;

export function setParserState(state: ParserState | null): void {
  currentParserState = state;
}

export function getParserState(): ParserState | null {
  return currentParserState;
}

export function requireParserState(): ParserState {
  if (!currentParserState) {
    throw new SyntaxError(
      'Definition opener/closer used outside of parser context',
      vm.getStackData(),
    );
  }
  return currentParserState;
}
