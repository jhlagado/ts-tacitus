import { VM } from "./vm";

/**
 * A function that operates on the VM.
 */
export type Verb = (vm: VM) => void;

/**
 * Represents the heap for memory allocation.
 */
export type Heap = {
  start: number;
  size: number;
  freeList: number;
};
