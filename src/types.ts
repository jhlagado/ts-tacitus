// src/types.ts

import { VM } from "./vm";

export type Verb = (vm: VM) => void;
export type Cell = number | string | object | Verb;
export type Dictionary<T = Verb> = { [name: string]: T };

// Memory type
export type Memory = {
  data: number[]; // Memory array
};

// Heap type
export type Heap = {
  start: number; // Start of the heap in blocks
  size: number; // Size of the heap in blocks
  freeList: number; // Pointer to the head of the free list
};

