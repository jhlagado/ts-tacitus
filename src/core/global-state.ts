/**
 * @file src/core/global-state.ts
 * Compatibility shim for legacy imports in tests and tooling.
 *
 * Deprecated: Runtime wiring now lives in `src/lang/runtime.ts`.
 * Production code should import `{ vm, initializeInterpreter }` from `src/lang/runtime`.
 */
export { vm, initializeInterpreter } from '../lang/runtime';

