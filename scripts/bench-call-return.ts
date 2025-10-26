/* Simple microbenchmark for call/return and local variable access.
 * Usage: ts-node scripts/bench-call-return.ts (or via yarn bench:call)
 */
import { VM } from '../src/core/vm';
import { Compiler } from '../src/lang/compiler';
import { Tokenizer } from '../src/lang/tokenizer';
import { parse } from '../src/lang/parser';
import { execute } from '../src/lang/interpreter';

function compile(vm: VM, code: string) {
  const tokenizer = new Tokenizer(code);
  parse(tokenizer);
}

function bench(iterations: number) {
  const vm = new VM();
  vm.compiler = new Compiler(vm);
  vm.debug = false;

  // Define a simple recursive-like function (non-recursive loop via repeat)
  const code = `: f 0 var x 1 ;`; // simple function with a local
  compile(vm, code);
  const addr = vm.symbolTable.findTaggedValue('f');
  if (addr === undefined) throw new Error('Symbol f not found');

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    vm.push(addr); // push CODE tagged value
    // eval is opcode  ? Instead just force interpreter to execute from base each time
    execute(vm.compiler.BCP); // execute whole compiled program (includes definition + abort)
  }
  const end = performance.now();
  return end - start;
}

function main() {
  const iters = 10000;
  const ms = bench(iters);
  console.log(JSON.stringify({ iterations: iters, msTotal: ms, msPerIter: ms / iters }));
}

main();
