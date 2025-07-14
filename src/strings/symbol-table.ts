/**
 * @file src/strings/symbol-table.ts
 * 
 * This file implements the symbol table for the Tacit VM.
 * 
 * The symbol table is responsible for mapping word names (symbols) to their
 * function indices and implementations. It provides functionality for defining,
 * finding, and executing words in the Tacit language. The symbol table uses
 * a linked list structure for efficient insertion and lookup.
 * 
 * The symbol table also supports checkpointing and reverting, which is useful
 * for implementing scoping and temporary definitions.
 */

import { Digest } from '@src/strings/digest';
import { VM } from '@core/vm';

/**
 * Type definition for a word implementation function
 * 
 * A WordFunction is a JavaScript function that implements a Tacit word.
 * It receives the VM instance as its argument and manipulates the VM state directly.
 */
type WordFunction = (vm: VM) => void;

/**
 * Represents a node in the symbol table linked list
 * 
 * Each node contains:
 * - key: The address of the word name in the string digest
 * - value: The function index/opcode for the word
 * - implementation: Optional JavaScript function implementing the word
 * - next: Reference to the next node in the linked list
 */
interface SymbolTableNode {
  key: number;
  value: number;
  implementation?: WordFunction;
  next: SymbolTableNode | null;
}

/**
 * Represents a saved state of the symbol table
 * 
 * A checkpoint is simply a reference to the head of the symbol table
 * linked list at the time the checkpoint was created. This allows for
 * efficient reverting to a previous state.
 */
export type SymbolTableCheckpoint = SymbolTableNode | null;
/**
 * The SymbolTable class manages word definitions in the Tacit VM
 * 
 * It provides methods for defining words, looking up words by name or opcode,
 * and managing the symbol table state through checkpoints and reverting.
 * The symbol table is implemented as a linked list for efficient insertion
 * and lookup operations.
 */
export class SymbolTable {
  /**
   * The head of the symbol table linked list
   */
  private head: SymbolTableNode | null;

  /**
   * Creates a new SymbolTable instance
   * 
   * @param {Digest} digest - The string digest to use for storing word names
   */
  constructor(private digest: Digest) {
    this.head = null;
  }

  /**
   * Defines a new word in the symbol table
   * 
   * This method adds a new word definition to the symbol table. The word name
   * is added to the digest, and a new node is created at the head of the linked list.
   * 
   * @param {string} name - The name of the word to define
   * @param {number} functionIndex - The function index/opcode for the word
   * @param {WordFunction} [implementation] - Optional JavaScript function implementing the word
   */
  define(name: string, functionIndex: number, implementation?: WordFunction): void {
    // Add the word name to the digest
    const key = this.digest.add(name);
    
    // Create a new node at the head of the linked list
    const newNode: SymbolTableNode = { key, value: functionIndex, implementation, next: this.head };
    this.head = newNode;
  }

  /**
   * Defines a callable word in the symbol table
   * 
   * This is an alias for the define method, provided for semantic clarity
   * when defining words that are meant to be called directly.
   * 
   * @param {string} name - The name of the word to define
   * @param {number} functionIndex - The function index/opcode for the word
   * @param {WordFunction} [implementation] - Optional JavaScript function implementing the word
   */
  defineCall(name: string, functionIndex: number, implementation?: WordFunction): void {
    this.define(name, functionIndex, implementation);
  }

  /**
   * Finds a word in the symbol table by name
   * 
   * This method searches the symbol table for a word with the given name.
   * If found, it returns the function index/opcode for the word.
   * 
   * @param {string} name - The name of the word to find
   * @returns {number | undefined} The function index/opcode if found, undefined otherwise
   */
  find(name: string): number | undefined {
    // Traverse the linked list
    let current = this.head;
    while (current !== null) {
      // Compare the word name with the current node
      if (this.digest.get(current.key) === name) {
        return current.value;
      }

      current = current.next;
    }

    // Word not found
    return undefined;
  }
  
  /**
   * Finds both the value and implementation for a word
   * 
   * This method searches the symbol table for a word with the given name.
   * If found, it returns both the function index/opcode and the implementation function.
   * 
   * @param {string} name - The name of the word to lookup
   * @returns {Object | undefined} An object with the index and implementation if found, or undefined
   */
  findWithImplementation(name: string): { index: number; implementation?: WordFunction } | undefined {
    // Traverse the linked list
    let current = this.head;
    while (current !== null) {
      // Compare the word name with the current node
      if (this.digest.get(current.key) === name) {
        return { 
          index: current.value, 
          implementation: current.implementation 
        };
      }

      current = current.next;
    }

    // Word not found
    return undefined;
  }
  
  /**
   * Finds a function implementation by its opcode/index value
   * 
   * This method searches the symbol table for a word with the given opcode/index.
   * If found and it has an implementation, it returns the implementation function.
   * 
   * This is useful for the VM's opcode dispatch mechanism, which needs to find
   * the implementation for a given opcode during execution.
   * 
   * @param {number} opcode - The opcode to find an implementation for
   * @returns {WordFunction | undefined} The implementation function if found, otherwise undefined
   */
  findImplementationByOpcode(opcode: number): WordFunction | undefined {
    // Traverse the linked list
    let current = this.head;
    while (current !== null) {
      // Check if the current node matches the opcode and has an implementation
      if (current.value === opcode && current.implementation) {
        return current.implementation;
      }
      current = current.next;
    }
    
    // Implementation not found
    return undefined;
  }

  /**
   * Creates a checkpoint representing the current state of the symbol table
   * 
   * This method returns a checkpoint that can be used to revert the symbol table
   * to its current state at a later time. The checkpoint is simply a reference
   * to the current head of the linked list.
   * 
   * This is useful for implementing scoping and temporary definitions.
   * 
   * @returns {SymbolTableCheckpoint} A checkpoint object representing the current state
   */
  mark(): SymbolTableCheckpoint {
    return this.head;
  }

  /**
   * Reverts the symbol table to a previously created checkpoint
   * 
   * This method restores the symbol table to the state it was in when the
   * checkpoint was created. All definitions made after the checkpoint was
   * created will be forgotten.
   * 
   * Note that this only affects the symbol table structure, not the underlying
   * string digest. Word names added to the digest will remain there even after
   * reverting the symbol table.
   * 
   * @param {SymbolTableCheckpoint} checkpoint - The checkpoint to revert to
   */
  revert(checkpoint: SymbolTableCheckpoint): void {
    this.head = checkpoint;
  }
}
