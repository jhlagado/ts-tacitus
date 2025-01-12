import { literalNumber, exitDef } from "./builtins";
import { vm } from "./globalState";
import { reset } from "./memory";

export function parse(tokens: (string | number)[]) {
  reset(vm.buffer);
  for (const token of tokens) {
    if (typeof token === "number") {
      vm.compiler.compile(vm.buffer, literalNumber);
      vm.compiler.compile(vm.buffer, token);
    } else {
      const fn = vm.compiler.dictionary[token]; // Use vm.compiler.dictionary
      if (!fn) {
        throw new Error(`Unknown word: ${token}`);
      }
      vm.compiler.compile(vm.buffer, fn);
    }
  }
  vm.compiler.compile(vm.buffer, exitDef);
}
