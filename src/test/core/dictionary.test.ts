import { describe, expect, test, beforeEach } from '@jest/globals';
import {
  VM,
  Tag,
  fromTaggedValue,
  SEG_GLOBAL,
  CELL_SIZE,
  NIL,
} from '../../core';
import {
  dictInit,
  dictDefineBuiltin,
  dictDefineCode,
  dictDefineLocal,
  dictDefineGlobal,
  dictLookup,
  dictLookupEntry,
  dictGetEntryRef,
} from '../../core/dictionary';
import { pushSimpleToGlobalHeap } from '../../core/global-heap';
import { decodeDataRef } from '../../core/refs';

describe('Heap dictionary helpers', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
    dictInit(vm);
  });

  test('defines builtin entries on the heap', () => {
    const nameOffset = vm.digest.add('dup');
    const entry = dictDefineBuiltin(vm, nameOffset, 3);

    const payloadInfo = fromTaggedValue(entry.payload);
    expect(payloadInfo.tag).toBe(Tag.BUILTIN);
    expect(payloadInfo.value).toBe(3);
    expect(payloadInfo.meta).toBe(0);

    const { segment, cellIndex } = decodeDataRef(entry.entryRef);
    expect(segment).toBe(SEG_GLOBAL);

    const storedPayload = vm.memory.readFloat32(segment, (cellIndex - 3) * CELL_SIZE);
    expect(storedPayload).toBe(entry.payload);
    expect(vm.dictHead).toBe(entry.entryRef);
  });

  test('sets immediate flag for builtin entries', () => {
    const nameOffset = vm.digest.add('immediate-word');
    const entry = dictDefineBuiltin(vm, nameOffset, 9, true);
    const payloadInfo = fromTaggedValue(entry.payload);
    expect(payloadInfo.meta).toBe(1);
  });

  test('defines code entries with immediate metadata', () => {
    const nameOffset = vm.digest.add('square');
    const entry = dictDefineCode(vm, nameOffset, 0x1234, true);
    const info = fromTaggedValue(entry.payload);
    expect(info.tag).toBe(Tag.CODE);
    expect(info.value).toBe(0x1234);
    expect(info.meta).toBe(1);
  });

  test('auto-assigns local slots and tracks counter', () => {
    const first = dictDefineLocal(vm, vm.digest.add('x'));
    const second = dictDefineLocal(vm, vm.digest.add('y'));

    const firstInfo = fromTaggedValue(first.payload);
    const secondInfo = fromTaggedValue(second.payload);
    expect(firstInfo.tag).toBe(Tag.LOCAL);
    expect(firstInfo.value).toBe(0);
    expect(secondInfo.value).toBe(1);
    expect(vm.dictLocalSlots).toBe(2);
  });

  test('stores global payload references', () => {
    const valueRef = pushSimpleToGlobalHeap(vm, 42);
    const entry = dictDefineGlobal(vm, vm.digest.add('answer'), valueRef);
    expect(entry.payload).toBe(valueRef);
  });

  test('dictDefineGlobal rejects non-reference payloads', () => {
    expect(() => dictDefineGlobal(vm, vm.digest.add('bad'), 123)).toThrow(/DATA_REF/);
  });

  test('lookup returns most recent definition', () => {
    const nameOffset = vm.digest.add('word');
    dictDefineBuiltin(vm, nameOffset, 1);
    const codeEntry = dictDefineCode(vm, nameOffset, 0x200);

    const payload = dictLookup(vm, nameOffset);
    expect(payload).toBe(codeEntry.payload);

    const decoded = fromTaggedValue(payload!);
    expect(decoded.tag).toBe(Tag.CODE);
    expect(decoded.value).toBe(0x200);
  });

  test('lookup entry exposes payload and prev pointer', () => {
    const alpha = vm.digest.add('alpha');
    const beta = vm.digest.add('beta');

    const first = dictDefineBuiltin(vm, alpha, 7);
    const second = dictDefineBuiltin(vm, beta, 8);

    const resolved = dictLookupEntry(vm, alpha);
    expect(resolved).toBeDefined();
    expect(resolved?.entryRef).toBe(first.entryRef);

    const prevInfo = fromTaggedValue(second.prev);
    expect(prevInfo.tag).toBe(Tag.DATA_REF);
    const firstRefInfo = decodeDataRef(first.entryRef);
    expect(prevInfo.value).toBe(firstRefInfo.absoluteCellIndex);
  });

  test('dictGetEntryRef returns NIL for missing names', () => {
    expect(dictGetEntryRef(vm, vm.digest.add('missing'))).toBeUndefined();
  });

  test('dictLookup returns undefined when not found', () => {
    expect(dictLookup(vm, vm.digest.add('shadow'))).toBeUndefined();
  });

  test('dictInit resets head and local slots', () => {
    dictDefineLocal(vm, vm.digest.add('slot-1'));
    dictInit(vm);
    expect(vm.dictHead).toBe(NIL);
    expect(vm.dictLocalSlots).toBe(0);
  });
});
