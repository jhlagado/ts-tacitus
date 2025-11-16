import { Tagged, Tag, type VM } from '@src/core';
import { define } from '@src/core/dictionary';
import { Op } from '../ops/opcodes';
import { installLangBridgeHandlers } from '../ops/lang-bridge';
import {
  beginDefinitionImmediate,
  beginIfImmediate,
  beginElseImmediate,
  beginMatchImmediate,
  beginWithImmediate,
  beginCaseImmediate,
  clauseDoImmediate,
  beginCapsuleImmediate,
  registerImmediateHandler,
  resetImmediateHandlers,
  semicolonImmediate,
  recurseImmediate,
  type ImmediateHandler,
} from './meta';
import { tokenNextOp } from './meta/token-bridge';
import {
  emitNumberOp,
  emitStringOp,
  handleSpecialOp,
  emitWordOp,
  emitRefSigilOp,
  finalizeCompileOp,
  unexpectedTokenOp,
} from './meta/compiler-bridge';

type ImmediateSpec = {
  name: string;
  opcode: Op;
  handler?: ImmediateHandler;
};

function defineImmediate(vm: VM, spec: ImmediateSpec): void {
  const { name, opcode, handler } = spec;
  define(vm, name, Tagged(opcode, Tag.CODE, 1));
  if (handler) {
    registerImmediateHandler(opcode, handler);
  }
}

function defineBuiltin(vm: VM, name: string, opcode: Op): void {
  define(vm, name, Tagged(opcode, Tag.CODE, 0));
}

export function registerLanguageBuiltins(vm: VM): void {
  resetImmediateHandlers();

  const immediates: ImmediateSpec[] = [
    { name: ':', opcode: Op.BeginDefinitionImmediate, handler: beginDefinitionImmediate },
    { name: ';', opcode: Op.SemicolonImmediate, handler: semicolonImmediate },
    { name: 'recurse', opcode: Op.RecurseImmediate, handler: recurseImmediate },
    { name: 'if', opcode: Op.BeginIfImmediate, handler: beginIfImmediate },
    { name: 'else', opcode: Op.BeginElseImmediate, handler: beginElseImmediate },
    { name: 'match', opcode: Op.BeginMatchImmediate, handler: beginMatchImmediate },
    { name: 'with', opcode: Op.BeginWithImmediate, handler: beginWithImmediate },
    { name: 'case', opcode: Op.BeginCaseImmediate, handler: beginCaseImmediate },
    { name: 'do', opcode: Op.ClauseDoImmediate, handler: clauseDoImmediate },
    { name: 'capsule', opcode: Op.BeginCapsuleImmediate, handler: beginCapsuleImmediate },
    { name: 'DEFAULT', opcode: Op.Nop },
    { name: 'NIL', opcode: Op.Nop },
  ];

  for (const spec of immediates) {
    defineImmediate(vm, spec);
  }

  defineBuiltin(vm, 'token-next', Op.TokenNext);
  defineBuiltin(vm, 'sentinel-encode', Op.SentinelEncode);
  defineBuiltin(vm, 'emit-number', Op.EmitNumberWord);
  defineBuiltin(vm, 'emit-string', Op.EmitStringWord);
  defineBuiltin(vm, 'handle-special', Op.HandleSpecialWord);
  defineBuiltin(vm, 'emit-word', Op.EmitWordCall);
  defineBuiltin(vm, 'emit-symbol', Op.EmitSymbolWord);
  defineBuiltin(vm, 'emit-ref-sigil', Op.EmitRefSigilWord);
  defineBuiltin(vm, 'finalize-compile', Op.FinalizeCompile);
  defineBuiltin(vm, 'unexpected-token', Op.UnexpectedTokenWord);

  installLangBridgeHandlers({
    tokenNext: tokenNextOp,
    emitNumber: emitNumberOp,
    emitString: emitStringOp,
    handleSpecial: handleSpecialOp,
    emitWord: emitWordOp,
    emitRefSigil: emitRefSigilOp,
    finalizeCompile: finalizeCompileOp,
    unexpectedToken: unexpectedTokenOp,
  });
}
