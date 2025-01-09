import { createDictionary, define } from "./dictionary";
import { VM } from "./types";
import { allot, createHeap, mark } from "./memory";
import { builtins } from "./builtins";

export let vm = {} as VM;

export function initializeInterpreter(): void {
  vm.heap = createHeap(10000);
  vm.stack = allot(vm.heap, 100);
  vm.rstack = allot(vm.heap, 100);
  vm.buffer = allot(vm.heap, 100);
  vm.compileBuffer = allot(vm.heap, 100);
  vm.IP = mark(vm.heap);
  vm.compileMode = false;
  vm.nestingScore = 0;
  vm.running = true;

  vm.dictionary = createDictionary();
  for (const [name, word] of Object.entries(builtins)) {
    define(vm.dictionary, name, word);
  }
}
