import { literalNumber } from "./builtins";
import { find } from "./dictionary";
import { vm } from "./globalState";
import { Verb } from "./types";

/**
 * Parses tokens into a buffer of instructions.
 * @param tokens - The tokens to parse.
 * @returns A buffer of instructions (Word functions or numbers).
 */
export function parse(tokens: (string | number)[]): (Verb | number)[] {
  const buffer: (Verb | number)[] = [];
  for (const token of tokens) {
    if (typeof token === "number") {
      buffer.push(literalNumber, token);
    } else {
      const fn = find(vm.dictionary, token);
      if (!fn) {
        throw new Error(`Unknown word: ${token}`);
      }
      buffer.push(fn);
    }
  }
  return buffer;
}
