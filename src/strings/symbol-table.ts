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

import { Digest } from './digest';
import { VM } from '../core/vm';
import { Tag, fromTaggedValue } from '../core/tagged';
import { createBuiltinRef, createCodeRef } from '../core/code-ref';
import { MIN_USER_OPCODE } from '../core/constants';

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
 * - taggedValue: The tagged value for unified @symbol system (Tag.BUILTIN or Tag.CODE)
 * - implementation: Optional JavaScript function implementing the word (for legacy compatibility)
 * - next: Reference to the next node in the linked list
 */
interface SymbolTableNode {
  key: number;
  taggedValue: number; // Unified storage for tagged values
  implementation?: WordFunction; // Keep for transition compatibility
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
   * Defines a symbol in the symbol table with a tagged value
   *
   * This is the unified method for storing symbols with their tagged values.
   * Both built-ins and colon definitions use this method.
   *
   * @param name The symbol name
   * @param taggedValue The tagged value (Tag.BUILTIN or Tag.CODE with address)
   * @param implementation Optional implementation function for legacy compatibility
   */
  defineSymbol(name: string, taggedValue: number, implementation?: WordFunction): void {
    const key = this.digest.add(name);

    const newNode: SymbolTableNode = {
      key,
      taggedValue,
      implementation,
      next: this.head,
    };
    this.head = newNode;
  }

  /**
   * Defines a new word in the symbol table
   *
   * This method adds a new word definition to the symbol table. The word name
   * is added to the digest, and a new node is created at the head of the linked list.
   * Maintains backward compatibility while transitioning to tagged values.
   *
   * @param {string} name - The name of the word to define
   * @param {number} functionIndex - The function index/opcode for the word
   * @param {WordFunction} [implementation] - Optional JavaScript function implementing the word
   */
  define(name: string, functionIndex: number, implementation?: WordFunction): void {
    const key = this.digest.add(name);

    // Create appropriate tagged value based on function index
    let taggedValue: number;
    if (functionIndex < MIN_USER_OPCODE) {
      // Built-in opcode
      taggedValue = createBuiltinRef(functionIndex);
    } else {
      // For now, user-defined words still use function indices
      // This will be updated in later steps when we have direct bytecode addresses
      taggedValue = createCodeRef(functionIndex);
    }

    const newNode: SymbolTableNode = {
      key,
      taggedValue,
      implementation,
      next: this.head,
    };
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
   * Defines a colon definition with direct addressing
   *
   * This method stores the bytecode address directly in the symbol table,
   * enabling direct jumps to user-defined words without any intermediate lookups.
   *
   * @param {string} name - The name of the colon definition
   * @param {number} bytecodeAddr - The bytecode address for direct addressing
   * @param {WordFunction} [implementation] - Optional JavaScript function implementing the word
   */
  defineColonDefinition(name: string, bytecodeAddr: number, implementation?: WordFunction): void {
    // Store the bytecode address directly using defineCode
    // This enables direct addressing without any intermediate lookups
    this.defineCode(name, bytecodeAddr);
  }

  /**
   * Finds a tagged value for a symbol name
   *
   * This method searches the symbol table for a symbol with the given name
   * and returns its tagged value if found. This is the primary method for
   * the unified @symbol system.
   *
   * @param {string} name - The name of the symbol to find
   * @returns {number | undefined} The tagged value if found, undefined otherwise
   */
  findTaggedValue(name: string): number | undefined {
    let current = this.head;
    while (current !== null) {
      if (this.digest.get(current.key) === name) {
        return current.taggedValue;
      }
      current = current.next;
    }
    return undefined;
  }

  /**
   * Finds a word in the symbol table by name
   *
   * This method searches the symbol table for a word with the given name.
   * If found, it returns the function index/opcode for the word.
   * Maintains backward compatibility by extracting address from tagged value.
   *
   * @param {string} name - The name of the word to find
   * @returns {number | undefined} The function index/opcode if found, undefined otherwise
   */
  find(name: string): number | undefined {
    const taggedValue = this.findTaggedValue(name);
    if (taggedValue !== undefined) {
      // Extract the address from the tagged value for backward compatibility
      const { value: address } = fromTaggedValue(taggedValue);
      return address;
    }
    return undefined;
  }

  /**
   * @deprecated Use findTaggedValue instead
   * Legacy compatibility method - findCodeRef now maps to findTaggedValue
   */
  findCodeRef(name: string): number | undefined {
    return this.findTaggedValue(name);
  }

  /**
   * Finds the bytecode address for a colon definition
   *
   * This method searches for colon definitions (Tag.CODE) and returns
   * their bytecode address. Built-ins (Tag.BUILTIN) return undefined
   * since they don't have bytecode addresses in the CODE segment.
   *
   * @param {string} name - The name of the word to find
   * @returns {number | undefined} The bytecode address if it's a colon definition, undefined otherwise
   */
  findBytecodeAddress(name: string): number | undefined {
    const taggedValue = this.findTaggedValue(name);
    if (taggedValue !== undefined) {
      const { tag, value } = fromTaggedValue(taggedValue);
      // Only return bytecode addresses for colon definitions (Tag.CODE)
      if (tag === Tag.CODE) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Finds both the value and implementation for a word
   *
   * This method searches the symbol table for a word with the given name.
   * If found, it returns both the function index/opcode and the implementation function.
   * Maintains backward compatibility by extracting address from tagged value.
   *
   * @param {string} name - The name of the word to lookup
   * @returns {Object | undefined} An object with the index and implementation if found, or undefined
   */
  findWithImplementation(
    name: string,
  ): { index: number; implementation?: WordFunction } | undefined {
    let current = this.head;
    while (current !== null) {
      if (this.digest.get(current.key) === name) {
        // Extract address from tagged value for backward compatibility
        const { value: address } = fromTaggedValue(current.taggedValue);
        return {
          index: address,
          implementation: current.implementation,
        };
      }

      current = current.next;
    }

    return undefined;
  }

  /**
   * Finds a function implementation by its opcode/index value
   *
   * This method searches the symbol table for a word with the given opcode/index.
   * If found and it has an implementation, it returns the implementation function.
   * Uses tagged value comparison for consistency.
   *
   * This is useful for the VM's opcode dispatch mechanism, which needs to find
   * the implementation for a given opcode during execution.
   *
   * @param {number} opcode - The opcode to find an implementation for
   * @returns {WordFunction | undefined} The implementation function if found, otherwise undefined
   */
  findImplementationByOpcode(opcode: number): WordFunction | undefined {
    let current = this.head;
    while (current !== null) {
      // Extract address from tagged value for comparison
      const { value: address } = fromTaggedValue(current.taggedValue);
      if (address === opcode && current.implementation) {
        return current.implementation;
      }
      current = current.next;
    }

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

  // =================================================================================
  // UNIFIED @SYMBOL SYSTEM METHODS (NEW)
  // =================================================================================

  /**
   * Defines a built-in operation in the symbol table with direct addressing
   *
   * This method adds a built-in operation (like add, dup, swap) to the symbol table
   * with a direct tagged value that can be used by the unified @symbol system.
   * Convenience method that calls defineSymbol with a BUILTIN tagged value.
   *
   * @param {string} name - The name of the built-in operation (e.g., "add")
   * @param {number} opcode - The opcode for the built-in operation
   */
  defineBuiltin(name: string, opcode: number): void {
    this.defineSymbol(name, createBuiltinRef(opcode));
  }

  /**
   * Defines a colon definition in the symbol table with direct addressing
   *
   * This method adds a colon definition (user-defined word) to the symbol table
   * with a direct tagged value that can be used by the unified @symbol system.
   * Convenience method that calls defineSymbol with a CODE tagged value.
   *
   * @param {string} name - The name of the colon definition (e.g., "square")
   * @param {number} bytecodeAddr - The bytecode address where the definition starts
   */
  defineCode(name: string, bytecodeAddr: number): void {
    this.defineSymbol(name, createCodeRef(bytecodeAddr));
  }
}
