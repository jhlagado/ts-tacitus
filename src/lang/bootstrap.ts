import { Tagged, Tag, type VM } from '@src/core';
import { define } from '@src/core/dictionary';
import { Op } from '../ops/opcodes';
import { installLangBridgeHandlers } from '../ops/lang-bridge';
import { shouldUseTacitCompileLoop } from './feature-flags';
import { parse } from './parser';
import { Tokenizer } from './tokenizer';

function resetCompilerState(vm: VM): void {
  vm.compiler.CP = 0;
  vm.compiler.BCP = 0;
  vm.compiler.preserve = false;
  vm.compiler.isInFunction = false;
  vm.compiler.reservePatchAddr = -1;
}
import {
  beginDefinitionImmediateOp,
  beginIfImmediateOp,
  beginElseImmediateOp,
  beginMatchImmediateOp,
  beginWithImmediateOp,
  beginCaseImmediateOp,
  clauseDoImmediateOp,
  beginCapsuleImmediateOp,
  registerImmediateHandler,
  resetImmediateHandlers,
  semicolonImmediateOp,
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
  runTacitCompileLoopOp,
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
    { name: ':', opcode: Op.BeginDefinitionImmediate },
    { name: ';', opcode: Op.SemicolonImmediate },
    { name: 'recurse', opcode: Op.RecurseImmediate, handler: recurseImmediate },
    { name: 'if', opcode: Op.BeginIfImmediate },
    { name: 'else', opcode: Op.BeginElseImmediate },
    { name: 'match', opcode: Op.BeginMatchImmediate },
    { name: 'with', opcode: Op.BeginWithImmediate },
    { name: 'case', opcode: Op.BeginCaseImmediate },
    { name: 'do', opcode: Op.ClauseDoImmediate },
    { name: 'capsule', opcode: Op.BeginCapsuleImmediate },
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
    runCompileLoop: runTacitCompileLoopOp,
  });

  if (shouldUseTacitCompileLoop()) {
    defineBuiltin(vm, 'compile-loop', Op.RunTacitCompileLoop);
  } else {
    parse(vm, new Tokenizer(': compile-loop 0 ;'));
  }

  resetCompilerState(vm);
}
