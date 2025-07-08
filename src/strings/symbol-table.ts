import { Digest } from './digest';

interface SymbolTableNode {
  key: number;
  value: number;
  next: SymbolTableNode | null;
}

/**  Represents a saved state of the symbol table. */
export type SymbolTableCheckpoint = SymbolTableNode | null;
export class SymbolTable {
  private head: SymbolTableNode | null;
  constructor(private digest: Digest) {
    this.head = null;
  }

  define(name: string, functionIndex: number): void {
    const key = this.digest.add(name);
    const newNode: SymbolTableNode = { key, value: functionIndex, next: this.head };
    this.head = newNode;
  }

  defineCall(name: string, functionIndex: number): void {
    this.define(name, functionIndex);
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
