export type Verb = () => void;

export type Cell = number | string | object | Verb;

export type Heap = Cell[];

export type Dictionary<T = Verb> = { [name: string]: T };

export type Ref = { data: Cell[]; base: number; ofs: number };

export type VM = {
  dictionary: Dictionary<Verb>;
  heap: Ref;
  stack: Ref;
  rstack: Ref;
  buffer: Ref;
  compileBuffer: Ref;
  IP: Ref;
  compileMode: boolean;
  nestingScore: number;
  running: boolean;
};
