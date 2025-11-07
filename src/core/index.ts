// Stable facade for core exports. Keep minimal to avoid cycles.
export { VM, createVM } from './vm';
export { Memory } from './memory';
export * from './constants';
export * from './tagged';
export * from './refs';
export * from './errors';
export * from './utils';
export * from './types';
export * from './list';
export * from './format-utils';
export * from './code-ref';
export * from './global-heap';
