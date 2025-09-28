import { createBuiltinRef } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { vm } from '../runtime';
import { setEndDefinitionHandler } from '../compiler-hooks';
import { beginDefinition, endDefinition } from '../definitions';
import { requireParserState } from '../state';

const ENDDEF_CODE_REF = createBuiltinRef(Op.EndDefinition);

setEndDefinitionHandler(() => endDefinition(requireParserState()));

export function beginDefinitionImmediate(): void {
  const state = requireParserState();
  beginDefinition(state);
  vm.push(ENDDEF_CODE_REF);
}
