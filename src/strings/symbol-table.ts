/**
 * @file src/strings/symbol-table.ts
 * Symbol table for the Tacit VM.
 */

import { Digest } from './digest';
import { VM } from '../core/vm';
import { Tag, fromTaggedValue, toTaggedValue } from '../core/tagged';
import { createBuiltinRef, createCodeRef } from '../core/code-ref';

/**
 * Word implementation function type.
 */
type WordFunction = (vm: VM) => void;

/**
 * Symbol table node.
 */
interface SymbolTableNode {
  key: number;
  taggedValue: number;
  implementation?: WordFunction;
  next: SymbolTableNode | null;
}

/**
 * Symbol table checkpoint.
 */
export type SymbolTableCheckpoint = SymbolTableNode | null;
/**
 * Symbol table for managing word definitions.
 */
export class SymbolTable {
  private head: SymbolTableNode | null;
  private localSlotCount: number;

  /**
   * Creates a new SymbolTable instance.
   * @param digest String digest for word names
   */
  constructor(private digest: Digest) {
    this.head = null;
    this.localSlotCount = 0;
  }

  /**
   * Defines symbol with tagged value.
   * @param name Symbol name
   * @param taggedValue Tagged value
   * @param implementation Optional implementation function
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
   * since they don't have bytecode addresses in the code segment.
   *
   * @param {string} name - The name of the word to find
   * @returns {number | undefined} The bytecode address if it's a colon definition, undefined otherwise
   */
  findBytecodeAddress(name: string): number | undefined {
    const taggedValue = this.findTaggedValue(name);
    if (taggedValue !== undefined) {
      const { tag, value } = fromTaggedValue(taggedValue);
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
   * This also resets the local slot counter to zero, which is used for 
   * auto-assigning slot numbers to local variables in functions.
   *
   * This is useful for implementing scoping and temporary definitions.
   *
   * @returns {SymbolTableCheckpoint} A checkpoint object representing the current state
   */
  mark(): SymbolTableCheckpoint {
    this.localSlotCount = 0;
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
  defineBuiltin(name: string, opcode: number, implementation?: WordFunction): void {
    this.defineSymbol(name, createBuiltinRef(opcode), implementation);
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

  /**
   * Defines a local variable in the symbol table with auto-slot assignment
   *
   * This method adds a local variable to the symbol table with an automatically
   * assigned slot number. Each call increments the internal slot counter.
   * Uses Tag.LOCAL tagged values for consistency with the existing system.
   *
   * @param {string} name - The name of the local variable (e.g., "x", "radius")
   */
  defineLocal(name: string): void {
    const slotNumber = this.localSlotCount++;
    this.defineSymbol(name, toTaggedValue(slotNumber, Tag.LOCAL));
  }

  /**
   * Gets the current local variable count
   *
   * This method returns the number of local variables that have been defined
   * since the last mark() call. Useful for back-patching Reserve opcodes.
   *
   * @returns {number} The current local slot count
   */
  getLocalCount(): number {
    return this.localSlotCount;
  }
}
