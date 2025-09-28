/**
 * @file src/lang/compiler-hooks.ts
 * Provides hook registration for compiler-time operations that need to be invoked from VM opcodes.
 */

let endDefinitionHandler: (() => void) | null = null;

/**
 * Registers the handler that finalises a colon definition when `enddef` executes.
 */
export function setEndDefinitionHandler(handler: () => void): void {
  endDefinitionHandler = handler;
}

/**
 * Invokes the registered end-definition handler.
 * Throws if no handler has been registered.
 */
export function invokeEndDefinitionHandler(): void {
  if (!endDefinitionHandler) {
    throw new Error('End-definition handler not installed');
  }
  endDefinitionHandler();
}
