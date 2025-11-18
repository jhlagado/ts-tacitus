import { SyntaxError, Tag, getTaggedInfo } from '@src/core';
import { createBuiltinRef, decodeX1516 } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { emitUserWordCall, getStackData, push, type VM } from '../../core/vm';
import { beginDefinition } from '../definitions';
import type { Tokenizer } from '../tokenizer';
import { getDictionaryEntryInfo } from '../../core/dictionary';

const ENDDEF_CODE_REF = createBuiltinRef(Op.EndDefinition);

function requireTokenizer(vm: VM): Tokenizer {
  const tokenizer = vm.currentTokenizer;
  if (!tokenizer) {
    throw new SyntaxError('Tokenizer is not available for ":"', getStackData(vm));
  }
  return tokenizer;
}

export function beginDefinitionImmediateOp(vm: VM): void {
  beginDefinition(vm, requireTokenizer(vm));
  push(vm, ENDDEF_CODE_REF);
}

export function recurseImmediate(
  vm: VM,
  _tokenizer: Tokenizer,
): void {
  if (!vm.currentDefinition) {
    throw new SyntaxError('RECURSE outside definition', getStackData(vm));
  }

  const entryInfo = getDictionaryEntryInfo(vm, vm.currentDefinition.entryCell);
  if (!entryInfo.hidden) {
    throw new SyntaxError('RECURSE requires active definition', getStackData(vm));
  }

  const payloadInfo = getTaggedInfo(entryInfo.payload);
  if (payloadInfo.tag !== Tag.CODE) {
    throw new SyntaxError('Active definition payload invalid for RECURSE', getStackData(vm));
  }

  const address = decodeX1516(payloadInfo.value);
  emitUserWordCall(vm, address);
}
