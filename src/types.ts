import { VM } from "./vm";

export type Verb = (vm: VM) => void;
export type Cell = number | string | object | Verb;
export type Heap = Cell[];
export type Dictionary<T = Verb> = { [name: string]: T };
export type Ref = { data: Cell[]; base: number; ofs: number };
