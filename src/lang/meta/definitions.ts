import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { push, type VM } from '../../core/vm';
import { beginDefinition } from '../definitions';
import type { Tokenizer } from '../tokenizer';
import type { ActiveDefinition } from '../state';

const ENDDEF_CODE_REF = createBuiltinRef(Op.EndDefinition);

export function beginDefinitionImmediate(
  vm: VM,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  beginDefinition(vm, tokenizer, currentDefinition);
  push(vm, ENDDEF_CODE_REF);
}
