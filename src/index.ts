// Public embedding surface (optional)
export * as core from './core';
export * as strings from './strings';
export * as lang from './lang/runtime';
export * as ops from './ops';
// Convenience re-exports for REPL helpers
export { executeLine, setupInterpreter } from './lang/executor';
