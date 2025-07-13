import { Digest } from '@src/strings/digest';
import { VM } from '@core/vm';

type WordFunction = (vm: VM) => void;

interface SymbolTableNode {
  key: number;
  value: number;
  implementation?: WordFunction;
  next: SymbolTableNode | null;
}

/**  Represents a saved state of the symbol table. */
export type SymbolTableCheckpoint = SymbolTableNode | null;
export class SymbolTable {
  private head: SymbolTableNode | null;
  constructor(private digest: Digest) {
    this.head = null;
  }

  define(name: string, functionIndex: number, implementation?: WordFunction): void {
    const key = this.digest.add(name);
    const newNode: SymbolTableNode = { key, value: functionIndex, implementation, next: this.head };
    this.head = newNode;
  }

  defineCall(name: string, functionIndex: number, implementation?: WordFunction): void {
    this.define(name, functionIndex, implementation);
  }

  find(name: string): number | undefined {
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
   * Finds both the value and implementation for a word
   * @param name The word to lookup
   * @returns An object with the index and implementation if found, or undefined
   */
  findWithImplementation(name: string): { index: number; implementation?: WordFunction } | undefined {
    let current = this.head;
    while (current !== null) {
      if (this.digest.get(current.key) === name) {
        return { 
          index: current.value, 
          implementation: current.implementation 
        };
      }

      current = current.next;
    }

    return undefined;
  }
  
  /**
   * Finds a function implementation by its opcode/index value
   * @param opcode The opcode to find an implementation for
   * @returns The implementation function if found, otherwise undefined
   */
  findImplementationByOpcode(opcode: number): WordFunction | undefined {
    let current = this.head;
    while (current !== null) {
      if (current.value === opcode && current.implementation) {
        return current.implementation;
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
