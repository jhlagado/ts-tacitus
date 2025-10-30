/**
 * @file src/strings/symbol-table.ts
 * Symbol table facade type and factory. No classes.
 */

import { Digest } from './digest';
import {
  Tag,
  fromTaggedValue,
  toTaggedValue,
  Verb,
  VM,
  NIL,
  CELL_SIZE,
  GLOBAL_SIZE,
  pushSimpleToGlobalHeap,
  pushListToGlobalHeap,
  isRef,
  SEG_DATA,
  isNIL,
} from '@src/core';
import { defineBuiltin as dictDefineBuiltin } from './symbols';
import { isList, getListLength } from '@src/core';
import { getByteAddressFromRef } from '@src/core';

type WordFunction = Verb;

export interface SymbolTableEntry {
  taggedValue: number;
  implementation?: WordFunction;
  isImmediate: boolean;
}
export interface SymbolTableCheckpoint {
  head: null;
  gp: number;
  localSlotCount: number;
  newDictHead?: number;
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
    dictLookupPreferred: true,
    fallbackEnabled: true,
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
  function findInHeapDict(name: string): number | undefined {
    const vm = state.vmRef;
    if (!vm) return undefined;
    let cur = vm.newDictHead;
    let guard = 0;
    while (!isNIL(cur) && guard < 10000) {
      const hAddr = getByteAddressFromRef(cur);
      const header = vm.memory.readFloat32(SEG_DATA, hAddr);
      if (!isList(header) || getListLength(header) !== 3) break;
      const base = hAddr - 3 * CELL_SIZE;
      const valueRef = vm.memory.readFloat32(SEG_DATA, base + 1 * CELL_SIZE);
      const entryName = vm.memory.readFloat32(SEG_DATA, base + 2 * CELL_SIZE);
      const entryStr = vm.digest.get(fromTaggedValue(entryName).value);
      if (entryStr === name) {
        const vAddr = getByteAddressFromRef(valueRef);
        return vm.memory.readFloat32(SEG_DATA, vAddr);
      }
      const prevRef = vm.memory.readFloat32(SEG_DATA, base + 0 * CELL_SIZE);
      cur = prevRef;
      guard++;
    }
    return undefined;
  }
  function mirrorToHeap(name: string, tval: number, nameAddrOverride?: number): void {
    const vm = state.vmRef;
    if (!vm) return;
    const nameAddr = nameAddrOverride ?? state.digest.intern(name);
    const nameTagged = toTaggedValue(nameAddr, Tag.STRING);
    let valueRef: number;
    if (isRef(tval)) valueRef = tval;
    else {
      const cap = GLOBAL_SIZE / CELL_SIZE;
      const need = 1 + 4;
      if (vm.gp + need > cap) return;
      valueRef = pushSimpleToGlobalHeap(vm, tval);
    }
    const prevRef = vm.newDictHead ?? NIL;
    {
      const cap = GLOBAL_SIZE / CELL_SIZE;
      const need = 4;
      if (vm.gp + need > cap) return;
    }
    vm.push(prevRef);
    vm.push(valueRef);
    vm.push(nameTagged);
    const header = toTaggedValue(3, Tag.LIST);
    vm.push(header);
    const baseCell = vm.sp - 1 - 3;
    const baseAddrBytes = baseCell * CELL_SIZE;
    const entryRef = pushListToGlobalHeap(vm, { header, baseAddrBytes });
    vm.pop();
    vm.pop();
    vm.pop();
    vm.pop();
    vm.newDictHead = entryRef;
  }
  function findTaggedValue(name: string): number | undefined {
    const key = state.digest.intern(name);
    for (let i = 0; i < state.localDefs.length; i++)
      if (state.localDefs[i].key === key) return state.localDefs[i].tval;
    if (state.fallbackEnabled) {
      for (let i = 0; i < state.fallbackDefs.length; i++)
        if (state.fallbackDefs[i].key === key) return state.fallbackDefs[i].tval;
    }
    if (state.dictLookupPreferred) {
      const dictHit = findInHeapDict(name);
      if (dictHit !== undefined) return dictHit;
    }
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
    // Prepare for fallback removal: ensure definitions are mirrored to the heap dictionary
    // when a VM is attached so lookups can succeed with fallback disabled.
    if (state.vmRef) {
      const info = fromTaggedValue(taggedOrRawValue);
      // Avoid mirroring locals into the global dictionary here; locals are handled by defineLocal.
      if (info.tag !== Tag.LOCAL) {
        mirrorToHeap(name, taggedOrRawValue, key);
      }
    }
  }
  function defineBuiltin(
    name: string,
    opcode: number,
    implementation?: WordFunction,
    isImmediate = false,
  ): void {
    const tval = toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0);
    state.fallbackDefs.unshift({ key: state.digest.intern(name), tval });
    if (state.vmRef) dictDefineBuiltin(state.vmRef, name, opcode, isImmediate);
  }
  function defineCode(name: string, addr: number, isImmediate = false): void {
    const tval = toTaggedValue(addr, Tag.CODE, isImmediate ? 1 : 0);
    const key = state.digest.intern(name);
    state.fallbackDefs.unshift({ key, tval });
    mirrorToHeap(name, tval, key);
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
    const vm = state.vmRef;
    const cp: SymbolTableCheckpoint = {
      head: null,
      gp: vm ? vm.gp : 0,
      localSlotCount: state.localSlotCount,
      newDictHead: vm ? vm.newDictHead : NIL,
      fallbackDepth: state.fallbackDefs.length,
      localDepth: state.localDefs.length,
    };
    state.localSlotCount = 0;
    if (vm) vm.localCount = 0;
    return cp;
  }
  function revert(cp: SymbolTableCheckpoint): void {
    const vm = state.vmRef;
    if (vm) {
      vm.gp = cp.gp;
      if (typeof cp.newDictHead === 'number') vm.newDictHead = cp.newDictHead;
    }
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
