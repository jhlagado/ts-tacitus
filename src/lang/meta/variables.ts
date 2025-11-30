import {
  SyntaxError,
  getTaggedInfo,
  Tag,
  Tagged,
  getRefArea,
  createGlobalRef,
  isNIL,
} from '@src/core';
import {
  type VM,
  emitOpcode,
  emitUint16,
  ensureReserveEmitted,
  getStackData,
} from '../../core/vm';
import { define, lookup } from '../../core/dictionary';
import { TokenType, tokenizerNext, tokenizerPushBack } from '../tokenizer';
import { Op } from '../../ops/opcodes';
import { getCellFromRef } from '../../core/refs';
import { GLOBAL_BASE, GLOBAL_SIZE } from '../../core/constants';
import { compilePathList } from '../helpers/bracket-path';
import { ensureTokenizer, readNameAfter } from '../helpers/tokenizer-utils';

export function varImmediateOp(vm: VM): void {
  const tokenizer = ensureTokenizer(vm, 'var');
  if (vm.compile.entryCell === -1) {
    throw new SyntaxError(
      'Variable declarations only allowed inside function definitions',
      getStackData(vm),
    );
  }
  const varName = readNameAfter(vm, tokenizer, 'var');
  ensureReserveEmitted(vm);
  const slotNumber = vm.compile.localCount++;
  define(vm, varName, Tagged(slotNumber, Tag.LOCAL));
  emitOpcode(vm, Op.InitVar);
  emitUint16(vm, slotNumber);
}

export function globalImmediateOp(vm: VM): void {
  const tokenizer = ensureTokenizer(vm, 'global');
  if (vm.compile.entryCell !== -1) {
    throw new SyntaxError('Global declarations only allowed at top level', getStackData(vm));
  }
  const varName = readNameAfter(vm, tokenizer, 'global');
  const offset = vm.gp;
  if (offset > 0xffff) {
    throw new SyntaxError('Global variable limit exceeded (64K)', getStackData(vm));
  }
  if (vm.gp >= GLOBAL_SIZE) {
    throw new SyntaxError('Global area exhausted', getStackData(vm));
  }
  vm.gp += 1;
  const globalRef = createGlobalRef(offset);
  define(vm, varName, globalRef);
  emitOpcode(vm, Op.InitGlobal);
  emitUint16(vm, offset);
}

export function assignImmediateOp(vm: VM): void {
  const tokenizer = ensureTokenizer(vm, '->');
  const varName = readNameAfter(vm, tokenizer, '->');
  const symbol = lookup(vm, varName);
  if (isNIL(symbol)) {
    throw new SyntaxError(`Undefined local or global variable: ${varName}`, getStackData(vm));
  }
  const info = getTaggedInfo(symbol);
  const maybeBracket = tokenizerNext(tokenizer);

  if (info.tag === Tag.LOCAL) {
    emitOpcode(vm, Op.VarRef);
    emitUint16(vm, info.value);
    if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      emitOpcode(vm, Op.Fetch);
      compilePathList(vm, tokenizer);
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Nip);
      emitOpcode(vm, Op.Store);
    } else {
      tokenizerPushBack(tokenizer, maybeBracket);
      emitOpcode(vm, Op.Store);
    }
    return;
  }

  if (info.tag === Tag.REF && getRefArea(symbol) === 'global') {
    const absoluteCellIndex = getCellFromRef(symbol);
    const offset = absoluteCellIndex - GLOBAL_BASE;
    emitOpcode(vm, Op.GlobalRef);
    emitUint16(vm, offset);
    if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
      emitOpcode(vm, Op.Fetch);
      compilePathList(vm, tokenizer);
      emitOpcode(vm, Op.Select);
      emitOpcode(vm, Op.Nip);
      emitOpcode(vm, Op.Store);
    } else {
      tokenizerPushBack(tokenizer, maybeBracket);
      emitOpcode(vm, Op.Store);
    }
    return;
  }

  throw new SyntaxError(
    'Assignment operator (->) only allowed for locals or globals',
    getStackData(vm),
  );
}

export function incrementImmediateOp(vm: VM): void {
  const tokenizer = ensureTokenizer(vm, '+>');
  if (vm.compile.entryCell === -1) {
    throw new SyntaxError(
      'Increment operator (+>) only allowed inside function definitions',
      getStackData(vm),
    );
  }
  const varName = readNameAfter(vm, tokenizer, '+>');
  const symbol = lookup(vm, varName);
  if (isNIL(symbol)) {
    throw new SyntaxError(`Undefined local variable: ${varName}`, getStackData(vm));
  }
  const info = getTaggedInfo(symbol);
  if (info.tag !== Tag.LOCAL) {
    throw new SyntaxError(`${varName} is not a local variable`, getStackData(vm));
  }
  const maybeBracket = tokenizerNext(tokenizer);
  emitOpcode(vm, Op.VarRef);
  emitUint16(vm, info.value);
  if (maybeBracket.type === TokenType.SPECIAL && maybeBracket.value === '[') {
    emitOpcode(vm, Op.Fetch);
    compilePathList(vm, tokenizer);
    emitOpcode(vm, Op.Select);
    emitOpcode(vm, Op.Nip);
    emitOpcode(vm, Op.Swap);
    emitOpcode(vm, Op.Over);
    emitOpcode(vm, Op.Fetch);
    emitOpcode(vm, Op.Add);
    emitOpcode(vm, Op.Swap);
    emitOpcode(vm, Op.Store);
  } else {
    tokenizerPushBack(tokenizer, maybeBracket);
    emitOpcode(vm, Op.Swap);
    emitOpcode(vm, Op.Over);
    emitOpcode(vm, Op.Fetch);
    emitOpcode(vm, Op.Add);
    emitOpcode(vm, Op.Swap);
    emitOpcode(vm, Op.Store);
  }
}
