/**
 * @file src/strings/symbol-table.ts
 * Symbol table facade type and factory. No classes.
 */

import { Digest } from './digest';
import { Tag, fromTaggedValue, toTaggedValue, Verb } from '@src/core';
import type { VM } from '@src/core';
// Decoupled from heap-backed dictionary: no imports from './symbols'

type WordFunction = Verb;

export interface SymbolTableEntry {
  taggedValue: number;
  implementation?: WordFunction;
  isImmediate: boolean;
}
export interface SymbolTableCheckpoint {
  head: null;
  localSlotCount: number;
  fallbackDepth?: number;
  localDepth?: number;
}

export interface SymbolTable {
  attachVM(vm: VM): void;
  setDictFirstLookup(enabled: boolean): void;
  setFallbackEnabled(enabled: boolean): void;
  findTaggedValue(name: string): number | undefined;
  find(name: string): number | undefined;
  findCodeRef(name: string): number | undefined;
  findBytecodeAddress(name: string): number | undefined;
  findEntry(name: string): SymbolTableEntry | undefined;
  findWithImplementation(
    name: string,
  ): { index: number; implementation?: WordFunction; isImmediate: boolean } | undefined;
  defineSymbol(name: string, taggedOrRawValue: number): void;
  defineBuiltin(
    name: string,
    opcode: number,
    implementation?: WordFunction,
    isImmediate?: boolean,
  ): void;
  defineCode(name: string, addr: number, isImmediate?: boolean): void;
  defineLocal(name: string): void;
  mark(): SymbolTableCheckpoint;
  revert(cp: SymbolTableCheckpoint): void;
  getGlobalCount(): number;
  getLocalCount(): number;
}

export function createSymbolTable(digest: Digest): SymbolTable {
  const state = {
    digest,
    vmRef: null as VM | null,
    localSlotCount: 0,
    dictLookupPreferred: true, // retained for API compatibility; unused
    fallbackEnabled: true, // retained for API compatibility; unused
    localDefs: [] as { key: number; tval: number }[],
    fallbackDefs: [] as { key: number; tval: number }[],
  };

  function attachVM(vm: VM): void {
    state.vmRef = vm;
  }
  function setDictFirstLookup(enabled: boolean): void {
    state.dictLookupPreferred = enabled;
  }
  function setFallbackEnabled(enabled: boolean): void {
    state.fallbackEnabled = enabled;
  }
  function findTaggedValue(name: string): number | undefined {
    const key = state.digest.intern(name);
    for (let i = 0; i < state.localDefs.length; i++)
      if (state.localDefs[i].key === key) return state.localDefs[i].tval;
    // Self-contained resolution: locals first, then fallbackDefs
    for (let i = 0; i < state.fallbackDefs.length; i++)
      if (state.fallbackDefs[i].key === key) return state.fallbackDefs[i].tval;
    return undefined;
  }
  function find(name: string): number | undefined {
    const t = findTaggedValue(name);
    if (t === undefined) return undefined;
    const info = fromTaggedValue(t);
    if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return info.value;
    return undefined;
  }
  function findCodeRef(name: string): number | undefined {
    const t = findTaggedValue(name);
    if (t === undefined) return undefined;
    const info = fromTaggedValue(t);
    if (info.tag === Tag.BUILTIN || info.tag === Tag.CODE) return t;
    return undefined;
  }
  function findBytecodeAddress(name: string): number | undefined {
    const t = findTaggedValue(name);
    if (t === undefined) return undefined;
    const info = fromTaggedValue(t);
    if (info.tag === Tag.CODE) return info.value;
    return undefined;
  }
  function findEntry(name: string): SymbolTableEntry | undefined {
    const t = findTaggedValue(name);
    if (t === undefined) return undefined;
    const info = fromTaggedValue(t);
    return { taggedValue: t, implementation: undefined, isImmediate: info.meta === 1 };
  }
  function findWithImplementation(name: string) {
    const entry = findEntry(name);
    if (!entry) return undefined;
    const info = fromTaggedValue(entry.taggedValue);
    return {
      index: info.value,
      implementation: entry.implementation,
      isImmediate: entry.isImmediate,
    };
  }
  function defineSymbol(name: string, taggedOrRawValue: number): void {
    const key = state.digest.intern(name);
    for (let i = 0; i < state.localDefs.length; i++)
      if (state.localDefs[i].key === key) {
        state.localDefs.unshift({ key, tval: taggedOrRawValue });
        return;
      }
    state.fallbackDefs.unshift({ key, tval: taggedOrRawValue });
    // Standalone: no mirroring to heap dictionary
  }
  function defineBuiltin(
    name: string,
    opcode: number,
    implementation?: WordFunction,
    isImmediate = false,
  ): void {
    const tval = toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0);
    state.fallbackDefs.unshift({ key: state.digest.intern(name), tval });
  }
  function defineCode(name: string, addr: number, isImmediate = false): void {
    const tval = toTaggedValue(addr, Tag.CODE, isImmediate ? 1 : 0);
    const key = state.digest.intern(name);
    state.fallbackDefs.unshift({ key, tval });
  }
  function defineLocal(name: string): void {
    let slot: number;
    if (state.vmRef) slot = state.vmRef.localCount++;
    else slot = state.localSlotCount++;
    const tval = toTaggedValue(slot, Tag.LOCAL);
    const key = state.digest.intern(name);
    state.localDefs.unshift({ key, tval });
  }
  function mark(): SymbolTableCheckpoint {
    const cp: SymbolTableCheckpoint = {
      head: null,
      localSlotCount: state.localSlotCount,
      fallbackDepth: state.fallbackDefs.length,
      localDepth: state.localDefs.length,
    };
    state.localSlotCount = 0;
    if (state.vmRef) state.vmRef.localCount = 0;
    return cp;
  }
  function revert(cp: SymbolTableCheckpoint): void {
    // Standalone: do not touch VM heap/dictionary state
    if (typeof cp.fallbackDepth === 'number')
      state.fallbackDefs.splice(0, state.fallbackDefs.length - cp.fallbackDepth);
    if (typeof cp.localDepth === 'number')
      state.localDefs.splice(0, state.localDefs.length - cp.localDepth);
  }
  function getGlobalCount(): number {
    return 0;
  }
  function getLocalCount(): number {
    return state.vmRef ? state.vmRef.localCount : state.localSlotCount;
  }

  return {
    attachVM,
    setDictFirstLookup,
    setFallbackEnabled,
    findTaggedValue,
    find,
    findCodeRef,
    findBytecodeAddress,
    findEntry,
    findWithImplementation,
    defineSymbol,
    defineBuiltin,
    defineCode,
    defineLocal,
    mark,
    revert,
    getGlobalCount,
    getLocalCount,
  };
}
