import { Digest } from './digest';
import { Verb } from '../core/types';
import { VM } from '../core/vm';

interface SymbolTableNode {
  key: number;
  value: Verb;
  next: SymbolTableNode | null;
  opcode?: number;
  address?: number;
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
  private builtins: (Verb | undefined)[];
  private userDefined: (number | undefined)[];
  private nextOpcode: number;
  private nextFunctionIndex: number;

  constructor(private digest: Digest) {
    this.head = null;
    this.builtins = new Array(128).fill(undefined);
    this.userDefined = [];
    this.nextOpcode = 0;
    this.nextFunctionIndex = 0;
  }
  // Define a new word in the symbolTable
  define(name: string, verb: Verb, options: { isBuiltin?: boolean } = {}): number | undefined {
    const key = this.digest.add(name);
    const newNode: SymbolTableNode = { key, value: verb, next: this.head };
    
    if (options.isBuiltin && this.nextOpcode < 128) {
      newNode.opcode = this.nextOpcode;
      this.builtins[this.nextOpcode] = verb;
      this.nextOpcode++;
      return newNode.opcode;
    }
    
    this.head = newNode;
    return undefined;
  }

  defineCall(name: string, address: number): number {
    const key = this.digest.add(name);
    const newNode: SymbolTableNode = { 
      key, 
      value: compileCall(address), 
      next: this.head,
      address
    };
    
    const index = this.nextFunctionIndex++;
    this.userDefined[index] = address;
    this.head = newNode;
    
    return index;
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
   * Gets a built-in operation by its opcode
   */
  getBuiltin(opcode: number): Verb | undefined {
    if (opcode < 0 || opcode >= this.builtins.length) {
      return undefined;
    }
    return this.builtins[opcode];
  }
  
  /**
   * Gets the address of a user-defined function by its index
   */
  getUserDefined(index: number): number | undefined {
    if (index < 0 || index >= this.userDefined.length) {
      return undefined;
    }
    return this.userDefined[index];
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
