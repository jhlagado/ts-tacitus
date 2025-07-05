import { Digest } from './digest';
import { Verb } from '../core/types';
import { VM } from '../core/vm';

interface SymbolTableNode {
  key: number;
  value: Verb;
  next: SymbolTableNode | null;
}

const compileCall = (address: number) => (vm: VM) => {
  // In our simplified approach, we compile a direct operation function
  // that jumps to the specified address
  vm.compiler.compileOp((vm: VM) => {
    vm.IP = address;
  });
};

/** Represents a saved state of the symbol table. */
export type SymbolTableCheckpoint = SymbolTableNode | null;

export class SymbolTable {
  private head: SymbolTableNode | null;

  constructor(private digest: Digest) {
    this.head = null;
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

  /**
   * Creates a checkpoint representing the current state of the symbol table.
   * @returns {SymbolTableCheckpoint} An opaque checkpoint object.
   */
  mark(): SymbolTableCheckpoint {
    return this.head;
  }

  /**
   * Reverts the symbol table to a previously created checkpoint.
   * All definitions made after the checkpoint was created will be forgotten.
   * Note: This does not affect the underlying string Digest.
   * @param {SymbolTableCheckpoint} checkpoint The checkpoint to revert to.
   */
  revert(checkpoint: SymbolTableCheckpoint): void {
    this.head = checkpoint;
  }
}
