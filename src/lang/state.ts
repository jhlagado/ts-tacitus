import { SyntaxError } from '@src/core';
import { getStackData } from '../core/vm';
import type { VM } from '../core/vm';
import type { Tokenizer } from './tokenizer';

export type ActiveDefinition = {
  name: string;
  branchPos: number;
  checkpoint: number; // Dictionary mark (heap position)
}

export type ParserState = {
  vm: VM;
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
      [],
    );
  }
  return currentParserState;
}
