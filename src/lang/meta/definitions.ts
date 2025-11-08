import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import type { VM } from '../../core/vm';
import { push } from '../../core/vm';
import { setEndDefinitionHandler } from '../compiler-hooks';
import { beginDefinition, endDefinition } from '../definitions';
import { requireParserState } from '../state';

const ENDDEF_CODE_REF = createBuiltinRef(Op.EndDefinition);

setEndDefinitionHandler(() => {
 endDefinition(requireParserState());
});

export function beginDefinitionImmediate(vm: VM): void {
  const state = requireParserState();
  beginDefinition(vm, state);
  push(vm, ENDDEF_CODE_REF);
}
