export interface TupleInfo {
  start: number;       // Start address of the tuple (TUPLE tag) in bytes
  end: number;         // End address of the tuple (after LINK tag) in bytes
  size: number;        // Number of elements in the tuple (excluding TUPLE and LINK tags)
  totalSize: number;   // Total size in bytes including TUPLE tag and LINK tag
  linkOffset: number;  // Offset of the LINK tag from the start of the tuple
}

export type StackArgInfo = [number, number]; // [offset, size]
