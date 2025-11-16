import type { Verb } from '@src/core';

type LangBridgeHandlers = {
  tokenNext: Verb;
  emitNumber: Verb;
  emitString: Verb;
  handleSpecial: Verb;
  emitWord: Verb;
  emitRefSigil: Verb;
  finalizeCompile: Verb;
  unexpectedToken: Verb;
};

function createMissingHandler(name: string): Verb {
  return () => {
    throw new Error(`Language bridge handler '${name}' not installed`);
  };
}

const missingHandlers: LangBridgeHandlers = {
  tokenNext: createMissingHandler('token-next'),
  emitNumber: createMissingHandler('emit-number'),
  emitString: createMissingHandler('emit-string'),
  handleSpecial: createMissingHandler('handle-special'),
  emitWord: createMissingHandler('emit-word'),
  emitRefSigil: createMissingHandler('emit-ref-sigil'),
  finalizeCompile: createMissingHandler('finalize-compile'),
  unexpectedToken: createMissingHandler('unexpected-token'),
};

let activeHandlers: LangBridgeHandlers = missingHandlers;

export function installLangBridgeHandlers(handlers: LangBridgeHandlers): void {
  activeHandlers = handlers;
}

export function getLangBridgeHandlers(): LangBridgeHandlers {
  return activeHandlers;
}
