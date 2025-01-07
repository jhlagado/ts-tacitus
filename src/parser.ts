import { exitDef, literalNumber } from "./builtins";
import { find } from "./dictionary";
import { vm } from "./globalState";
import { push, reset } from "./memory";

/**
 * Parses tokens into a buffer of instructions.
 * @param tokens - The tokens to parse.
 * @returns A buffer of instructions (Word functions or numbers).
 */
export function parse(tokens: (string | number)[]) {
  reset(vm.buffer);
  for (const token of tokens) {
    if (typeof token === "number") {
      push(vm.buffer, literalNumber);
      push(vm.buffer, token);
    } else {
      const fn = find(vm.dictionary, token);
      if (!fn) {
        throw new Error(`Unknown word: ${token}`);
      }
      push(vm.buffer, fn);
    }
  }
  push(vm.buffer, exitDef);
}
