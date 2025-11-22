import { SyntaxError, Tag, getTaggedInfo } from '@src/core';
import { createCodeRef, decodeX1516 } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { emitUserWordCall, getStackData, push, type VM } from '../../core/vm';
import { beginDefinition } from '../definition-system';
import { getDictionaryEntryInfo } from '../../core/dictionary';
import { ensureTokenizer } from '../helpers/tokenizer-utils';

const ENDDEF_CODE_REF = createCodeRef(Op.EndDefinition);

export function beginDefinitionImmediateOp(vm: VM): void {
  beginDefinition(vm, ensureTokenizer(vm, ':'));
  push(vm, ENDDEF_CODE_REF);
}

export function recurseImmediateOp(vm: VM): void {
  if (vm.compile.entryCell === -1) {
    throw new SyntaxError('RECURSE outside definition', getStackData(vm));
  }

  const entryInfo = getDictionaryEntryInfo(vm, vm.compile.entryCell);
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
