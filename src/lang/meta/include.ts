import { NIL, SyntaxError } from '@src/core';
import type { VM } from '../../core/vm';
import { getStackData } from '../../core/vm';
import {
  define,
  findEntryByName,
  getDictionaryEntryInfo,
  hideDictionaryEntry,
  setDictionaryEntryPayload,
  unhideDictionaryEntry,
} from '../../core/dictionary';
import { createTokenizer, TokenType, tokenizerNext } from '../tokenizer';
import { parse } from '../parser';
import { ensureTokenizer } from '../helpers/tokenizer-utils';

export function includeImmediateOp(vm: VM): void {
  const tokenizer = ensureTokenizer(vm, 'include');
  const next = tokenizerNext(tokenizer);
  if (next.type !== TokenType.STRING) {
    throw new SyntaxError('include expects a literal string path', getStackData(vm));
  }

  const target = next.value as string;
  const host = vm.compile.includeHost;
  if (!host) {
    throw new SyntaxError('include requires a host resolver', getStackData(vm));
  }

  const currentSource = vm.compile.currentSource ?? null;
  const { canonicalPath, source } = host.resolveInclude(target, currentSource);
  if (!canonicalPath || source === undefined) {
    throw new SyntaxError('include host returned invalid data', getStackData(vm));
  }

  const existing = findEntryByName(vm, canonicalPath);
  if (existing) {
    // Smudged (hidden) means in-progress: skip to avoid circular include.
    if (existing.hidden) {
      return;
    }
    // Already complete: pragma-once behaviour.
    return;
  }

  // Create smudged placeholder global for this canonical path.
  define(vm, canonicalPath, NIL);
  const includeEntry = vm.compile.head;
  hideDictionaryEntry(vm, includeEntry);

  // Parse the child file in-place without resetting compiler or emitting Abort.
  const childTokenizer = createTokenizer(source);
  parse(vm, childTokenizer, { resetCompiler: false, emitAbort: false, sourceName: canonicalPath });

  // Entry point is the payload of the most recent dictionary entry.
  if (vm.compile.head === includeEntry) {
    throw new SyntaxError('include produced no definitions', getStackData(vm));
  }
  const entryPointPayload = getDictionaryEntryInfo(vm, vm.compile.head).payload;
  setDictionaryEntryPayload(vm, includeEntry, entryPointPayload);
  unhideDictionaryEntry(vm, includeEntry);
}
