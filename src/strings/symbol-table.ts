/**
 * @file src/strings/symbol-table.ts
 * Symbol table for the Tacit VM.
 */

import { Digest } from './digest';
import { Tag, fromTaggedValue, toTaggedValue, createBuiltinRef, createCodeRef, Verb, VM, NIL, CELL_SIZE, GLOBAL_SIZE, pushSimpleToGlobalHeap, pushListToGlobalHeap, isRef, SEG_DATA, isNIL } from '@src/core';
import { isList, getListLength } from '@src/core';
import { getByteAddressFromRef } from '@src/core';
// Legacy dictionary-heap removed from global definition path

/**
 * Word implementation function type.
 */
type WordFunction = Verb;

/**
 * Symbol table node.
 */
export interface SymbolTableEntry {
  taggedValue: number;
  implementation?: WordFunction;
  isImmediate: boolean;
}

interface SymbolTableNode extends SymbolTableEntry {
  key: number;
  dictEntryRef?: number;
  next: SymbolTableNode | null;
}

export interface SymbolTableCheckpoint {
  head: SymbolTableNode | null;
  dictHead: number;
  gp: number;
  localSlotCount: number;
  newDictHead?: number;
}
/**
 * Symbol table for managing word definitions.
 */
export class SymbolTable {
  private head: SymbolTableNode | null;
  private localSlotCount: number;
  private globalSlotCount: number;
  private vmRef: VM | null;
  // Phase 1 flag: when true, prefer heap-backed dictionary for lookups
  public dictLookupPreferred = true;

  /**
   * Creates a new SymbolTable instance.
   * @param digest String digest for word names
   */
  constructor(private digest: Digest) {
    this.head = null;
    this.localSlotCount = 0;
    this.globalSlotCount = 0;
    this.vmRef = null;
  }

  attachVM(vm: VM): void {
    this.vmRef = vm;
  }

  // Optional: enable/disable heap-backed dictionary lookups (Phase 1)
  setDictFirstLookup(enabled: boolean): void {
    this.dictLookupPreferred = enabled;
  }

  // Traverse heap-backed dictionary and return tagged value if found
  private findInHeapDict(name: string): number | undefined {
    const vm = this.vmRef;
    if (!vm) return undefined;
    let cur = vm.newDictHead;
    while (!isNIL(cur)) {
      const hAddr = getByteAddressFromRef(cur);
      const header = vm.memory.readFloat32(SEG_DATA, hAddr);
      if (!isList(header) || getListLength(header) !== 3) break;
      const base = hAddr - 3 * CELL_SIZE;
      const valueRef = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
      const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
      const entryStr = vm.digest.get(fromTaggedValue(entryName).value);
      if (entryStr === name) {
        // Deref once to return the stored tagged value (builtins/code are simple cells)
        const vAddr = getByteAddressFromRef(valueRef);
        return vm.memory.readFloat32(SEG_DATA, vAddr);
      }
      // Move to prev
      const prevRef = vm.memory.readFloat32(SEG_DATA, base + 0 * CELL_SIZE);
      cur = prevRef;
    }
    return undefined;
  }

  // Phase 0: mirror definitions into heap-backed dictionary (newDictHead chain)
  private mirrorToHeap(name: string, tval: number, nameAddrOverride?: number): void {
    const vm = this.vmRef;
    if (!vm) return;
    const nameAddr = nameAddrOverride ?? this.digest.intern(name);
    const nameTagged = toTaggedValue(nameAddr, Tag.STRING);

    // Materialize valueRef: preserve DATA_REF, otherwise copy simple value
    let valueRef: number;
    if (isRef(tval)) {
      valueRef = tval;
    } else {
      // Capacity check: 1 cell for value + 4 cells for entry list
      const cap = GLOBAL_SIZE / CELL_SIZE;
      const need = 1 + 4;
      if (vm.gp + need > cap) return; // skip mirroring under pressure
      valueRef = pushSimpleToGlobalHeap(vm, tval);
    }

    const prevRef = vm.newDictHead ?? NIL;
    // Capacity check: 4 cells for entry list
    {
      const cap = GLOBAL_SIZE / CELL_SIZE;
      const need = 4;
      if (vm.gp + need > cap) return; // skip mirroring under pressure
    }
    // Build entry [prevRef, valueRef, name] on stack, then copy to global heap
    vm.push(prevRef);
    vm.push(valueRef);
    vm.push(nameTagged);
    const header = toTaggedValue(3, Tag.LIST);
    vm.push(header);
    const baseCell = vm.sp - 1 - 3;
    const baseAddrBytes = baseCell * CELL_SIZE;
    const entryRef = pushListToGlobalHeap(vm, { header, baseAddrBytes });
    // Drop temporary list from stack
    vm.pop();
    vm.pop();
    vm.pop();
    vm.pop();
    vm.newDictHead = entryRef;
  }

  /**
   * Defines symbol with tagged value.
   * @param name Symbol name
   * @param taggedValue Tagged value
   * @param implementation Optional implementation function
   */
  defineSymbol(
    name: string,
    taggedValue: number,
    implementation?: WordFunction,
    isImmediate = false,
    dictEntryRef?: number,
    stringAddress?: number,
  ): void {
    const key = stringAddress ?? this.digest.add(name);

    const newNode: SymbolTableNode = {
      key,
      taggedValue,
      implementation,
      isImmediate,
      dictEntryRef,
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
    if (this.dictLookupPreferred) {
      const dictHit = this.findInHeapDict(name);
      if (dictHit !== undefined) return dictHit;
    }
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
  ): { index: number; implementation?: WordFunction; isImmediate: boolean } | undefined {
    let current = this.head;
    while (current !== null) {
      if (this.digest.get(current.key) === name) {
        const { value: address } = fromTaggedValue(current.taggedValue);
        return {
          index: address,
          implementation: current.implementation,
          isImmediate: current.isImmediate,
        };
      }

      current = current.next;
    }

    return undefined;
  }

  findEntry(name: string): SymbolTableEntry | undefined {
    let current = this.head;
    while (current !== null) {
      if (this.digest.get(current.key) === name) {
        return {
          taggedValue: current.taggedValue,
          implementation: current.implementation,
          isImmediate: current.isImmediate,
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
    const vmInstance = this.vmRef;
    const checkpoint: SymbolTableCheckpoint = {
      head: this.head,
      dictHead: vmInstance ? vmInstance.dictHead : NIL,
      gp: vmInstance ? vmInstance.gp : 0,
      localSlotCount: this.localSlotCount,
      newDictHead: vmInstance ? vmInstance.newDictHead : NIL,
    };
    this.localSlotCount = 0;
    return checkpoint;
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
    this.head = checkpoint.head;
    const vmInstance = this.vmRef;
    if (vmInstance) {
      vmInstance.dictHead = checkpoint.dictHead;
      vmInstance.gp = checkpoint.gp;
      if (typeof checkpoint.newDictHead === 'number') {
        vmInstance.newDictHead = checkpoint.newDictHead;
      }
    }
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
  defineBuiltin(
    name: string,
    opcode: number,
    implementation?: WordFunction,
    isImmediate = false,
  ): void {
    const tval = createBuiltinRef(opcode);
    this.defineSymbol(name, tval, implementation, isImmediate);
    this.mirrorToHeap(name, tval);
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
  defineCode(name: string, bytecodeAddr: number, isImmediate = false): void {
    const tval = createCodeRef(bytecodeAddr);
    const nameAddr = this.digest.intern(name);
    this.defineSymbol(name, tval, undefined, isImmediate, undefined, nameAddr);
    this.mirrorToHeap(name, tval, nameAddr);
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
   * Defines a global variable in the symbol table with auto-slot assignment
   *
   * Globals persist for the lifetime of the program and are not reset by mark()/revert().
   * The tagged value is a GLOBAL_REF with payload = global cell index (slot number).
   */
  defineGlobal(name: string): number {
    const vmInstance = this.vmRef;
    if (!vmInstance) {
      throw new Error('SymbolTable VM reference unavailable; attach VM before defining globals');
    }

    const nameAddr = this.digest.intern(name);
    const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
    // Allocate a global payload cell initialized to NIL
    const payloadRef = pushSimpleToGlobalHeap(vmInstance, NIL);
    // Define in symbol table
    this.globalSlotCount++;
    this.defineSymbol(name, payloadRef, undefined, false, undefined, nameAddr);
    // Create heap-backed dictionary entry [prevRef, valueRef, name]
    this.mirrorToHeap(name, payloadRef, nameAddr);
    return payloadRef;
  }

  /**
   * Returns the number of globals defined so far.
   */
  getGlobalCount(): number {
    return this.globalSlotCount;
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
