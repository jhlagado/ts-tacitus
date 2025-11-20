// Stable facade for core exports. Keep minimal to avoid cycles.
export { VM, createVM } from './vm';
export {
  type Memory,
  createMemory,
  memoryResolveAddress,
  memoryWrite8,
  memoryRead8,
  memoryWrite16,
  memoryRead16,
  memoryWriteFloat32,
  memoryReadFloat32,
  memoryWriteCell,
  memoryReadCell,
  memoryDump,
  memoryDumpChars,
} from './memory';
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
export {
  type Digest,
  createDigest,
  digestAdd,
  digestLength,
  digestGet,
  digestRemainingSpace,
  digestFind,
  digestIntern,
} from '../strings/digest';
