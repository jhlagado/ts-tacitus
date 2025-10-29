/**
 * @file src/strings/symbol-table.ts
 * Symbol table for the Tacit VM.
 */

import { Digest } from './digest';
import { Tag, fromTaggedValue, toTaggedValue, Verb, VM, NIL, CELL_SIZE, GLOBAL_SIZE, pushSimpleToGlobalHeap, pushListToGlobalHeap, isRef, SEG_DATA, isNIL } from '@src/core';
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

export interface SymbolTableCheckpoint {
  head: null; // legacy field retained for compatibility
  gp: number;
  localSlotCount: number;
  newDictHead?: number;
  fallbackDepth?: number; // number of fallback defs at mark
  implDepth?: number; // number of impl entries at mark
  localDepth?: number; // number of local defs at mark
}
/**
 * Symbol table for managing word definitions.
 */
export class SymbolTable {
  private localSlotCount: number;
  private vmRef: VM | null;
  // Minimal local/fallback stores to support detached usage and locals
  private localDefs: { key: number; tval: number }[] = [];
  private fallbackDefs: { key: number; tval: number }[] = [];
  // Store implementations for immediate/builtin words (parser-time execution)
  private impls: { key: number; fn: WordFunction }[] = [];
  // Phase 1 flag: when true, prefer heap-backed dictionary for lookups
  public dictLookupPreferred = true;

  /**
   * Creates a new SymbolTable instance.
   * @param digest String digest for word names
   */
  constructor(private digest: Digest) {
    this.localSlotCount = 0;
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

  // Mirror definitions into heap-backed dictionary (newDictHead chain)
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
  // Removed generic defineSymbol; builtins/code/locals handled explicitly

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
    // Locals first (compile-time scope)
    const key = this.digest.intern(name);
    for (let i = 0; i < this.localDefs.length; i++) {
      if (this.localDefs[i].key === key) return this.localDefs[i].tval;
    }

    // Fallback store supports detached tests (no VM attached)
    for (let i = 0; i < this.fallbackDefs.length; i++) {
      if (this.fallbackDefs[i].key === key) return this.fallbackDefs[i].tval;
    }

    // Heap-backed dictionary preferred when VM attached
    if (this.dictLookupPreferred) {
      const dictHit = this.findInHeapDict(name);
      if (dictHit !== undefined) return dictHit;
    }
    return undefined;
  }

  // Legacy wrappers (find/findCodeRef/findBytecodeAddress) removed. Use findTaggedValue instead.
  /**
   * Compatibility shim: legacy find(name) → returns numeric address/opcode
   * - For BUILTIN: returns opcode number
   * - For CODE: returns bytecode address
   * - Otherwise: undefined
   */
  find(name: string): number | undefined {
    const t = this.findTaggedValue(name);
    if (t === undefined) return undefined;
    const info = fromTaggedValue(t);
    if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return info.value;
    return undefined;
  }

  /**
   * Compatibility shim: legacy findCodeRef(name) → returns tagged code/builtin ref if present
   */
  findCodeRef(name: string): number | undefined {
    const t = this.findTaggedValue(name);
    if (t === undefined) return undefined;
    const info = fromTaggedValue(t);
    if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return t;
    return undefined;
  }

  /**
   * Compatibility shim: return bytecode address for a CODE word (number), else undefined.
   */
  findBytecodeAddress(name: string): number | undefined {
    const t = this.findTaggedValue(name);
    if (t === undefined) return undefined;
    const info = fromTaggedValue(t);
    if (info.tag === Tag.CODE) return info.value;
    return undefined;
  }

  /**
   * Proxy entry lookup for parser: returns tagged value, immediacy, and optional implementation.
   */
  findEntry(name: string): SymbolTableEntry | undefined {
    const t = this.findTaggedValue(name);
    if (t === undefined) return undefined;
    const key = this.digest.intern(name);
    let impl: WordFunction | undefined = undefined;
    for (let i = 0; i < this.impls.length; i++) {
      if (this.impls[i].key === key) {
        impl = this.impls[i].fn;
        break;
      }
    }
    const info = fromTaggedValue(t);
    return { taggedValue: t, implementation: impl, isImmediate: info.meta === 1 };
  }

  /**
   * Compatibility helper used by a legacy test to force-insert a symbol.
   * If a local exists in current scope, override by inserting into locals; otherwise fallback.
   * Treats the provided number as-is.
   */
  defineSymbol(name: string, taggedOrRawValue: number): void {
    const key = this.digest.intern(name);
    for (let i = 0; i < this.localDefs.length; i++) {
      if (this.localDefs[i].key === key) {
        this.localDefs.unshift({ key, tval: taggedOrRawValue });
        return;
      }
    }
    this.fallbackDefs.unshift({ key, tval: taggedOrRawValue });
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
    const entry = this.findEntry(name);
    if (!entry) return undefined;
    const info = fromTaggedValue(entry.taggedValue);
    return { index: info.value, implementation: entry.implementation, isImmediate: entry.isImmediate };
  }

  // findImplementationByOpcode removed; dispatch table owns opcode→verb mapping.

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
      head: null,
      gp: vmInstance ? vmInstance.gp : 0,
      localSlotCount: this.localSlotCount,
      newDictHead: vmInstance ? vmInstance.newDictHead : NIL,
      fallbackDepth: this.fallbackDefs.length,
      implDepth: this.impls.length,
      localDepth: this.localDefs.length,
    };
    this.localSlotCount = 0;
    if (vmInstance) vmInstance.localCount = 0;
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
    const vmInstance = this.vmRef;
    if (vmInstance) {
      vmInstance.gp = checkpoint.gp;
      if (typeof checkpoint.newDictHead === 'number') {
        vmInstance.newDictHead = checkpoint.newDictHead;
      }
    }
    // Restore fallback/impl depths for detached usage
    if (typeof checkpoint.fallbackDepth === 'number') {
      const cur = this.fallbackDefs.length;
      const target = checkpoint.fallbackDepth;
      const drop = cur - target;
      if (drop > 0) this.fallbackDefs.splice(0, drop);
    }
    if (typeof checkpoint.implDepth === 'number') {
      const cur = this.impls.length;
      const target = checkpoint.implDepth;
      const drop = cur - target;
      if (drop > 0) this.impls.splice(0, drop);
    }
    if (typeof checkpoint.localDepth === 'number') {
      const cur = this.localDefs.length;
      const target = checkpoint.localDepth;
      const drop = cur - target;
      if (drop > 0) this.localDefs.splice(0, drop);
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
    const tval = toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0);
    // Always record fallback to support parser/VM resolution independent of heap state
    this.fallbackDefs.unshift({ key: this.digest.intern(name), tval });
    // Do not mirror builtins to heap here; keep heap pristine until user definitions
    if (implementation) {
      const key = this.digest.intern(name);
      this.impls.unshift({ key, fn: implementation });
    }
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
    const tval = toTaggedValue(bytecodeAddr, Tag.CODE, isImmediate ? 1 : 0);
    const nameAddr = this.digest.intern(name);
    // Always record fallback first
    this.fallbackDefs.unshift({ key: nameAddr, tval });
    if (this.vmRef) this.mirrorToHeap(name, tval, nameAddr);
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
    // Prefer VM-owned counter when attached; fallback to internal for detached tests
    let slotNumber: number;
    if (this.vmRef) {
      slotNumber = this.vmRef.localCount++;
    } else {
      slotNumber = this.localSlotCount++;
    }
    const tval = toTaggedValue(slotNumber, Tag.LOCAL);
    const key = this.digest.intern(name);
    this.localDefs.unshift({ key, tval });
  }

  /**
   * Defines a global variable in the symbol table with auto-slot assignment
   *
   * Globals persist for the lifetime of the program and are not reset by mark()/revert().
   * The tagged value is a GLOBAL_REF with payload = global cell index (slot number).
   */
  // defineGlobal removed: globals are disabled in this phase.

  /**
   * Returns the number of globals defined so far.
   */
  getGlobalCount(): number {
    return 0;
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
    return this.vmRef ? this.vmRef.localCount : this.localSlotCount;
  }
}
