import { defineBuiltins, Op } from "../ops/builtins";
import { Digest } from "./digest";
import { Verb } from "./types";
import { VM } from "./vm";

interface SymbolTableNode {
  key: number;
  value: Verb;
  next: SymbolTableNode | null;
}

const compileCall = (address: number) => (vm: VM) => {
  vm.compiler.compile8(Op.Call);
  vm.compiler.compile16(address);
};

export class SymbolTable {
  private head: SymbolTableNode | null;

  constructor(private digest: Digest) {
    this.head = null;
    defineBuiltins(this);
  }
  // Define a new word in the symbolTable
  define(name: string, verb: Verb): void {
    const key = this.digest.add(name);
    const newNode: SymbolTableNode = { key, value: verb, next: this.head };
    this.head = newNode;
  }

  defineCall(name: string, address: number): void {
    this.define(name, compileCall(address));
  }

  // Find a word in the symbolTable
  find(name: string): Verb | undefined {
    let current = this.head;
    while (current !== null) {
      if (this.digest.get(current.key) === name) {
        return current.value;
      }
      current = current.next;
    }
    return undefined;
  }
}
