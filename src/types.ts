import { VM } from "./vm";

/**
 * A function that operates on the VM.
 */
export type Verb = (vm: VM) => void;

/**
 * Represents a memory cell, which can be a number, string, object, or Verb.
 */
export type Cell = number | string | object | Verb;

/**
 * Represents the memory of the VM.
 */
export type Memory = number[];

/**
 * Represents the heap for memory allocation.
 */
export type Heap = {
  start: number;
  size: number;
  freeList: number;
};
