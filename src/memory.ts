import { Cell, Ref } from "./types";

export function createHeap(size: number): Ref {
  return { data: Array(size).fill(0), base: 0, ofs: 0 };
}

export function allot(heap: Ref, size: number): Ref {
  const ref = { ...heap };
  ref.data = heap.data;
  ref.base = heap.ofs;
  ref.ofs = heap.ofs;
  heap.ofs += size;
  return ref;
}

export function mark(heap: Ref): Ref {
  return { ...heap };
}

export function getRef(src: Ref, ofs: number): Ref {
  return { data: src.data, base: src.base, ofs };
}

export function getData(ref: Ref, start: number, length: number): Cell[] {
  return ref.data.slice(ref.base + start, ref.base + start + length);
}

export function getItems(ref: Ref): Cell[] {
  return ref.data.slice(ref.base, ref.ofs);
}

export function setData(ref: Ref, start: number, values: Cell[]): void {
  for (let i = 0; i < values.length; i++) {
    ref.data[ref.base + start + i] = values[i];
  }
}

export function push(ref: Ref, value: Cell): void {
  ref.data[ref.ofs++] = value;
}

export function pop(ref: Ref): Cell {
  if (ref.ofs === ref.base) {
    throw new Error("Stack underflow");
  }
  return ref.data[--ref.ofs];
}

export function reset(ref: Ref): void {
  ref.ofs = ref.base;
}

export function next(ref: Ref): Cell {
  return ref.data[ref.ofs++];
}

