import { builtins } from "./builtins";
import { Memory } from "./memory";
import { StringBuffer } from "./string-buffer";
import { Verb } from "./types";

interface DictionaryNode {
  key: number;
  value: Verb;
  next: DictionaryNode | null;
}

export class Dictionary {
  private head: DictionaryNode | null;
  private stringBuffer: StringBuffer;

  constructor(private memory: Memory) {
    this.head = null;
    this.stringBuffer = new StringBuffer(this.memory);

    // Initialize the dictionary with builtins
    for (const [name, verb] of Object.entries(builtins)) {
      this.define(name, verb);
    }
  }

  // Define a new word in the dictionary
  define(name: string, word: Verb): void {
    const key = this.stringBuffer.add(name);
    const newNode: DictionaryNode = { key, value: word, next: this.head };
    this.head = newNode;
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