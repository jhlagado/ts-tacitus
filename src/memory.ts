import { Cell, Ref } from "./types";

export function createHeap(size: number): Ref {
  return { data: Array(size).fill(0), initOfs: 0, ofs: 0 };
}

export function allot(heap: Ref, size: number): Ref {
  const ref = { ...heap };
  ref.data = heap.data;
  ref.initOfs = heap.ofs;
  ref.ofs = heap.ofs;
  heap.ofs += size;
  return ref;
}

export function free(heap: Ref, size: number): Ref {
  const ref = { ...heap };
  heap.ofs -= size;
  return ref;
}

export function mark(heap: Ref): Ref {
  return { ...heap };
}

export function getRef(src: Ref, ofs: number): Ref {
  return { data: src.data, initOfs: ofs, ofs };
}

export function setRef(src: Ref, ref: Ref): void {
  ref.ofs = src.ofs;
}

export function forget(heap: Ref, mark: Ref) {
  const size = heap.ofs - mark.ofs;
  heap.ofs = mark.ofs;
  return size;
}

export function get(ref: Ref): Cell {
  return ref.data[ref.ofs];
}

export function getData(ref: Ref, start: number, end: number): Cell {
  return ref.data.slice(ref.initOfs + start, ref.initOfs + end);
}

export function set(ref: Ref, value: Cell): void {
  ref.data[ref.ofs] = value;
}

export function setData(ref: Ref, start: number, values: Cell[]): void {
  for (let i = 0; i < values.length; i++) {
    ref.data[ref.initOfs + start + i] = values[i];
  }
}

export function push(ref: Ref, value: Cell): void {
  ref.data[ref.ofs++] = value;
}

export function pop(ref: Ref): Cell {
  if (ref.ofs === ref.initOfs) {
    throw new Error("Stack underflow");
  }
  return ref.data[--ref.ofs];
}

export function peek(ref: Ref): Cell {
  return ref.data[ref.ofs];
}

export function reset(ref: Ref): void {
  ref.ofs = ref.initOfs;
}

export function getItems(ref: Ref): Cell[] {
  return ref.data.slice(ref.initOfs, ref.ofs);
}
