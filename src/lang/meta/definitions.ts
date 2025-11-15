import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { push, type VM } from '../../core/vm';
import { beginDefinition } from '../definitions';
import type { Tokenizer } from '../tokenizer';

const ENDDEF_CODE_REF = createBuiltinRef(Op.EndDefinition);

export function beginDefinitionImmediate(
  vm: VM,
  tokenizer: Tokenizer,
): void {
  beginDefinition(vm, tokenizer);
  push(vm, ENDDEF_CODE_REF);
}
