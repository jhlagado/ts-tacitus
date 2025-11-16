/**
 * Feature flag utilities for language-layer experiments.
 *
 * Each helper inspects process.env at call time so tests and callers
 * can toggle behaviour dynamically.
 */

const TACIT_COMPILE_LOOP_ENV = 'TACIT_COMPILE_LOOP';

/**
 * Returns true when the Tacit compile loop prototype should be invoked.
 * Enable by setting `TACIT_COMPILE_LOOP=1` in the environment.
 */
export function shouldUseTacitCompileLoop(): boolean {
  return process.env[TACIT_COMPILE_LOOP_ENV] === '1';
}
