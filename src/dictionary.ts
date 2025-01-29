import { defineBuiltins, Op } from "./builtins";
import { Memory } from "./memory";
import { StringBuffer } from "./strings";
import { Verb } from "./types";
import { VM } from "./vm";

interface DictionaryNode {
  key: number;
  value: Verb;
  next: DictionaryNode | null;
}

const compileCall = (address: number) => (vm: VM) => {
  vm.compiler.compile8(Op.Call);
  vm.compiler.compile16(address);
};

export class Dictionary {
  private head: DictionaryNode | null;
  private stringBuffer: StringBuffer;

  constructor(private memory: Memory) {
    this.head = null;
    this.stringBuffer = new StringBuffer(this.memory);
    defineBuiltins(this);
  }
  // Define a new word in the dictionary
  define(name: string, verb: Verb): void {
    const key = this.stringBuffer.add(name);
    const newNode: DictionaryNode = { key, value: verb, next: this.head };
    this.head = newNode;
  }

  defineCall(name: string, address: number): void {
    this.define(name, compileCall(address));
  }

  // Find a word in the dictionary
  find(name: string): Verb | undefined {
    let current = this.head;
    while (current !== null) {
      if (this.stringBuffer.get(current.key) === name) {
        return current.value;
      }
      current = current.next;
    }
    return undefined;
  }
}
